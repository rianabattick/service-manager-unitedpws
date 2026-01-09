import { redirect } from "next/navigation"
import { getCurrentUser } from "@/lib/db"
import { createAdminClient } from "@/lib/supabase-server"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { MarkAllReadButton } from "./MarkAllReadButton"
import { NotificationRow } from "./NotificationRow"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { PageHeader } from "@/components/shared/PageHeader"

export const dynamic = "force-dynamic"
export const revalidate = 0
export const fetchCache = "force-no-store"

export default async function ManagerNotificationsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>
}) {
  const user = await getCurrentUser()

  if (!user) {
    redirect("/login")
  }

  // Check role authorization
  const allowedRoles = ["owner", "admin", "manager", "dispatcher"]
  if (!allowedRoles.includes(user.role)) {
    if (user.role === "technician") {
      redirect("/technician/notifications")
    } else {
      redirect("/login")
    }
  }

  const params = await searchParams
  const page = Number.parseInt(params.page || "1")
  const itemsPerPage = 20
  const offset = (page - 1) * itemsPerPage

  const supabase = await createAdminClient()

  console.log("[v0] Fetching notifications for user:", {
    userId: user.id,
    organizationId: user.organization_id,
    role: user.role,
  })

  const { data: notifications, error } = await supabase
    .from("notifications")
    .select("id, type, message, related_entity_type, related_entity_id, is_read, created_at")
    .eq("organization_id", user.organization_id)
    .eq("recipient_user_id", user.id)
    .order("created_at", { ascending: false })

  if (error) {
    console.error("[v0] Error fetching notifications:", error)
  } else {
    console.log("[v0] Fetched notifications:", notifications?.length || 0, "notifications")
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

  const contractNotifications = notifications?.filter(
    (n) => n.related_entity_type === "contract" && n.related_entity_id,
  )
  const contractIds = [...new Set(contractNotifications?.map((n) => n.related_entity_id) || [])]

  const contractsMap = new Map<string, string>()
  if (contractIds.length > 0) {
    const { data: contracts } = await supabase
      .from("service_agreements")
      .select("id, name, agreement_number")
      .in("id", contractIds)

    contracts?.forEach((contract) => {
      contractsMap.set(contract.id, contract.name || contract.agreement_number)
    })
  }

  // Replace job IDs and contract IDs in notification messages with titles
  const enhancedNotifications = notifications?.map((notification) => {
    let message = notification.message

    // Replace job IDs with job titles
    if (notification.related_entity_type === "job" && notification.related_entity_id) {
      const jobTitle = jobsMap.get(notification.related_entity_id)
      if (jobTitle) {
        // Replace patterns like "Job JOB-123-ABC" with "Job Title"
        message = message.replace(/Job\s+JOB-\d+-[A-Z0-9]+/g, jobTitle)
      }
    }

    // Replace contract IDs with contract names
    if (notification.related_entity_type === "contract" && notification.related_entity_id) {
      const contractName = contractsMap.get(notification.related_entity_id)
      if (contractName && message.includes(notification.related_entity_id)) {
        message = message.replace(notification.related_entity_id, contractName)
      }
    }

    return {
      ...notification,
      message,
    }
  })

  const unreadCount = enhancedNotifications?.filter((n) => !n.is_read).length || 0

  const totalItems = enhancedNotifications?.length || 0
  const totalPages = Math.ceil(totalItems / itemsPerPage)
  const paginatedNotifications = enhancedNotifications?.slice(offset, offset + itemsPerPage)

  return (
    <div className="space-y-6">
      <PageHeader title="Notifications" subtitle="Recent updates about jobs, reports, and contracts." />

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
          {!paginatedNotifications || paginatedNotifications.length === 0 ? (
            <p className="text-sm text-muted-foreground">No notifications yet.</p>
          ) : (
            <>
              <div className="space-y-2">
                {paginatedNotifications.map((notification) => (
                  <NotificationRow key={notification.id} notification={notification} />
                ))}
              </div>

              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-6 pt-6 border-t">
                  <p className="text-sm text-muted-foreground">
                    Showing {offset + 1}-{Math.min(offset + itemsPerPage, totalItems)} of {totalItems} notifications
                  </p>
                  <div className="flex gap-2">
                    {page > 1 && (
                      <Link href={`/manager/notifications?page=${page - 1}`}>
                        <Button variant="outline" size="sm">
                          Previous
                        </Button>
                      </Link>
                    )}
                    <span className="flex items-center px-3 text-sm">
                      Page {page} of {totalPages}
                    </span>
                    {page < totalPages && (
                      <Link href={`/manager/notifications?page=${page + 1}`}>
                        <Button variant="outline" size="sm">
                          Next
                        </Button>
                      </Link>
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
