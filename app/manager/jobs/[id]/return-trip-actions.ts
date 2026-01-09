"use server"

import { createAdminClient } from "@/lib/supabase-server"
import { revalidatePath } from "next/cache"
import { getCurrentUser } from "@/lib/db"

export async function loadReturnTripDecision(jobId: string) {
  try {
    const user = await getCurrentUser()

    if (!user) {
      return { success: false, error: "Not authenticated" }
    }

    if (!["owner", "admin", "manager", "dispatcher"].includes(user.role)) {
      return { success: false, error: "Unauthorized" }
    }

    const supabase = await createAdminClient()

    const { data, error } = await supabase
      .from("jobs")
      .select(
        "manager_return_trip_needed, manager_return_trip_reason, manager_return_trip_updated_at, manager_return_trip_updated_by",
      )
      .eq("id", jobId)
      .eq("organization_id", user.organization_id)
      .single()

    if (error) {
      console.error("[v0] Error loading return trip decision:", error)
      return { success: false, error: error.message }
    }

    return { success: true, data }
  } catch (err) {
    console.error("[v0] Exception loading return trip decision:", err)
    return { success: false, error: String(err) }
  }
}

export async function updateReturnTripDecision(jobId: string, needed: boolean | null, reason: string) {
  try {
    const user = await getCurrentUser()

    if (!user) {
      return { success: false, error: "Not authenticated" }
    }

    if (!["owner", "admin", "manager", "dispatcher"].includes(user.role)) {
      return { success: false, error: "Unauthorized: Only managers can update return trip decisions" }
    }

    const supabase = await createAdminClient()

    const { error } = await supabase
      .from("jobs")
      .update({
        manager_return_trip_needed: needed,
        manager_return_trip_reason: reason || null,
        manager_return_trip_updated_at: new Date().toISOString(),
        manager_return_trip_updated_by: user.id,
      })
      .eq("id", jobId)
      .eq("organization_id", user.organization_id)

    if (error) {
      console.error("[v0] Error updating return trip decision:", error)
      return { success: false, error: error.message }
    }

    revalidatePath(`/manager/jobs/${jobId}`)
    revalidatePath("/manager/jobs")
    return { success: true }
  } catch (err) {
    console.error("[v0] Exception updating return trip decision:", err)
    return { success: false, error: String(err) }
  }
}
