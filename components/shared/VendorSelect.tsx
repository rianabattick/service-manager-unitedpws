"use client"

import { useState, useEffect } from "react"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Plus } from "lucide-react"
import { createClient } from "@/lib/supabase-client"

interface Vendor {
  id: string
  name: string
}

interface VendorSelectProps {
  value?: string
  onValueChange: (vendorId: string | undefined) => void
  organizationId: string
  userId: string
  showLabel?: boolean
}

export function VendorSelect({ value, onValueChange, organizationId, userId, showLabel = true }: VendorSelectProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [newVendorName, setNewVendorName] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [vendors, setVendors] = useState<Vendor[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const fetchVendors = async () => {
      try {
        const supabase = createClient()
        const { data, error } = await supabase
          .from("vendors")
          .select("id, name")
          .eq("organization_id", organizationId)
          .eq("is_active", true)
          .order("name")

        if (error) throw error
        setVendors(data || [])
      } catch (error) {
        console.error("[v0] Error fetching vendors:", error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchVendors()
  }, [organizationId])

  const handleAddVendor = async () => {
    if (!newVendorName.trim()) return

    setIsSubmitting(true)
    try {
      const supabase = createClient()
      const { data, error } = await supabase
        .from("vendors")
        .insert({
          organization_id: organizationId,
          name: newVendorName.trim(),
          is_active: true,
        })
        .select()
        .single()

      if (error) throw error

      if (data) {
        setVendors([...vendors, data])
        onValueChange(data.id)
        setNewVendorName("")
        setIsDialogOpen(false)
      }
    } catch (error) {
      console.error("[v0] Error creating vendor:", error)
      alert("Failed to create vendor")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="space-y-2">
      {showLabel && <Label htmlFor="vendorId">Subcontracted By</Label>}
      <div className="flex gap-2">
        <select
          id="vendorId"
          value={value || ""}
          onChange={(e) => onValueChange(e.target.value || undefined)}
          className="flex-1 px-3 py-2 border border-input rounded-md bg-background"
          disabled={isLoading}
        >
          <option value="">Select client</option>
          {vendors.map((vendor) => (
            <option key={vendor.id} value={vendor.id}>
              {vendor.name}
            </option>
          ))}
        </select>

        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button type="button" variant="outline" size="icon">
              <Plus className="h-4 w-4" />
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add New Client</DialogTitle>
              <DialogDescription>Enter the name of the client</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="vendorName">Client Name</Label>
                <Input
                  id="vendorName"
                  value={newVendorName}
                  onChange={(e) => setNewVendorName(e.target.value)}
                  placeholder="Enter client name"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault()
                      handleAddVendor()
                    }
                  }}
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)} disabled={isSubmitting}>
                Cancel
              </Button>
              <Button type="button" onClick={handleAddVendor} disabled={isSubmitting || !newVendorName.trim()}>
                {isSubmitting ? "Adding..." : "Add Client"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  )
}

export default VendorSelect
