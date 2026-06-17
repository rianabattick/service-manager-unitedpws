import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET() {
  try {
    // Calculate the cutoff date (30 days ago)
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - 30)
    const cutoffIso = cutoffDate.toISOString()

    // Delete notifications older than 30 days
    // We use { count: 'exact' } so Supabase returns the total number of rows it deleted
    const { count, error } = await supabase
      .from("notifications")
      .delete({ count: "exact" })
      .lt("created_at", cutoffIso)

    if (error) throw error

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      message: `Automated cleanup complete. Purged ${count || 0} old notifications.`,
    })

  } catch (error: any) {
    console.error("Automated notification cleanup error:", error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}