"use client"

import type React from "react"
import { useState, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Upload } from "lucide-react"
import { createClient } from "@/lib/supabase-client"
import { saveReportMetadata } from "./actions"

interface ReportUploadFormProps {
  jobId: string
  equipmentId: string
}

export function ReportUploadForm({ jobId, equipmentId }: ReportUploadFormProps) {
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedFileName, setSelectedFileName] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  async function handleUpload(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setUploading(true)

    try {
      const form = e.currentTarget
      const fileInput = form.elements.namedItem("file") as HTMLInputElement
      const file = fileInput?.files?.[0]

      if (!file) {
        throw new Error("Please select a file")
      }

      // Optional: size limit (50MB)
      const maxSize = 50 * 1024 * 1024
      if (file.size > maxSize) {
        throw new Error("File size must be less than 50MB")
      }

      const supabase = createClient()

      const timestamp = Date.now()
      const randomStr = Math.random().toString(36).substring(7)

      // Sanitize the original filename
      const sanitizedFileName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_")

      // Generate unique filename with timestamp prefix
      const uniqueFileName = `${timestamp}-${randomStr}-${sanitizedFileName}`
      const path = `${jobId}/${uniqueFileName}`

      // 1) Upload file directly from the browser to Supabase Storage
      const { data: uploadData, error: uploadError } = await supabase.storage.from("job-reports").upload(path, file, {
        cacheControl: "3600",
        upsert: false,
        contentType: file.type || "application/octet-stream",
      })

      if (uploadError) {
        console.error("[v0] Storage upload error:", uploadError)
        throw new Error(uploadError.message || "Failed to upload file")
      }

      console.log("[v0] File uploaded to storage:", uploadData)

      // 2) Get a public URL for the uploaded file
      const { data: urlData } = supabase.storage.from("job-reports").getPublicUrl(path)
      const fileUrl = urlData.publicUrl

      if (!fileUrl) {
        throw new Error("Failed to generate file URL")
      }

      // 3) Save metadata in job_attachments via server action
      await saveReportMetadata(jobId, equipmentId, {
        url: fileUrl,
        name: file.name,
        size: file.size,
        type: file.type || "application/octet-stream",
      })

      // 4) Reset and refresh
      form.reset()
      setSelectedFileName(null)
      setUploading(false)
      window.location.reload()
    } catch (err: any) {
      console.error("[v0] Upload error:", err)
      setError(err.message || "An unexpected error occurred while uploading")
      setUploading(false)
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    setSelectedFileName(file ? file.name : null)
  }

  return (
    <form onSubmit={handleUpload} className="space-y-2">
      <div className="flex gap-2 items-center">
        <input
          ref={fileInputRef}
          type="file"
          name="file"
          accept="image/*,.pdf,.doc,.docx,.xls,.xlsx"
          disabled={uploading}
          onChange={handleFileChange}
          className="hidden"
          required
        />
        <Button type="button" variant="outline" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
          Choose File
        </Button>
        <span className="text-sm text-muted-foreground flex-1">{selectedFileName || "No file chosen"}</span>
        <Button type="submit" disabled={uploading}>
          <Upload className="w-4 h-4 mr-2" />
          {uploading ? "Uploading..." : "Upload Report"}
        </Button>
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </form>
  )
}
