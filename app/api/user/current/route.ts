import { NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/db"

export async function GET() {
  try {
    const user = await getCurrentUser()

    if (!user) {
      console.log("[v0] No user found - returning soft 503 to prevent redirect loops")
      return NextResponse.json({ error: "User not available", rateLimited: true }, { status: 503 })
    }

    return NextResponse.json({
      id: user.id,
      email: user.email,
      full_name: user.full_name,
      role: user.role,
    })
  } catch (error) {
    console.error("[v0] Error fetching current user:", error)
    return NextResponse.json({ error: "Failed to fetch user", transient: true }, { status: 503 })
  }
}
