"use server"

import { createAdminClient } from "@/lib/supabase-server"
import { redirect } from "next/navigation"
import { revalidatePath } from "next/cache"
import { createNotification } from "@/lib/notifications"
import { getManagerUserIds } from "@/lib/notifications"

export async function deleteJob(jobId: string) {
  const supabase = await createAdminClient()

  // Delete job and all related records (cascading should handle this)
  const { error } = await supabase.from("jobs").delete().eq("id", jobId)

  if (error) {
    throw new Error(`Failed to delete job: ${error.message}`)
  }

  revalidatePath("/manager/jobs")
  redirect("/manager/jobs")
}

export async function createJobEditNotifications(
  jobId: string,
  jobTitle: string,
  changes: string[],
  technicianIds: string[],
  organizationId: string,
) {
  console.log("[v0] createJobEditNotifications called", { jobId, jobTitle, changes, technicianIds, organizationId })

  try {
    if (changes.length === 0) {
      console.log("[v0] No changes detected, skipping notifications")
      return
    }

    const changesSummary = changes.join(", ")

    // Notify all managers in the organization
    const managerIds = await getManagerUserIds(organizationId)
    console.log("[v0] Notifying managers:", managerIds)

    for (const managerId of managerIds) {
      await createNotification({
        recipientId: managerId,
        type: "job_updated",
        title: "Job Updated",
        message: `Job "${jobTitle}" was updated. Changes: ${changesSummary}`,
        relatedJobId: jobId,
      })
    }

    // Notify all assigned technicians
    console.log("[v0] Notifying technicians:", technicianIds)
    for (const technicianId of technicianIds) {
      await createNotification({
        recipientId: technicianId,
        type: "job_updated",
        title: "Job Updated",
        message: `Job "${jobTitle}" was updated. Changes: ${changesSummary}`,
        relatedJobId: jobId,
      })
    }

    console.log("[v0] Job edit notifications created successfully")
  } catch (error) {
    console.error("[v0] Error creating job edit notifications:", error)
  }
}

export async function createStatusChangeNotifications(jobId: string, jobTitle: string, technicianIds: string[]) {
  console.log("[v0] createStatusChangeNotifications called", { jobId, jobTitle, technicianIds })

  try {
    // Notify all assigned technicians
    for (const technicianId of technicianIds) {
      await createNotification({
        recipientId: technicianId,
        type: "job_completed",
        title: "Job Completed",
        message: `Job "${jobTitle}" has been marked as completed`,
        relatedJobId: jobId,
      })
      console.log("[v0] Created notification for technician:", technicianId)
    }

    console.log("[v0] Status change notifications created successfully")
  } catch (error) {
    console.error("[v0] Error creating status change notifications:", error)
  }
}
