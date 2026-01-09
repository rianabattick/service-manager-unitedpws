import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase-server"

export async function POST(request: NextRequest) {
  try {
    const { jobTechnicianId } = await request.json()

    if (!jobTechnicianId) {
      return NextResponse.json({ error: "Missing jobTechnicianId" }, { status: 400 })
    }

    const supabase = await createClient()

    // Update job technician status to declined
    const { error } = await supabase
      .from("job_technicians")
      .update({
        status: "declined",
        responded_at: new Date().toISOString(),
      })
      .eq("id", jobTechnicianId)

    if (error) {
      console.error("[v0] Error declining job:", error)
      return NextResponse.json({ error: "Failed to decline job" }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[v0] Error in decline-job route:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
