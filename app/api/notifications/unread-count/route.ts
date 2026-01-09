import { NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/db"
import { getUnreadNotificationCount } from "@/lib/notifications"

export async function GET() {
  try {
    // In v0 preview environment, Supabase server client may not work properly
    // Return a default count to prevent the UI from breaking
    const user = await getCurrentUser()

    if (!user) {
      return NextResponse.json({ count: 0 })
    }

    const count = await getUnreadNotificationCount(user.id)

    return NextResponse.json({ count })
  } catch (error) {
    console.error("[v0] Error in notifications API:", error)
    return NextResponse.json({ count: 0 }, { status: 200 })
  }
}
