import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase-server"
import { getCurrentUser } from "@/lib/db"

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const user = await getCurrentUser()
  if (!user) {
    return new NextResponse("Unauthorized", { status: 401 })
  }

  const supabase = await createClient()

  const { data: attachment, error } = await supabase
    .from("job_attachments")
    .select("id, job_id, file_url, file_name, mime_type")
    .eq("id", params.id)
    .single()

  if (error || !attachment) {
    return new NextResponse("Not found", { status: 404 })
  }

  const parts = attachment.file_url.split("/job-reports/")
  if (parts.length !== 2) {
    return new NextResponse("Invalid file URL", { status: 500 })
  }

  const storagePath = parts[1]

  const { data: signed, error: signedError } = await supabase.storage
    .from("job-reports")
    .createSignedUrl(storagePath, 60)

  if (signedError || !signed?.signedUrl) {
    return new NextResponse("Failed to access file", { status: 500 })
  }

  const fileRes = await fetch(signed.signedUrl)

  if (!fileRes.ok) {
    return new NextResponse("Failed to fetch file", { status: 500 })
  }

  const arrayBuffer = await fileRes.arrayBuffer()
  const fileBuffer = Buffer.from(arrayBuffer)

  return new NextResponse(fileBuffer, {
    status: 200,
    headers: {
      "Content-Type": attachment.mime_type || "application/octet-stream",
      "Content-Disposition": `attachment; filename="${encodeURIComponent(attachment.file_name || "download")}"`,
      "Cache-Control": "private, max-age=0, must-revalidate",
    },
  })
}
