"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Textarea } from "@/components/ui/textarea"
import { useState } from "react"
import { updateReturnTripDecision } from "./return-trip-actions" 
import { useToast } from "@/hooks/use-toast"

interface ReturnTripManagerProps {
  jobId: string
  initialNeeded: boolean | null
  initialReason: string | null
  initialScheduled?: boolean | null // 👈 NEW PROP
}

export function ReturnTripManager({ jobId, initialNeeded, initialReason, initialScheduled }: ReturnTripManagerProps) {
  const [needed, setNeeded] = useState<boolean | null>(initialNeeded)
  const [reason, setReason] = useState(initialReason || "")
  const [scheduled, setScheduled] = useState<boolean>(!!initialScheduled) // 👈 NEW STATE
  const [isSaving, setIsSaving] = useState(false)
  const { toast } = useToast()

  const handleCheckChange = async (value: boolean) => {
    const newValue = needed === value ? null : value
    // If they change to 'No', automatically uncheck 'Scheduled'
    const newScheduled = value === false ? false : scheduled

    setNeeded(newValue)
    if (value === false) setScheduled(false)
    
    setIsSaving(true)
    const result = await updateReturnTripDecision(jobId, newValue, reason, newScheduled)
    setIsSaving(false)

    if (result.success) {
      toast({ title: "Saved", description: "Return trip decision updated" })
    } else {
      toast({ title: "Error", description: result.error || "Failed to save", variant: "destructive" })
      setNeeded(needed) 
    }
  }

  const handleReasonChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setReason(e.target.value)
  }

  const handleBlur = async () => {
    setIsSaving(true)
    const result = await updateReturnTripDecision(jobId, needed, reason, scheduled)
    setIsSaving(false)

    if (result.success) {
      toast({ title: "Saved", description: "Return trip reason updated" })
    } else {
      toast({ title: "Error", description: result.error || "Failed to save reason", variant: "destructive" })
    }
  }

  // 👈 NEW HANDLER FOR THE SCHEDULED CHECKBOX
  const handleScheduledChange = async (checked: boolean) => {
    setScheduled(checked)
    setIsSaving(true)
    const result = await updateReturnTripDecision(jobId, needed, reason, checked)
    setIsSaving(false)

    if (result.success) {
      toast({ title: "Saved", description: checked ? "Marked as scheduled" : "Unmarked as scheduled" })
    } else {
      toast({ title: "Error", description: result.error || "Failed to save status", variant: "destructive" })
      setScheduled(!checked)
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
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <Checkbox
                id="return-trip-no"
                checked={needed === false}
                onCheckedChange={() => handleCheckChange(false)}
                disabled={isSaving}
              />
              <label htmlFor="return-trip-no" className="text-sm font-medium cursor-pointer">No</label>
            </div>

            <div className="flex items-center gap-2">
              <Checkbox
                id="return-trip-yes"
                checked={needed === true}
                onCheckedChange={() => handleCheckChange(true)}
                disabled={isSaving}
              />
              <label htmlFor="return-trip-yes" className="text-sm font-medium cursor-pointer">Yes</label>
            </div>
          </div>

          <div>
            <label htmlFor="return-trip-reason" className="block text-sm font-medium mb-2">Why?</label>
            <Textarea
              id="return-trip-reason"
              value={reason}
              onChange={handleReasonChange}
              onBlur={handleBlur}
              placeholder="Add context for why a return trip is / isn't needed…"
              className="min-h-[100px]"
              disabled={isSaving}
            />
            {showWarning && (
              <p className="text-sm text-amber-600 mt-2">Consider adding a reason when a return trip is needed</p>
            )}
          </div>

          {/* 👈 NEW SCHEDULED CHECKBOX UI */}
          {needed === true && (
            <div className="pt-4 mt-4 border-t flex items-center space-x-2">
              <Checkbox
                id="return-trip-scheduled"
                checked={scheduled}
                onCheckedChange={handleScheduledChange}
                disabled={isSaving}
              />
              <label htmlFor="return-trip-scheduled" className="text-sm font-medium cursor-pointer">
                Mark Return Trip as Scheduled
              </label>
            </div>
          )}

          {needed === null && (
            <p className="text-sm text-muted-foreground">No decision made yet. Select Yes or No above.</p>
          )}
        </div>
      </CardContent>
    </Card>
  )
}