import { redirect } from "next/navigation"
import { getCurrentUser } from "@/lib/db"
import { createAdminClient } from "@/lib/supabase-server"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { MarkAllReadButton } from "./MarkAllReadButton"
import { NotificationRow } from "./NotificationRow"
import { PaginationWrapper } from "@/components/ui/pagination-wrapper"
import { PageHeader } from "@/components/shared/PageHeader"

export const dynamic = "force-dynamic"
export const revalidate = 0
export const fetchCache = "force-no-store"

const ITEMS_PER_PAGE = 20

export default async function TechnicianNotificationsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>
}) {
  const user = await getCurrentUser()

  if (!user) {
    redirect("/login")
  }

  // Check role authorization
  if (user.role !== "technician") {
    redirect("/manager/notifications")
  }

  const params = await searchParams
  const currentPage = Number(params.page) || 1
  const offset = (currentPage - 1) * ITEMS_PER_PAGE

  const supabase = await createAdminClient()

  const { count } = await supabase
    .from("notifications")
    .select("*", { count: "exact", head: true })
    .eq("organization_id", user.organization_id)
    .eq("recipient_user_id", user.id)

  const totalPages = Math.ceil((count || 0) / ITEMS_PER_PAGE)

  const { data: notifications, error } = await supabase
    .from("notifications")
    .select("id, type, message, related_entity_type, related_entity_id, is_read, created_at")
    .eq("organization_id", user.organization_id)
    .eq("recipient_user_id", user.id)
    .order("created_at", { ascending: false })
    .range(offset, offset + ITEMS_PER_PAGE - 1)

  if (error) {
    console.error("[v0] Error fetching notifications:", error)
  }

  const jobNotifications = notifications?.filter((n) => n.related_entity_type === "job" && n.related_entity_id)
  const jobIds = [...new Set(jobNotifications?.map((n) => n.related_entity_id) || [])]

  const jobsMap = new Map<string, string>()
  if (jobIds.length > 0) {
    const { data: jobs } = await supabase.from("jobs").select("id, title, job_number").in("id", jobIds)

    jobs?.forEach((job) => {
      jobsMap.set(job.id, job.title || job.job_number)
    })
  }

  // Replace job IDs in notification messages with titles
  const enhancedNotifications = notifications?.map((notification) => {
    let message = notification.message

    if (notification.related_entity_type === "job" && notification.related_entity_id) {
      const jobTitle = jobsMap.get(notification.related_entity_id)
      if (jobTitle) {
        // Replace patterns like "Job JOB-123-ABC" with "Job Title"
        message = message.replace(/Job\s+JOB-\d+-[A-Z0-9]+/g, jobTitle)
      }
    }

    return {
      ...notification,
      message,
    }
  })

  const unreadCount = enhancedNotifications?.filter((n) => !n.is_read).length || 0

  return (
    <div className="space-y-6">
      <PageHeader title="Notifications" subtitle="Recent updates about jobs and reports." />

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>All Notifications</CardTitle>
              <CardDescription>
                {unreadCount > 0
                  ? `${unreadCount} unread notification${unreadCount === 1 ? "" : "s"}`
                  : "No unread notifications"}
              </CardDescription>
            </div>
            {notifications && notifications.length > 0 && <MarkAllReadButton />}
          </div>
        </CardHeader>
        <CardContent>
          {!enhancedNotifications || enhancedNotifications.length === 0 ? (
            <p className="text-sm text-muted-foreground">No notifications yet.</p>
          ) : (
            <>
              <div className="space-y-2">
                {enhancedNotifications.map((notification) => (
                  <NotificationRow key={notification.id} notification={notification} />
                ))}
              </div>
              {totalPages > 1 && (
                <div className="mt-6 flex justify-center">
                  <PaginationWrapper
                    currentPage={currentPage}
                    totalPages={totalPages}
                    baseUrl="/technician/notifications"
                  />
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
