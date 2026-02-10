"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Textarea } from "@/components/ui/textarea"
import { useState } from "react"
import { updateReturnTripDecision } from "./return-trip-actions" // Make sure path is correct
import { useToast } from "@/hooks/use-toast"

interface ReturnTripManagerProps {
  jobId: string
  initialNeeded: boolean | null
  initialReason: string | null
}

export function ReturnTripManager({ jobId, initialNeeded, initialReason }: ReturnTripManagerProps) {
  const [needed, setNeeded] = useState<boolean | null>(initialNeeded)
  const [reason, setReason] = useState(initialReason || "")
  const [isSaving, setIsSaving] = useState(false)
  const { toast } = useToast()

  const handleCheckChange = async (value: boolean) => {
    // Toggle: if clicking the same value, uncheck it (set to null)
    const newValue = needed === value ? null : value

    setNeeded(newValue)
    setIsSaving(true)

    // Pass the CURRENT 'reason' state
    const result = await updateReturnTripDecision(jobId, newValue, reason)

    setIsSaving(false)

    if (result.success) {
      toast({
        title: "Saved",
        description: "Return trip decision updated",
      })
    } else {
      toast({
        title: "Error",
        description: result.error || "Failed to save",
        variant: "destructive",
      })
      // Revert on error
      setNeeded(needed) 
    }
  }

  // 1. Only update LOCAL state while typing (Instant, no lag)
  const handleReasonChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setReason(e.target.value)
  }

  // 2. Save to Server ONLY when user clicks away
  const handleBlur = async () => {
    // Optional: Prevent saving if nothing changed (optimization)
    if (reason === initialReason && needed === initialNeeded) return

    setIsSaving(true)
    const result = await updateReturnTripDecision(jobId, needed, reason)
    setIsSaving(false)

    if (result.success) {
      toast({
        title: "Saved",
        description: "Return trip reason updated",
      })
    } else {
      toast({
        title: "Error",
        description: result.error || "Failed to save reason",
        variant: "destructive",
      })
    }
  }

  const showWarning = needed === true && !reason.trim()

  return (
    <Card>
      <CardHeader>
        <CardTitle>Return Trip Needed?</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Checkboxes */}
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <Checkbox
                id="return-trip-no"
                checked={needed === false}
                onCheckedChange={() => handleCheckChange(false)}
                disabled={isSaving}
              />
              <label htmlFor="return-trip-no" className="text-sm font-medium cursor-pointer">
                No
              </label>
            </div>

            <div className="flex items-center gap-2">
              <Checkbox
                id="return-trip-yes"
                checked={needed === true}
                onCheckedChange={() => handleCheckChange(true)}
                disabled={isSaving}
              />
              <label htmlFor="return-trip-yes" className="text-sm font-medium cursor-pointer">
                Yes
              </label>
            </div>
          </div>

          {/* Reason textarea */}
          <div>
            <label htmlFor="return-trip-reason" className="block text-sm font-medium mb-2">
              Why?
            </label>
            <Textarea
              id="return-trip-reason"
              value={reason}
              onChange={handleReasonChange} // 👈 Fast local update
              onBlur={handleBlur}          // 👈 Save only when done
              placeholder="Add context for why a return trip is / isn't needed…"
              className="min-h-[100px]"
              disabled={isSaving}
            />
            {showWarning && (
              <p className="text-sm text-amber-600 dark:text-amber-400 mt-2">
                Consider adding a reason when a return trip is needed
              </p>
            )}
          </div>

          {needed === null && (
            <p className="text-sm text-muted-foreground">No decision made yet. Select Yes or No above.</p>
          )}
        </div>
      </CardContent>
    </Card>
  )
}