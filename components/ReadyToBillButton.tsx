"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { createClient } from "@/lib/supabase-client"
import { Send, CheckCircle2 } from "lucide-react"

interface ReadyToBillButtonProps {
  jobId: string
  jobTitle: string
  jobNumber: string | number
  currentBillingStatus: string | null
}

export function ReadyToBillButton({ jobId, jobTitle, jobNumber, currentBillingStatus }: ReadyToBillButtonProps) {
  const [isSending, setIsSending] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  // Disable the button if it's already sent, invoiced, or paid
  const isAlreadySent = ["sent_to_billing", "invoiced", "paid"].includes(currentBillingStatus?.toLowerCase() || "")

  const handleSendToBilling = async () => {
    try {
      setIsSending(true)

      // 1. Update the Job in Supabase first
      const { error: dbError } = await supabase
        .from("jobs")
        .update({ billing_status: "sent_to_billing" })
        .eq("id", jobId)

      if (dbError) throw new Error("Failed to update database")

      // 2. Fire the API to send the email
      // We use window.location.href so the email link automatically points to your local dev OR your live site!
      const response = await fetch("/api/send-billing-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jobId,
          jobTitle,
          jobNumber,
          jobUrl: window.location.href, 
        }),
      })

      if (!response.ok) throw new Error("Failed to send email")

      // 3. Refresh the page to show the new status
      router.refresh()
    } catch (error) {
      console.error(error)
      alert("Something went wrong. Please try again.")
    } finally {
      setIsSending(false)
    }
  }

  return (
    <Card className="border-primary/20 bg-primary/5">
      <CardContent className="p-4 flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-sm">Billing Notification</h3>
          <p className="text-xs text-muted-foreground mt-1">
            {isAlreadySent 
              ? "The billing department has been notified." 
              : "Notify accounting that this job is ready to bill."}
          </p>
        </div>
        
        <Button 
          onClick={handleSendToBilling} 
          disabled={isAlreadySent || isSending}
          className={isAlreadySent ? "bg-green-600 text-white opacity-100" : ""}
        >
          {isAlreadySent ? (
            <>
              <CheckCircle2 className="w-4 h-4 mr-2" />
              Notified
            </>
          ) : isSending ? (
            "Sending..."
          ) : (
            <>
              <Send className="w-4 h-4 mr-2" />
              Ready to Bill
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  )
}