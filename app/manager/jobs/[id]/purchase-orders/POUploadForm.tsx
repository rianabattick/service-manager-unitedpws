"use client"

import type React from "react"
import { useState, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Upload } from "lucide-react"
import { createClient } from "@/lib/supabase-client"

interface POUploadFormProps {
  jobId: string
}

export function POUploadForm({ jobId }: POUploadFormProps) {
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedFileName, setSelectedFileName] = useState<string | null>(null)
  const [notes, setNotes] = useState("")
  const fileInputRef = useRef<HTMLInputElement>(null)

  async function handleUpload(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setUploading(true)

    try {
      const form = e.currentTarget
      const fileInput = form.elements.namedItem("file") as HTMLInputElement
      const files = Array.from(fileInput?.files || [])

      if (files.length === 0) {
        throw new Error("Please select at least one file")
      }

      const maxSize = 50 * 1024 * 1024 // 50MB limit
      for (const file of files) {
        if (file.size > maxSize) {
          throw new Error(`File ${file.name} is too large. Must be less than 50MB.`)
        }
      }

      const supabase = createClient()

      // Get current user to tag who uploaded it
      const { data: { user } } = await supabase.auth.getUser()
      let uploadedByName = "Unknown"
      if (user) {
        const { data: userData } = await supabase.from("users").select("full_name").eq("id", user.id).single()
        if (userData) uploadedByName = userData.full_name
      }

      const uploadPromises = files.map(async (file) => {
        const timestamp = Date.now()
        const randomStr = Math.random().toString(36).substring(7)
        const sanitizedFileName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_")
        
        // Save in a dedicated 'pos' folder inside your existing reports bucket
        const path = `pos/${jobId}/${timestamp}-${randomStr}-${sanitizedFileName}`

        // 1) Upload to Storage
        const { error: uploadError } = await supabase.storage
          .from("job-reports")
          .upload(path, file, {
            cacheControl: "3600",
            upsert: false,
            contentType: file.type || "application/octet-stream",
          })

        if (uploadError) throw new Error(`Failed to upload ${file.name}: ${uploadError.message}`)

        // 2) Get Public URL
        const { data: urlData } = supabase.storage.from("job-reports").getPublicUrl(path)
        const fileUrl = urlData.publicUrl

        // 3) Insert into your brand new Database Table
        const { error: dbError } = await supabase.from("job_purchase_orders").insert({
          job_id: jobId,
          file_name: file.name,
          file_url: fileUrl,
          file_size: file.size,
          notes: notes,
          uploaded_by: user?.id || null,
          uploaded_by_name: uploadedByName
        })

        if (dbError) throw new Error(`Database error: ${dbError.message}`)
      })

      await Promise.all(uploadPromises)

      // Reset and reload
      form.reset()
      setSelectedFileName(null)
      setNotes("")
      setUploading(false)
      window.location.reload()
      
    } catch (err: any) {
      console.error("[v0] Upload error:", err)
      setError(err.message || "An unexpected error occurred while uploading")
      setUploading(false)
    }
  }

  return (
    <form onSubmit={handleUpload} className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
        <input
          ref={fileInputRef}
          type="file"
          name="file"
          accept="image/*,.pdf,.doc,.docx,.xls,.xlsx"
          disabled={uploading}
          onChange={(e) => {
            const files = e.target.files
            setSelectedFileName(files?.length ? (files.length > 1 ? `${files.length} files` : files[0].name) : null)
          }}
          className="hidden"
          multiple
          required
        />
        <Button type="button" variant="outline" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
          Choose Files
        </Button>
        <span className="text-sm text-muted-foreground flex-1 truncate">
          {selectedFileName || "No files chosen"}
        </span>
      </div>

      <div className="flex gap-3 items-end">
        <div className="flex-1">
          <Input 
            type="text" 
            placeholder="Add a note with this PO... (optional)" 
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            disabled={uploading}
          />
        </div>
        <Button type="submit" disabled={uploading}>
          <Upload className="w-4 h-4 mr-2" />
          {uploading ? "Uploading..." : "Upload PO"}
        </Button>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}
    </form>
  )
}