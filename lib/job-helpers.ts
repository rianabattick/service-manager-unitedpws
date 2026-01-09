"use server"

import { createClient } from "./supabase-server"
import { createNotifications, getManagerUserIds } from "./notifications"

/**
 * Check and update jobs that are overdue (2+ days past scheduled date)
 * Returns the count of jobs updated
 */
export async function checkAndUpdateOverdueJobs(organizationId: string): Promise<number> {
  try {
    const supabase = await createClient()

    // Calculate 2 days ago
    const twoDaysAgo = new Date()
    twoDaysAgo.setDate(twoDaysAgo.getDate() - 2)

    // Find jobs that are past their scheduled date by 2+ days and not completed/cancelled/overdue
    const { data: overdueJobs, error } = await supabase
      .from("jobs")
      .select("id, title, job_number, scheduled_start")
      .eq("organization_id", organizationId)
      .lt("scheduled_start", twoDaysAgo.toISOString())
      .not("status", "in", '("completed","cancelled","overdue")')

    if (error) {
      console.error("[v0] Error fetching overdue jobs:", error)
      return 0
    }

    if (!overdueJobs || overdueJobs.length === 0) {
      return 0
    }

    let updatedCount = 0

    // Update each job to overdue status
    for (const job of overdueJobs) {
      const { error: updateError } = await supabase.from("jobs").update({ status: "overdue" }).eq("id", job.id)

      if (!updateError) {
        updatedCount++

        // Notify managers about overdue job
        const managerIds = await getManagerUserIds(organizationId, supabase)
        await createNotifications({
          organizationId,
          recipientUserIds: managerIds,
          type: "job_overdue",
          message: `Job "${job.title || job.job_number}" is now overdue`,
          relatedEntityType: "job",
          relatedEntityId: job.id,
          supabase,
        })
      }
    }

    console.log(`[v0] Updated ${updatedCount} jobs to overdue status`)
    return updatedCount
  } catch (error) {
    console.error("[v0] Error in checkAndUpdateOverdueJobs:", error)
    return 0
  }
}
