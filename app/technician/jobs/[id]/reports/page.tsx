import { redirect, notFound } from "next/navigation"
import { getCurrentUser } from "@/lib/db"
import { createClient } from "@/lib/supabase-server"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { ReportUploadForm } from "./ReportUploadForm"
import { ReportActions } from "./ReportActions"

export default async function TechnicianReportsPage({ params }: { params: { id: string } }) {
  const user = await getCurrentUser()

  if (!user) {
    redirect("/login")
  }

  if (user.role !== "technician") {
    redirect("/manager")
  }

  const { id: jobId } = params
  const supabase = await createClient()

  // Get job details
  const { data: job, error: jobError } = await supabase
    .from("jobs")
    .select("id, job_number, organization_id")
    .eq("id", jobId)
    .eq("organization_id", user.organization_id)
    .single()

  if (jobError || !job) {
    notFound()
  }

  // Check if technician is assigned to this job
  const { data: assignment } = await supabase
    .from("job_technicians")
    .select("id")
    .eq("job_id", jobId)
    .eq("technician_id", user.id)
    .single()

  if (!assignment) {
    notFound()
  }

  // Get units for this job
  const { data: jobEquipment } = await supabase
    .from("job_equipment")
    .select(`
      equipment_id,
      expected_reports,
      equipment:equipment!job_equipment_equipment_id_fkey (
        id,
        name,
        serial_number
      )
    `)
    .eq("job_id", jobId)

  // Get existing reports for each unit
  const { data: attachments } = await supabase
    .from("job_attachments")
    .select("id, equipment_id, file_name, file_url, created_at, type")
    .eq("job_id", jobId)
    .in("type", ["photo", "document"])

  const units =
    jobEquipment?.map((je: any) => {
      const unitReports = attachments?.filter((a) => a.equipment_id === je.equipment_id) || []

      return {
        equipment_id: je.equipment_id,
        name: je.equipment?.name || "Unknown",
        serial_number: je.equipment?.serial_number || null,
        expected_reports: je.expected_reports || 0,
        reports: unitReports,
      }
    }) || []

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link
          href={`/technician/jobs/${jobId}`}
          className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Job
        </Link>
      </div>

      <div>
        <h1 className="text-3xl font-bold">Reports - Job #{job.job_number}</h1>
        <p className="text-muted-foreground">Upload and manage reports for each unit on this job.</p>
      </div>

      <div className="grid gap-6">
        {units.length === 0 ? (
          <Card>
            <CardContent className="p-6">
              <p className="text-muted-foreground text-center">No units assigned to this job.</p>
            </CardContent>
          </Card>
        ) : (
          units.map((unit) => (
            <Card key={unit.equipment_id}>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <div>
                    {unit.name}
                    {unit.serial_number && (
                      <span className="text-sm font-normal text-muted-foreground ml-2">(SN# {unit.serial_number})</span>
                    )}
                  </div>
                  <span className="text-sm font-normal text-muted-foreground">
                    Reports uploaded: {unit.reports.length} / {unit.expected_reports}
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Upload Form */}
                <ReportUploadForm jobId={jobId} equipmentId={unit.equipment_id} />

                {/* Existing Reports */}
                {unit.reports.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="text-sm font-medium">Uploaded Reports</h4>
                    <div className="space-y-2">
                      {unit.reports.map((report: any) => (
                        <div key={report.id} className="flex items-center justify-between p-3 border rounded-lg">
                          <div className="flex-1">
                            <p className="text-sm font-medium">{report.file_name}</p>
                            <p className="text-xs text-muted-foreground">
                              {new Date(report.created_at).toLocaleString()}
                            </p>
                          </div>
                          <ReportActions reportId={report.id} jobId={jobId} fileName={report.file_name} />
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  )
}
