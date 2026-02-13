import Link from "next/link"
import { redirect } from "next/navigation"
import { getCurrentUser, listTechnicianJobsDetailed } from "@/lib/db"
import { createClient } from "@/lib/supabase-server"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { PageHeader } from "@/components/shared/PageHeader"

export const dynamic = "force-dynamic"

export default async function TechnicianDashboardPage() {
  const user = await getCurrentUser()

  if (!user) {
    redirect("/login")
  }

  if (user.role !== "technician") {
    redirect("/manager")
  }

  const supabase = await createClient()

  // 1. Get Detailed jobs to see equipment list
  const allJobs = await listTechnicianJobsDetailed(user.id)
  const jobs = allJobs.filter((j) => j.status !== "completed")

  // 2. Fetch ALL attachments for these jobs to calculate KPI accurately
  // We need to know exactly WHICH units have files to count "Units Completed" vs "Total Files"
  const activeJobIds = jobs.map(j => j.job_id);
  
  // Safe check: only query if we have active jobs
  let allAttachments: any[] = [];
  if (activeJobIds.length > 0) {
    const { data } = await supabase
      .from("job_attachments")
      .select("job_id, equipment_id")
      .in("job_id", activeJobIds)
      .in("type", ["photo", "document"]);
    allAttachments = data || [];
  }

  // Create a Set of "Completed Unit Keys" for fast lookup
  // Key format: "jobId_equipmentId"
  const completedUnitKeys = new Set(
    allAttachments.map(a => `${a.job_id}_${a.equipment_id}`)
  );

  // --- Calculate KPIs ---
  const totalActiveJobs = jobs.length

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const tomorrow = new Date(today)
  tomorrow.setDate(tomorrow.getDate() + 1)

  const todaysJobs = jobs.filter((j) => {
    if (!j.scheduled_at) return false
    const jobDate = new Date(j.scheduled_at)
    return jobDate >= today && jobDate < tomorrow
  })

  // Count TOTAL units
  const totalUnitsAllJobs = jobs.reduce((sum, j) => sum + (j.equipment?.length || 0), 0)
  
  // Count COMPLETED units (lookup in our Set)
  const totalUnitsCompleted = jobs.reduce((sum, j) => {
    const completedInJob = j.equipment?.filter((u:any) => {
       const unitId = u.id || u.equipment_id;
       return completedUnitKeys.has(`${j.job_id}_${unitId}`)
    }).length || 0
    return sum + completedInJob
  }, 0)

  // Report Progress: If 0 total units, we consider it 100% complete
  const reportProgress = totalUnitsAllJobs > 0 
    ? Math.round((totalUnitsCompleted / totalUnitsAllJobs) * 100) 
    : 100;

  // Filter upcoming jobs (Next 7 days)
  const sevenDaysFromNow = new Date()
  sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7)

  const upcomingJobs = jobs
    .filter((j) => {
      if (!j.scheduled_at) return false
      const jobDate = new Date(j.scheduled_at)
      return jobDate >= tomorrow && jobDate <= sevenDaysFromNow
    })
    .sort((a, b) => new Date(a.scheduled_at!).getTime() - new Date(b.scheduled_at!).getTime())
    .slice(0, 5)

  // Sort today's jobs by time
  const sortedTodaysJobs = todaysJobs
    .sort((a, b) => new Date(a.scheduled_at!).getTime() - new Date(b.scheduled_at!).getTime())
    .slice(0, 3)

  // Calc Summary: Jobs Fully Reported vs Missing
  const jobsFullyReported = jobs.filter((j) => {
    const totalUnits = j.equipment?.length || 0
    // If 0 units, it IS fully reported (Auto-Green)
    if (totalUnits === 0) return true;

    const completedInJob = j.equipment?.filter((u:any) => {
       const unitId = u.id || u.equipment_id;
       return completedUnitKeys.has(`${j.job_id}_${unitId}`)
    }).length || 0
    return completedInJob >= totalUnits
  }).length

  const jobsWithMissingReports = jobs.filter((j) => {
    const totalUnits = j.equipment?.length || 0
    if (totalUnits === 0) return false; // Not missing anything if 0 units

    const completedInJob = j.equipment?.filter((u:any) => {
       const unitId = u.id || u.equipment_id;
       return completedUnitKeys.has(`${j.job_id}_${unitId}`)
    }).length || 0
    return completedInJob < totalUnits
  }).length

  return (
    <div className="space-y-8">
      <PageHeader title="Field Engineer Dashboard" subtitle="Overview of your assigned jobs and reporting status." />

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Assigned Active Jobs</p>
              <p className="text-3xl font-bold">{totalActiveJobs}</p>
              <p className="text-xs text-muted-foreground">Excluding completed jobs</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Today's Jobs</p>
              <p className="text-3xl font-bold">{todaysJobs.length}</p>
              <p className="text-xs text-muted-foreground">Scheduled for today</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Reports Progress</p>
              <p className="text-3xl font-bold">
                {totalUnitsCompleted} / {totalUnitsAllJobs}
              </p>
              <p className="text-xs text-muted-foreground mb-2">Units reported across all jobs</p>
              <div className="h-1.5 w-full bg-muted rounded-full">
                <div className="h-1.5 bg-primary rounded-full transition-all" style={{ width: `${reportProgress}%` }} />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        {/* Left column */}
        <div className="space-y-6">
          {/* Today's Jobs */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Today's Jobs</CardTitle>
                <p className="text-sm text-muted-foreground mt-1">Jobs scheduled for today.</p>
              </div>
              <Link href="/technician/jobs" className="text-sm text-primary hover:underline">
                View all
              </Link>
            </CardHeader>
            <CardContent>
              {sortedTodaysJobs.length === 0 ? (
                <p className="text-sm text-muted-foreground">No jobs scheduled for today.</p>
              ) : (
                <div className="space-y-4">
                  {sortedTodaysJobs.map((job) => {
                     const totalUnits = job.equipment?.length || 0;
                     const completedUnits = job.equipment?.filter((u:any) => {
                        const unitId = u.id || u.equipment_id;
                        return completedUnitKeys.has(`${job.job_id}_${unitId}`)
                     }).length || 0;

                     return (
                      <div key={job.job_id} className="flex items-center justify-between py-3 border-b last:border-0">
                        <div>
                          <Link
                            href={`/technician/jobs/${job.job_id}`}
                            className="font-mono text-sm text-primary hover:underline"
                          >
                            {job.title || job.job_number}
                          </Link>
                          <p className="text-sm font-medium">{job.customer_name}</p>
                          <p className="text-xs text-muted-foreground">{job.location_name ?? "Location not set"}</p>
                        </div>
                        <div className="text-right space-y-1">
                          <span
                            className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${getStatusClasses(job.status)}`}
                          >
                            {formatStatus(job.status)}
                          </span>
                          <p className="text-xs text-muted-foreground">
                            {completedUnits} / {totalUnits} units
                          </p>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Upcoming Jobs */}
          <Card>
            <CardHeader>
              <CardTitle>Upcoming Jobs</CardTitle>
              <p className="text-sm text-muted-foreground mt-1">Next 7 days.</p>
            </CardHeader>
            <CardContent>
              {upcomingJobs.length === 0 ? (
                <p className="text-sm text-muted-foreground">No upcoming jobs in the next week.</p>
              ) : (
                <div className="space-y-4">
                  {upcomingJobs.map((job) => {
                     const totalUnits = job.equipment?.length || 0;
                     const completedUnits = job.equipment?.filter((u:any) => {
                        const unitId = u.id || u.equipment_id;
                        return completedUnitKeys.has(`${job.job_id}_${unitId}`)
                     }).length || 0;

                     return (
                      <div key={job.job_id} className="flex items-center justify-between py-3 border-b last:border-0">
                        <div>
                          <Link
                            href={`/technician/jobs/${job.job_id}`}
                            className="font-mono text-sm text-primary hover:underline"
                          >
                            {job.title || job.job_number}
                          </Link>
                          <p className="text-sm font-medium">{job.customer_name}</p>
                          <p className="text-xs text-muted-foreground">{job.location_name ?? "Location not set"}</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {job.scheduled_at ? formatDateTime(job.scheduled_at) : "Not scheduled"}
                          </p>
                        </div>
                        <div className="text-right space-y-1">
                          <span
                            className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${getStatusClasses(job.status)}`}
                          >
                            {formatStatus(job.status)}
                          </span>
                          <p className="text-xs text-muted-foreground">
                            {completedUnits} / {totalUnits} units
                          </p>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right column */}
        <div className="space-y-6">
          {/* Reporting Summary */}
          <Card>
            <CardHeader>
              <CardTitle>Reporting Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Units reported</p>
                <p className="text-2xl font-bold">{totalUnitsCompleted}</p>
                <p className="text-xs text-muted-foreground">out of {totalUnitsAllJobs} total units</p>
              </div>

              <div className="space-y-2 pt-2 border-t">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Jobs fully reported</span>
                  <span className="font-semibold">{jobsFullyReported}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Jobs with missing reports</span>
                  <span className="font-semibold">{jobsWithMissingReports}</span>
                </div>
              </div>

              <div className="pt-2">
                <div className="h-2 w-full bg-muted rounded-full">
                  <div className="h-2 bg-primary rounded-full transition-all" style={{ width: `${reportProgress}%` }} />
                </div>
                <p className="text-xs text-muted-foreground text-center mt-1">{reportProgress}% complete</p>
              </div>
            </CardContent>
          </Card>

          {/* Quick Links */}
          <Card>
            <CardHeader>
              <CardTitle>Quick Links</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm">
                <li>
                  <Link href="/technician/jobs" className="text-primary hover:underline">
                    Go to My Jobs
                  </Link>
                </li>
                <li>
                  <Link href="/technician/schedule" className="text-primary hover:underline">
                    View Schedule
                  </Link>
                </li>
                <li>
                  <Link href="/technician/notifications" className="text-primary hover:underline">
                    View Notifications
                  </Link>
                </li>
              </ul>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

function formatStatus(status: string): string {
  return status
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ")
}

function getStatusClasses(status: string): string {
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
    default:
      return "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300"
  }
}

function formatDateTime(dateString: string): string {
  const date = new Date(dateString)
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true
  })
}