import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(request: Request) {
  try {
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
    const cutoffDate = thirtyDaysAgo.toISOString()

    // 👇 CHANGED: Now looks at completed_at instead of updated_at!
    const { data: eligibleJobs, error: jobsError } = await supabase
      .from("jobs")
      .select("id")
      .eq("status", "completed")
      .lte("completed_at", cutoffDate) 
      
    if (jobsError) throw jobsError
    if (!eligibleJobs || eligibleJobs.length === 0) {
      return NextResponse.json({ message: "No eligible jobs found for cleanup" })
    }

    const jobIds = eligibleJobs.map((j) => j.id)

    // 👇 CHANGED: Now uses file_url instead of file_path
    const { data: attachments, error: attachError } = await supabase
      .from("job_attachments")
      .select("id, file_url, job_id")
      .in("job_id", jobIds)
      .neq("file_url", "archived")

    if (attachError) throw attachError
    if (!attachments || attachments.length === 0) {
      return NextResponse.json({ message: "No active reports found for eligible jobs" })
    }

    // Extract the exact bucket path from the file_url so Supabase can delete it
    const filePathsToDelete = attachments
      .map((a) => {
        if (!a.file_url) return null;
        
        const rawPath = a.file_url.split('/storage/v1/object/public/job-reports/').pop() || a.file_url;
        return decodeURIComponent(rawPath); 
      })
      .filter(Boolean)

    if (filePathsToDelete.length > 0) {
      // 👇 CHANGED: Now deletes from the "job-reports" bucket
      const { error: storageError } = await supabase.storage
        .from("job-reports") 
        .remove(filePathsToDelete as string[])

      if (storageError) {
        console.error("Storage deletion error:", storageError)
      }
    }

    // 👇 CHANGED: Update file_url to "archived"
    const attachmentIds = attachments.map((a) => a.id)
    const { error: updateError } = await supabase
      .from("job_attachments")
      .update({ file_url: "archived" })
      .in("id", attachmentIds)

    if (updateError) throw updateError

    return NextResponse.json({ 
      success: true, 
      message: `Successfully archived ${attachments.length} reports. Storage freed.` 
    })

  } catch (error: any) {
    console.error("Report cleanup error:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}