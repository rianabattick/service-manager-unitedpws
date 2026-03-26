"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase-client" // Adjust path if your client is elsewhere
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Pencil, Check, X } from "lucide-react"

interface ServiceCounterEditorProps {
  contractId: string
  automaticCount: number
  manualCount: number
  totalServices: number
  totalPMsPerYear: number
  agreementLength: number
}

export function ServiceCounterEditor({
  contractId,
  automaticCount,
  manualCount,
  totalServices,
  totalPMsPerYear,
  agreementLength
}: ServiceCounterEditorProps) {
  // Show the ACTUAL total (auto + manual) in the edit box
  const [editValue, setEditValue] = useState((automaticCount + manualCount).toString())
  const [isEditing, setIsEditing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  
  const router = useRouter()
  const supabase = createClient()

  // The actual displayed total is the auto + the manual adjustment
  const currentTotal = automaticCount + manualCount

  const handleSave = async () => {
    try {
      setIsSaving(true)
      
      // 1. Get the exact total the user typed in
      const desiredTotal = parseInt(editValue) || 0
      
      // 2. Subtract the automatic jobs to find the "adjustment" number
      const adjustmentValue = desiredTotal - automaticCount

      // 3. IMPORTANT: Change 'service_agreements' to 'contracts' if that is your table name!
      const { error } = await supabase
        .from("service_agreements") 
        .update({ manual_completed_services: adjustmentValue })
        .eq("id", contractId)

      if (error) throw error

      setIsEditing(false)
      router.refresh() // Refresh to update the server components
    } catch (error) {
      console.error("Failed to update counter:", error)
      alert("Failed to update counter. Please try again.")
    } finally {
      setIsSaving(false)
    }
  }

  if (isEditing) {
    return (
      <div className="flex items-center gap-4 p-4 bg-primary/10 border border-primary/20 rounded-lg">
        <div className="flex items-center gap-2">
          <Input 
            type="number" 
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            className="w-20 text-center font-bold"
            disabled={isSaving}
          />
          <span className="text-2xl font-bold text-muted-foreground">/ {totalServices}</span>
        </div>
        <div className="flex flex-col gap-1">
          <div className="flex gap-2">
            <Button size="icon" variant="default" onClick={handleSave} disabled={isSaving} className="h-8 w-8">
              <Check className="h-4 w-4" />
            </Button>
            <Button size="icon" variant="outline" onClick={() => setIsEditing(false)} disabled={isSaving} className="h-8 w-8">
              <X className="h-4 w-4" />
            </Button>
          </div>
          <span className="text-xs text-muted-foreground">Adjust legacy count</span>
        </div>
      </div>
    )
  }

  return (
    <div className="flex items-center justify-between p-4 bg-muted rounded-lg group">
      <div className="flex items-center gap-4">
        <div className="text-2xl font-bold text-muted-foreground">
          <span className={manualCount !== 0 ? "text-primary" : ""}>{currentTotal}</span> / {totalServices}
        </div>
        <div>
          <p className="font-semibold">
            {totalPMsPerYear} PM{totalPMsPerYear !== 1 ? "s" : ""} per year
          </p>
          <p className="text-sm text-muted-foreground">
            Total: {totalServices} services over {agreementLength} year{agreementLength !== 1 ? "s" : ""}
          </p>
        </div>
      </div>
      <Button 
        variant="ghost" 
        size="icon" 
        onClick={() => setIsEditing(true)}
        className="opacity-0 group-hover:opacity-100 transition-opacity"
      >
        <Pencil className="h-4 w-4 text-muted-foreground" />
      </Button>
    </div>
  )
}