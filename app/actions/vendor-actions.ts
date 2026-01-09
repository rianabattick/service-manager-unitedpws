"use server"

import { createAdminClient } from "@/lib/supabase-server"

export async function createVendor(organizationId: string, name: string) {
  try {
    const supabase = await createAdminClient()

    const { data: vendor, error } = await supabase
      .from("vendors")
      .insert({
        organization_id: organizationId,
        name: name,
        is_active: true,
      })
      .select()
      .single()

    if (error) {
      console.error("[v0] Error creating vendor:", error)
      return { success: false, error: error.message }
    }

    return { success: true, vendor: { id: vendor.id, name: vendor.name } }
  } catch (error) {
    console.error("[v0] Unexpected error creating vendor:", error)
    return { success: false, error: "An unexpected error occurred" }
  }
}
