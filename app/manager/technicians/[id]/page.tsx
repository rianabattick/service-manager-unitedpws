import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { redirect } from "next/navigation"
import { getCurrentUser } from "@/lib/db"
import { createClient } from "@/lib/supabase-server"
import { ArrowLeft } from "lucide-react"

export default async function TechnicianDetailPage({ params }: { params: { id: string } }) {
  const { id } = params
  const user = await getCurrentUser()

  if (!user) {
    redirect("/login")
  }

  if (!["owner", "admin", "manager", "dispatcher"].includes(user.role)) {
    redirect("/login")
  }

  if (id === "new") {
    redirect("/manager/technicians?action=create")
  }

  const supabase = await createClient()

  // Fetch technician details
  const { data: technician, error: techError } = await supabase
    .from("users")
    .select("*")
    .eq("id", id)
    .eq("organization_id", user.organization_id)
    .eq("role", "technician")
    .single()

  if (techError || !technician) {
    redirect("/manager/technicians")
  }

  // Fetch assigned jobs with details
  const { data: jobAssignments } = await supabase
    .from("job_technicians")
    .select(
      `
      *,
      job:jobs (
        id,
        job_number,
        title,
        status,
        scheduled_start,
        scheduled_end,
        customer:customers (
          id,
          company_name,
          first_name,
          last_name
        ),
        location:service_locations (
          name
        )
      )
    `,
    )
    .eq("technician_id", id)
    .order("assigned_at", { ascending: false })

  const jobs = jobAssignments?.map((ja: any) => ja.job).filter(Boolean) || []
  const activeJobs = jobs.filter((j: any) => !["completed", "cancelled"].includes(j.status))
  const completedJobs = jobs.filter((j: any) => j.status === "completed")

  const specialty = technician.preferences?.specialty || "Not specified"

  return (
    <div className="space-y-6">
      {/* Back Button */}
      <Link
        href="/manager/technicians"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Technicians
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">{technician.full_name}</h1>
          <p className="text-muted-foreground">{specialty}</p>
        </div>
        <div className="flex gap-2">
          <Link href={`/manager/technicians/${id}/edit`}>
            <Button variant="outline">Edit</Button>
          </Link>
          <span
            className={`inline-flex items-center px-3 py-2 rounded-md text-sm font-medium ${
              technician.is_active
                ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300"
                : "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300"
            }`}
          >
            {technician.is_active ? "Active" : "Inactive"}
          </span>
        </div>
      </div>

      {/* Statistics */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Active Jobs</p>
              <p className="text-3xl font-bold">{activeJobs.length}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Completed Jobs</p>
              <p className="text-3xl font-bold">{completedJobs.length}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Total Assignments</p>
              <p className="text-3xl font-bold">{jobs.length}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Single Column Layout */}
      <div className="space-y-6">
        {/* Contact Information */}
        <Card>
          <CardHeader>
            <CardTitle>Contact Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm text-muted-foreground">Email</p>
              <p className="font-medium">{technician.email || "—"}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Phone</p>
              <p className="font-medium">{technician.phone || "—"}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Specialty</p>
              <p className="font-medium">{specialty}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Member Since</p>
              <p className="font-medium">
                {technician.created_at ? new Date(technician.created_at).toLocaleDateString() : "—"}
              </p>
            </div>
            {technician.last_login_at && (
              <div>
                <p className="text-sm text-muted-foreground">Last Login</p>
                <p className="font-medium">{new Date(technician.last_login_at).toLocaleString()}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Active Jobs */}
        <Card>
          <CardHeader>
            <CardTitle>Active Jobs</CardTitle>
          </CardHeader>
          <CardContent>
            {activeJobs.length === 0 ? (
              <p className="text-muted-foreground text-sm">No active jobs</p>
            ) : (
              <div className="space-y-3">
                {activeJobs.map((job: any) => (
                  <Link
                    key={job.id}
                    href={`/manager/jobs/${job.id}`}
                    className="block p-3 rounded-lg border border-border hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex-1 space-y-1">
                        <p className="font-medium">{job.title || job.job_number}</p>
                        <p className="text-sm text-muted-foreground">
                          {job.customer?.company_name ||
                            `${job.customer?.first_name || ""} ${job.customer?.last_name || ""}`.trim() ||
                            "Unknown"}
                        </p>
                        {job.scheduled_start && (
                          <p className="text-xs text-muted-foreground">
                            {new Date(job.scheduled_start).toLocaleDateString()}
                          </p>
                        )}
                      </div>
                      <span
                        className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(job.status)}`}
                      >
                        {job.status}
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent Completed Jobs */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Completed Jobs</CardTitle>
        </CardHeader>
        <CardContent>
          {completedJobs.length === 0 ? (
            <p className="text-muted-foreground text-sm">No completed jobs</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="border-b border-border">
                  <tr className="text-left">
                    <th className="pb-3 font-semibold">Job Title</th>
                    <th className="pb-3 font-semibold">Customer</th>
                    <th className="pb-3 font-semibold">Scheduled Date</th>
                    <th className="pb-3 font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {completedJobs.slice(0, 10).map((job: any) => (
                    <tr key={job.id} className="hover:bg-muted/50">
                      <td className="py-3">
                        <Link href={`/manager/jobs/${job.id}`} className="text-primary hover:underline font-medium">
                          {job.title || job.job_number}
                        </Link>
                      </td>
                      <td className="py-3">
                        {job.customer?.company_name ||
                          `${job.customer?.first_name || ""} ${job.customer?.last_name || ""}`.trim() ||
                          "Unknown"}
                      </td>
                      <td className="py-3 text-muted-foreground">
                        {job.scheduled_start ? new Date(job.scheduled_start).toLocaleDateString() : "—"}
                      </td>
                      <td className="py-3">
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300">
                          {job.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function getStatusColor(status: string): string {
  switch (status) {
    case "pending":
      return "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300"
    case "confirmed":
      return "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
    case "in_progress":
      return "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300"
    case "completed":
      return "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300"
    case "cancelled":
      return "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300"
    default:
      return "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300"
  }
}
