"use server"

import { createClient } from "./supabase-server"
import { getJobDetail, getCurrentUser } from "./db"

interface CalendarResult {
  success: boolean
  error?: string
  details?: Record<string, any>
}

/**
 * Helper: Exchange the permanent Refresh Token for a temporary Access Token
 */
async function getAccessToken(): Promise<string | null> {
  const refreshToken = process.env.GOOGLE_REFRESH_TOKEN
  const clientId = process.env.GOOGLE_CLIENT_ID
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET

  if (!refreshToken || !clientId || !clientSecret) {
    console.error("[v0] Missing Google OAuth credentials in environment variables")
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

    if (!response.ok) {
      console.error("[v0] Failed to refresh access token:", data)
      return null
    }

    return data.access_token
  } catch (error) {
    console.error("[v0] Error refreshing access token:", error)
    return null
  }
}

/**
 * Create Google Calendar events for a job
 */
export async function createCalendarInviteForJob(jobId: string, technicianIds: string[]): Promise<CalendarResult> {
  console.log("[v0] createCalendarInviteForJob called", { jobId, technicianIds })

  if (!technicianIds || technicianIds.length === 0) {
    return { success: true, details: { message: "No technicians to create events for" } }
  }

  try {
    const currentUser = await getCurrentUser()
    if (!currentUser?.organization_id) {
      return { success: false, error: "Unable to determine organization" }
    }

    // FIX 1: Handle the nested structure from getJobDetail
    const jobData = await getJobDetail(jobId, currentUser.organization_id)
    if (!jobData || !jobData.job) {
      return { success: false, error: "Job not found" }
    }

    // Extract the actual job object and units
    const job = jobData.job
    const equipmentList = jobData.units || []

    const accessToken = await getAccessToken()
    if (!accessToken) {
      return { success: false, error: "Failed to generate Google Access Token" }
    }

    const supabase = await createClient()

    // Get technician details
    const { data: technicians, error: techError } = await supabase
      .from("users")
      .select("id, full_name, email")
      .in("id", technicianIds)

    if (techError || !technicians) {
      console.error("[v0] Error fetching technicians:", techError)
      return { success: false, error: "Failed to fetch technician details" }
    }

    const results: Record<string, any> = {}

    for (const tech of technicians) {
      if (!tech.email) {
        results[tech.id] = { success: false, error: "No email for technician" }
        continue
      }

      try {
        // Build event description
        let description = `Job: ${job.title || "Untitled Job"}\n`
        description += `Job Number: ${job.job_number}\n`
        description += `Customer: ${job.customer_name || "N/A"}\n`

        // Add site information
        if (job.site_locations && job.site_locations.length > 0) {
          description += `\nSites:\n`
          job.site_locations.forEach((site: any) => {
            description += `- ${site.service_location_name || "Unknown Site"}\n`
            if (site.service_location_address) {
              description += `  ${site.service_location_address}`
              if (site.service_location_city) description += `, ${site.service_location_city}`
              if (site.service_location_state) description += `, ${site.service_location_state}`
              if (site.service_location_zip_code) description += ` ${site.service_location_zip_code}`
              description += `\n`
            }
            if (site.site_notes) {
              description += `  Notes: ${site.site_notes}\n`
            }
          })
        }

        // FIX 2: Use the correctly extracted 'equipmentList' and correct variable names
        if (equipmentList.length > 0) {
          description += `\nEquipment:\n`
          equipmentList.forEach((eq: any) => {
            description += `- ${eq.equipment_name || "Unknown Equipment"}`
            // DB returns 'serial_number', not 'equipment_serial_number'
            if (eq.serial_number) description += ` (S/N: ${eq.serial_number})`
            description += `\n`
            if (eq.unit_notes) {
              description += `  Notes: ${eq.unit_notes}\n`
            }
          })
        }

        if (job.internal_notes) {
          description += `\nInternal Notes: ${job.internal_notes}\n`
        }

        description += `\nScheduled by: schedule@unitedpws.com`

        const startTime = job.scheduled_start ? new Date(job.scheduled_start).toISOString() : new Date().toISOString()
        const endTime = job.scheduled_end
          ? new Date(job.scheduled_end).toISOString()
          : new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString()

        const iCalUID = `job-${jobId}-tech-${tech.id}@unitedpws.com`

        const eventPayload = {
          summary: `${job.job_number}: ${job.title || "Job"}`,
          description,
          start: {
            dateTime: startTime,
            timeZone: "America/New_York",
          },
          end: {
            dateTime: endTime,
            timeZone: "America/New_York",
          },
          iCalUID,
          extendedProperties: {
            private: {
              jobId: jobId,
              technicianId: tech.id,
            },
          },
        }

        const calendarId = encodeURIComponent(tech.email)
        const response = await fetch(
          `https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events?sendUpdates=none`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${accessToken}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify(eventPayload),
          },
        )

        if (!response.ok) {
          const errorText = await response.text()
          console.error(`[v0] Failed to create event for ${tech.email}:`, errorText)
          results[tech.id] = {
            success: false,
            error: `Calendar API error: ${response.status}`,
          }
          continue
        }

        const eventData = await response.json()
        console.log(`[v0] CREATED event for ${tech.email}: ${eventData.id}`)

        const { error: updateError } = await supabase
          .from("job_technicians")
          .update({
            google_event_id: eventData.id,
            google_calendar_id: tech.email,
          })
          .eq("job_id", jobId)
          .eq("technician_id", tech.id)

        if (updateError) {
          console.error("[v0] Error storing event ID:", updateError)
        }

        results[tech.id] = { success: true, eventId: eventData.id }
      } catch (error) {
        console.error(`[v0] Error creating event for technician ${tech.id}:`, error)
        results[tech.id] = { success: false, error: error instanceof Error ? error.message : "Unknown error" }
      }
    }

    return { success: true, details: results }
  } catch (error) {
    console.error("[v0] Error in createCalendarInviteForJob:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to create calendar invites",
    }
  }
}

/**
 * Update Google Calendar events for a job
 */
export async function updateCalendarInviteForJob(jobId: string, newTechnicianIds: string[]): Promise<CalendarResult> {
  console.log("[v0] updateCalendarInviteForJob called", { jobId, newTechnicianIds })

  try {
    const supabase = await createClient()

    const { data: existingTechs, error: existingError } = await supabase
      .from("job_technicians")
      .select("technician_id, google_event_id, google_calendar_id")
      .eq("job_id", jobId)

    if (existingError) {
      return { success: false, error: "Failed to fetch existing technician assignments" }
    }

    const existingTechIds = (existingTechs || []).map((t) => t.technician_id)
    const techsToRemove = existingTechIds.filter((id) => !newTechnicianIds.includes(id))
    const techsToAdd = newTechnicianIds.filter((id) => !existingTechIds.includes(id))
    const techsToUpdate = existingTechIds.filter((id) => newTechnicianIds.includes(id))

    const accessToken = await getAccessToken()
    if (!accessToken) {
      return { success: false, error: "Failed to generate Google Access Token" }
    }

    // Delete events for removed technicians
    for (const techId of techsToRemove) {
      const tech = existingTechs?.find((t) => t.technician_id === techId)
      if (tech?.google_event_id && tech?.google_calendar_id) {
        try {
          const calendarId = encodeURIComponent(tech.google_calendar_id)
          await fetch(
            `https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events/${tech.google_event_id}?sendUpdates=none`,
            {
              method: "DELETE",
              headers: { Authorization: `Bearer ${accessToken}` },
            },
          )
          console.log(`[v0] DELETED event for removed technician ${techId}`)
        } catch (error) {
          console.error(`[v0] Error deleting event:`, error)
        }
      }
    }

    // Update events for existing technicians
    const currentUser = await getCurrentUser()
    if (!currentUser?.organization_id) return { success: false, error: "Unable to determine organization" }

    // FIX 3: Apply nested structure fix here too
    const jobData = await getJobDetail(jobId, currentUser.organization_id)
    if (!jobData || !jobData.job) return { success: false, error: "Job not found" }
    
    const job = jobData.job
    const equipmentList = jobData.units || []

    for (const techId of techsToUpdate) {
      const tech = existingTechs?.find((t) => t.technician_id === techId)
      if (tech?.google_event_id && tech?.google_calendar_id) {
        try {
          let description = `Job: ${job.title || "Untitled Job"}\n`
          description += `Job Number: ${job.job_number}\n`
          description += `Customer: ${job.customer_name || "N/A"}\n`

          if (job.site_locations && job.site_locations.length > 0) {
            description += `\nSites:\n`
            job.site_locations.forEach((site: any) => {
              description += `- ${site.service_location_name || "Unknown Site"}\n`
              if (site.service_location_address) {
                description += `  ${site.service_location_address}\n`
              }
            })
          }

          if (equipmentList.length > 0) {
            description += `\nEquipment:\n`
            equipmentList.forEach((eq: any) => {
              description += `- ${eq.equipment_name || "Unknown Equipment"}`
              if (eq.serial_number) description += ` (S/N: ${eq.serial_number})`
              description += `\n`
            })
          }

          if (job.internal_notes) {
            description += `\nInternal Notes: ${job.internal_notes}\n`
          }
          
          description += `\nScheduled by: schedule@unitedpws.com`

          const startTime = job.scheduled_start ? new Date(job.scheduled_start).toISOString() : new Date().toISOString()
          const endTime = job.scheduled_end ? new Date(job.scheduled_end).toISOString() : new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString()

          const eventPayload = {
            summary: `${job.job_number}: ${job.title || "Job"}`,
            description,
            start: { dateTime: startTime, timeZone: "America/New_York" },
            end: { dateTime: endTime, timeZone: "America/New_York" },
          }

          const calendarId = encodeURIComponent(tech.google_calendar_id)
          await fetch(
            `https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events/${tech.google_event_id}?sendUpdates=none`,
            {
              method: "PATCH",
              headers: {
                Authorization: `Bearer ${accessToken}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify(eventPayload),
            },
          )
          console.log(`[v0] PATCHED event for technician ${techId}`)
        } catch (error) {
          console.error(`[v0] Error updating event for technician ${techId}:`, error)
        }
      }
    }

    if (techsToAdd.length > 0) {
      await createCalendarInviteForJob(jobId, techsToAdd)
    }

    return { success: true }
  } catch (error) {
    console.error("[v0] Error in updateCalendarInviteForJob:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to update calendar invites",
    }
  }
}
