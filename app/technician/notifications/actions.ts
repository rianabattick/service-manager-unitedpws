"use server"

import { revalidatePath } from "next/cache"
import { createAdminClient } from "@/lib/supabase-server" // Updated to use server client
import { getCurrentUser } from "@/lib/db"

export async function markNotificationRead(notificationId: string) {
  const user = await getCurrentUser()

  if (!user) {
    throw new Error("Unauthorized")
  }

  const supabase = await createAdminClient() // Use admin client to bypass RLS

  const { error } = await supabase
    .from("notifications")
    .update({ is_read: true })
    .eq("id", notificationId)
    .eq("organization_id", user.organization_id)
    .eq("recipient_user_id", user.id)

  if (error) {
    console.error("[v0] Error marking notification as read:", error)
    throw new Error("Failed to mark notification as read")
  }

  revalidatePath("/technician/notifications")
}

export async function markAllNotificationsRead() {
  const user = await getCurrentUser()

  if (!user) {
    throw new Error("Unauthorized")
  }

  const supabase = await createAdminClient() // Use admin client to bypass RLS

  const { error } = await supabase
    .from("notifications")
    .update({ is_read: true })
    .eq("organization_id", user.organization_id)
    .eq("recipient_user_id", user.id)
    .eq("is_read", false)

  if (error) {
    console.error("[v0] Error marking all notifications as read:", error)
    throw new Error("Failed to mark all notifications as read")
  }

  revalidatePath("/technician/notifications")
}
