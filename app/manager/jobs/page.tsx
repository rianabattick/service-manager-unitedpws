import Link from "next/link"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { redirect } from "next/navigation"
import { getCurrentUser, listManagerJobsLite } from "@/lib/db"
import { createClient } from "@/lib/supabase-server"
import { JobsViewToggle } from "./JobsViewToggle"
import { checkAndUpdateOverdueJobs } from "@/lib/job-helpers"
import { PageHeader } from "@/components/shared/PageHeader"

export const dynamic = "force-dynamic"

interface SearchParams {
  status?: string
  fromDate?: string
  toDate?: string
  customer?: string
  technician?: string
  vendor?: string // Added vendor filter parameter
  view?: "active" | "completed" | "overdue" | "return-trip" // Updated view type to include return-trip
  page?: string // Add page parameter
}

export default async function ManagerJobsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
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

  const params = await searchParams
  const supabase = await createClient()

  await checkAndUpdateOverdueJobs(user.organization_id)

  const viewMode = params.view || "active"

  const page = Number.parseInt(params.page || "1")
  const itemsPerPage = 20
  const offset = (page - 1) * itemsPerPage

  // Fetch jobs with filters
  const jobs = await listManagerJobsLite({
    organizationId: user.organization_id,
    status: params.status,
    customerId: params.customer,
    technicianId: params.technician,
    vendorId: params.vendor, // Pass vendor filter to query
    fromDate: params.fromDate,
    toDate: params.toDate,
  })

  let filteredJobs = jobs

  // If a specific status filter is selected, filter by that status
  if (params.status) {
    filteredJobs = jobs.filter((job) => job.status === params.status)
  } else {
    // Otherwise, filter by view mode (active, completed, overdue, or return-trip)
    const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000)

    if (viewMode === "return-trip") {
      // Show jobs where manager_return_trip_needed = true
      filteredJobs = jobs.filter((job) => job.manager_return_trip_needed === true)
    } else if (viewMode === "overdue") {
      // Show jobs with overdue status OR jobs that are 2+ days past scheduled date
      filteredJobs = jobs.filter(
        (job) =>
          job.status === "overdue" ||
          (job.scheduled_date &&
            new Date(job.scheduled_date) < twoDaysAgo &&
            !["completed", "cancelled"].includes(job.status)),
      )
    } else if (viewMode === "completed") {
      filteredJobs = jobs.filter((job) => job.status === "completed")
    } else {
      // Active jobs: not completed, cancelled, or overdue
      filteredJobs = jobs.filter((job) => !["completed", "cancelled", "overdue"].includes(job.status))
    }
  }

  const totalItems = filteredJobs.length
  const totalPages = Math.ceil(totalItems / itemsPerPage)
  const paginatedJobs = filteredJobs.slice(offset, offset + itemsPerPage)

  const { data: customers } = await supabase
    .from("customers")
    .select("id, first_name, last_name, company_name")
    .eq("organization_id", user.organization_id)
    .eq("is_active", true)
    .order("company_name", { ascending: true, nullsFirst: false })
    .limit(100)

  const { data: technicians } = await supabase
    .from("users")
    .select("id, full_name")
    .eq("organization_id", user.organization_id)
    .eq("role", "technician")
    .eq("is_active", true)
    .order("full_name", { ascending: true })

  const { data: vendors } = await supabase
    .from("vendors")
    .select("id, name")
    .eq("organization_id", user.organization_id)
    .eq("is_active", true)
    .order("name", { ascending: true })

  const statuses = ["pending", "confirmed", "completed", "cancelled", "on_hold"]

  return (
    <div className="space-y-6">
      <PageHeader
        title="Jobs"
        subtitle="Overview of all jobs"
        actions={
          <Link href="/manager/schedule-job">
            <Button>Schedule Job</Button>
          </Link>
        }
      />

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <form method="get" className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Status Filter */}
            <div>
              <label htmlFor="status" className="block text-sm font-medium mb-2">
                Status
              </label>
              <select
                id="status"
                name="status"
                defaultValue={params.status || ""}
                className="w-full px-3 py-2 border border-input rounded-md bg-background"
              >
                <option value="">All Statuses</option>
                {statuses
                  .filter((s) => s !== "completed")
                  .map((s) => (
                    <option key={s} value={s}>
                      {s.replace("_", " ")}
                    </option>
                  ))}
              </select>
            </div>

            {/* Customer Filter */}
            <div>
              <label htmlFor="customer" className="block text-sm font-medium mb-2">
                Customer
              </label>
              <select
                id="customer"
                name="customer"
                defaultValue={params.customer || ""}
                className="w-full px-3 py-2 border border-input rounded-md bg-background"
              >
                <option value="">All Customers</option>
                {customers?.map((c: any) => (
                  <option key={c.id} value={c.id}>
                    {c.company_name || `${c.first_name || ""} ${c.last_name || ""}`.trim()}
                  </option>
                ))}
              </select>
            </div>

            {/* Field Engineer Filter */}
            <div>
              <label htmlFor="technician" className="block text-sm font-medium mb-2">
                Field Engineer
              </label>
              <select
                id="technician"
                name="technician"
                defaultValue={params.technician || ""}
                className="w-full px-3 py-2 border border-input rounded-md bg-background"
              >
                <option value="">All Field Engineers</option>
                {technicians?.map((t: any) => (
                  <option key={t.id} value={t.id}>
                    {t.full_name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="vendor" className="block text-sm font-medium mb-2">
                Subcontracted By
              </label>
              <select
                id="vendor"
                name="vendor"
                defaultValue={params.vendor || ""}
                className="w-full px-3 py-2 border border-input rounded-md bg-background"
              >
                <option value="">All Vendors</option>
                {vendors?.map((v: any) => (
                  <option key={v.id} value={v.id}>
                    {v.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Date Range */}
            <div className="md:col-span-2">
              <label className="block text-sm font-medium mb-2">Date Range</label>
              <div className="flex gap-2">
                <div className="flex-1">
                  <input
                    type="date"
                    id="fromDate"
                    name="fromDate"
                    defaultValue={params.fromDate || ""}
                    placeholder="From Date"
                    className="w-full px-3 py-2 border border-input rounded-md bg-background"
                  />
                </div>
                <div className="flex-1">
                  <input
                    type="date"
                    id="toDate"
                    name="toDate"
                    defaultValue={params.toDate || ""}
                    placeholder="To Date"
                    className="w-full px-3 py-2 border border-input rounded-md bg-background"
                  />
                </div>
              </div>
            </div>

            {/* Submit Button */}
            <div className="flex items-end">
              <button
                type="submit"
                className="w-full px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
              >
                Apply Filters
              </button>
            </div>

            {/* Clear Filters */}
            <div className="flex items-end">
              <Link
                href="/manager/jobs"
                className="w-full px-4 py-2 border border-input rounded-md text-center hover:bg-muted transition-colors"
              >
                Clear Filters
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Jobs Table */}
      <Card>
        <CardHeader>
          <JobsViewToggle
            currentView={viewMode}
            currentPath="/manager/jobs"
            currentSearchParams={Object.fromEntries(
              Object.entries(params).filter(([_, v]) => v !== undefined) as [string, string][],
            )}
          />
        </CardHeader>
        <CardContent>
          {paginatedJobs.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground">
                No{" "}
                {viewMode === "active"
                  ? "active"
                  : viewMode === "overdue"
                    ? "overdue"
                    : viewMode === "return-trip"
                      ? "return trip needed"
                      : "completed"}{" "}
                jobs found
              </p>
              <p className="text-sm text-muted-foreground mt-2">
                {viewMode === "active"
                  ? "Try adjusting filters or creating a new job."
                  : viewMode === "overdue"
                    ? "No jobs are currently overdue."
                    : viewMode === "return-trip"
                      ? "No jobs require return trips."
                      : "Completed jobs will appear here."}
              </p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="border-b border-border">
                    <tr className="text-left">
                      <th className="pb-3 font-semibold">Job Title</th>
                      <th className="pb-3 font-semibold">Company</th>
                      <th className="pb-3 font-semibold">Site</th>
                      <th className="pb-3 font-semibold">Status</th>
                      <th className="pb-3 font-semibold">Scheduled Date</th>
                      <th className="pb-3 font-semibold">Field Engineers</th>
                      <th className="pb-3 font-semibold">Units</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {paginatedJobs.map((job) => (
                      <tr key={job.id} className="hover:bg-muted/50">
                        <td className="py-3">
                          <Link href={`/manager/jobs/${job.id}`} className="text-primary hover:underline font-medium">
                            {job.title || "Untitled Job"}
                          </Link>
                        </td>
                        <td className="py-3">{job.customer_name}</td>
                        <td className="py-3 text-muted-foreground">{job.site_name || "—"}</td>
                        <td className="py-3">
                          <span
                            className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(job.status)}`}
                          >
                            {job.status}
                          </span>
                        </td>
                        <td className="py-3 text-muted-foreground">
                          {job.scheduled_date ? new Date(job.scheduled_date).toLocaleDateString() : "Not scheduled"}
                        </td>
                        <td className="py-3">
                          {job.technicians.length > 0 ? job.technicians.map((t) => t.full_name).join(", ") : "—"}
                        </td>
                        <td className="py-3 text-muted-foreground">
                          {job.unit_count > 0 ? `${job.unit_count} units` : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-6 pt-6 border-t">
                  <p className="text-sm text-muted-foreground">
                    Showing {offset + 1}-{Math.min(offset + itemsPerPage, totalItems)} of {totalItems} jobs
                  </p>
                  <div className="flex gap-2">
                    {page > 1 && (
                      <Link
                        href={`/manager/jobs?${new URLSearchParams({ ...(params as any), page: String(page - 1) }).toString()}`}
                      >
                        <Button variant="outline" size="sm">
                          Previous
                        </Button>
                      </Link>
                    )}
                    <span className="flex items-center px-3 text-sm">
                      Page {page} of {totalPages}
                    </span>
                    {page < totalPages && (
                      <Link
                        href={`/manager/jobs?${new URLSearchParams({ ...(params as any), page: String(page + 1) }).toString()}`}
                      >
                        <Button variant="outline" size="sm">
                          Next
                        </Button>
                      </Link>
                    )}
                  </div>
                </div>
              )}
            </>
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
    case "completed":
      return "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300"
    case "cancelled":
      return "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300"
    case "on_hold":
      return "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300"
    case "overdue":
      return "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300"
    case "return-trip":
      return "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300"
    default:
      return "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300"
  }
}
