"use server"

import { createClient } from "./supabase-server"
import { getJobDetail, getCurrentUser } from "./db"

interface CalendarResult {
  success: boolean
  error?: string
  details?: Record<string, any>
}

/**
 * Create Google Calendar events for a job
 * Creates one event per technician on their individual calendar
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

    // Fetch job details with organizationId
    const job = await getJobDetail(jobId, currentUser.organization_id)
    if (!job) {
      return { success: false, error: "Job not found" }
    }

    // Get Google API credentials
    const accessToken = process.env.GOOGLE_API_KEY || process.env.GOOGLE_REFRESH_TOKEN
    if (!accessToken) {
      return { success: false, error: "Google Calendar API credentials not configured" }
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

    // Create events for each technician
    const results: Record<string, any> = {}

    for (const tech of technicians) {
      if (!tech.email) {
        results[tech.id] = { success: false, error: "No email for technician" }
        continue
      }

      try {
        // Build event description with job details
        let description = `Job: ${job.title}\n`
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

        // Add equipment information
        if (job.equipment && job.equipment.length > 0) {
          description += `\nEquipment:\n`
          job.equipment.forEach((eq: any) => {
            description += `- ${eq.equipment_name || "Unknown Equipment"}`
            if (eq.equipment_serial_number) description += ` (S/N: ${eq.equipment_serial_number})`
            description += `\n`
            if (eq.unit_notes) {
              description += `  Notes: ${eq.unit_notes}\n`
            }
          })
        }

        // Add internal notes
        if (job.internal_notes) {
          description += `\nInternal Notes: ${job.internal_notes}\n`
        }

        description += `\nScheduled by: schedule@unitedpws.com`

        // Build event payload
        const startTime = job.scheduled_start ? new Date(job.scheduled_start).toISOString() : new Date().toISOString()
        const endTime = job.scheduled_end
          ? new Date(job.scheduled_end).toISOString()
          : new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString()

        // Deterministic iCalUID for recovery
        const iCalUID = `job-${jobId}-tech-${tech.id}@unitedpws.com`

        const eventPayload = {
          summary: `${job.job_number}: ${job.title}`,
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

        // Create event on technician's calendar
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
            error: `Calendar API error: ${response.status}. Technician may need to share calendar with schedule@unitedpws.com (Make changes to events permission)`,
          }
          continue
        }

        const eventData = await response.json()
        console.log(`[v0] CREATED event for ${tech.email}: ${eventData.id}`)

        // Store event ID in job_technicians table
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

    // Check if all failed
    const allFailed = Object.values(results).every((r: any) => !r.success)
    if (allFailed) {
      return {
        success: false,
        error:
          "Failed to create any calendar events. Technicians may need to share calendars with schedule@unitedpws.com",
        details: results,
      }
    }

    // Check if some failed
    const someFailed = Object.values(results).some((r: any) => !r.success)
    if (someFailed) {
      return {
        success: true,
        error: "Some calendar events failed to create",
        details: results,
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
 * Handles adding new technicians, removing old ones, and updating existing events
 */
export async function updateCalendarInviteForJob(jobId: string, newTechnicianIds: string[]): Promise<CalendarResult> {
  console.log("[v0] updateCalendarInviteForJob called", { jobId, newTechnicianIds })

  try {
    const supabase = await createClient()

    // Get existing job_technicians with event IDs
    const { data: existingTechs, error: existingError } = await supabase
      .from("job_technicians")
      .select("technician_id, google_event_id, google_calendar_id")
      .eq("job_id", jobId)

    if (existingError) {
      console.error("[v0] Error fetching existing technicians:", existingError)
      return { success: false, error: "Failed to fetch existing technician assignments" }
    }

    const existingTechIds = (existingTechs || []).map((t) => t.technician_id)
    const techsToRemove = existingTechIds.filter((id) => !newTechnicianIds.includes(id))
    const techsToAdd = newTechnicianIds.filter((id) => !existingTechIds.includes(id))
    const techsToUpdate = existingTechIds.filter((id) => newTechnicianIds.includes(id))

    console.log("[v0] Calendar update plan:", {
      techsToRemove: techsToRemove.length,
      techsToAdd: techsToAdd.length,
      techsToUpdate: techsToUpdate.length,
    })

    const accessToken = process.env.GOOGLE_API_KEY || process.env.GOOGLE_REFRESH_TOKEN
    if (!accessToken) {
      return { success: false, error: "Google Calendar API credentials not configured" }
    }

    // Delete events for removed technicians
    for (const techId of techsToRemove) {
      const tech = existingTechs?.find((t) => t.technician_id === techId)
      if (tech?.google_event_id && tech?.google_calendar_id) {
        try {
          const calendarId = encodeURIComponent(tech.google_calendar_id)
          const eventId = tech.google_event_id

          await fetch(
            `https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events/${eventId}?sendUpdates=none`,
            {
              method: "DELETE",
              headers: {
                Authorization: `Bearer ${accessToken}`,
              },
            },
          )
          console.log(`[v0] DELETED event for removed technician ${techId}`)
        } catch (error) {
          console.error(`[v0] Error deleting event for technician ${techId}:`, error)
        }
      }
    }

    // Update events for existing technicians
    const currentUser = await getCurrentUser()
    if (!currentUser?.organization_id) {
      return { success: false, error: "Unable to determine organization" }
    }

    const job = await getJobDetail(jobId, currentUser.organization_id)
    if (!job) {
      return { success: false, error: "Job not found" }
    }

    for (const techId of techsToUpdate) {
      const tech = existingTechs?.find((t) => t.technician_id === techId)
      if (tech?.google_event_id && tech?.google_calendar_id) {
        try {
          // Rebuild event description
          let description = `Job: ${job.title}\n`
          description += `Job Number: ${job.job_number}\n`
          description += `Customer: ${job.customer_name || "N/A"}\n`

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

          if (job.equipment && job.equipment.length > 0) {
            description += `\nEquipment:\n`
            job.equipment.forEach((eq: any) => {
              description += `- ${eq.equipment_name || "Unknown Equipment"}`
              if (eq.equipment_serial_number) description += ` (S/N: ${eq.equipment_serial_number})`
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

          const eventPayload = {
            summary: `${job.job_number}: ${job.title}`,
            description,
            start: {
              dateTime: startTime,
              timeZone: "America/New_York",
            },
            end: {
              dateTime: endTime,
              timeZone: "America/New_York",
            },
          }

          const calendarId = encodeURIComponent(tech.google_calendar_id)
          const eventId = tech.google_event_id

          const response = await fetch(
            `https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events/${eventId}?sendUpdates=none`,
            {
              method: "PATCH",
              headers: {
                Authorization: `Bearer ${accessToken}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify(eventPayload),
            },
          )

          if (response.ok) {
            console.log(`[v0] PATCHED event for technician ${techId}`)
          } else {
            const errorText = await response.text()
            console.error(`[v0] Failed to update event for technician ${techId}:`, errorText)
          }
        } catch (error) {
          console.error(`[v0] Error updating event for technician ${techId}:`, error)
        }
      }
    }

    // Create events for new technicians
    if (techsToAdd.length > 0) {
      const createResult = await createCalendarInviteForJob(jobId, techsToAdd)
      if (!createResult.success) {
        return {
          success: false,
          error: `Failed to create events for new technicians: ${createResult.error}`,
        }
      }
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
