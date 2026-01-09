import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase-server"
import { getCurrentUser } from "@/lib/db"

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { id } = params
    const user = await getCurrentUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const isManager = ["owner", "admin", "manager", "dispatcher"].includes(user.role)

    if (!isManager) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const supabase = await createClient()

    // Delete related records first (cascade should handle this, but being explicit)
    await supabase.from("job_technicians").delete().eq("job_id", id)
    await supabase.from("job_equipment").delete().eq("job_id", id)
    await supabase.from("job_contacts").delete().eq("job_id", id)
    await supabase.from("job_attachments").delete().eq("job_id", id)

    // Delete the job
    const { error: jobError } = await supabase
      .from("jobs")
      .delete()
      .eq("id", id)
      .eq("organization_id", user.organization_id)

    if (jobError) {
      console.error("[v0] Error deleting job:", jobError)
      return NextResponse.json({ error: jobError.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error("[v0] Delete job error:", error)
    return NextResponse.json({ error: error.message || "Failed to delete job" }, { status: 500 })
  }
}
