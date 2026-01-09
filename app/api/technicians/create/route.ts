import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase-server"
import { getCurrentUser } from "@/lib/db"

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser()

    if (!user || !["owner", "admin", "manager"].includes(user.role)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const { full_name, email, phone, specialty, is_active, organization_id } = body

    if (!full_name || !email) {
      return NextResponse.json({ error: "Full name and email are required" }, { status: 400 })
    }

    const supabase = await createClient()

    // Check if email already exists
    const { data: existingUser } = await supabase.from("users").select("id").eq("email", email).single()

    if (existingUser) {
      return NextResponse.json({ error: "A user with this email already exists" }, { status: 400 })
    }

    // Create technician user
    const { data: technician, error: insertError } = await supabase
      .from("users")
      .insert({
        full_name,
        email,
        phone: phone || null,
        role: "technician",
        is_active: is_active ?? true,
        organization_id,
        preferences: specialty ? { specialty } : {},
      })
      .select()
      .single()

    if (insertError) {
      console.error("Error creating technician:", insertError)
      return NextResponse.json({ error: "Failed to create technician" }, { status: 500 })
    }

    return NextResponse.json({ technician }, { status: 201 })
  } catch (error) {
    console.error("Error in technician create API:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
