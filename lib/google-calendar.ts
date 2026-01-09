"use server"

import { createClient } from "./supabase-server"
import { getJobDetail, getCurrentUser } from "./db"

interface CalendarResult {
  success: boolean
  error?: string
  details?: Record<string, any>
}

async function getAccessToken(): Promise<string | null> {
  const refreshToken = process.env.GOOGLE_REFRESH_TOKEN
  const clientId = process.env.GOOGLE_CLIENT_ID
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET

  if (!refreshToken || !clientId || !clientSecret) {
    console.error("[v0] Missing Google OAuth credentials")
    return null
  }

  try {
    const response = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
        grant_type: "refresh_token",
      }),
    })

    const data = await response.json()
    if (!response.ok) return null
    return data.access_token
  } catch (error) {
    console.error("[v0] Error refreshing access token:", error)
    return null
  }
}

export async function createCalendarInviteForJob(jobId: string, technicianIds: string[]): Promise<CalendarResult> {
  console.log("[v0] createCalendarInviteForJob called", { jobId, technicianIds })

  if (!technicianIds || technicianIds.length === 0) {
    return { success: true, details: { message: "No technicians to create events for" } }
  }

  try {
    const currentUser = await getCurrentUser()
    if (!currentUser?.organization_id) return { success: false, error: "Unable to determine organization" }

    // 1. Get the data correctly
    const jobData = await getJobDetail(jobId, currentUser.organization_id)
    if (!jobData || !jobData.job) return { success: false, error: "Job not found" }

    // 2. Extract the parts (This fixes the 'undefined' issue)
    const job = jobData.job
    const equipmentList = jobData.units || [] // Your DB calls them 'units', not 'equipment'

    const accessToken = await getAccessToken()
    if (!accessToken) return { success: false, error: "Failed to generate Google Access Token" }

    const supabase = await createClient()

    const { data: technicians, error: techError } = await supabase
      .from("users")
      .select("id, full_name, email")
      .in("id", technicianIds)

    if (techError || !technicians) return { success: false, error: "Failed to fetch technician details" }

    const results: Record<string, any> = {}

    for (const tech of technicians) {
      if (!tech.email) {
        results[tech.id] = { success: false, error: "No email for technician" }
        continue
      }

      try {
        let description = `Job: ${job.title || "Untitled Job"}\n`
        description += `Job Number: ${job.job_number}\n`
        description += `Customer: ${job.customer_name || "N/A"}\n`

        // SITES: Restored full address formatting
        if (job.site_locations?.length) {
          description += `\nSites:\n`
          job.site_locations.forEach((site: any) => {
            description += `- ${site.service_location_name || "Unknown Site"}\n`
            
            let addr = site.service_location_address || ""
            if (site.service_location_city) addr += `, ${site.service_location_city}`
            if (site.service_location_state) addr += `, ${site.service_location_state}`
            if (site.service_location_zip_code) addr += ` ${site.service_location_zip_code}`
            
            if (addr) description += `  ${addr}\n`
            if (site.site_notes) description += `  Notes: ${site.site_notes}\n`
          })
        }

        // EQUIPMENT: Restored Notes and Serial Number checks
        if (equipmentList.length > 0) {
          description += `\nEquipment:\n`
          equipmentList.forEach((eq: any) => {
            description += `- ${eq.equipment_name || "Unknown Equipment"}`
            // DB returns 'serial_number' (not equipment_serial_number)
            if (eq.serial_number) description += ` (S/N: ${eq.serial_number})`
            description += `\n`
            if (eq.unit_notes) description += `  Notes: ${eq.unit_notes}\n`
          })
        }

        if (job.internal_notes) description += `\nInternal Notes: ${job.internal_notes}\n`
        description += `\nScheduled by: schedule@unitedpws.com`

        // TIME: Fixed the "Time Range Empty" crash
        const startDate = job.scheduled_start ? new Date(job.scheduled_start) : new Date()
        let endDate: Date
        if (job.scheduled_end) {
          endDate = new Date(job.scheduled_end)
          if (endDate.getTime() <= startDate.getTime()) {
             endDate = new Date(startDate.getTime() + 60 * 60 * 1000)
          }
        } else {
          endDate = new Date(startDate.getTime() + 60 * 60 * 1000)
        }

        const eventPayload = {
          summary: `${job.job_number}: ${job.title || "Job"}`,
          description,
          start: { dateTime: startDate.toISOString(), timeZone: "America/New_York" },
          end: { dateTime: endDate.toISOString(), timeZone: "America/New_York" },
          iCalUID: `job-${jobId}-tech-${tech.id}@unitedpws.com`,
          extendedProperties: { private: { jobId: jobId, technicianId: tech.id } },
        }

        const calendarId = encodeURIComponent(tech.email)
        const response = await fetch(
          `https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events?sendUpdates=none`,
          {
            method: "POST",
            headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
            body: JSON.stringify(eventPayload),
          },
        )

        if (!response.ok) {
          const errorText = await response.text()
          console.error(`[v0] Failed to create event for ${tech.email}:`, errorText)
          results[tech.id] = { success: false, error: `Calendar API error: ${response.status}` }
          continue
        }

        const eventData = await response.json()
        console.log(`[v0] CREATED event for ${tech.email}: ${eventData.id}`)

        await supabase
          .from("job_technicians")
          .update({ google_event_id: eventData.id, google_calendar_id: tech.email })
          .eq("job_id", jobId)
          .eq("technician_id", tech.id)

        results[tech.id] = { success: true, eventId: eventData.id }
      } catch (error) {
        console.error(`[v0] Error creating event for technician ${tech.id}:`, error)
        results[tech.id] = { success: false, error: error instanceof Error ? error.message : "Unknown error" }
      }
    }
    return { success: true, details: results }
  } catch (error) {
    console.error("[v0] Error in createCalendarInviteForJob:", error)
    return { success: false, error: error instanceof Error ? error.message : "Failed" }
  }
}

export async function updateCalendarInviteForJob(jobId: string, newTechnicianIds: string[]): Promise<CalendarResult> {
  console.log("[v0] updateCalendarInviteForJob called", { jobId, newTechnicianIds })

  try {
    const supabase = await createClient()
    const { data: existingTechs } = await supabase
      .from("job_technicians")
      .select("technician_id, google_event_id, google_calendar_id")
      .eq("job_id", jobId)

    const existingTechIds = (existingTechs || []).map((t) => t.technician_id)
    const techsToRemove = existingTechIds.filter((id) => !newTechnicianIds.includes(id))
    const techsToAdd = newTechnicianIds.filter((id) => !existingTechIds.includes(id))
    const techsToUpdate = existingTechIds.filter((id) => newTechnicianIds.includes(id))

    const accessToken = await getAccessToken()
    if (!accessToken) return { success: false, error: "Failed token" }

    // Remove old events
    for (const techId of techsToRemove) {
      const tech = existingTechs?.find((t) => t.technician_id === techId)
      if (tech?.google_event_id && tech?.google_calendar_id) {
        try {
          const calendarId = encodeURIComponent(tech.google_calendar_id)
          await fetch(
            `https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events/${tech.google_event_id}?sendUpdates=none`,
            { method: "DELETE", headers: { Authorization: `Bearer ${accessToken}` } },
          )
        } catch (e) { console.error("Error deleting", e) }
      }
    }

    // Update existing events
    const currentUser = await getCurrentUser()
    if (currentUser?.organization_id) {
       const jobData = await getJobDetail(jobId, currentUser.organization_id)
       if (jobData?.job) {
          const job = jobData.job
          const equipmentList = jobData.units || []
          
          for (const techId of techsToUpdate) {
            const tech = existingTechs?.find((t) => t.technician_id === techId)
            if (tech?.google_event_id && tech?.google_calendar_id) {
               try {
                  let description = `Job: ${job.title || "Untitled Job"}\n`
                  description += `Job Number: ${job.job_number}\n`
                  description += `Customer: ${job.customer_name || "N/A"}\n`

                  if (job.site_locations?.length) {
                    description += `\nSites:\n`
                    job.site_locations.forEach((site: any) => {
                      description += `- ${site.service_location_name || "Unknown Site"}\n`
                      let addr = site.service_location_address || ""
                      if (site.service_location_city) addr += `, ${site.service_location_city}`
                      if (site.service_location_state) addr += `, ${site.service_location_state}`
                      if (site.service_location_zip_code) addr += ` ${site.service_location_zip_code}`
                      if (addr) description += `  ${addr}\n`
                      if (site.site_notes) description += `  Notes: ${site.site_notes}\n`
                    })
                  }

                  if (equipmentList.length > 0) {
                    description += `\nEquipment:\n`
                    equipmentList.forEach((eq: any) => {
                      description += `- ${eq.equipment_name || "Unknown Equipment"}`
                      if (eq.serial_number) description += ` (S/N: ${eq.serial_number})`
                      description += `\n`
                      if (eq.unit_notes) description += `  Notes: ${eq.unit_notes}\n`
                    })
                  }
                  
                  if (job.internal_notes) description += `\nInternal Notes: ${job.internal_notes}\n`
                  description += `\nScheduled by: schedule@unitedpws.com`

                  const startDate = job.scheduled_start ? new Date(job.scheduled_start) : new Date()
                  let endDate: Date
                  if (job.scheduled_end) {
                    endDate = new Date(job.scheduled_end)
                    if (endDate.getTime() <= startDate.getTime()) endDate = new Date(startDate.getTime() + 60 * 60 * 1000)
                  } else {
                    endDate = new Date(startDate.getTime() + 60 * 60 * 1000)
                  }

                  const eventPayload = {
                    summary: `${job.job_number}: ${job.title || "Job"}`,
                    description,
                    start: { dateTime: startDate.toISOString(), timeZone: "America/New_York" },
                    end: { dateTime: endDate.toISOString(), timeZone: "America/New_York" },
                  }

                  const calendarId = encodeURIComponent(tech.google_calendar_id)
                  await fetch(
                    `https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events/${tech.google_event_id}?sendUpdates=none`,
                    {
                      method: "PATCH",
                      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
                      body: JSON.stringify(eventPayload),
                    },
                  )
               } catch (e) { console.error("Error updating", e) }
            }
          }
       }
    }

    if (techsToAdd.length > 0) {
      await createCalendarInviteForJob(jobId, techsToAdd)
    }

    return { success: true }
  } catch (error) {
    return { success: false, error: "Failed" }
  }
}
