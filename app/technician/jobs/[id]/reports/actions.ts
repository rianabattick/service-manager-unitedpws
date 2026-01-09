"use server"

import { revalidatePath } from "next/cache"
import { createClient, createAdminClient } from "@/lib/supabase-server"
import { getCurrentUser } from "@/lib/db"
import { createNotifications, getManagerUserIds, getJobTechnicianIds, getJobLabel } from "@/lib/notifications"

/**
 * Called AFTER the file has already been uploaded to Supabase Storage
 * from the browser. This only:
 *  - Verifies the user + job
 *  - Saves a row in job_attachments
 *  - Sends notifications
 *  - Triggers revalidation
 */
export async function saveReportMetadata(
  jobId: string,
  equipmentId: string,
  file: {
    url: string
    name: string
    size: number
    type: string
  },
) {
  console.log("[v0] saveReportMetadata called", { jobId, equipmentId, fileName: file.name })

  try {
    const user = await getCurrentUser()

    console.log("[v0] Current user:", user ? { id: user.id, role: user.role } : "null")

    if (!user) {
      throw new Error("Unauthorized")
    }

    const supabase = await createClient()

    // Verify the job exists and belongs to the same organization
    const { data: job, error: jobError } = await supabase
      .from("jobs")
      .select("id, organization_id")
      .eq("id", jobId)
      .single()

    if (jobError || !job) {
      console.error("[v0] Job lookup error:", jobError)
      throw new Error("Job not found")
    }

    if (job.organization_id !== user.organization_id) {
      throw new Error("You do not have permission to upload a report for this job")
    }

    console.log("[v0] Job verified, inserting attachment record...")

    // Insert record into job_attachments
    const { error: insertError } = await supabase.from("job_attachments").insert({
      job_id: jobId,
      equipment_id: equipmentId,
      uploaded_by: user.id,
      file_name: file.name,
      file_url: file.url,
      file_size: file.size,
      mime_type: file.type,
      type: file.type.startsWith("image/") ? "photo" : "document",
    })

    if (insertError) {
      console.error("[v0] Database insert error:", insertError)
      throw new Error(`Failed to save report: ${insertError.message}`)
    }

    console.log("[v0] Report record created successfully, creating notifications...")

    try {
      const adminClient = await createAdminClient()
      await createReportUploadNotifications(jobId, user.id, user.organization_id, adminClient)
    } catch (notifError) {
      console.error("[v0] Error creating notifications (non-blocking):", notifError)
    }

    // Revalidate pages so the new report shows up
    revalidatePath(`/technician/jobs/${jobId}/reports`)
    revalidatePath(`/manager/jobs/${jobId}/reports`)

    console.log("[v0] saveReportMetadata completed successfully")

    return { success: true }
  } catch (error: any) {
    console.error("[v0] Error in saveReportMetadata:", error)
    throw new Error(error.message || "Failed to save report")
  }
}

/**
 * Delete a report (both file + DB row)
 * Managers/dispatch/admin can delete, or the original uploader.
 */
export async function deleteReport(attachmentId: string, jobId: string) {
  try {
    const user = await getCurrentUser()

    if (!user) {
      throw new Error("Unauthorized")
    }

    const supabase = await createClient()

    console.log("[v0] Deleting report:", { attachmentId, jobId, userId: user.id })

    const { data: attachment, error: fetchError } = await supabase
      .from("job_attachments")
      .select("job_id, equipment_id, uploaded_by, file_url")
      .eq("id", attachmentId)
      .single()

    if (fetchError || !attachment) {
      console.error("[v0] Attachment not found:", fetchError)
      throw new Error("Attachment not found")
    }

    const isManager = ["owner", "admin", "manager", "dispatcher"].includes(user.role)
    const isUploader = attachment.uploaded_by === user.id

    if (!isManager && !isUploader) {
      throw new Error("You do not have permission to delete this report")
    }

    // URL format: https://{project}.supabase.co/storage/v1/object/public/job-reports/{path}
    const urlParts = attachment.file_url.split("/job-reports/")
    if (urlParts.length === 2) {
      const storagePath = urlParts[1]

      console.log("[v0] Deleting file from storage:", storagePath)

      const { error: storageError } = await supabase.storage.from("job-reports").remove([storagePath])

      if (storageError) {
        console.error("[v0] Error deleting file from storage:", storageError)
        // Continue with database deletion even if storage deletion fails
      } else {
        console.log("[v0] File deleted from storage successfully")
      }
    }

    const { error: deleteError } = await supabase.from("job_attachments").delete().eq("id", attachmentId)

    if (deleteError) {
      console.error("[v0] Error deleting attachment from database:", deleteError)
      throw new Error("Failed to delete report from database")
    }

    console.log("[v0] Report record deleted successfully")

    const adminClient = await createAdminClient()
    await createReportDeleteNotifications(attachment.job_id, user.id, user.organization_id, adminClient)

    revalidatePath(`/technician/jobs/${jobId}/reports`)
    revalidatePath(`/manager/jobs/${jobId}/reports`)

    return { success: true }
  } catch (error) {
    console.error("[v0] Error in deleteReport:", error)
    throw error
  }
}

async function createReportDeleteNotifications(
  jobId: string,
  deletedBy: string,
  organizationId: string,
  supabase: any,
) {
  console.log("[v0] createReportDeleteNotifications called", { jobId, deletedBy, organizationId })

  try {
    const jobLabel = await getJobLabel(jobId, supabase)
    console.log("[v0] Job label:", jobLabel)

    const managerIds = await getManagerUserIds(organizationId, supabase)
    console.log("[v0] Manager IDs:", managerIds)

    const techIds = await getJobTechnicianIds(jobId, supabase)
    console.log("[v0] Technician IDs:", techIds)

    const allRecipients = [...managerIds, ...techIds].filter((id) => id !== deletedBy)
    console.log("[v0] Report delete notification recipients:", allRecipients)

    if (allRecipients.length === 0) {
      console.log("[v0] No recipients for report delete notification")
      return
    }

    await createNotifications({
      organizationId,
      recipientUserIds: allRecipients,
      type: "report_deleted",
      message: `Report deleted from job ${jobLabel}`,
      relatedEntityType: "job",
      relatedEntityId: jobId,
      supabase,
    })

    console.log("[v0] Report delete notifications created successfully")
  } catch (error) {
    console.error("[v0] Error in createReportDeleteNotifications:", error)
    throw error
  }
}

async function createReportUploadNotifications(
  jobId: string,
  uploadedBy: string,
  organizationId: string,
  supabase: any,
) {
  console.log("[v0] createReportUploadNotifications called", { jobId, uploadedBy, organizationId })

  try {
    const jobLabel = await getJobLabel(jobId, supabase)
    console.log("[v0] Job label:", jobLabel)

    const managerIds = await getManagerUserIds(organizationId, supabase)
    console.log("[v0] Manager IDs:", managerIds)

    const techIds = await getJobTechnicianIds(jobId, supabase)
    console.log("[v0] Technician IDs:", techIds)

    const allRecipients = [...managerIds, ...techIds].filter((id) => id !== uploadedBy)
    console.log("[v0] Report upload notification recipients:", allRecipients)

    if (allRecipients.length === 0) {
      console.log("[v0] No recipients for report upload notification")
      return
    }

    await createNotifications({
      organizationId,
      recipientUserIds: allRecipients,
      type: "report_uploaded",
      message: `Report uploaded to job ${jobLabel}`,
      relatedEntityType: "job",
      relatedEntityId: jobId,
      supabase,
    })

    console.log("[v0] Report upload notifications created successfully")
  } catch (error) {
    console.error("[v0] Error in createReportUploadNotifications:", error)
    throw error
  }
}
