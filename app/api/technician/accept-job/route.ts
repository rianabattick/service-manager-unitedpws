import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase-server"

export async function POST(request: NextRequest) {
  try {
    const { jobTechnicianId, jobId } = await request.json()

    if (!jobTechnicianId || !jobId) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    const supabase = await createClient()

    // Update job technician status to accepted
    const { error: techError } = await supabase
      .from("job_technicians")
      .update({
        status: "accepted",
        responded_at: new Date().toISOString(),
      })
      .eq("id", jobTechnicianId)

    if (techError) {
      console.error("[v0] Error accepting job technician:", techError)
      return NextResponse.json({ error: "Failed to accept job" }, { status: 500 })
    }

    // Update job status to accepted
    const { error: jobError } = await supabase
      .from("jobs")
      .update({
        status: "accepted",
      })
      .eq("id", jobId)

    if (jobError) {
      console.error("[v0] Error updating job status:", jobError)
      return NextResponse.json({ error: "Failed to update job status" }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[v0] Error in accept-job route:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
