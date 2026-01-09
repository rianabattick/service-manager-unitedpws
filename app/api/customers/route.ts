import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase-server"

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const organizationId = searchParams.get("organizationId")

    if (!organizationId) {
      return NextResponse.json({ error: "Organization ID is required" }, { status: 400 })
    }

    let supabase
    try {
      supabase = await createClient()
    } catch (clientError) {
      console.error("[v0] Failed to create Supabase client:", clientError)
      return NextResponse.json({ error: "Authentication required" }, { status: 401 })
    }

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { data: customers, error } = await supabase
      .from("customers")
      .select("id, first_name, last_name, company_name")
      .eq("organization_id", organizationId)
      .eq("is_active", true)
      .order("company_name")

    if (error) {
      console.error("[v0] Error fetching customers:", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(customers || [])
  } catch (error) {
    console.error("[v0] Error in customers API:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
