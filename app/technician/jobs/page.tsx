import { redirect } from "next/navigation"
import { getCurrentUser, listTechnicianJobsDetailed } from "@/lib/db"
import { createClient } from "@/lib/supabase-server"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import Link from "next/link"
import { JobsViewToggle } from "./JobsViewToggle"
import { PaginationWrapper } from "@/components/ui/pagination-wrapper"
import { PageHeader } from "@/components/shared/PageHeader"

interface SearchParams {
  status?: string
  fromDate?: string
  toDate?: string
  customer?: string
  view?: "active" | "completed"
  page?: string
}

const ITEMS_PER_PAGE = 20

export default async function TechnicianJobsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const user = await getCurrentUser()

  if (!user) {
    redirect("/login")
  }

  if (user.role !== "technician") {
    redirect("/manager")
  }

  const params = await searchParams
  const supabase = await createClient()

  const viewMode = params.view || "active"
  const currentPage = Number(params.page) || 1

  let jobs = await listTechnicianJobsDetailed(user.id)

  jobs = jobs.filter((job) => (viewMode === "active" ? job.status !== "completed" : job.status === "completed"))

  if (params.status) {
    jobs = jobs.filter((job) => job.status === params.status)
  }

  if (params.customer) {
    jobs = jobs.filter((job) => job.customer_id === params.customer)
  }

  if (params.fromDate) {
    jobs = jobs.filter((job) => job.scheduled_at && new Date(job.scheduled_at) >= new Date(params.fromDate!))
  }

  if (params.toDate) {
    jobs = jobs.filter((job) => job.scheduled_at && new Date(job.scheduled_at) <= new Date(params.toDate!))
  }

  const totalJobs = jobs.length
  const totalPages = Math.ceil(totalJobs / ITEMS_PER_PAGE)
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE
  const paginatedJobs = jobs.slice(startIndex, startIndex + ITEMS_PER_PAGE)

  const { data: customers } = await supabase
    .from("customers")
    .select("id, first_name, last_name, company_name")
    .eq("organization_id", user.organization_id)
    .eq("is_active", true)
    .order("company_name", { ascending: true, nullsFirst: false })
    .limit(100)

  const statuses = ["pending", "confirmed", "completed", "cancelled", "on_hold", "overdue"]

  return (
    <div className="space-y-6">
      <PageHeader title="My Jobs" subtitle="Jobs assigned to you" />

      <Card>
        <CardContent className="pt-6">
          <form method="get" className="grid grid-cols-1 md:grid-cols-4 gap-4">
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

            <div>
              <label htmlFor="fromDate" className="block text-sm font-medium mb-2">
                From Date
              </label>
              <input
                type="date"
                id="fromDate"
                name="fromDate"
                defaultValue={params.fromDate || ""}
                className="w-full px-3 py-2 border border-input rounded-md bg-background"
              />
            </div>

            <div>
              <label htmlFor="toDate" className="block text-sm font-medium mb-2">
                To Date
              </label>
              <input
                type="date"
                id="toDate"
                name="toDate"
                defaultValue={params.toDate || ""}
                className="w-full px-3 py-2 border border-input rounded-md bg-background"
              />
            </div>

            <div className="flex items-end md:col-span-2">
              <button
                type="submit"
                className="w-full px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
              >
                Apply Filters
              </button>
            </div>

            <div className="flex items-end md:col-span-2">
              <Link
                href="/technician/jobs"
                className="w-full px-4 py-2 border border-input rounded-md text-center hover:bg-muted transition-colors"
              >
                Clear Filters
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <JobsViewToggle
            currentView={viewMode}
            currentPath="/technician/jobs"
            currentSearchParams={Object.fromEntries(
              Object.entries(params).filter(([_, v]) => v !== undefined) as [string, string][],
            )}
          />
        </CardHeader>
        <CardContent>
          {paginatedJobs.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground">You have no assigned jobs.</p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="border-b border-border">
                    <tr className="text-left">
                      <th className="pb-3 pr-6 font-semibold">Job Title</th>
                      <th className="pb-3 pr-6 font-semibold">Company</th>
                      <th className="pb-3 pr-6 font-semibold">Site</th>
                      <th className="pb-3 pr-6 font-semibold">Status</th>
                      <th className="pb-3 pr-6 font-semibold">Scheduled Date</th>
                      <th className="pb-3 pr-6 font-semibold">Units</th>
                      <th className="pb-3 font-semibold">Reports</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {paginatedJobs.map((job) => (
                      <tr key={job.job_id} className="hover:bg-muted/50">
                        <td className="py-3 pr-6">
                          <Link
                            href={`/technician/jobs/${job.job_id}`}
                            className="text-primary hover:underline font-medium"
                          >
                            {job.title || `Job #${job.job_number}`}
                          </Link>
                        </td>
                        <td className="py-3 pr-6">{job.customer_name}</td>
                        <td className="py-3 pr-6 text-muted-foreground">{job.location_name || "—"}</td>
                        <td className="py-3 pr-6">
                          <span
                            className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(
                              job.status,
                            )}`}
                          >
                            {formatStatus(job.status)}
                          </span>
                        </td>
                        <td className="py-3 pr-6 text-muted-foreground">
                          {job.scheduled_at
                            ? new Date(job.scheduled_at).toLocaleDateString("en-US", {
                                weekday: "short",
                                month: "short",
                                day: "numeric",
                                year: "numeric",
                                hour: "numeric",
                                minute: "2-digit",
                              })
                            : "Not scheduled"}
                        </td>
                        <td className="py-3 pr-6 text-muted-foreground">
                          {job.equipment.length > 0
                            ? `${job.equipment.length} ${job.equipment.length === 1 ? "unit" : "units"}`
                            : "—"}
                        </td>
                        <td className="py-3">
                          <span
                            className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                              job.report_progress.completed_reports >= job.report_progress.total_units
                                ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300"
                                : "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
                            }`}
                          >
                            {job.report_progress.completed_reports} / {job.report_progress.total_units}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {totalPages > 1 && (
                <div className="mt-6 flex justify-center">
                  <PaginationWrapper
                    currentPage={currentPage}
                    totalPages={totalPages}
                    baseUrl="/technician/jobs"
                    searchParams={params}
                  />
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
    default:
      return "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300"
  }
}

function formatStatus(status: string): string {
  return status
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ")
}
