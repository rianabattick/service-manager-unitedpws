import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { redirect, notFound } from "next/navigation"
import { ArrowLeft } from "lucide-react"
import { getCurrentUser } from "@/lib/db"
import { getContractDetail } from "@/lib/contracts"
import { DeleteContractButton } from "./DeleteContractButton"

export default async function ContractDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const user = await getCurrentUser()

  if (!user) {
    redirect("/login")
  }

  if (!["owner", "admin", "manager", "dispatcher"].includes(user.role)) {
    redirect("/login")
  }

  const { id } = await params

  if (id === "new") {
    redirect("/manager/contracts/new")
  }

  const contract = await getContractDetail(id)

  if (!contract) {
    notFound()
  }

  const totalPMsPerYear = contract.services.reduce((sum: number, s: any) => sum + s.frequency_months, 0)
  const totalServices = totalPMsPerYear * (contract.agreement_length_years || 1)
  const completedServices =
    contract.jobs?.filter((j: any) => {
      if (j.status !== "completed") return false
      const serviceType = (j.service_type || "").toLowerCase()
      return serviceType.includes("mjpm") || serviceType.includes("mnpm")
    }).length || 0

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link
          href="/manager/contracts"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Contracts
        </Link>
      </div>

      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">{contract.name || "Untitled Contract"}</h1>
          <p className="text-sm text-muted-foreground">
            {contract.agreement_number && `Agreement #${contract.agreement_number}`}
          </p>
        </div>
        <div className="flex gap-2">
          <Link href={`/manager/contracts/${id}/edit`}>
            <Button variant="outline">Edit Contract</Button>
          </Link>
          <DeleteContractButton contractId={id} />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[2fr_1.2fr] gap-6">
        {/* Left Column */}
        <div className="space-y-6">
          {/* Contract Overview */}
          <Card>
            <CardHeader>
              <CardTitle className="text-xl">Contract Overview</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <span className="text-sm text-muted-foreground">Customer</span>
                  <p className="text-sm font-medium">{contract.customer_name}</p>
                </div>
                <div>
                  <span className="text-sm text-muted-foreground">Customer Type</span>
                  <p className="text-sm capitalize font-medium">{contract.vendor_id ? "Subcontract" : "Direct"}</p>
                </div>
                {contract.vendor_name && (
                  <div>
                    <span className="text-sm text-muted-foreground">Subcontracted By</span>
                    <p className="text-sm font-medium">{contract.vendor_name}</p>
                  </div>
                )}
                <div>
                  <span className="text-sm text-muted-foreground">Status</span>
                  <p className="text-sm capitalize font-medium">{contract.status?.replace(/_/g, " ")}</p>
                </div>
                <div>
                  <span className="text-sm text-muted-foreground">Start Date</span>
                  <p className="text-sm font-medium">
                    {contract.start_date ? new Date(contract.start_date).toLocaleDateString() : "—"}
                  </p>
                </div>
                <div>
                  <span className="text-sm text-muted-foreground">End Date</span>
                  <p className="text-sm font-medium">
                    {contract.end_date ? new Date(contract.end_date).toLocaleDateString() : "—"}
                  </p>
                </div>
                <div>
                  <span className="text-sm text-muted-foreground">Type of Coverage</span>
                  <p className="text-sm capitalize font-medium">{contract.type?.replace(/_/g, " ") || "—"}</p>
                </div>
                <div>
                  <span className="text-sm text-muted-foreground">Length of Agreement</span>
                  <p className="text-sm font-medium">
                    {contract.agreement_length_years || 1} year
                    {(contract.agreement_length_years || 1) !== 1 ? "s" : ""}
                  </p>
                </div>
                {contract.billing_type && (
                  <div>
                    <span className="text-sm text-muted-foreground">Type of Billing</span>
                    <p className="text-sm capitalize font-medium">{contract.billing_type.replace(/_/g, " ")}</p>
                  </div>
                )}
                {contract.pm_due_next && (
                  <div>
                    <span className="text-sm text-muted-foreground">PM Due Next</span>
                    <p className="text-sm font-medium">{new Date(contract.pm_due_next).toLocaleDateString()}</p>
                  </div>
                )}
              </div>

              {contract.unit_information && (
                <div className="mt-6">
                  <span className="text-sm text-muted-foreground">Unit Information</span>
                  <p className="mt-2 text-sm font-medium whitespace-pre-wrap">{contract.unit_information}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Notes */}
          <Card>
            <CardHeader>
              <CardTitle className="text-xl">Notes</CardTitle>
            </CardHeader>
            <CardContent>
              {contract.notes ? (
                <p className="text-sm whitespace-pre-wrap">{contract.notes}</p>
              ) : (
                <p className="text-sm text-muted-foreground">No notes added yet.</p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right Column */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-xl">Services</CardTitle>
            </CardHeader>
            <CardContent>
              {contract.services && contract.services.length > 0 ? (
                <div className="space-y-4">
                  <div className="flex items-center gap-4 p-4 bg-muted rounded-lg">
                    <div className="text-2xl font-bold text-muted-foreground">
                      {completedServices}/{totalServices}
                    </div>
                    <div>
                      <p className="font-semibold">
                        {totalPMsPerYear} PM{totalPMsPerYear !== 1 ? "s" : ""} per year
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Total: {totalServices} services over {contract.agreement_length_years || 1} year
                        {(contract.agreement_length_years || 1) !== 1 ? "s" : ""}
                      </p>
                    </div>
                  </div>

                  <div className="space-y-3">
                    {contract.services.map((service: any) => (
                      <div
                        key={service.id}
                        className="flex items-center justify-between p-4 border border-border rounded-md"
                      >
                        <div>
                          <p className="text-sm font-medium">{service.service_type}</p>
                          <p className="text-sm text-muted-foreground">{service.frequency_months} per year</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No services configured</p>
              )}
            </CardContent>
          </Card>

          {/* Job History */}
          <Card>
            <CardHeader>
              <CardTitle className="text-xl">Job History</CardTitle>
            </CardHeader>
            <CardContent>
              {contract.jobs && contract.jobs.length > 0 ? (
                <div className="space-y-3">
                  {contract.jobs.map((job: any) => (
                    <Link
                      key={job.id}
                      href={`/manager/jobs/${job.id}`}
                      className="block p-3 rounded-lg border border-border hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{job.title || job.job_number}</p>
                          <p className="text-xs text-muted-foreground">
                            {job.scheduled_start ? new Date(job.scheduled_start).toLocaleDateString() : "Not scheduled"}
                          </p>
                          <p className="text-xs text-muted-foreground">{job.service_type || "—"}</p>
                          {job.status === "completed" && job.completed_by_name && job.completed_at && (
                            <p className="text-xs text-green-600 dark:text-green-400 mt-1">
                              Confirmed by {job.completed_by_name} on{" "}
                              {new Date(job.completed_at).toLocaleDateString("en-US", {
                                month: "short",
                                day: "numeric",
                                year: "numeric",
                              })}
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
              ) : (
                <p className="text-sm text-muted-foreground">No jobs created for this contract yet</p>
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
    case "overdue":
      return "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300"
    case "on_hold":
      return "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300"
    default:
      return "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300"
  }
}
