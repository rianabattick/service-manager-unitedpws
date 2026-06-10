"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Download, Trash2 } from "lucide-react"
import { createClient } from "@/lib/supabase-client"
import { useRouter } from "next/navigation"

interface POActionsProps {
  poId: string
  jobId: string
  fileUrl: string
}

export function POActions({ poId, fileUrl }: POActionsProps) {
  const [isDeleting, setIsDeleting] = useState(false)
  const router = useRouter()

  async function handleDelete() {
    if (!confirm("Are you sure you want to delete this purchase order?")) return

    setIsDeleting(true)
    try {
      const supabase = createClient()
      
      // Delete from database
      const { error } = await supabase.from("job_purchase_orders").delete().eq("id", poId)
      if (error) throw error

      router.refresh()
    } catch (error) {
      console.error("Error deleting PO:", error)
      alert("Failed to delete purchase order")
      setIsDeleting(false)
    }
  }

  return (
    <div className="flex gap-2">
      <a href={fileUrl} target="_blank" rel="noopener noreferrer">
        <Button variant="outline" size="sm">
          <Download className="w-4 h-4 mr-1" />
          Download
        </Button>
      </a>
      
      <Button 
        variant="outline" 
        size="sm" 
        className="text-destructive hover:bg-destructive/10 hover:text-destructive"
        onClick={handleDelete}
        disabled={isDeleting}
        title="Delete Purchase Order"
      >
        <Trash2 className="w-4 h-4" />
      </Button>
    </div>
  )
}