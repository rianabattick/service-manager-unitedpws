"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { useState, useEffect } from "react"
import { updateChecklist, loadChecklist } from "./completion-actions"

interface CompletionChecklistProps {
  jobId: string
  currentStatus: string
  billingStatus: string | null
  totalReports: number
  uploadedReports: number
}

export function CompletionChecklist({
  jobId,
  currentStatus,
  billingStatus,
  totalReports,
  uploadedReports,
}: CompletionChecklistProps) {
  const [checklist, setChecklist] = useState({
    reports_uploaded: false,
    reports_sent_to_customer: false,
    reports_saved_in_file: false,
    invoiced: false,
    parts_logistics_completed: false,
    // 👇 ADDED BACK: Kept in state to satisfy TypeScript/DB, but hidden from UI
    no_pending_return_visits: false, 
  })
  const [isLoading, setIsLoading] = useState(true)
  const [completionInfo, setCompletionInfo] = useState<{
    completedBy?: string
    completedAt?: string
  } | null>(null)

  // 1. Load initial data
  useEffect(() => {
    async function loadData() {
      const result = await loadChecklist(jobId)
      if (result.success && result.data) {
        setChecklist({
          reports_uploaded: result.data.reports_uploaded,
          reports_sent_to_customer: result.data.reports_sent_to_customer,
          reports_saved_in_file: result.data.reports_saved_in_file,
          invoiced: result.data.invoiced,
          parts_logistics_completed: result.data.parts_logistics_completed,
          // Load this too so we don't accidentally overwrite it with false
          no_pending_return_visits: result.data.no_pending_return_visits, 
        })
        if (result.data.completed_by && result.data.completed_at) {
          setCompletionInfo({
            completedBy: result.data.completed_by_name || result.data.completed_by,
            completedAt: result.data.completed_at,
          })
        }
      }
      setIsLoading(false)
    }
    loadData()
  }, [jobId])

  // 2. Auto-check based on props
  useEffect(() => {
    if (isLoading) return

    // Logic: If 0 expected reports, consider it complete (Auto-check true)
    const reportsAutoChecked = totalReports === 0 || uploadedReports >= totalReports
    
    const invoicedAutoChecked =
      billingStatus === "invoiced" || billingStatus === "paid" || billingStatus === "un_billable"

    // Only update if the current state doesn't match the desired auto-state
    const needsUpdate = 
      checklist.reports_uploaded !== reportsAutoChecked ||
      checklist.invoiced !== invoicedAutoChecked

    if (needsUpdate) {
      const updatedChecklist = {
        ...checklist,
        reports_uploaded: reportsAutoChecked,
        invoiced: invoicedAutoChecked,
      }

      // Update UI
      setChecklist(updatedChecklist)

      // Update Database
      updateChecklist(jobId, updatedChecklist, currentStatus)
    }
  }, [
    totalReports, 
    uploadedReports, 
    billingStatus, 
    isLoading, 
    jobId, 
    currentStatus, 
    checklist.reports_uploaded,
    checklist.invoiced,
    checklist
  ])

  // Check if everything (EXCEPT the hidden field) is true
  // We filter out 'no_pending_return_visits' from the validation check if you want to ignore it,
  // OR if it's still required by the system, we leave it. 
  // Assuming we want to ignore the hidden field for completion:
  const visibleChecklistItems = {
    reports_uploaded: checklist.reports_uploaded,
    reports_sent_to_customer: checklist.reports_sent_to_customer,
    reports_saved_in_file: checklist.reports_saved_in_file,
    invoiced: checklist.invoiced,
    parts_logistics_completed: checklist.parts_logistics_completed,
  }
  const allCompleted = Object.values(visibleChecklistItems).every((v) => v)

  const handleCheckChange = async (key: keyof typeof checklist, checked: boolean) => {
    const updatedChecklist = { ...checklist, [key]: checked }
    setChecklist(updatedChecklist)
    await updateChecklist(jobId, updatedChecklist, currentStatus)
  }

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Completion Checklist</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Loading checklist...</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Completion Checklist</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          <div className="flex items-start gap-3">
            <Checkbox
              id="reports_uploaded"
              checked={checklist.reports_uploaded}
              onCheckedChange={(checked) => handleCheckChange("reports_uploaded", checked as boolean)}
              disabled={totalReports === 0 || uploadedReports >= totalReports}
            />
            <label htmlFor="reports_uploaded" className="text-sm cursor-pointer leading-none peer-disabled:opacity-70">
              Reports uploaded {totalReports === 0 && <span className="text-muted-foreground ml-1">(N/A)</span>}
            </label>
          </div>

          <div className="flex items-start gap-3">
            <Checkbox
              id="reports_sent_to_customer"
              checked={checklist.reports_sent_to_customer}
              onCheckedChange={(checked) => handleCheckChange("reports_sent_to_customer", checked as boolean)}
            />
            <label
              htmlFor="reports_sent_to_customer"
              className="text-sm cursor-pointer leading-none peer-disabled:opacity-70"
            >
              Reports sent to customer
            </label>
          </div>

          <div className="flex items-start gap-3">
            <Checkbox
              id="reports_saved_in_file"
              checked={checklist.reports_saved_in_file}
              onCheckedChange={(checked) => handleCheckChange("reports_saved_in_file", checked as boolean)}
            />
            <label
              htmlFor="reports_saved_in_file"
              className="text-sm cursor-pointer leading-none peer-disabled:opacity-70"
            >
              Reports saved in customer file
            </label>
          </div>

          <div className="flex items-start gap-3">
            <Checkbox
              id="invoiced"
              checked={checklist.invoiced}
              onCheckedChange={(checked) => handleCheckChange("invoiced", checked as boolean)}
              disabled={billingStatus === "invoiced" || billingStatus === "paid" || billingStatus === "un_billable"}
            />
            <label htmlFor="invoiced" className="text-sm cursor-pointer leading-none peer-disabled:opacity-70">
              Invoiced / Paid / Un-billable
            </label>
          </div>

          <div className="flex items-start gap-3">
            <Checkbox
              id="parts_logistics_completed"
              checked={checklist.parts_logistics_completed}
              onCheckedChange={(checked) => handleCheckChange("parts_logistics_completed", checked as boolean)}
            />
            <label
              htmlFor="parts_logistics_completed"
              className="text-sm cursor-pointer leading-none peer-disabled:opacity-70"
            >
              Parts logistics completed (if N/A check box)
            </label>
          </div>

          {allCompleted && currentStatus !== "completed" && (
            <p className="text-sm text-green-600 dark:text-green-400 font-medium mt-4">
              All items completed! Job status will be updated to "Completed".
            </p>
          )}
          {!allCompleted && currentStatus === "completed" && (
            <p className="text-sm text-amber-600 dark:text-amber-400 font-medium mt-4">
              Some items unchecked. Job status will revert to previous status.
            </p>
          )}
          {allCompleted && currentStatus === "completed" && completionInfo && (
            <div className="mt-4 p-3 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
              <p className="text-sm text-green-800 dark:text-green-200 font-medium">
                Confirmed by: {completionInfo.completedBy}
              </p>
              <p className="text-xs text-green-700 dark:text-green-300 mt-1">
                {new Date(completionInfo.completedAt!).toLocaleString("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                  hour: "numeric",
                  minute: "2-digit",
                })}
              </p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}