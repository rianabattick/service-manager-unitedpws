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
      
      // Convert the FileList object into a standard array
      const files = Array.from(fileInput?.files || [])

      if (files.length === 0) {
        throw new Error("Please select at least one file")
      }

      // Check the size limit for EVERY file before starting any uploads
      const maxSize = 50 * 1024 * 1024 // 50MB
      for (const file of files) {
        if (file.size > maxSize) {
          throw new Error(`File ${file.name} is too large. Must be less than 50MB.`)
        }
      }

      const supabase = createClient()

      // Map through all files and create an upload Promise for each one
      const uploadPromises = files.map(async (file) => {
        const timestamp = Date.now()
        const randomStr = Math.random().toString(36).substring(7)

        // Sanitize the original filename
        const sanitizedFileName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_")

        // Generate unique filename
        const uniqueFileName = `${timestamp}-${randomStr}-${sanitizedFileName}`
        const path = `${jobId}/${uniqueFileName}`

        // 1) Upload file directly to Supabase Storage
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from("job-reports")
          .upload(path, file, {
            cacheControl: "3600",
            upsert: false,
            contentType: file.type || "application/octet-stream",
          })

        if (uploadError) {
          console.error(`[v0] Storage upload error for ${file.name}:`, uploadError)
          throw new Error(`Failed to upload ${file.name}: ${uploadError.message}`)
        }

        // 2) Get a public URL
        const { data: urlData } = supabase.storage.from("job-reports").getPublicUrl(path)
        const fileUrl = urlData.publicUrl

        if (!fileUrl) {
          throw new Error(`Failed to generate file URL for ${file.name}`)
        }

        // 3) Save metadata in job_attachments via server action
        await saveReportMetadata(jobId, equipmentId, {
          url: fileUrl,
          name: file.name,
          size: file.size,
          type: file.type || "application/octet-stream",
        })
      })

      // Execute all uploads simultaneously!
      await Promise.all(uploadPromises)

      // 4) Reset and refresh after EVERYTHING is done
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
    const files = e.target.files
    if (!files || files.length === 0) {
      setSelectedFileName(null)
    } else if (files.length === 1) {
      setSelectedFileName(files[0].name)
    } else {
      // If multiple files, display the total count
      setSelectedFileName(`${files.length} files selected`)
    }
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
          // 👇 Added the multiple attribute right here!
          multiple
          required
        />
        <Button type="button" variant="outline" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
          Choose Files
        </Button>
        <span className="text-sm text-muted-foreground flex-1">{selectedFileName || "No files chosen"}</span>
        <Button type="submit" disabled={uploading}>
          <Upload className="w-4 h-4 mr-2" />
          {uploading ? "Uploading..." : "Upload Reports"}
        </Button>
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </form>
  )
}