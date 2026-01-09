import { redirect, notFound } from "next/navigation"
import { getCurrentUser, getJobDetail } from "@/lib/db"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { getStatusColor, getTechnicianStatusColor } from "@/lib/utils"
import { Button } from "@/components/ui/button"

export default async function TechnicianJobDetailPage({ params }: { params: { id: string } }) {
  const user = await getCurrentUser()

  if (!user) {
    redirect("/login")
  }

  if (user.role !== "technician") {
    redirect("/manager")
  }

  const { id } = params

  // Fetch complete job detail
  const jobDetail = await getJobDetail(id, user.organization_id)

  if (!jobDetail) {
    notFound()
  }

  const { job, technicians, units } = jobDetail

  // Check if this technician is assigned to this job
  const technicianAssignment = technicians.find((t) => t.id === user.id)

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link
          href="/technician/jobs"
          className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to My Jobs
        </Link>
      </div>

      {/* Header */}
      <div>
        <div className="flex items-center gap-3 mb-2">
          <h1 className="text-3xl font-bold">{job.title || `Job #${job.job_number}`}</h1>
          {technicianAssignment && (
            <span
              className={`inline-flex items-center px-2 py-1 rounded-md text-xs font-medium ${getTechnicianStatusColor(technicianAssignment.status)}`}
            >
              {technicianAssignment.status === "accepted"
                ? "Assigned to you"
                : technicianAssignment.status === "pending"
                  ? "Pending your response"
                  : technicianAssignment.status}
            </span>
          )}
        </div>
        <p className="text-muted-foreground">Job details including units and report expectations.</p>
      </div>

      {/* Main Layout: 2-column on desktop, stacked on mobile */}
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

                {job.site_locations && job.site_locations.length > 0 ? (
                  <div className="sm:col-span-2">
                    <span className="text-sm text-muted-foreground">Site Address(s)</span>
                    <div className="space-y-3 mt-1">
                      {(() => {
                        // Group locations by service_location_id to avoid duplicates
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
                              notes: loc.site_notes, // Get site notes
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
                              <div className="mt-2 p-2 bg-muted rounded text-xs">
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
                    <span className="text-sm text-muted-foreground">Site Address</span>
                    <div className="mt-1">
                      <p className="font-medium">{job.site_name}</p>
                      {job.site_address && <p className="text-sm text-muted-foreground">{job.site_address}</p>}
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
                    {job.job_type === "contracted" ? "Contracted" : job.job_type === "daily" ? "Daily" : "Not set"}
                  </p>
                </div>

                <div>
                  <span className="text-sm text-muted-foreground">Service</span>
                  <p className="font-medium">{job.service_type || "Not set"}</p>
                </div>

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
                    {job.service_agreement_number
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

          {/* Technicians Section */}
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
                          {tech.id === user.id && <span className="text-muted-foreground ml-2">(You)</span>}
                          {tech.is_lead && (
                            <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-primary/10 text-primary">
                              Lead
                            </span>
                          )}
                        </p>
                        {tech.email && tech.full_name && <p className="text-xs text-muted-foreground">{tech.email}</p>}
                        {/* Site Address and Location Display */}
                        {tech.site_address && tech.site_location_name && (
                          <p className="text-xs text-muted-foreground">
                            Site: {tech.site_address} → {tech.site_location_name}
                          </p>
                        )}
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
        </div>

        {/* Right Column */}
        <div className="space-y-6">
          {/* Units & Reports Section */}
          <Card>
            <CardHeader>
              <CardTitle>
                <Link href={`/technician/jobs/${id}/reports`}>
                  <Button variant="outline" className="justify-start bg-transparent px-4 text-xl font-semibold">
                    Units & Reports
                  </Button>
                </Link>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {units.length === 0 ? (
                <p className="text-muted-foreground text-sm">No units linked to this job yet.</p>
              ) : (
                <div className="space-y-4">
                  {units.map((unit) => (
                    <div key={unit.equipment_id} className="space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1">
                          <p className="font-medium text-sm">{unit.equipment_name}</p>
                          {unit.serial_number && (
                            <p className="text-xs text-muted-foreground">SN#: {unit.serial_number}</p>
                          )}
                          {(unit.make || unit.model) && (
                            <p className="text-xs text-muted-foreground">
                              {[unit.make, unit.model].filter(Boolean).join(" ")}
                            </p>
                          )}
                          {unit.type && <p className="text-xs text-muted-foreground capitalize">{unit.type}</p>}
                          {/* Site Name and Location Name */}
                          {unit.site_name && <p className="text-xs text-muted-foreground">Site: {unit.site_name}</p>}
                        </div>
                        <span className="text-xs text-muted-foreground whitespace-nowrap">
                          {unit.reports_uploaded} / {unit.expected_reports} reports
                        </span>
                      </div>
                      {unit.expected_reports > 0 && (
                        <div className="w-full bg-muted rounded-full h-2">
                          <div
                            className="bg-primary h-2 rounded-full transition-all"
                            style={{
                              width: `${Math.min(100, (unit.reports_uploaded / unit.expected_reports) * 100)}%`,
                            }}
                          />
                        </div>
                      )}
                      {unit.unit_notes && (
                        <div className="mt-1 p-1.5 bg-muted rounded text-xs">
                          <p className="font-medium text-muted-foreground">Notes:</p>
                          <p className="whitespace-pre-wrap">{unit.unit_notes}</p>
                        </div>
                      )}
                    </div>
                  ))}
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
        </div>
      </div>
    </div>
  )
}
