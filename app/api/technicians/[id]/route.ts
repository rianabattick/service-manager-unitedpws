import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase-server"
import { getCurrentUser } from "@/lib/db"

export async function PUT(request: Request, { params }: { params: { id: string } }) {
  try {
    const { id } = params
    const user = await getCurrentUser()

    if (!user || !["owner", "admin", "manager"].includes(user.role)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const { full_name, email, phone, specialty, is_active } = body

    if (!full_name || !email) {
      return NextResponse.json({ error: "Full name and email are required" }, { status: 400 })
    }

    const supabase = await createClient()

    // Update technician
    const { data: technicians, error: updateError } = await supabase
      .from("users")
      .update({
        full_name,
        email,
        phone: phone || null,
        is_active: is_active ?? true,
        preferences: specialty ? { specialty } : {},
      })
      .eq("id", id)
      .eq("organization_id", user.organization_id)
      .eq("role", "technician")
      .select()

    if (updateError) {
      console.error("Error updating technician:", updateError)
      return NextResponse.json({ error: "Failed to update technician" }, { status: 500 })
    }

    if (!technicians || technicians.length === 0) {
      return NextResponse.json({ error: "Technician not found" }, { status: 404 })
    }

    const technician = technicians[0]

    return NextResponse.json({ technician })
  } catch (error) {
    console.error("Error in technician update API:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
