"use client"

import { Button } from "@/components/ui/button"
import { Download } from "lucide-react"
import { DeleteReportButton } from "./DeleteReportButton"

interface ReportActionsProps {
  reportId: string
  jobId: string
  fileName: string
}

export function ReportActions({ reportId, jobId, fileName }: ReportActionsProps) {
  return (
    <div className="flex gap-2">
      {/* View button removed as requested */}
      
      <a href={`/api/reports/${reportId}/download`} target="_blank" rel="noopener noreferrer">
        <Button variant="outline" size="sm">
          <Download className="w-4 h-4 mr-1" />
          Download
        </Button>
      </a>
      <DeleteReportButton reportId={reportId} jobId={jobId} fileName={fileName} />
    </div>
  )
}
