import { redirect, notFound } from "next/navigation"
import { getCurrentUser } from "@/lib/db"
import { createClient } from "@/lib/supabase-server"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import Link from "next/link"
import { ArrowLeft, Eye } from "lucide-react"
import { Button } from "@/components/ui/button"

export default async function ManagerReportsPage({ params }: { params: { id: string } }) {
  const user = await getCurrentUser()

  if (!user) {
    redirect("/login")
  }

  const isManager = ["owner", "admin", "manager", "dispatcher"].includes(user.role)
  if (!isManager) {
    redirect("/technician")
  }

  const { id: jobId } = params
  const supabase = await createClient()

  const { data: job, error: jobError } = await supabase
    .from("jobs")
    .select("id, job_number, title, organization_id")
    .eq("id", jobId)
    .eq("organization_id", user.organization_id)
    .single()

  if (jobError || !job) {
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
    .select(`
      id,
      equipment_id,
      file_name,
      file_url,
      created_at,
      type,
      uploaded_by,
      uploader:users!job_attachments_uploaded_by_fkey (
        full_name
      )
    `)
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
          href={`/manager/jobs/${jobId}`}
          className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Job
        </Link>
      </div>

      <div>
        <h1 className="text-3xl font-bold">Reports - {job.title || `Job #${job.job_number}`}</h1>
        <p className="text-muted-foreground">View all reports uploaded for this job.</p>
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
              <CardContent>
                {unit.reports.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No reports uploaded yet for this unit.</p>
                ) : (
                  <div className="space-y-2">
                    {unit.reports.map((report: any) => (
                      <div key={report.id} className="flex items-center justify-between p-3 border rounded-lg">
                        <div className="flex-1">
                          <p className="text-sm font-medium">{report.file_name}</p>
                          <p className="text-xs text-muted-foreground">
                            Uploaded by {report.uploader?.full_name || "Unknown"} on{" "}
                            {new Date(report.created_at).toLocaleString()}
                          </p>
                        </div>
                        <a href={report.file_url} target="_blank" rel="noopener noreferrer">
                          <Button variant="outline" size="sm">
                            <Eye className="w-4 h-4 mr-1" />
                            View
                          </Button>
                        </a>
                      </div>
                    ))}
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
