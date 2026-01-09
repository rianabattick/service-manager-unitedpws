import { redirect } from "next/navigation"
import { getCurrentUser } from "@/lib/db"
import { createClient } from "@/lib/supabase-server"
import { ScheduleCalendar } from "@/components/shared/ScheduleCalendar"
import { PageHeader } from "@/components/shared/PageHeader"

export default async function TechnicianSchedulePage() {
  const user = await getCurrentUser()

  if (!user) {
    redirect("/login")
  }

  if (user.role !== "technician") {
    redirect("/manager")
  }

  const supabase = await createClient()

  const { data: jobTechnicians } = await supabase
    .from("job_technicians")
    .select(
      `
      job_id,
      jobs!inner (
        id,
        job_number,
        title,
        scheduled_start,
        scheduled_end,
        status,
        organization_id
      )
    `,
    )
    .eq("technician_id", user.id)
    .eq("jobs.organization_id", user.organization_id)
    .not("jobs.scheduled_start", "is", null)

  const events =
    jobTechnicians?.map((jt: any) => {
      const job = jt.jobs
      const start = job.scheduled_start
      const end = job.scheduled_end || new Date(new Date(job.scheduled_start).getTime() + 60 * 60 * 1000).toISOString()

      let backgroundColor = "#3b82f6" // blue for default
      let borderColor = "#2563eb"

      if (job.status === "completed") {
        backgroundColor = "#9ca3af" // gray for completed
        borderColor = "#6b7280"
      } else if (job.status === "cancelled") {
        backgroundColor = "#ef4444" // red for cancelled
        borderColor = "#dc2626"
      } else if (job.status === "confirmed") {
        backgroundColor = "#10b981" // green for confirmed
        borderColor = "#059669"
      }

      return {
        id: job.id,
        title: job.title || "Untitled Job",
        start,
        end,
        url: `/technician/jobs/${job.id}`,
        backgroundColor,
        borderColor,
      }
    }) || []

  return (
    <div className="space-y-6">
      <PageHeader title="My Schedule" subtitle="Calendar view of your assigned jobs" />

      <ScheduleCalendar events={events} />
    </div>
  )
}
