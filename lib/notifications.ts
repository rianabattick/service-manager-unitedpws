"use server"

import { createAdminClient } from "./supabase-server"

export interface CreateNotificationParams {
  organizationId: string
  recipientUserIds: string[]
  type: string
  message: string
  relatedEntityType?: string
  relatedEntityId?: string
  supabase?: any
}

export interface SingleNotificationParams {
  recipientId: string
  type: string
  message: string
  relatedJobId?: string
  relatedEntityType?: string
  relatedEntityId?: string
}

/**
 * Create a single notification for one recipient
 */
export async function createNotification(params: SingleNotificationParams) {
  const { recipientId, type, message, relatedJobId, relatedEntityType, relatedEntityId } = params

  console.log("[v0] createNotification called with:", message)

  const supabase = await createAdminClient()

  // Get the recipient's organization
  const { data: user } = await supabase.from("users").select("organization_id").eq("id", recipientId).single()

  if (!user) {
    console.error("[v0] Recipient user not found:", recipientId)
    return
  }

  const notification = {
    organization_id: user.organization_id,
    recipient_user_id: recipientId,
    type,
    message,
    related_entity_type: relatedEntityType || (relatedJobId ? "job" : null),
    related_entity_id: relatedEntityId || relatedJobId || null,
    is_read: false,
  }

  console.log("[v0] Inserting notification:", message)

  const { data, error } = await supabase.from("notifications").insert(notification).select()

  if (error) {
    console.error("[v0] Error creating notification:", error.message)
  } else {
    console.log("[v0] Successfully created notification:", data?.[0]?.id)
  }
}

/**
 * Create notifications for multiple recipients
 */
export async function createNotifications(params: CreateNotificationParams) {
  const {
    organizationId,
    recipientUserIds,
    type,
    message,
    relatedEntityType,
    relatedEntityId,
    supabase: providedSupabase,
  } = params

  console.log("[v0] createNotifications called with:", {
    organizationId,
    recipientUserIds,
    type,
    message,
    relatedEntityType,
    relatedEntityId,
  })

  // If no recipients, do nothing
  if (!recipientUserIds || recipientUserIds.length === 0) {
    console.log("[v0] No recipients, skipping notification creation")
    return
  }

  const supabase = providedSupabase || (await createAdminClient()) // Use admin client to bypass RLS

  const notifications = recipientUserIds.map((recipientId) => ({
    organization_id: organizationId,
    recipient_user_id: recipientId,
    type,
    message,
    related_entity_type: relatedEntityType || null,
    related_entity_id: relatedEntityId || null,
    is_read: false,
  }))

  console.log("[v0] Inserting notifications:", notifications)

  const { data, error } = await supabase.from("notifications").insert(notifications).select()

  if (error) {
    console.error("[v0] Error creating notifications:", error)
  } else {
    console.log("[v0] Successfully created notifications:", data)
  }
}

/**
 * Get all manager user IDs in an organization
 */
export async function getManagerUserIds(organizationId: string, supabase?: any): Promise<string[]> {
  const client = supabase || (await createAdminClient())

  const { data: managers, error } = await client
    .from("users")
    .select("id")
    .eq("organization_id", organizationId)
    .in("role", ["owner", "admin", "manager", "dispatcher"])

  if (error) {
    console.error("[v0] Error fetching managers:", error)
    return []
  }

  return managers?.map((m: any) => m.id) || []
}

/**
 * Get job label (title or job_number or ID fallback)
 */
export async function getJobLabel(jobId: string, supabase?: any): Promise<string> {
  const client = supabase || (await createAdminClient())

  const { data: job } = await client.from("jobs").select("title, job_number").eq("id", jobId).single()

  return job?.title || job?.job_number || jobId
}

/**
 * Get technician user IDs assigned to a job
 */
export async function getJobTechnicianIds(jobId: string, supabase?: any): Promise<string[]> {
  const client = supabase || (await createAdminClient())

  const { data: jobTechs, error } = await client.from("job_technicians").select("technician_id").eq("job_id", jobId)

  if (error) {
    console.error("[v0] Error fetching job technicians:", error)
    return []
  }

  return jobTechs?.map((jt: any) => jt.technician_id) || []
}

/**
 * Get the count of unread notifications for a user
 */
export async function getUnreadNotificationCount(userId: string): Promise<number> {
  try {
    const supabase = await createAdminClient()

    const { count, error } = await supabase
      .from("notifications")
      .select("*", { count: "exact", head: true })
      .eq("recipient_user_id", userId)
      .eq("is_read", false)

    if (error) {
      console.error("[v0] Error fetching unread notification count:", error)
      return 0
    }

    return count || 0
  } catch (error) {
    console.error("[v0] Error fetching unread notification count:", error)
    return 0
  }
}
