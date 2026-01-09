"use client"

import type React from "react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { markNotificationRead } from "./actions"
import { useTransition } from "react"
import { useRouter } from "next/navigation"

interface NotificationRowProps {
  notification: {
    id: string
    type: string
    message: string
    is_read: boolean
    created_at: string
    related_entity_type: string | null
    related_entity_id: string | null
  }
}

function getTypeLabel(type: string): string {
  if (type.startsWith("job_")) return "Job"
  if (type.startsWith("report_")) return "Report"
  return "Notification"
}

function formatTimestamp(timestamp: string): string {
  const date = new Date(timestamp)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMins / 60)
  const diffDays = Math.floor(diffHours / 24)

  if (diffMins < 1) return "Just now"
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 7) return `${diffDays}d ago`
  return date.toLocaleDateString()
}

export function NotificationRow({ notification }: NotificationRowProps) {
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  const handleMarkRead = (e: React.MouseEvent) => {
    e.stopPropagation()
    startTransition(async () => {
      await markNotificationRead(notification.id)
    })
  }

  const handleNotificationClick = () => {
    // Navigate based on related entity type
    if (notification.related_entity_type === "job" && notification.related_entity_id) {
      router.push(`/technician/jobs/${notification.related_entity_id}`)
    } else if (notification.related_entity_type === "report" && notification.related_entity_id) {
      // For reports, navigate to jobs list for now
      router.push(`/technician/jobs`)
    }

    // Mark as read in background (don't wait for it)
    if (!notification.is_read) {
      markNotificationRead(notification.id)
    }
  }

  return (
    <div
      onClick={handleNotificationClick}
      className={`flex items-start justify-between p-3 rounded-lg border cursor-pointer transition-colors hover:bg-accent ${
        notification.is_read ? "bg-background" : "bg-muted/50 border-primary/20"
      }`}
    >
      <div className="flex-1 space-y-1">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-xs">
            {getTypeLabel(notification.type)}
          </Badge>
          {!notification.is_read && <span className="h-2 w-2 rounded-full bg-primary" title="Unread" />}
        </div>
        <p className={`text-sm ${notification.is_read ? "text-muted-foreground" : "font-semibold"}`}>
          {notification.message}
        </p>
        <p className="text-xs text-muted-foreground">{formatTimestamp(notification.created_at)}</p>
      </div>
      {!notification.is_read && (
        <Button variant="ghost" size="sm" onClick={handleMarkRead} disabled={isPending}>
          {isPending ? "..." : "Mark read"}
        </Button>
      )}
    </div>
  )
}
