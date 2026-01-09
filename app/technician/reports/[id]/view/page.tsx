import { notFound, redirect } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, Download } from "lucide-react"
import { createClient } from "@/lib/supabase-server"
import { getCurrentUser } from "@/lib/db"
import { Button } from "@/components/ui/button"

export default async function ViewReportPage({ params }: { params: { id: string } }) {
  const user = await getCurrentUser()
  if (!user) redirect("/login")

  const supabase = await createClient()

  const { data: attachment, error } = await supabase
    .from("job_attachments")
    .select("id, job_id, file_url, file_name, mime_type")
    .eq("id", params.id)
    .single()

  if (error || !attachment) notFound()

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <Link
          href={`/technician/jobs/${attachment.job_id}/reports`}
          className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Reports
        </Link>

        <a href={`/api/reports/${attachment.id}/download`}>
          <Button>
            <Download className="w-4 h-4 mr-2" />
            Download PDF
          </Button>
        </a>
      </div>

      <div>
        <h1 className="text-2xl font-semibold">{attachment.file_name}</h1>
        <p className="text-sm text-muted-foreground">Viewing as PDF</p>
      </div>

      <div className="border rounded-lg overflow-hidden">
        <iframe src={`/api/reports/${attachment.id}/view`} className="w-full h-[80vh]" title={attachment.file_name} />
      </div>
    </div>
  )
}
