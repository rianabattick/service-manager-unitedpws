"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { FileDown, Loader2 } from "lucide-react"

export function GenerateReportButton({ 
  jobId, 
  unitId, 
  templates, 
  defaultFileName,
  userId
}: { 
  jobId: string; 
  unitId: string; 
  templates: any[]; 
  defaultFileName: string;
  userId: string;
}) {
  const [isOpen, setIsOpen] = useState(false)
  const [selectedTemplate, setSelectedTemplate] = useState("")
  const [fileName, setFileName] = useState(defaultFileName)
  const [isGenerating, setIsGenerating] = useState(false)

  const handleGenerate = async () => {
    if (!selectedTemplate || !fileName) return;

    try {
      setIsGenerating(true)
      
      const response = await fetch("/api/reports/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jobId,
          unitId,
          templateId: selectedTemplate,
          userId
        })
      });

      if (!response.ok) {
        throw new Error("Failed to generate report")
      }

      // Download the file directly to the device
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      
      // Ensure the file saves as a macro-enabled excel file
      const finalFileName = fileName.endsWith(".xlsx") ? fileName : `${fileName}.xlsx`
      a.download = finalFileName
      
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
      
      setIsOpen(false)
    } catch (error) {
      console.error(error)
      alert("Error generating report. Please try again.")
    } finally {
      setIsGenerating(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="flex items-center gap-2">
          <FileDown className="w-4 h-4" />
          Create Pre-filled Report
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Generate Pre-filled Report</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Select Template</Label>
            <Select value={selectedTemplate} onValueChange={setSelectedTemplate}>
              <SelectTrigger>
                <SelectValue placeholder="Choose a template..." />
              </SelectTrigger>
              <SelectContent>
                {templates.map((t) => (
                  <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>File Name</Label>
            <Input 
              value={fileName} 
              onChange={(e) => setFileName(e.target.value)} 
              placeholder="e.g. Job_123_Report"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setIsOpen(false)}>Cancel</Button>
          <Button onClick={handleGenerate} disabled={!selectedTemplate || !fileName || isGenerating}>
            {isGenerating ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
            Confirm & Download
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}