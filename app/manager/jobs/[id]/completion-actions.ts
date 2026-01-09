"use server"

import { createAdminClient } from "@/lib/supabase-server"
import { revalidatePath } from "next/cache"
import { getCurrentUser } from "@/lib/db"

export async function updateJobStatus(jobId: string, status: string) {
  try {
    const supabase = await createAdminClient()

    const { error } = await supabase.from("jobs").update({ status }).eq("id", jobId)

    if (error) {
      console.error("[v0] Error updating job status:", error)
      return { success: false, error: error.message }
    }

    revalidatePath(`/manager/jobs/${jobId}`)
    return { success: true }
  } catch (err) {
    console.error("[v0] Exception updating job status:", err)
    return { success: false, error: String(err) }
  }
}

export async function loadChecklist(jobId: string) {
  try {
    const user = await getCurrentUser()

    if (!user) {
      return { success: false, error: "Not authenticated" }
    }

    const supabase = await createAdminClient()

    const { data, error } = await supabase
      .from("completion_checklists")
      .select(`
        *,
        completed_by_user:users!completion_checklists_completed_by_fkey(full_name, email)
      `)
      .eq("job_id", jobId)
      .eq("organization_id", user.organization_id)
      .maybeSingle()

    if (error) {
      console.error("[v0] Error loading checklist:", error)
      return { success: false, error: error.message }
    }

    if (data && data.completed_by_user) {
      const completedByName = data.completed_by_user.full_name || data.completed_by_user.email
      return {
        success: true,
        data: data ? { ...data, completed_by_name: completedByName } : null,
      }
    }

    return { success: true, data: data || null }
  } catch (err) {
    console.error("[v0] Exception loading checklist:", err)
    return { success: true, data: null }
  }
}

export async function updateChecklist(
  jobId: string,
  checklist: {
    reports_uploaded: boolean
    reports_sent_to_customer: boolean
    reports_saved_in_file: boolean
    invoiced: boolean
    no_pending_return_visits: boolean
    parts_logistics_completed: boolean
  },
  currentJobStatus: string,
) {
  try {
    const user = await getCurrentUser()

    if (!user) {
      return { success: false, error: "Not authenticated" }
    }

    const supabase = await createAdminClient()

    // Check if all items are completed
    const allCompleted = Object.values(checklist).every((v) => v)

    let previousStatus = currentJobStatus
    try {
      const { data: existingChecklist } = await supabase
        .from("completion_checklists")
        .select("previous_status")
        .eq("job_id", jobId)
        .maybeSingle()

      if (existingChecklist?.previous_status) {
        previousStatus = existingChecklist.previous_status
      }
    } catch (err) {
      console.error("[v0] Error fetching existing checklist:", err)
    }

    const checklistData: any = {
      job_id: jobId,
      organization_id: user.organization_id,
      ...checklist,
      previous_status: allCompleted ? previousStatus : currentJobStatus,
      updated_at: new Date().toISOString(),
    }

    if (allCompleted && currentJobStatus !== "completed") {
      checklistData.completed_by = user.id
      checklistData.completed_at = new Date().toISOString()
    }

    // Upsert checklist
    const { error: checklistError } = await supabase.from("completion_checklists").upsert(checklistData, {
      onConflict: "job_id",
    })

    if (checklistError) {
      console.error("[v0] Error updating checklist:", checklistError)
      return { success: false, error: checklistError.message }
    }

    if (allCompleted && currentJobStatus !== "completed") {
      const { error: statusError } = await supabase
        .from("jobs")
        .update({
          status: "completed",
          completed_at: new Date().toISOString(),
        })
        .eq("id", jobId)

      if (statusError) {
        console.error("[v0] Error updating job status to completed:", statusError)
        return { success: false, error: statusError.message }
      }
    } else if (!allCompleted && currentJobStatus === "completed" && previousStatus) {
      // Items unchecked - revert to previous status
      const { error: statusError } = await supabase.from("jobs").update({ status: previousStatus }).eq("id", jobId)

      if (statusError) {
        console.error("[v0] Error reverting job status:", statusError)
        return { success: false, error: statusError.message }
      }
    }

    revalidatePath(`/manager/jobs/${jobId}`)
    return { success: true }
  } catch (err) {
    console.error("[v0] Exception updating checklist:", err)
    return { success: false, error: String(err) }
  }
}
