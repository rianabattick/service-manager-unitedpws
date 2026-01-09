"use client"

import { useState } from "react"
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
import { createVendor } from "@/app/actions/vendor-actions"

interface Vendor {
  id: string
  name: string
}

interface VendorSelectProps {
  vendors: Vendor[]
  selectedVendorId: string
  onVendorChange: (vendorId: string) => void
  organizationId: string
}

export default function VendorSelect({ vendors, selectedVendorId, onVendorChange, organizationId }: VendorSelectProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [newVendorName, setNewVendorName] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [localVendors, setLocalVendors] = useState(vendors)

  const handleAddVendor = async () => {
    if (!newVendorName.trim()) return

    setIsSubmitting(true)
    try {
      const result = await createVendor(organizationId, newVendorName.trim())

      if (result.success && result.vendor) {
        setLocalVendors([...localVendors, result.vendor])
        onVendorChange(result.vendor.id)
        setNewVendorName("")
        setIsDialogOpen(false)
      } else {
        alert(result.error || "Failed to create vendor")
      }
    } catch (error) {
      console.error("[v0] Error creating vendor:", error)
      alert("An unexpected error occurred")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="space-y-2">
      <Label htmlFor="vendorId">Subcontracted By</Label>
      <div className="flex gap-2">
        <select
          id="vendorId"
          value={selectedVendorId}
          onChange={(e) => onVendorChange(e.target.value)}
          className="flex-1 px-3 py-2 border border-input rounded-md bg-background"
        >
          <option value="">Select vendor</option>
          {localVendors.map((vendor) => (
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
              <DialogTitle>Add New Vendor</DialogTitle>
              <DialogDescription>Enter the name of the vendor</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="vendorName">Vendor Name</Label>
                <Input
                  id="vendorName"
                  value={newVendorName}
                  onChange={(e) => setNewVendorName(e.target.value)}
                  placeholder="Enter vendor name"
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
                {isSubmitting ? "Adding..." : "Add Vendor"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  )
}
