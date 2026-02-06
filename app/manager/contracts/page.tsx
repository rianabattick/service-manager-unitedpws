import Link from "next/link"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { getCurrentUser } from "@/lib/db"
import { createClient } from "@/lib/supabase-server" // Updated import to use supabase-server
import { ContractsViewToggle } from "./ContractsViewToggle"
import { listContracts as listContractsFromLib } from "@/lib/contracts"
import { PageHeader } from "@/components/shared/PageHeader"

export const dynamic = "force-dynamic"
export const revalidate = 0

interface SearchParams {
  status?: string
  customerType?: string
  customer?: string
  coveragePlan?: string
  view?: "active" | "ended"
  page?: string
}

export default async function ContractsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  // Await the searchParams before accessing properties
  const resolvedParams = await searchParams
  const user = await getCurrentUser()

  if (!user) {
    return (
      <div className="space-y-6">
        <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-6">
          <h2 className="text-lg font-semibold text-yellow-900">Session Temporarily Unavailable</h2>
          <p className="mt-2 text-sm text-yellow-700">
            Unable to load your session. This may be due to a temporary connectivity issue in the preview environment.
          </p>
          <p className="mt-2 text-sm text-yellow-700">
            <strong>To continue:</strong>
          </p>
          <ul className="mt-2 list-disc list-inside text-sm text-yellow-700">
            <li>Refresh this page</li>
            <li>
              Or{" "}
              <a href="/login" className="underline font-medium">
                log in again
              </a>
            </li>
          </ul>
        </div>
      </div>
    )
  }

  if (!["owner", "admin", "manager", "dispatcher"].includes(user.role)) {
    return (
      <div className="space-y-6">
        <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-6">
          <h2 className="text-lg font-semibold text-yellow-900">Access Denied</h2>
          <p className="mt-2 text-sm text-yellow-700">
            You do not have permission to view contracts. Please contact your administrator.
          </p>
        </div>
      </div>
    )
  }

  const supabase = await createClient()

  const viewMode = resolvedParams.view || "active"

  const page = Number.parseInt((resolvedParams as any).page || "1")
  const itemsPerPage = 20
  const offset = (page - 1) * itemsPerPage

  // Fetch contracts with filters
  const contracts = await listContractsFromLib({
    organizationId: user.organization_id,
    status: resolvedParams.status,
    customerType: resolvedParams.customerType,
    customerId: resolvedParams.customer,
    coveragePlan: resolvedParams.coveragePlan,
    viewMode,
  })

  const totalItems = contracts.length
  const totalPages = Math.ceil(totalItems / itemsPerPage)
  const paginatedContracts = contracts.slice(offset, offset + itemsPerPage)

  // Get customers for filter
  const { data: customers } = await supabase
    .from("customers")
    .select("id, first_name, last_name, company_name")
    .eq("organization_id", user.organization_id)
    .eq("is_active", true)
    .order("company_name", { ascending: true, nullsFirst: false })
    .limit(500)

  const statuses = ["in_progress", "job_creation_needed", "renewal_needed", "on_hold", "cancelled", "overdue"]
  const coveragePlans = ["gold", "remedial", "pm_contract", "pseudo_gold"]

  return (
    <div className="space-y-6">
      <PageHeader
        title="Contracts"
        subtitle="Manage service agreements and upcoming renewals/jobs"
        actions={
          <Link href="/manager/contracts/new">
            <Button>Create Contract</Button>
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
                defaultValue={resolvedParams.status || ""}
                className="w-full px-3 py-2 border border-input rounded-md bg-background"
              >
                <option value="">All Statuses</option>
                {statuses.map((s) => (
                  <option key={s} value={s}>
                    {s.replace(/_/g, " ")}
                  </option>
                ))}
              </select>
            </div>

            {/* Contract Type Filter */}
            <div>
              <label htmlFor="customerType" className="block text-sm font-medium mb-2">
                Contract Type
              </label>
              <select
                id="customerType"
                name="customerType"
                defaultValue={resolvedParams.customerType || ""}
                className="w-full px-3 py-2 border border-input rounded-md bg-background"
              >
                <option value="">All Types</option>
                <option value="direct">Direct</option>
                <option value="subcontract">Subcontract</option>
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
                defaultValue={resolvedParams.customer || ""}
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

            {/* Coverage Plan Filter */}
            <div>
              <label htmlFor="coveragePlan" className="block text-sm font-medium mb-2">
                Coverage Plan
              </label>
              <select
                id="coveragePlan"
                name="coveragePlan"
                defaultValue={resolvedParams.coveragePlan || ""}
                className="w-full px-3 py-2 border border-input rounded-md bg-background"
              >
                <option value="">All Plans</option>
                {coveragePlans.map((p) => (
                  <option key={p} value={p}>
                    {p.replace(/_/g, " ")}
                  </option>
                ))}
              </select>
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
                href="/manager/contracts"
                className="w-full px-4 py-2 border border-input rounded-md text-center hover:bg-muted transition-colors"
              >
                Clear Filters
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Contracts Table */}
      <Card>
        <CardHeader>
          <ContractsViewToggle
            currentView={viewMode}
            currentPath="/manager/contracts"
            currentSearchParams={Object.fromEntries(
              Object.entries(resolvedParams).filter(([_, v]) => v !== undefined) as [string, string][],
            )}
          />
        </CardHeader>
        <CardContent>
          {paginatedContracts.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground">No {viewMode === "active" ? "active" : "ended"} contracts found</p>
              <p className="text-sm text-muted-foreground mt-2">
                {viewMode === "active"
                  ? "Try adjusting filters or creating a new contract."
                  : "Ended contracts will appear here."}
              </p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="border-b border-border">
                    <tr className="text-left">
                      <th className="pb-3 font-semibold">Contract Title</th>
                      <th className="pb-3 font-semibold">Customer</th>
                      <th className="pb-3 font-semibold">Start Date</th>
                      <th className="pb-3 font-semibold">End Date</th>
                      <th className="pb-3 font-semibold">Type</th>
                      <th className="pb-3 font-semibold">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {paginatedContracts.map((contract) => (
                      <tr key={contract.id} className="hover:bg-muted/50">
                        <td className="py-3">
                          <Link
                            href={`/manager/contracts/${contract.id}`}
                            className="text-primary hover:underline font-medium"
                          >
                            {contract.name || contract.agreement_number || "Untitled Contract"}
                          </Link>
                        </td>
                        <td className="py-3">{contract.customer_name}</td>
                        <td className="py-3 text-muted-foreground">
                          {contract.start_date ? new Date(contract.start_date).toLocaleDateString() : "—"}
                        </td>
                        <td className="py-3 text-muted-foreground">
                          {contract.end_date ? new Date(contract.end_date).toLocaleDateString() : "—"}
                        </td>
                        <td className="py-3 capitalize">{contract.type?.replace(/_/g, " ") || "—"}</td>
                        <td className="py-3">
                          <span
                            className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(contract.status)}`}
                          >
                            {contract.status.replace(/_/g, " ")}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-6 pt-6 border-t">
                  <p className="text-sm text-muted-foreground">
                    Showing {offset + 1}-{Math.min(offset + itemsPerPage, totalItems)} of {totalItems} contracts
                  </p>
                  <div className="flex gap-2">
                    {page > 1 && (
                      <Link
                        href={`/manager/contracts?${new URLSearchParams({ ...(resolvedParams as any), page: String(page - 1) }).toString()}`}
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
                        href={`/manager/contracts?${new URLSearchParams({ ...(resolvedParams as any), page: String(page + 1) }).toString()}`}
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
    case "in_progress":
      return "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
    case "renewal_needed":
      return "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300"
    case "job_creation_needed":
      return "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300"
    case "ended":
      return "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300"
    case "on_hold":
      return "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300"
    case "cancelled":
      return "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300"
    case "overdue":
      return "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300"
    default:
      return "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300"
  }
}