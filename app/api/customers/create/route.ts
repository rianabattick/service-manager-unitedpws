import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase-server"

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const body = await request.json()

    const { data, error } = await supabase.from("customers").insert(body).select().single()

    if (error) {
      console.error("[v0] Error creating customer:", error)
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json(data)
  } catch (error) {
    console.error("[v0] Error in customer create API:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create customer" },
      { status: 500 },
    )
  }
}
