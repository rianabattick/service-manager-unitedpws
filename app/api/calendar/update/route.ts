import { type NextRequest, NextResponse } from "next/server"
import { updateCalendarInviteForJob } from "@/lib/google-calendar"

export async function POST(request: NextRequest) {
  try {
    const { jobId, technicianIds } = await request.json()

    if (!jobId || !technicianIds || !Array.isArray(technicianIds)) {
      return NextResponse.json({ success: false, error: "Missing or invalid jobId or technicianIds" }, { status: 400 })
    }

    const result = await updateCalendarInviteForJob(jobId, technicianIds)

    return NextResponse.json(result)
  } catch (error) {
    console.error("[v0] Error in calendar update API:", error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to update calendar invite",
      },
      { status: 500 },
    )
  }
}
