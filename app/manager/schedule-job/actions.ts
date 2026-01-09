"use server"

import { createClient } from "@/lib/supabase-server"
import { createNotifications, getManagerUserIds } from "@/lib/notifications"

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
