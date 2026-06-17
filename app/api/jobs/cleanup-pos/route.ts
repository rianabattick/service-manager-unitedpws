import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET() {
  try {
    // Calculate the 1-month cutoff date (30 days ago)
    const cutoffDate = new Date()
    cutoffDate.setMonth(cutoffDate.getMonth() - 1)
    const cutoffIso = cutoffDate.toISOString()

    // Query POs where the job is completed > 1 month ago AND hasn't been archived yet
    const { data: expiredPOs, error: dbError } = await supabase
      .from("job_purchase_orders")
      .select(`
        id,
        file_url,
        jobs!inner (
          status,
          completed_at
        )
      `)
      .eq("jobs.status", "completed")
      .lt("jobs.completed_at", cutoffIso)
      .neq("file_url", "PO exported to public docs") 

    if (dbError) throw dbError

    let updatedCount = 0
    let failedCount = 0
    const foldersToCheck = new Set<string>()

    // Loop through expired POs, delete from storage, then UPDATE the database row
    for (const po of expiredPOs || []) {
      if (!po.file_url) continue

      // Extract relative path from full URL
      const rawPath = po.file_url.split('/storage/v1/object/public/job-reports/').pop()
      const filePath = rawPath ? decodeURIComponent(rawPath) : null

      if (filePath) {
        // Track parent folder path to clean up empty structures later
        const pathParts = filePath.split('/')
        if (pathParts.length >= 2) {
          foldersToCheck.add(`${pathParts[0]}/${pathParts[1]}`)
        }

        // Delete the physical file from Supabase storage
        const { error: storageError } = await supabase
          .storage
          .from("job-reports")
          .remove([filePath])

        // If file is gone (or was already missing), update the database record
        if (!storageError || storageError.message.includes("Object not found")) {
          await supabase
            .from("job_purchase_orders")
            .update({ file_url: "PO exported to public docs" })
            .eq("id", po.id)
            
          updatedCount++
        } else {
          console.error(`Failed to delete storage file ${filePath}:`, storageError.message)
          failedCount++
        }
      }
    }

    // Clean up any parent job folders inside 'pos' that are now completely empty
    for (const folderPath of foldersToCheck) {
      const { data: remainingFiles } = await supabase
        .storage
        .from("job-reports")
        .list(folderPath, { limit: 10 })

      if (!remainingFiles || remainingFiles.length === 0 || (remainingFiles.length === 1 && remainingFiles[0].name === ".emptyFolderPlaceholder")) {
        await supabase.storage.from("job-reports").remove([folderPath])
      }
    }

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      message: `Automated cleanup complete. Purged physical files and archived ${updatedCount} PO records.`,
      failedCount
    })

  } catch (error: any) {
    console.error("Automated PO cleanup error:", error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}