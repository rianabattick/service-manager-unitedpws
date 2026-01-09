"use client"

import { Button } from "@/components/ui/button"
import { markAllNotificationsRead } from "./actions"
import { useTransition } from "react"

export function MarkAllReadButton() {
  const [isPending, startTransition] = useTransition()

  const handleMarkAll = () => {
    startTransition(async () => {
      await markAllNotificationsRead()
    })
  }

  return (
    <Button variant="outline" onClick={handleMarkAll} disabled={isPending}>
      {isPending ? "Marking..." : "Mark all as read"}
    </Button>
  )
}
