import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase-server"
import { PDFDocument } from "pdf-lib"

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  try {
    console.log("[v0] view-pdf route called for report:", params.id)

    const supabase = createAdminClient()

    const { data: attachment, error } = await supabase
      .from("job_attachments")
      .select("id, job_id, file_url, file_name, mime_type")
      .eq("id", params.id)
      .single()

    if (error || !attachment) {
      console.error("[v0] Attachment not found:", error)
      return new NextResponse("Not found", { status: 404 })
    }

    console.log("[v0] Attachment found:", attachment.file_name, attachment.mime_type)

    const parts = attachment.file_url.split("/job-reports/")
    if (parts.length !== 2) {
      console.error("[v0] Invalid file URL:", attachment.file_url)
      return new NextResponse("Invalid file URL", { status: 500 })
    }

    const storagePath = parts[1]
    console.log("[v0] Storage path:", storagePath)

    const { data: fileData, error: downloadError } = await supabase.storage.from("job-reports").download(storagePath)

    if (downloadError || !fileData) {
      console.error("[v0] Failed to download file:", downloadError)
      return new NextResponse("Failed to access file", { status: 500 })
    }

    console.log("[v0] File downloaded from storage, size:", fileData.size, "bytes")

    const arrayBuffer = await fileData.arrayBuffer()

    let pdfBuffer: Buffer

    if (attachment.mime_type === "application/pdf") {
      console.log("[v0] File is already PDF, using as-is")
      pdfBuffer = Buffer.from(arrayBuffer)
    } else if (attachment.mime_type?.startsWith("image/")) {
      console.log("[v0] Converting image to PDF...")
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
        console.log("[v0] Image converted to PDF, size:", pdfBuffer.length, "bytes")
      } catch (error) {
        console.error("[v0] Error converting image to PDF:", error)
        return new NextResponse("Failed to convert image to PDF", { status: 500 })
      }
    } else {
      console.log("[v0] Unsupported file type, returning as-is")
      pdfBuffer = Buffer.from(arrayBuffer)
    }

    const pdfFileName = attachment.file_name.replace(/\.[^/.]+$/, "") + ".pdf"
    console.log("[v0] Sending PDF response, filename:", pdfFileName, "size:", pdfBuffer.length)

    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${pdfFileName}"`,
        "Content-Length": pdfBuffer.length.toString(),
        "Cache-Control": "no-cache, no-store, must-revalidate",
        Pragma: "no-cache",
        Expires: "0",
      },
    })
  } catch (error) {
    console.error("[v0] Unexpected error in view-pdf route:", error)
    if (error instanceof Error) {
      console.error("[v0] Error message:", error.message)
      console.error("[v0] Error stack:", error.stack)
    }
    return new NextResponse("Internal server error", { status: 500 })
  }
}
