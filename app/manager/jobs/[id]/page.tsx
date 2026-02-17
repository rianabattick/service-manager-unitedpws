import { redirect, notFound } from "next/navigation"
import { getCurrentUser, getJobDetail } from "@/lib/db"
import { createClient } from "@/lib/supabase-server"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import Link from "next/link"
import { ArrowLeft, CheckCircle2, CircleDashed } from "lucide-react"
import { getStatusColor, getTechnicianStatusColor } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { DeleteJobButton } from "./DeleteJobButton"
import { CompletionChecklist } from "./CompletionChecklist"
import { ReturnTripManager } from "./ReturnTripManager"

// Helper to format generic strings like "time_and_materials" -> "Time & Materials"
function formatString(str: string | null) {
  if (!str) return "Not set"
  return str
    .split(/_| /)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ")
    .replace("And", "&")
}

// Specific helper for Billing Status to get exact casing
function getBillingStatusLabel(status: string | null) {
  if (!status) return "Not set"
  
  switch (status.toLowerCase()) {
    case "sent_to_billing": return "Sent to billing"
    case "invoiced": return "Invoiced"
    case "paid": return "Paid"
    case "processing": return "Processing"
    case "un_billable": 
    case "un-billable":
    case "unbillable":
      return "Un-billable" 
    default:
      return formatString(status)
  }
}

export default async function JobDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  if (id === "new") return null

  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  if (!uuidRegex.test(id)) notFound()

  const user = await getCurrentUser()
  if (!user) redirect("/login")

  const jobDetail = await getJobDetail(id, user.organization_id)
  if (!jobDetail) notFound()

  const { job, technicians, units, contacts } = jobDetail

  // Fetch Attachments for Progress Logic
  const { data: attachments } = await supabase
    .from("job_attachments")
    .select("equipment_id")
    .eq("job_id", id)
    .in("type", ["photo", "document"])

  // Calculate Overall Progress
  const totalUnits = units.length
  // Create a Set of equipment IDs that have at least one attachment
  const completedUnitIds = new Set(attachments?.map((a) => a.equipment_id) || [])
  const completedUnitsCount = units.filter((u) => completedUnitIds.has(u.id || u.equipment_id)).length
  
  // 0/0 is 100% complete
  const progressPercent = totalUnits > 0 ? Math.round((completedUnitsCount / totalUnits) * 100) : 100
  const isAllReported = totalUnits === 0 || completedUnitsCount >= totalUnits

  const isManager = ["owner", "admin", "manager", "dispatcher"].includes(user.role)
  const isTechnician = user.role === "technician"

  const createdDate = new Date(job.created_at)
  const isJobClosed = job.status === "completed" || job.status === "closed"

  let daysCount: number
  let daysLabel: string

  if (isJobClosed && job.completed_at) {
    const completedDate = new Date(job.completed_at)
    daysCount = Math.floor((completedDate.getTime() - createdDate.getTime()) / (1000 * 60 * 60 * 24))
    daysLabel = `${daysCount} day${daysCount !== 1 ? "s" : ""} to complete`
  } else {
    const now = new Date()
    daysCount = Math.floor((now.getTime() - createdDate.getTime()) / (1000 * 60 * 60 * 24))
    daysLabel = `${daysCount} day${daysCount !== 1 ? "s" : ""} open`
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link
          href="/manager/jobs"
          className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Jobs
        </Link>
      </div>

      {/* Header */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold">{job.title || "Untitled Job"}</h1>
            {isTechnician && (
              <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                Technician view
              </span>
            )}
            {isManager && (
              <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300">
                Manager view
              </span>
            )}
          </div>

          {isManager && (
            <div className="flex gap-2">
              <Link href={`/manager/jobs/${id}/edit`}>
                <Button variant="outline">Edit Job</Button>
              </Link>
              <DeleteJobButton jobId={id} jobNumber={job.job_number || job.id} buttonText="Delete" />
            </div>
          )}
        </div>
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <span className="font-mono">Job #{job.job_number || job.id}</span>
          <span>•</span>
          <span>Created {createdDate.toLocaleDateString()}</span>
          <span>•</span>
          <span className="font-medium">{daysLabel}</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[2fr_1.2fr] gap-6">
        {/* Left Column */}
        <div className="space-y-6">
          {/* Basic Info Section */}
          <Card>
            <CardHeader>
              <CardTitle>Job Overview</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <span className="text-sm text-muted-foreground">Company</span>
                  <p className="font-medium">{job.customer_name}</p>
                </div>

                <div>
                  <span className="text-sm text-muted-foreground">Customer Type</span>
                  <p className="font-medium">{formatString(job.customer_type || job.customer?.customer_type || (job.vendor_id ? "Subcontract" : "Direct"))}</p>
                </div>

                {job.vendor_name && (
                  <div>
                    <span className="text-sm text-muted-foreground">Subcontracted By</span>
                    <p className="font-medium">{job.vendor_name}</p>
                  </div>
                )}

                {job.site_locations && job.site_locations.length > 0 ? (
                  <div className="sm:col-span-2">
                    <span className="text-sm text-muted-foreground">Site Address(s)</span>
                    <div className="space-y-3 mt-1">
                      {(() => {
                        const groupedBySite = job.site_locations.reduce((acc: any, loc: any) => {
                          const siteId = loc.service_location_id
                          if (!acc[siteId]) {
                            acc[siteId] = {
                              name: loc.service_location_name,
                              address: loc.service_location_address,
                              address_line_2: loc.service_location_address_line_2,
                              city: loc.service_location_city,
                              state: loc.service_location_state,
                              zip_code: loc.service_location_zip_code,
                              notes: loc.site_notes,
                            }
                          }
                          return acc
                        }, {})

                        return Object.values(groupedBySite).map((site: any, index: number) => (
                          <div key={index} className="text-sm">
                            <p className="font-medium">{site.name}</p>
                            {site.address && <p className="text-sm text-muted-foreground">{site.address}</p>}
                            {site.address_line_2 && (
                              <p className="text-sm text-muted-foreground">{site.address_line_2}</p>
                            )}
                            {(site.city || site.state || site.zip_code) && (
                              <p className="text-sm text-muted-foreground">
                                {[site.city, site.state, site.zip_code].filter(Boolean).join(", ")}
                              </p>
                            )}
                            {site.notes && (
                              <div className="ml-2 mt-2 p-2 bg-muted rounded text-xs">
                                <p className="font-medium text-muted-foreground mb-1">Site Notes:</p>
                                <p className="whitespace-pre-wrap">{site.notes}</p>
                              </div>
                            )}
                          </div>
                        ))
                      })()}
                    </div>
                  </div>
                ) : job.site_name ? (
                  <div className="sm:col-span-2">
                    <span className="text-sm text-muted-foreground">Site Address(s)</span>
                    <div className="mt-1">
                      <p className="font-medium">{job.site_name}</p>
                      {job.site_address && <p className="text-sm text-muted-foreground mt-1">{job.site_address}</p>}
                    </div>
                  </div>
                ) : null}

                <div>
                  <span className="text-sm text-muted-foreground">PO# / WO#</span>
                  <p className="font-medium">{job.po_number || "—"}</p>
                </div>

                <div>
                  <span className="text-sm text-muted-foreground">Estimate#</span>
                  <p className="font-medium">{job.estimate_number || "—"}</p>
                </div>

                <div>
                  <span className="text-sm text-muted-foreground">Job Type</span>
                  <p className="font-medium">
                    {formatString(job.job_type)}
                  </p>
                </div>

                <div>
                  <span className="text-sm text-muted-foreground">Service</span>
                  <p className="font-medium">{job.service_type || "Not set"}</p>
                </div>

                {isManager && (
                  <>
                    <div>
                      <span className="text-sm text-muted-foreground">Billing Status</span>
                      <p className="font-medium">
                        {getBillingStatusLabel(job.billing_status)}
                      </p>
                    </div>

                    <div>
                      <span className="text-sm text-muted-foreground">Invoice #</span>
                      <p className="font-medium">{job.invoice_number || "—"}</p>
                    </div>
                  </>
                )}

                <div>
                  <span className="text-sm text-muted-foreground">Status</span>
                  <div>
                    <span
                      className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(job.status)}`}
                    >
                      {job.status}
                    </span>
                  </div>
                </div>

                <div>
                  <span className="text-sm text-muted-foreground">Scheduled</span>
                  <p className="font-medium">
                    {job.scheduled_start
                      ? new Date(job.scheduled_start).toLocaleString("en-US", {
                          timeZone: "America/New_York",
                          weekday: "short",
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                          hour: "numeric",
                          minute: "2-digit",
                        })
                      : "Not scheduled"}
                  </p>
                </div>

                <div>
                  <span className="text-sm text-muted-foreground">Contract</span>
                  <p className="font-medium">
                    {job.service_agreement_title
                      ? job.service_agreement_title
                      : job.service_agreement_number
                        ? `Contract #${job.service_agreement_number}`
                        : "No contract (daily job)"}
                  </p>
                </div>

                <div>
                  <span className="text-sm text-muted-foreground">Is Return Trip</span>
                  <p className="font-medium">{job.return_trip_needed ? "Yes" : "No"}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Field Engineers Assigned Section */}
          <Card>
            <CardHeader>
              <CardTitle>Field Engineers Assigned</CardTitle>
            </CardHeader>
            <CardContent>
              {technicians.length === 0 ? (
                <p className="text-muted-foreground text-sm">No field engineers assigned yet.</p>
              ) : (
                <div className="space-y-3">
                  {technicians.map((tech) => (
                    <div
                      key={tech.id}
                      className="flex items-center justify-between p-3 rounded-lg border border-border"
                    >
                      <div>
                        <p className="font-medium">
                          {tech.full_name || tech.email || "Unknown"}
                          {tech.is_lead && (
                            <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-primary/10 text-primary">
                              Lead
                            </span>
                          )}
                        </p>
                        {tech.email && tech.full_name && <p className="text-xs text-muted-foreground">{tech.email}</p>}
                      </div>
                      <span
                        className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getTechnicianStatusColor(tech.status)}`}
                      >
                        {tech.status}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Point(s) of Contact</CardTitle>
            </CardHeader>
            <CardContent>
              {contacts.length === 0 ? (
                <p className="text-muted-foreground text-sm">No point of contact added for this job yet.</p>
              ) : (
                <div className="space-y-3">
                  {contacts.map((contact) => (
                    <div key={contact.id} className="p-3 rounded-lg border border-border">
                      <p className="font-medium">{contact.name || `${contact.first_name || ''} ${contact.last_name || ''}`.trim() || 'Unknown'}</p>
                      <p className="text-sm text-muted-foreground">{contact.phone}</p>
                      {contact.email && <p className="text-sm text-muted-foreground">{contact.email}</p>}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right Column */}
        <div className="space-y-6">
          
          {/* Units & Reports Section */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                {/* 👇 RESTORED BUTTON: Standard "Outline" variant for brightness */}
                <CardTitle>
                   <Link href={`/manager/jobs/${id}/reports`}>
                      <Button variant="outline" className="text-lg font-semibold">
                        Units & Reports
                      </Button>
                   </Link>
                </CardTitle>
                <span className={`text-xs font-medium px-2 py-1 rounded-full ${
                   isAllReported 
                    ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300" 
                    : "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
                }`}>
                  {completedUnitsCount} / {totalUnits} Complete
                </span>
              </div>
              {/* Progress Bar */}
              <div className="h-2 w-full bg-muted rounded-full mt-2">
                <div 
                   className="h-2 bg-primary rounded-full transition-all" 
                   style={{ width: `${progressPercent}%` }} 
                />
              </div>
            </CardHeader>
            <CardContent>
              {units.length === 0 ? (
                <p className="text-muted-foreground text-sm">No units linked to this job yet.</p>
              ) : (
                <div className="space-y-4 mt-2">
                  {units.map((unit) => {
                    const isReported = completedUnitIds.has(unit.equipment_id)
                    return (
                      <div key={unit.equipment_id} className="flex items-start justify-between border-b pb-3 last:border-0 last:pb-0">
                        <div className="flex-1">
                          <p className="font-medium text-sm">{unit.equipment_name}</p>
                          {unit.serial_number && (
                            <p className="text-xs text-muted-foreground">SN: {unit.serial_number}</p>
                          )}
                          {unit.site_name && (
                            <p className="text-xs text-muted-foreground">Site: {unit.site_name}</p>
                          )}
                        </div>
                        {/* Status Icon */}
                        <div className="pt-1 pl-2">
                           {isReported ? (
                             <CheckCircle2 className="h-5 w-5 text-green-500" />
                           ) : (
                             // 👇 DOTTED GRAY CIRCLE (Pending)
                             <CircleDashed className="h-5 w-5 text-muted-foreground" />
                           )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Notes Section */}
          <Card>
            <CardHeader>
              <CardTitle>Notes</CardTitle>
            </CardHeader>
            <CardContent>
              {job.notes ? (
                <p className="text-sm whitespace-pre-wrap">{job.notes}</p>
              ) : (
                <p className="text-muted-foreground text-sm">No notes added yet.</p>
              )}
            </CardContent>
          </Card>

          {isManager && (
            <CompletionChecklist
              jobId={id}
              currentStatus={job.status}
              billingStatus={job.billing_status}
              totalReports={totalUnits}
              uploadedReports={completedUnitsCount}
            />
          )}

          {isManager && (
            <ReturnTripManager
              jobId={id}
              initialNeeded={job.manager_return_trip_needed}
              initialReason={job.manager_return_trip_reason}
            />
          )}
        </div>
      </div>
    </div>
  )
}