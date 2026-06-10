import { redirect, notFound } from "next/navigation"
import { getCurrentUser } from "@/lib/db"
import { createClient } from "@/lib/supabase-server"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import Link from "next/link"
import { ArrowLeft, FileText, CheckCircle2, CircleDashed } from "lucide-react" 

// We will build these two specific PO components next!
import { POUploadForm } from "./POUploadForm"
import { POActions } from "./POActions"

export default async function ManagerPOsPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser()

  if (!user) redirect("/login")

  const isManager = ["owner", "admin", "manager", "dispatcher"].includes(user.role)
  if (!isManager) redirect("/technician")

  const { id: jobId } = await params
  const supabase = await createClient()

  // Get Job Details for the Header
  const { data: job, error: jobError } = await supabase
    .from("jobs")
    .select("id, job_number, title, organization_id")
    .eq("id", jobId)
    .eq("organization_id", user.organization_id)
    .single()

  if (jobError || !job) notFound()

  // Get Existing Purchase Orders
  const { data: purchaseOrders } = await supabase
    .from("job_purchase_orders")
    .select(`
      id,
      file_name,
      file_url,
      notes,
      created_at,
      uploaded_by_name
    `)
    .eq("job_id", jobId)
    .order("created_at", { ascending: false })

  const pos = purchaseOrders || []
  const hasPOs = pos.length > 0

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
          <h1 className="text-3xl font-bold">Purchase Orders - {job.title || `Job #${job.job_number}`}</h1>
          <p className="text-muted-foreground">View and upload purchase orders for this job.</p>
        </div>
        <div>
          <span className={`px-3 py-1 rounded-full text-sm font-medium inline-flex items-center gap-1 ${
            hasPOs
            ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300"
            : "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
          }`}>
            {pos.length} PO{pos.length !== 1 ? 's' : ''} Uploaded
          </span>
        </div>
      </div>

      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <div>Upload New PO</div>
              <div className="flex items-center gap-2">
                 {hasPOs ? (
                   <>
                     <CheckCircle2 className="w-5 h-5 text-green-600" />
                     <span className="text-sm font-medium text-green-600 hidden sm:inline-block">PO Attached</span>
                   </>
                 ) : (
                   <>
                     <CircleDashed className="w-5 h-5 text-muted-foreground" />
                     <span className="text-sm font-medium text-muted-foreground hidden sm:inline-block">Pending</span>
                   </>
                 )}
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            
            {/* The Upload Form (we will build this next) */}
            <POUploadForm jobId={jobId} />

            {/* List Existing POs */}
            {pos.length === 0 ? (
              <p className="text-sm text-muted-foreground italic mt-4 border-t pt-4">No purchase orders uploaded yet for this job.</p>
            ) : (
              <div className="space-y-2 mt-6 border-t pt-4">
                <h4 className="text-sm font-medium mb-3">Uploaded Documents</h4>
                <div className="space-y-3">
                  {pos.map((po: any) => (
                    <div 
                      key={po.id} 
                      className="flex flex-col sm:flex-row sm:items-start justify-between p-4 border rounded-lg gap-4 bg-card/50"
                    >
                      <div className="flex items-start gap-3 overflow-hidden flex-1">
                        <div className="p-2 bg-primary/10 rounded-md shrink-0 mt-0.5">
                          <FileText className="w-5 h-5 text-primary" />
                        </div>
                        
                        <div className="min-w-0 space-y-1">
                          <p className="text-sm font-medium truncate text-foreground">{po.file_name}</p>
                          <p className="text-xs text-muted-foreground">
                            Uploaded by {po.uploaded_by_name || "Unknown"} on{" "}
                            {new Date(po.created_at).toLocaleString()}
                          </p>
                          {po.notes && (
                            <div className="mt-2 text-sm bg-muted/50 p-2 rounded text-muted-foreground">
                              <span className="font-semibold text-xs uppercase tracking-wider block mb-1">Notes</span>
                              {po.notes}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Download and Delete Actions */}
                      <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
                        <POActions poId={po.id} jobId={jobId} fileUrl={po.file_url} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}