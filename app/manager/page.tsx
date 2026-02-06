import { getCurrentUser, listManagerDashboardJobs } from "@/lib/db"
import { createClient } from "@/lib/supabase-server"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import Link from "next/link"
import { redirect } from "next/navigation"
import { PageHeader } from "@/components/shared/PageHeader"

export const dynamic = "force-dynamic"

export default async function ManagerDashboard() {
  const user = await getCurrentUser()

  if (!user) {
    redirect("/login")
  }

  const managerRoles = ["owner", "admin", "manager", "dispatcher"] as const

  if (!managerRoles.includes(user.role as any)) {
    if (user.role === "technician") {
      redirect("/technician")
    }
    // Fallback for any other unexpected role
    redirect("/login")
  }

  const isManager = ["owner", "admin", "manager", "dispatcher"].includes(user.role)

  if (!isManager) {
    redirect("/debug")
  }

  // Fetch all dashboard data
  const jobs = await listManagerDashboardJobs(user.organization_id)

  const supabase = await createClient()
  const { count: activeContractsCount } = await supabase
    .from("service_agreements")
    .select("*", { count: "exact", head: true })
    .eq("organization_id", user.organization_id)
    .neq("status", "cancelled") // 👈 CHANGED: Counts everything EXCEPT 'cancelled'

  // Calculate KPIs
  const activeJobsCount = jobs.filter((j) => j.status !== "completed").length

  const upcomingJobsCount = jobs.filter(
    (j) => j.scheduled_start && new Date(j.scheduled_start) > new Date() && ["pending", "confirmed"].includes(j.status),
  ).length
  const overdueJobsCount = jobs.filter(
    (j) =>
      j.scheduled_start && new Date(j.scheduled_start) < new Date() && !["completed", "cancelled"].includes(j.status),
  ).length

  const overdueJobs = jobs
    .filter(
      (j) =>
        j.status as string === "overdue" ||
        (j.scheduled_start &&
          new Date(j.scheduled_start) < new Date(Date.now() - 2 * 24 * 60 * 60 * 1000) &&
          !["completed", "cancelled"].includes(j.status)),
    )
    .sort((a, b) => new Date(a.scheduled_start!).getTime() - new Date(b.scheduled_start!).getTime())
    .slice(0, 5)

  const { data: recentNotifications } = await supabase
    .from("notifications")
    .select("id, type, message, related_entity_type, related_entity_id, is_read, created_at")
    .eq("recipient_user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(5)

  // Fetch job details for job-related notifications
  const jobNotifications =
    recentNotifications?.filter((n) => n.related_entity_type === "job" && n.related_entity_id) || []
  const jobIds = jobNotifications.map((n) => n.related_entity_id).filter(Boolean) as string[]

  let jobDetailsMap: Record<string, { title: string; job_number: string }> = {}
  if (jobIds.length > 0) {
    const { data: jobDetails } = await supabase.from("jobs").select("id, title, job_number").in("id", jobIds)

    if (jobDetails) {
      jobDetailsMap = jobDetails.reduce(
        (acc, job) => {
          acc[job.id] = { title: job.title, job_number: job.job_number }
          return acc
        },
        {} as Record<string, { title: string; job_number: string }>,
      )
    }
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <PageHeader title="Dashboard" subtitle="Overview of service operations" />

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Active Contracts</p>
              <p className="text-3xl font-bold">{activeContractsCount}</p>
              <p className="text-xs text-muted-foreground">Service agreements</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Total Active Jobs</p>
              <p className="text-3xl font-bold">{activeJobsCount}</p>
              <p className="text-xs text-muted-foreground">Excluding completed</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Upcoming Jobs</p>
              <p className="text-3xl font-bold">{upcomingJobsCount}</p>
              <p className="text-xs text-muted-foreground">Scheduled ahead</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Overdue Jobs</p>
              <p className="text-3xl font-bold">{overdueJobsCount}</p>
              <p className="text-xs text-muted-foreground">Need attention</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Overdue Jobs - 2/3 width on large screens */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Overdue Jobs</CardTitle>
            </CardHeader>
            <CardContent>
              {overdueJobs.length === 0 ? (
                <p className="text-muted-foreground text-sm">No overdue jobs</p>
              ) : (
                <div className="space-y-4">
                  {overdueJobs.map((job:any) => (
                    <Link
                      key={job.id}
                      href={`/manager/jobs/${job.id}`}
                      className="block p-4 rounded-lg border border-border hover:bg-muted/50 transition-colors"
                    >
                      <div className="space-y-2">
                        <div className="flex items-center justify-between gap-4">
                          <p className="font-semibold">{job.title || `Job #${job.job_number}`}</p>
                          <span
                            className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(job.status)}`}
                          >
                            {job.status === "overdue" ? "overdue" : "past due"}
                          </span>
                        </div>
                        <div className="text-sm text-muted-foreground">
                          <p>{job.customer_name}</p>
                          {job.location_name && <p>{job.location_name}</p>}
                        </div>
                        {job.scheduled_start && (
                          <p className="text-xs text-muted-foreground">
                            Was due:{" "}
                            {new Date(job.scheduled_start).toLocaleDateString("en-US", {
                              weekday: "short",
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                              hour: "numeric",
                              minute: "2-digit",
                            })}
                          </p>
                        )}
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Notifications - 1/3 width on large screens */}
        <div className="lg:col-span-1">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Recent Notifications</CardTitle>
                <Link href="/manager/notifications" className="text-sm text-primary hover:underline">
                  View all
                </Link>
              </div>
            </CardHeader>
            <CardContent>
              {!recentNotifications || recentNotifications.length === 0 ? (
                <p className="text-muted-foreground text-sm">No notifications yet</p>
              ) : (
                <div className="space-y-3">
                  {recentNotifications.map((notification) => {
                    let href = "/manager/notifications"
                    if (notification.related_entity_type === "job" && notification.related_entity_id) {
                      href = `/manager/jobs/${notification.related_entity_id}`
                    } else if (notification.related_entity_type === "contract" && notification.related_entity_id) {
                      href = `/manager/contracts/${notification.related_entity_id}`
                    }

                    let displayMessage = notification.message
                    if (notification.related_entity_type === "job" && notification.related_entity_id) {
                      const jobInfo = jobDetailsMap[notification.related_entity_id]
                      if (jobInfo) {
                        const jobTitle = jobInfo.title || `Job #${jobInfo.job_number}`
                        // Replace patterns like "Job #123" or standalone job numbers
                        displayMessage = displayMessage
                          .replace(/Job #\d+/gi, jobTitle)
                          .replace(/job #\d+/gi, jobTitle)
                          .replace(new RegExp(`\\b${jobInfo.job_number}\\b`, "g"), jobTitle)
                      }
                    }

                    return (
                      <Link
                        key={notification.id}
                        href={href}
                        className={`block p-3 rounded-lg border border-border cursor-pointer transition-colors hover:bg-accent ${!notification.is_read ? "bg-primary/5" : ""}`}
                      >
                        <p className="text-sm">{displayMessage}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {new Date(notification.created_at).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                            hour: "numeric",
                            minute: "2-digit",
                          })}
                        </p>
                      </Link>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

function getStatusColor(status: string): string {
  switch (status) {
    case "pending":
      return "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300"
    case "confirmed":
      return "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
    case "completed":
      return "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300"
    case "cancelled":
      return "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300"
    case "on_hold":
      return "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300"
    case "overdue":
      return "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300"
    default:
      return "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300"
  }
}
