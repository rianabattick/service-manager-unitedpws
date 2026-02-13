import { redirect, notFound } from "next/navigation"
import { getCurrentUser } from "@/lib/db"
import { createClient } from "@/lib/supabase-server"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { ArrowLeft, Download, CheckCircle, Clock, FileText } from "lucide-react"
import { ReportUploadForm } from "./ReportUploadForm"
import { ReportActions } from "./ReportActions"

export default async function TechnicianReportsPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser()

  if (!user) {
    redirect("/login")
  }

  if (user.role !== "technician") {
    redirect("/manager")
  }

  const { id: jobId } = await params
  const supabase = await createClient()

  // 1. Fetch Job Title
  const { data: job, error: jobError } = await supabase
    .from("jobs")
    .select("id, job_number, title, organization_id")
    .eq("id", jobId)
    .eq("organization_id", user.organization_id)
    .single()

  if (jobError || !job) {
    notFound()
  }

  // Check assignment
  const { data: assignment } = await supabase
    .from("job_technicians")
    .select("id")
    .eq("job_id", jobId)
    .eq("technician_id", user.id)
    .single()

  if (!assignment) {
    notFound()
  }

  // Get units
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

  // 2. Fetch Reports + Uploader Name (Using the relation string you provided)
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

  // Process Units
  const units =
    jobEquipment?.map((je: any) => {
      const unitReports = attachments?.filter((a) => a.equipment_id === je.equipment_id) || []

      return {
        equipment_id: je.equipment_id,
        name: je.equipment?.name || "Unknown",
        serial_number: je.equipment?.serial_number || null,
        reports: unitReports,
        // 3. Logic Change: Complete if AT LEAST ONE report exists
        isComplete: unitReports.length > 0, 
      }
    }) || []

  // Calculate Overall Progress
  const totalUnits = units.length
  const completedUnits = units.filter((u) => u.isComplete).length

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
        {/* 1. Show Job Title */}
        <h1 className="text-3xl font-bold">Reports - {job.title || `Job #${job.job_number}`}</h1>
        <div className="flex items-center gap-2 mt-2">
          <p className="text-muted-foreground">Upload and manage reports for each unit.</p>
          {/* Overall Progress Badge */}
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
            {completedUnits} / {totalUnits} Units Completed
          </span>
        </div>
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
            <Card key={unit.equipment_id} className={unit.isComplete ? "border-green-200 dark:border-green-900" : ""}>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <div>
                    {unit.name}
                    {unit.serial_number && (
                      <span className="text-sm font-normal text-muted-foreground ml-2">(SN# {unit.serial_number})</span>
                    )}
                  </div>
                  {/* 4. Unit Status Badge */}
                  {unit.isComplete ? (
                    <div className="flex items-center gap-1.5 text-green-600 dark:text-green-400 text-sm font-medium">
                      <CheckCircle className="w-4 h-4" />
                      <span>Report Uploaded</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400 text-sm font-medium">
                      <Clock className="w-4 h-4" />
                      <span>Pending</span>
                    </div>
                  )}
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
                        <div key={report.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-3 border rounded-lg gap-3">
                           <div className="flex items-center gap-3 overflow-hidden">
                              <div className="p-2 bg-primary/10 rounded-md shrink-0">
                                <FileText className="w-5 h-5 text-primary" />
                              </div>
                              <div className="min-w-0">
                                <p className="text-sm font-medium truncate">{report.file_name}</p>
                                <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2 text-xs text-muted-foreground">
                                  <span>{new Date(report.created_at).toLocaleString()}</span>
                                  {/* Show Uploader Name if available */}
                                  {report.uploader?.full_name && (
                                    <>
                                      <span className="hidden sm:inline">•</span>
                                      <span>Uploaded by {report.uploader.full_name}</span>
                                    </>
                                  )}
                                </div>
                              </div>
                           </div>
                          
                           <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
  <ReportActions reportId={report.id} jobId={jobId} fileName={report.file_name} />
</div>
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