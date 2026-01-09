import { createAdminClient } from "@/lib/supabase-server"
import { NextResponse } from "next/server"
import { createNotifications, getManagerUserIds } from "@/lib/notifications"

export async function GET() {
  try {
    const supabase = await createAdminClient()

    // Get all jobs that are past their scheduled date by 2+ days and not completed/cancelled/overdue
    const twoDaysAgo = new Date()
    twoDaysAgo.setDate(twoDaysAgo.getDate() - 2)

    const { data: overdueJobs, error } = await supabase
      .from("jobs")
      .select("id, title, job_number, organization_id, scheduled_start")
      .lt("scheduled_start", twoDaysAgo.toISOString())
      .not("status", "in", '("completed","cancelled","overdue")')

    if (error) {
      console.error("[v0] Error fetching overdue jobs:", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    let updatedCount = 0

    // Update each job to overdue status and notify managers
    for (const job of overdueJobs || []) {
      const { error: updateError } = await supabase.from("jobs").update({ status: "overdue" }).eq("id", job.id)

      if (!updateError) {
        updatedCount++

        // Notify managers about overdue job
        const managerIds = await getManagerUserIds(job.organization_id, supabase)
        await createNotifications({
          organizationId: job.organization_id,
          recipientUserIds: managerIds,
          type: "job_overdue",
          message: `Job "${job.title || job.job_number}" is now overdue`,
          relatedEntityType: "job",
          relatedEntityId: job.id,
          supabase,
        })
      }
    }

    return NextResponse.json({
      success: true,
      checked: overdueJobs?.length || 0,
      updated: updatedCount,
    })
  } catch (error) {
    console.error("[v0] Error in overdue job check:", error)
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}
