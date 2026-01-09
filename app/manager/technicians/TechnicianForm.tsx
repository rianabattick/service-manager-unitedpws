"use client"

import type React from "react"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

interface TechnicianFormProps {
  organizationId: string
  technician?: {
    id: string
    full_name: string
    email: string
    phone?: string
    is_active: boolean
    preferences?: {
      specialty?: string
    }
  }
}

export default function TechnicianForm({ organizationId, technician }: TechnicianFormProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [formData, setFormData] = useState({
    full_name: technician?.full_name || "",
    email: technician?.email || "",
    phone: technician?.phone || "",
    specialty: technician?.preferences?.specialty || "",
    is_active: technician?.is_active ?? true,
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const url = technician ? `/api/technicians/${technician.id}` : "/api/technicians/create"
      const method = technician ? "PUT" : "POST"

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          organization_id: organizationId,
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || "Failed to save technician")
      }

      const data = await response.json()

      // Redirect to technician detail page
      window.location.href = `/manager/technicians/${data.technician.id}`
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card>
      <CardContent className="pt-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <div className="p-3 rounded-md bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300">{error}</div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Full Name */}
            <div className="space-y-2">
              <Label htmlFor="full_name">
                Full Name <span className="text-red-500">*</span>
              </Label>
              <Input
                id="full_name"
                value={formData.full_name}
                onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                required
              />
            </div>

            {/* Email */}
            <div className="space-y-2">
              <Label htmlFor="email">
                Email <span className="text-red-500">*</span>
              </Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                required
              />
            </div>

            {/* Phone */}
            <div className="space-y-2">
              <Label htmlFor="phone">Phone</Label>
              <Input
                id="phone"
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              />
            </div>

            {/* Specialty */}
            <div className="space-y-2">
              <Label htmlFor="specialty">Specialty</Label>
              <Input
                id="specialty"
                value={formData.specialty}
                onChange={(e) => setFormData({ ...formData, specialty: e.target.value })}
                placeholder="e.g., HVAC, Electrical, Plumbing"
              />
            </div>

            {/* Active Status */}
            <div className="space-y-2">
              <Label htmlFor="is_active">Status</Label>
              <select
                id="is_active"
                value={formData.is_active ? "active" : "inactive"}
                onChange={(e) => setFormData({ ...formData, is_active: e.target.value === "active" })}
                className="w-full px-3 py-2 border border-input rounded-md bg-background"
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 justify-end pt-4 border-t">
            <Button type="button" variant="outline" onClick={() => router.back()} disabled={loading}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Saving..." : technician ? "Update Technician" : "Create Technician"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
