import { redirect } from "next/navigation"
import { getCurrentUser } from "@/lib/db"
import { createClient } from "@/lib/supabase-server"
import { ScheduleCalendar } from "@/components/shared/ScheduleCalendar"
import { PageHeader } from "@/components/shared/PageHeader"

export const dynamic = "force-dynamic"

export default async function ManagerSchedulePage() {
  const user = await getCurrentUser()

  if (!user) {
    redirect("/login")
  }

  if (user.role === "technician") {
    redirect("/technician")
  }

  if (!["owner", "admin", "manager", "dispatcher"].includes(user.role)) {
    redirect("/login")
  }

  const supabase = await createClient()

  const { data: jobs } = await supabase
    .from("jobs")
    .select(
      `
      id,
      job_number,
      title,
      scheduled_start,
      scheduled_end,
      status
    `,
    )
    .eq("organization_id", user.organization_id)
    .not("scheduled_start", "is", null)
    .order("scheduled_start", { ascending: true })

  const events =
    jobs?.map((job) => {
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
        url: `/manager/jobs/${job.id}`,
        backgroundColor,
        borderColor,
      }
    }) || []

  return (
    <div className="space-y-6">
      <PageHeader title="Schedule" subtitle="Calendar view of all scheduled jobs" />

      <ScheduleCalendar events={events} />
    </div>
  )
}
