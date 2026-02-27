import { redirect, notFound } from "next/navigation"
import { getCurrentUser } from "@/lib/db"
import { createClient } from "@/lib/supabase-server"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import Link from "next/link"
import { ArrowLeft, FileText, CheckCircle2, Clock } from "lucide-react" 
import { Button } from "@/components/ui/button"

// 👇 ADDED: Import the upload form and report actions (adjust the path as needed to point to where these files are saved!)
import { ReportUploadForm } from "@/app/technician/jobs/[id]/reports/ReportUploadForm"
import { ReportActions } from "@/app/technician/jobs/[id]/reports/ReportActions"

export default async function ManagerReportsPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser()

  if (!user) {
    redirect("/login")
  }

  const isManager = ["owner", "admin", "manager", "dispatcher"].includes(user.role)
  if (!isManager) {
    redirect("/technician")
  }

  // Await params for Next.js 15
  const { id: jobId } = await params
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

  // Calculate Overall Progress
  const totalUnits = units.length
  // Count units that have at least one report uploaded
  const completedUnitsCount = units.filter(u => u.reports.length > 0).length
  
  // 0/0 is considered Complete (Green)
  const isComplete = totalUnits === 0 || completedUnitsCount >= totalUnits

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

      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold">Reports - {job.title || `Job #${job.job_number}`}</h1>
          <p className="text-muted-foreground">View all reports uploaded for this job.</p>
        </div>
        {/* Header Badge */}
        <div>
          <span className={`px-3 py-1 rounded-full text-sm font-medium ${
            isComplete
            ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300"
            : "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
          }`}>
            {completedUnitsCount} / {totalUnits} Units Completed
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
          units.map((unit) => {
            // Determine status for this specific unit
            const hasReport = unit.reports.length > 0

            return (
              <Card key={unit.equipment_id}>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <div>
                      {unit.name}
                      {unit.serial_number && (
                        <span className="text-sm font-normal text-muted-foreground ml-2">(SN# {unit.serial_number})</span>
                      )}
                    </div>
                    
                    {/* Status Indicator */}
                    <div className="flex items-center gap-2">
                       {hasReport ? (
                         <>
                           <CheckCircle2 className="w-5 h-5 text-green-600" />
                           <span className="text-sm font-medium text-green-600 hidden sm:inline-block">Report Uploaded</span>
                         </>
                       ) : (
                         <>
                           <Clock className="w-5 h-5 text-orange-600 dark:text-orange-500" />
                           <span className="text-sm font-medium text-orange-600 dark:text-orange-500 hidden sm:inline-block">Pending</span>
                         </>
                       )}
                    </div>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* 👇 ADDED: Upload Form exactly as it is on the tech side */}
                  <ReportUploadForm jobId={jobId} equipmentId={unit.equipment_id} />

                  {/* Existing Reports */}
                  {unit.reports.length === 0 ? (
                    <p className="text-sm text-muted-foreground italic mt-2">No reports uploaded yet for this unit.</p>
                  ) : (
                    <div className="space-y-2 mt-2">
                      <h4 className="text-sm font-medium">Uploaded Reports</h4>
                      <div className="space-y-2">
                        {unit.reports.map((report: any) => (
                          <div 
                            key={report.id} 
                            className="flex flex-col sm:flex-row sm:items-center justify-between p-3 border rounded-lg gap-3"
                          >
                            <div className="flex items-center gap-3 overflow-hidden">
                              <div className="p-2 bg-primary/10 rounded-md shrink-0">
                                <FileText className="w-5 h-5 text-primary" />
                              </div>
                              
                              <div className="min-w-0">
                                <p className="text-sm font-medium truncate">{report.file_name}</p>
                                <p className="text-xs text-muted-foreground">
                                  Uploaded by {report.uploader?.full_name || "Unknown"} on{" "}
                                  {new Date(report.created_at).toLocaleString()}
                                </p>
                              </div>
                            </div>

                            {/* 👇 CHANGED: Replaced static Download button with ReportActions so they get the Delete option */}
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
            )
          })
        )}
      </div>
    </div>
  )
}