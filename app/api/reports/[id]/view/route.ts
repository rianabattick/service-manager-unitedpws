import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase-server"
import { getCurrentUser } from "@/lib/db"
import { PDFDocument } from "pdf-lib"

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  console.log("[v0] View route called for report ID:", params.id)

  const user = await getCurrentUser()
  if (!user) {
    console.log("[v0] View route: No user found, returning 401")
    return new NextResponse("Unauthorized", { status: 401 })
  }

  console.log("[v0] View route: User authenticated:", user.email)

  const supabase = await createClient()

  const { data: attachment, error } = await supabase
    .from("job_attachments")
    .select("id, job_id, file_url, file_name, mime_type")
    .eq("id", params.id)
    .single()

  if (error || !attachment) {
    console.error("[v0] View: attachment not found", error)
    return new NextResponse("Not found", { status: 404 })
  }

  console.log("[v0] View route: Found attachment:", attachment.file_name, "MIME:", attachment.mime_type)

  const parts = attachment.file_url.split("/job-reports/")
  if (parts.length !== 2) {
    console.error("[v0] View: unable to parse storage path from URL", attachment.file_url)
    return new NextResponse("Invalid file URL", { status: 500 })
  }

  const storagePath = parts[1]
  console.log("[v0] View route: Storage path:", storagePath)

  const { data: signed, error: signedError } = await supabase.storage
    .from("job-reports")
    .createSignedUrl(storagePath, 60)

  if (signedError || !signed?.signedUrl) {
    console.error("[v0] View: error creating signed URL", signedError)
    return new NextResponse("Failed to access file", { status: 500 })
  }

  console.log("[v0] View route: Created signed URL")

  const fileRes = await fetch(signed.signedUrl)

  if (!fileRes.ok) {
    console.error("[v0] View: error fetching file from storage", await fileRes.text())
    return new NextResponse("Failed to fetch file", { status: 500 })
  }

  console.log("[v0] View route: Fetched file from storage, size:", fileRes.headers.get("content-length"))

  const arrayBuffer = await fileRes.arrayBuffer()
  console.log("[v0] View route: Converted to ArrayBuffer, size:", arrayBuffer.byteLength)

  let pdfBuffer: Buffer

  // If already a PDF, serve as-is
  if (attachment.mime_type === "application/pdf") {
    console.log("[v0] View route: File is already PDF, serving as-is")
    pdfBuffer = Buffer.from(arrayBuffer)
  }
  // If an image, convert to PDF
  else if (attachment.mime_type?.startsWith("image/")) {
    console.log("[v0] View route: Converting image to PDF")
    try {
      const pdfDoc = await PDFDocument.create()

      let image
      if (attachment.mime_type === "image/jpeg" || attachment.mime_type === "image/jpg") {
        image = await pdfDoc.embedJpg(arrayBuffer)
      } else if (attachment.mime_type === "image/png") {
        image = await pdfDoc.embedPng(arrayBuffer)
      } else {
        image = await pdfDoc.embedPng(arrayBuffer)
      }

      const page = pdfDoc.addPage([image.width, image.height])
      page.drawImage(image, {
        x: 0,
        y: 0,
        width: image.width,
        height: image.height,
      })

      const pdfBytes = await pdfDoc.save()
      pdfBuffer = Buffer.from(pdfBytes)
      console.log("[v0] View route: Converted to PDF, size:", pdfBuffer.length)
    } catch (error) {
      console.error("[v0] Error converting image to PDF:", error)
      pdfBuffer = Buffer.from(arrayBuffer)
    }
  } else {
    console.log("[v0] View route: Unknown MIME type, serving as binary")
    pdfBuffer = Buffer.from(arrayBuffer)
  }

  console.log("[v0] View route: Returning PDF response")

  return new NextResponse(pdfBuffer, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": "inline",
      "Cache-Control": "private, max-age=0, must-revalidate",
    },
  })
}
