"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"

interface AcceptDeclineButtonsProps {
  jobTechnicianId: string
  jobId: string
}

export default function AcceptDeclineButtons({ jobTechnicianId, jobId }: AcceptDeclineButtonsProps) {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)

  const handleAccept = async () => {
    setIsLoading(true)
    try {
      const response = await fetch("/api/technician/accept-job", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobTechnicianId, jobId }),
      })

      if (!response.ok) {
        const error = await response.json()
        console.error("[v0] Error accepting job:", error)
        alert("Failed to accept job. Please try again.")
      } else {
        router.refresh()
      }
    } catch (err) {
      console.error("[v0] Error accepting job:", err)
      alert("Failed to accept job. Please try again.")
    } finally {
      setIsLoading(false)
    }
  }

  const handleDecline = async () => {
    setIsLoading(true)
    try {
      const response = await fetch("/api/technician/decline-job", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobTechnicianId }),
      })

      if (!response.ok) {
        const error = await response.json()
        console.error("[v0] Error declining job:", error)
        alert("Failed to decline job. Please try again.")
      } else {
        router.refresh()
      }
    } catch (err) {
      console.error("[v0] Error declining job:", err)
      alert("Failed to decline job. Please try again.")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="flex gap-2">
      <Button onClick={handleAccept} disabled={isLoading} className="flex-1" size="sm">
        Accept
      </Button>
      <Button
        onClick={handleDecline}
        disabled={isLoading}
        variant="outline"
        className="flex-1 bg-transparent"
        size="sm"
      >
        Decline
      </Button>
    </div>
  )
}
