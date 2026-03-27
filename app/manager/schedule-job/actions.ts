"use server"

import { createClient } from "@/lib/supabase-server"
import { createNotifications, getManagerUserIds } from "@/lib/notifications"
import { revalidatePath } from "next/cache"
import { createAdminClient } from "@/lib/supabase-server"

export async function createJobNotifications(
  jobId: string,
  jobTitle: string,
  jobNumber: string,
  technicianIds: string[],
  organizationId: string,
  createdBy: string,
) {
  console.log("[v0] createJobNotifications called:", {
    jobId,
    jobTitle,
    jobNumber,
    technicianIds,
    organizationId,
    createdBy,
  })

  const supabase = await createClient()
  const jobLabel = jobTitle || jobNumber || jobId

  // Get technician names
  const { data: technicians } = await supabase.from("users").select("full_name").in("id", technicianIds)

  const techNames = technicians?.map((t: any) => t.full_name).join(", ") || "technicians"

  // Notify managers
  console.log("[v0] Getting manager user IDs...")
  const managerIds = await getManagerUserIds(organizationId, supabase)
  console.log("[v0] Manager IDs:", managerIds)

  if (managerIds.length > 0) {
    console.log("[v0] Creating notifications for all managers...")
    await createNotifications({
      organizationId,
      recipientUserIds: managerIds,
      type: "job_created",
      message: `Job ${jobLabel} confirmed, assigned to ${techNames}`,
      relatedEntityType: "job",
      relatedEntityId: jobId,
      supabase,
    })
  }

  // Notify assigned technicians
  if (technicianIds.length > 0) {
    console.log("[v0] Creating notifications for technicians...")
    await createNotifications({
      organizationId,
      recipientUserIds: technicianIds,
      type: "job_created",
      message: `Job ${jobLabel} confirmed and assigned to you`,
      relatedEntityType: "job",
      relatedEntityId: jobId,
      supabase,
    })
  }

  console.log("[v0] Finished creating notifications")
}

export async function setContractInProgress(contractId: string) {
  const supabase = await createAdminClient()
  
  // 1. Force the database update using Admin privileges
  const { error } = await supabase
    .from("service_agreements")
    .update({ status: "in_progress" })
    .eq("id", contractId)

  if (error) {
    console.error("[v0] Server action error updating contract:", error)
  }

  // 2. Force Next.js to clear the cache so you instantly see the new status
  revalidatePath(`/manager/contracts/${contractId}`)
  revalidatePath(`/manager/contracts`)
}