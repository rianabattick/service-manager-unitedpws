"use client"

import { Button } from "@/components/ui/button"
import { Eye, Download } from "lucide-react"
import { DeleteReportButton } from "./DeleteReportButton"

interface ReportActionsProps {
  reportId: string
  jobId: string
  fileName: string
}

export function ReportActions({ reportId, jobId, fileName }: ReportActionsProps) {
  return (
    <div className="flex gap-2">
      <a href={`/api/reports/${reportId}/view-pdf`} target="_blank" rel="noopener noreferrer">
        <Button variant="outline" size="sm">
          <Eye className="w-4 h-4 mr-1" />
          View as PDF
        </Button>
      </a>
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
