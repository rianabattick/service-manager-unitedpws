"use client"

import type React from "react"
import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { X, Pencil, Search } from "lucide-react"
import { createClient } from "@/lib/supabase-client"
import type { JobDetail, JobStatus } from "@/lib/types"
import { createStatusChangeNotifications, createJobEditNotifications } from "../actions"
import VendorSelect from "@/components/VendorSelect"
import { MultiSelectSite } from "@/components/shared/MultiSelectSite"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Card, CardHeader, CardContent, CardTitle } from "@/components/ui/card"

const SERVICE_OPTIONS = [
  "MJPM",
  "MnPM",
  "Battery PM",
  "Battery Replacement",
  "Battery Load Test",
  "Battery Evaluation",
  "StartUp",
  "EM/Troubleshooting",
  "Break/Fix",
  "Standby",
  "Unit Evaluation",
  "Site Evaluation",
  "Training",
  "Capacitor Upgrade",
  "Installation",
]

interface JobEditFormProps {
  jobId: string
  jobDetail: JobDetail
  customers: any[]
  serviceLocations: any[]
  equipment: any[]
  technicians: any[]
  serviceAgreements: any[]
  vendors: any[]
  organizationId: string
}

export default function JobEditForm({
  jobId,
  jobDetail,
  customers,
  serviceLocations,
  equipment,
  technicians,
  serviceAgreements,
  vendors,
  organizationId,
}: JobEditFormProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const { job, technicians: assignedTechnicians, units, contacts } = jobDetail

  // Initialize form state with existing data
  const [jobTitle, setJobTitle] = useState(job.title || "")
  const [customerId, setCustomerId] = useState(job.customer_id || "")
  const [jobTypeField, setJobTypeField] = useState<
    "service_call" | "installation" | "maintenance" | "inspection" | "estimate" | "warranty"
  >((job.job_type as any) || "service_call")
  const [jobType, setJobType] = useState<"time_and_materials" | "contracted">(
    (job.job_type as "time_and_materials" | "contracted") || "time_and_materials",
  )
  const [contractId, setContractId] = useState(job.service_agreement_id || "")
  const [serviceType, setServiceType] = useState<string[]>(
    job.service_type ? job.service_type.split(",").map((s) => s.trim()) : [],
  )
  const [billingStatus, setBillingStatus] = useState(job.billing_status || "processing")
  const [status, setStatus] = useState<JobStatus>(job.status as JobStatus)
  const [statusChanged, setStatusChanged] = useState(false)
  
  // FIX 1: Smart Initialization - If vendor exists, force 'subcontract'
  const [customerType, setCustomerType] = useState<"direct" | "subcontract">(
    job.customer_type === "subcontract" || job.vendor_id ? "subcontract" : "direct",
  )
  const [vendorId, setVendorId] = useState<string>(job.vendor_id || "")

  const originalScheduledDateTime = job.scheduled_start ? new Date(job.scheduled_start) : new Date()
  
  // FIX: Force browser to treat the incoming UTC date as EST for display (stripping the shift)
  const originalScheduledDateString = originalScheduledDateTime.toISOString().split("T")[0]
  const hours = originalScheduledDateTime.getHours().toString().padStart(2, '0')
  const minutes = originalScheduledDateTime.getMinutes().toString().padStart(2, '0')
  const originalScheduledTimeString = `${hours}:${minutes}`

  // Parse scheduled date/time
  const [scheduledDate, setScheduledDate] = useState(originalScheduledDateString)
  const [scheduledTime, setScheduledTime] = useState(originalScheduledTimeString)

  const [serviceLocationId, setServiceLocationId] = useState(job.service_location_id || "")
  const [returnTripNeeded, setReturnTripNeeded] = useState(job.return_trip_needed || false)
  const [selectedTechnicians, setSelectedTechnicians] = useState<string[]>(assignedTechnicians.map((t) => t.id))
  const [leadTechnicianId, setLeadTechnicianId] = useState<string | null>(
    assignedTechnicians.find((t) => t.is_lead)?.id || null,
  )
  const [notes, setNotes] = useState(job.notes || "")
  const [poNumber, setPoNumber] = useState(job.po_number || "")
  const [estimateNumber, setEstimateNumber] = useState(job.estimate_number || "")
  const [contactsState, setContactsState] = useState<
    Array<{ id?: string; name: string; phone: string; email: string }>
  >(
    contacts.length > 0
      ? contacts.map((c) => ({ id: c.id, name: c.name, phone: c.phone, email: c.email || "" }))
      : [{ name: "", phone: "", email: "" }],
  )

  // State for multi-site selection and site notes
  const [selectedSiteIds, setSelectedSiteIds] = useState<string[]>(() => {
    if (job.site_locations && Array.isArray(job.site_locations) && job.site_locations.length > 0) {
      const uniqueSiteIds = Array.from(
        new Set(
          job.site_locations.map((loc: any) => loc.service_location_id).filter((id): id is string => id !== null),
        ),
      )
      return uniqueSiteIds
    }
    return job.service_location_id ? [job.service_location_id] : []
  })
  const [siteNotes, setSiteNotes] = useState<Record<string, string>>(() => {
    const notes: Record<string, string> = {}
    if (job.site_locations && Array.isArray(job.site_locations)) {
      job.site_locations.forEach((loc: any) => {
        if (loc.service_location_id && loc.site_notes) {
          notes[loc.service_location_id] = loc.site_notes
        }
      })
    }
    return notes
  })

  const [filteredLocations, setFilteredLocations] = useState<any[]>(() => {
    if (customerId) {
      return serviceLocations.filter((loc) => loc.customer_id === customerId)
    }
    return []
  })

  // Filtered data based on selections
  const filteredEquipment = equipment.filter(
    (eq) => eq.customer_id === customerId && (!serviceLocationId || eq.service_location_id === serviceLocationId),
  )
  const filteredContracts = serviceAgreements.filter((sa) => sa.customer_id === customerId)

  const [assignedUnits, setAssignedUnits] = useState<
    Array<{
      id: string
      name: string
      serialNumber: string | null
      make: string | null
      model: string | null
      siteId: string | null
      unitNotes: string | null
    }>
  >(
    units.map((u) => ({
      id: u.equipment_id,
      name: u.equipment_name,
      serialNumber: u.serial_number,
      make: u.make,
      model: u.model,
      siteId: u.service_location_id,
      unitNotes: u.unit_notes || null,
    })),
  )

  const [showUnitSelector, setShowUnitSelector] = useState(false)
  const [showCreateUnit, setShowCreateUnit] = useState(false)
  const [unitSearchQuery, setUnitSearchQuery] = useState("")
  const [selectedUnitsToAdd, setSelectedUnitsToAdd] = useState<string[]>([])
  const [editingUnitId, setEditingUnitId] = useState<string | null>(null)
  const [newUnitName, setNewUnitName] = useState("")
  const [newUnitMake, setNewUnitMake] = useState("")
  const [newUnitModel, setNewUnitModel] = useState("")
  const [newUnitSerialNumber, setNewUnitSerialNumber] = useState("")

  const handleRemoveUnit = (unitId: string) => {
    setAssignedUnits((prev) => prev.filter((u) => u.id !== unitId))
  }

  const handleAddSelectedUnits = () => {
    const unitsToAdd = filteredEquipment
      .filter((eq) => selectedUnitsToAdd.includes(eq.id))
      .map((eq) => {
        const defaultSiteId = selectedSiteIds.length === 1 ? selectedSiteIds[0] : null
        return {
          id: eq.id,
          name: eq.name,
          serialNumber: eq.serial_number,
          make: eq.make,
          model: eq.model,
          siteId: defaultSiteId,
          unitNotes: null,
        }
      })

    setAssignedUnits((prev) => [...prev, ...unitsToAdd])
    setSelectedUnitsToAdd([])
    setShowUnitSelector(false)
    setUnitSearchQuery("")
  }

  const handleUpdateUnitSite = (unitId: string, siteId: string | null) => {
    setAssignedUnits((prev) => prev.map((u) => (u.id === unitId ? { ...u, siteId } : u)))
  }

  const handleDeleteUnit = async (unitId: string) => {
    try {
      const supabase = createClient()
      const { error } = await supabase.from("equipment").delete().eq("id", unitId)
      if (error) throw error

      setAssignedUnits((prev) => prev.filter((u) => u.id !== unitId))
      router.refresh()
    } catch (err) {
      console.error("Error deleting unit:", err)
      setError("Failed to delete unit")
    }
  }

  const handleCreateUnit = async () => {
    if (!customerId) {
      setError("Please select a company first")
      return
    }

    if (!newUnitName) {
      setError("Please provide a unit name")
      return
    }

    try {
      const supabase = createClient()

      if (editingUnitId) {
        // Update existing unit
        const { data, error: updateError } = await supabase
          .from("equipment")
          .update({
            name: newUnitName,
            make: newUnitMake || null,
            model: newUnitModel || null,
            serial_number: newUnitSerialNumber || null,
          })
          .eq("id", editingUnitId)
          .select()
          .single()

        if (updateError) throw updateError

        // Update in assigned units list
        setAssignedUnits((prev) =>
          prev.map((u) =>
            u.id === editingUnitId
              ? { ...u, name: newUnitName, make: newUnitMake, model: newUnitModel, serialNumber: newUnitSerialNumber }
              : u,
          ),
        )
      } else {
        const { data, error: insertError } = await supabase
          .from("equipment")
          .insert({
            organization_id: organizationId,
            customer_id: customerId,
            name: newUnitName,
            make: newUnitMake || "",
            model: newUnitModel || "",
            serial_number: newUnitSerialNumber || "",
            type: "-",
            is_active: true,
          })
          .select()
          .single()

        if (insertError) throw insertError

        const defaultSiteId = selectedSiteIds.length === 1 ? selectedSiteIds[0] : null

        setAssignedUnits((prev) => [
          ...prev,
          {
            id: data.id,
            name: newUnitName,
            serialNumber: newUnitSerialNumber || null,
            make: newUnitMake || null,
            model: newUnitModel || null,
            siteId: defaultSiteId,
            unitNotes: null,
          },
        ])
      }

      // Reset form
      setShowCreateUnit(false)
      setEditingUnitId(null)
      setNewUnitName("")
      setNewUnitMake("")
      setNewUnitModel("")
      setNewUnitSerialNumber("")
      setError(null)
    } catch (err: any) {
      console.error("Error saving unit:", err)
      setError(err.message || "Failed to save unit")
    }
  }

  // State and handlers for adding/editing sites
  const [newSiteName, setNewSiteName] = useState("")
  const [newSiteAddress, setNewSiteAddress] = useState("")
  const [newSiteAddressLine2, setNewSiteAddressLine2] = useState("")
  const [newSiteCity, setNewSiteCity] = useState("")
  const [newSiteState, setNewSiteState] = useState("")
  const [newSiteZipCode, setNewSiteZipCode] = useState("")
  const [editingSiteId, setEditingSiteId] = useState<string | null>(null)
  const [showAddSite, setShowAddSite] = useState(false)

  const handleEditSite = async (siteId: string) => {
    const site = filteredLocations.find((l) => l.id === siteId)
    if (!site) return

    setNewSiteName(site.name || "")
    setNewSiteAddress(site.address || "")
    setNewSiteAddressLine2(site.address_line_2 || "")
    setNewSiteCity(site.city || "")
    setNewSiteState(site.state || "")
    setNewSiteZipCode(site.zip_code || "")
    setEditingSiteId(siteId)
    setShowAddSite(true)
  }

  const handleDeleteSite = async (siteId: string) => {
    const supabase = createClient()

    // Remove from database
    const { error } = await supabase.from("service_locations").delete().eq("id", siteId)

    if (error) {
      console.error("[v0] Error deleting site:", error)
      alert("Failed to delete site")
      return
    }

    // Remove from local state
    setSelectedSiteIds((prev) => prev.filter((id) => id !== siteId))

    // Refresh the service locations list
    const { data: updatedLocations } = await supabase
      .from("service_locations")
      .select("*")
      .eq("customer_id", customerId)
      .order("name")

    if (updatedLocations) {
      setFilteredLocations(updatedLocations)
    }
    router.refresh()
  }

  const handleSiteNotesChange = (siteId: string, notes: string) => {
    setSiteNotes((prev) => ({
      ...prev,
      [siteId]: notes,
    }))
  }

  const handleSiteSelect = (siteIds: string[]) => {
    setSelectedSiteIds(siteIds)
    const currentSelectedSiteIds = new Set(siteIds)

    setAssignedUnits((prev) =>
      prev.map((unit) => {
        if (unit.siteId && !currentSelectedSiteIds.has(unit.siteId)) {
          return { ...unit, siteId: null }
        }
        return unit
      }),
    )
  }

  useEffect(() => {
    const fetchLocations = async () => {
      if (customerId) {
        const supabase = createClient()
        const { data, error } = await supabase
          .from("service_locations")
          .select("*")
          .eq("customer_id", customerId)
          .order("name")
        if (error) {
          console.error("Error fetching service locations:", error)
          setFilteredLocations([])
        } else {
          setFilteredLocations(data || [])
        }
      } else {
        setFilteredLocations([])
      }
    }
    fetchLocations()
  }, [customerId])

  const addContact = () => {
    setContactsState([...contactsState, { name: "", phone: "", email: "" }])
  }

  const removeContact = (index: number) => {
    setContactsState(contactsState.filter((_, i) => i !== index))
  }

  const updateContact = (index: number, field: "name" | "phone" | "email", value: string) => {
    const updated = [...contactsState]
    updated[index][field] = value
    setContactsState(updated)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSuccess(false)
    setIsSubmitting(true)
    setLoading(true)

    try {
      const supabase = createClient()

      // Validation
      if (!jobTitle.trim()) {
        throw new Error("Job title is required")
      }
      if (selectedTechnicians.length === 0) {
        throw new Error("At least one technician must be assigned")
      }
      if (serviceType.length === 0) {
        throw new Error("At least one service must be selected")
      }

      const scheduledChanged =
        scheduledDate !== originalScheduledDateString || scheduledTime !== originalScheduledTimeString

      const changes: string[] = []

      if (jobTitle !== job.title) changes.push("title")
      if (customerId !== job.customer_id) changes.push("customer")

      const normalizedServiceLocationId = serviceLocationId || null
      const normalizedJobServiceLocation = job.service_location_id || null
      if (normalizedServiceLocationId !== normalizedJobServiceLocation) changes.push("service location")

      const normalizedContractId = contractId || null
      const normalizedJobContract = job.service_agreement_id || null
      if (normalizedContractId !== normalizedJobContract) changes.push("contract")

      if (jobType !== job.job_type) changes.push("job type")
      if (serviceType.join(", ") !== job.service_type) changes.push("service type")
      if (billingStatus !== job.billing_status) changes.push("billing status")
      if (statusChanged && status !== job.status) changes.push("status")

      if (scheduledChanged) {
        changes.push("scheduled date/time")
      }

      if (returnTripNeeded !== job.return_trip_needed) changes.push("return trip")
      if (notes !== (job.notes || "")) changes.push("notes")
      if (poNumber !== (job.po_number || "")) changes.push("PO number")
      if (estimateNumber !== (job.estimate_number || "")) changes.push("estimate number")
      if (vendorId !== (job.vendor_id || "")) changes.push("subcontracted by")

      const previousTechIds = assignedTechnicians.map((t) => t.id).sort()
      const newTechIds = [...selectedTechnicians].sort()
      if (JSON.stringify(previousTechIds) !== JSON.stringify(newTechIds)) {
        changes.push("assigned technicians")
      }

      const previousEquipIds = units.map((u) => u.equipment_id).sort()
      const assignedUnitIds = assignedUnits.map((u) => u.id).sort()
      if (JSON.stringify(previousEquipIds) !== JSON.stringify(assignedUnitIds)) {
        changes.push("equipment")
      }

      // FIX: Construct proper ISO timestamp with UTC offset to prevent shifting
      const formDate = new Date(`${scheduledDate}T${scheduledTime}:00`);
      const isoScheduledStart = formDate.toISOString();

      // FIX 2: Ensure UUID fields are never sent as empty strings ("")
      // Convert "" to null to satisfy Postgres UUID type requirements
      const safeVendorId = customerType === "subcontract" && vendorId ? vendorId : null;
      const safeContractId = contractId || null;
      const safeServiceLocationId = serviceLocationId || null;

      const jobUpdateData: any = {
        title: jobTitle,
        customer_id: customerId,
        service_location_id: safeServiceLocationId,
        service_agreement_id: safeContractId,
        job_type: jobType,
        service_type: serviceType.join(", "),
        billing_status: billingStatus,
        customer_type: customerType, // Explicitly save this
        ...(statusChanged && { status: status }),
        ...(scheduledChanged && { scheduled_start: isoScheduledStart }),
        return_trip_needed: returnTripNeeded,
        notes: notes || null,
        po_number: poNumber || null,
        estimate_number: estimateNumber || null,
        vendor_id: safeVendorId, // Use the safe version
        updated_at: new Date().toISOString(),
      }

      console.log("[v0] Updating job with data:", jobUpdateData)

      const { error: updateError } = await supabase.from("jobs").update(jobUpdateData).eq("id", jobId)

      if (updateError) {
        console.error("[v0] Error updating job:", updateError)
        throw new Error(`Error updating job: ${updateError.message}`)
      }

      // Remove technicians that are no longer assigned
      const removedTechnicians = previousTechIds.filter((tid) => !newTechIds.includes(tid))
      if (removedTechnicians.length > 0) {
        const { error: deleteError } = await supabase
          .from("job_technicians")
          .delete()
          .eq("job_id", jobId)
          .in("technician_id", removedTechnicians)

        if (deleteError) {
          console.error("[v0] Error removing technicians:", deleteError)
          throw new Error(`Error removing technicians: ${deleteError.message}`)
        }
      }

      // UPSERT existing/new technicians
      if (selectedTechnicians.length > 0) {
        const technicianUpserts = selectedTechnicians.map((techId) => ({
          job_id: jobId,
          technician_id: techId,
          status: "accepted" as const,
          is_lead: techId === leadTechnicianId,
          assigned_at: new Date().toISOString(),
        }))

        const { error: upsertError } = await supabase.from("job_technicians").upsert(technicianUpserts, {
          onConflict: "job_id,technician_id",
          ignoreDuplicates: false,
        })

        if (upsertError) {
          console.error("[v0] Error upserting technicians:", upsertError)
          throw new Error(`Error assigning technicians: ${upsertError.message}`)
        }
      }

      // Update job service mappings
      await supabase.from("job_service_locations").delete().eq("job_id", jobId)

      const jobServiceLocationInserts = selectedSiteIds.map((siteId) => ({
        job_id: jobId,
        service_location_id: siteId,
        site_notes: siteNotes[siteId] || null,
      }))

      if (jobServiceLocationInserts.length > 0) {
        const { error: locationError } = await supabase.from("job_service_locations").insert(jobServiceLocationInserts)

        if (locationError) {
          console.error("[v0] Error updating job service locations:", locationError)
          throw new Error("Failed to update job service locations")
        }
      }

      // Update job_equipment
      await supabase.from("job_equipment").delete().eq("job_id", jobId)

      const jobEquipmentInserts = assignedUnits.map((unit) => ({
        job_id: jobId,
        equipment_id: unit.id,
        service_location_id: unit.siteId,
        unit_notes: unit.unitNotes || null,
        expected_reports: 1,
      }))

      if (jobEquipmentInserts.length > 0) {
        const { error: equipmentError } = await supabase.from("job_equipment").insert(jobEquipmentInserts)

        if (equipmentError) {
          console.error("Error updating job equipment:", equipmentError)
          throw new Error("Failed to update job equipment")
        }
      }

      // Update job_contacts
      await supabase.from("job_contacts").delete().eq("job_id", jobId)
      const validContacts = contactsState.filter((c) => c.name.trim() || c.phone.trim() || c.email.trim())
      if (validContacts.length > 0) {
        const contactInserts = validContacts.map((contact) => ({
          job_id: jobId,
          name: contact.name,
          phone: contact.phone,
          email: contact.email || null,
        }))
        const { error: contactError } = await supabase.from("job_contacts").insert(contactInserts)
        if (contactError) {
          console.error("[v0] Error updating contacts:", contactError)
          throw new Error(`Error updating contacts: ${contactError.message}`)
        }
      }

      console.log("[v0] Updating Google Calendar events...")
      try {
        const calendarResponse = await fetch("/api/calendar/update", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ jobId, technicianIds: selectedTechnicians, leadTechnicianId: leadTechnicianId }),
        })

        if (!calendarResponse.ok) {
          console.warn("[v0] Calendar update failed, but job was saved successfully")
        } else {
          console.log("[v0] Calendar events updated successfully")
        }
      } catch (calendarError) {
        console.error("[v0] Error updating calendar:", calendarError)
      }

      if (changes.length > 0) {
        await createJobEditNotifications(jobId, jobTitle, changes, selectedTechnicians, job.organization_id)
      }

      if (status === "completed" && job.status !== "completed") {
        await createStatusChangeNotifications(jobId, jobTitle, selectedTechnicians)
      }

      setSuccess(true)
      router.refresh()

      setTimeout(() => {
        router.push(`/manager/jobs/${jobId}`)
      }, 1500)
    } catch (err: any) {
      console.error("[v0] Error updating job:", err)
      setError(err.message || "An error occurred while updating the job")
    } finally {
      setIsSubmitting(false)
      setLoading(false)
    }
  }

  const availableUnits = filteredEquipment.filter((eq) => !assignedUnits.some((au) => au.id === eq.id))

  const searchFilteredUnits = availableUnits.filter(
    (eq) =>
      eq.name.toLowerCase().includes(unitSearchQuery.toLowerCase()) ||
      eq.serial_number?.toLowerCase().includes(unitSearchQuery.toLowerCase()),
  )

  const handleTechnicianToggle = (technicianId: string) => {
    setSelectedTechnicians((prev) =>
      prev.includes(technicianId) ? prev.filter((id) => id !== technicianId) : [...prev, technicianId],
    )
  }

  return (
    <div>
      <form onSubmit={handleSubmit} className="space-y-6">
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        {success && !error && (
          <Alert variant="success">
            <AlertDescription>Job updated successfully!</AlertDescription>
          </Alert>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Job Title */}
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="jobTitle">
              Job Title <span className="text-red-500">*</span>
            </Label>
            <Input
              type="text"
              id="jobTitle"
              value={jobTitle}
              onChange={(e) => setJobTitle(e.target.value)}
              placeholder="e.g., Monthly PM Service"
              required
            />
          </div>

          {/* Company */}
          <div className="space-y-2">
            <Label htmlFor="customer">
              Company <span className="text-red-500">*</span>
            </Label>
            <select
              id="customer"
              value={customerId}
              onChange={(e) => {
                setCustomerId(e.target.value)
                setServiceLocationId("")
                setContractId("")
                setVendorId("")
                setSelectedSiteIds([])
                setSiteNotes({})
                setAssignedUnits([])
                if (e.target.value) {
                  const selectedCustomerLocations = serviceLocations.filter((loc) => loc.customer_id === e.target.value)
                  setFilteredLocations(selectedCustomerLocations)
                } else {
                  setFilteredLocations([])
                }
              }}
              className="w-full px-3 py-2 border border-input rounded-md bg-background"
              required
            >
              <option value="">Select a company...</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.company_name || `${c.first_name || ""} ${c.last_name || ""}`.trim() || "Unknown"}
                </option>
              ))}
            </select>
          </div>

          {/* Customer Type */}
          <div className="space-y-2">
            <Label htmlFor="customerType">Customer Type</Label>
            <select
              id="customerType"
              value={customerType}
              onChange={(e) => setCustomerType(e.target.value as "direct" | "subcontract")}
              className="w-full px-3 py-2 border border-input rounded-md bg-background"
            >
              <option value="direct">Direct</option>
              <option value="subcontract">Subcontract</option>
            </select>
          </div>

          {/* Vendor Select */}
          {customerType === "subcontract" && (
            <VendorSelect
              vendors={vendors}
              selectedVendorId={vendorId}
              onVendorChange={setVendorId}
              organizationId={job.organization_id}
            />
          )}

          {/* Job Type */}
          <div className="space-y-2">
            <Label htmlFor="jobType">
              Job Type <span className="text-red-500">*</span>
            </Label>
            <select
              id="jobType"
              value={jobType}
              onChange={(e) => setJobType(e.target.value as "time_and_materials" | "contracted")}
              className="w-full px-3 py-2 border border-input rounded-md bg-background"
              required
            >
              <option value="time_and_materials">Time & Materials</option>
              <option value="contracted">Contracted</option>
            </select>
          </div>

          {/* PO Number */}
          <div className="space-y-2">
            <Label htmlFor="poNumber">PO #/ WO #</Label>
            <Input
              type="text"
              id="poNumber"
              value={poNumber}
              onChange={(e) => setPoNumber(e.target.value)}
              placeholder="Purchase/Work Order Number"
            />
          </div>

          {/* Estimate Number */}
          <div className="space-y-2">
            <Label htmlFor="estimateNumber">Estimate #</Label>
            <Input
              type="text"
              id="estimateNumber"
              value={estimateNumber}
              onChange={(e) => setEstimateNumber(e.target.value)}
              placeholder="Estimate Number"
            />
          </div>

          {/* Contract */}
          {jobType === "contracted" && (
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="contract">Contract</Label>
              <select
                id="contract"
                value={contractId}
                onChange={(e) => setContractId(e.target.value)}
                className="w-full px-3 py-2 border border-input rounded-md bg-background"
                disabled={!customerId || filteredContracts.length === 0}
              >
                <option value="">Select a contract...</option>
                {filteredContracts.map((sa) => (
                  <option key={sa.id} value={sa.id}>
                    {sa.agreement_number} - {sa.type}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Service */}
          <div className="space-y-2 md:col-span-2">
            <Label>
              Service(s) <span className="text-red-500">*</span>
            </Label>
            <div className="border border-input rounded-md p-3 bg-background max-h-48 overflow-y-auto space-y-2">
              {SERVICE_OPTIONS.map((service) => (
                <label key={service} className="flex items-center gap-2 cursor-pointer hover:bg-muted/50 p-1 rounded">
                  <input
                    type="checkbox"
                    checked={serviceType.includes(service)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setServiceType([...serviceType, service])
                      } else {
                        setServiceType(serviceType.filter((s) => s !== service))
                      }
                    }}
                  />
                  <span className="text-sm">{service}</span>
                </label>
              ))}
            </div>
            {serviceType.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {serviceType.map((service) => (
                  <span
                    key={service}
                    className="inline-flex items-center gap-1 px-2 py-1 bg-primary/10 text-primary rounded text-xs"
                  >
                    {service}
                    <button
                      type="button"
                      onClick={() => setServiceType(serviceType.filter((s) => s !== service))}
                      className="hover:bg-primary/20 rounded-full p-0.5"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Billing Status */}
          <div className="space-y-2">
            <Label htmlFor="billingStatus">Billing Status</Label>
            <select
              id="billingStatus"
              value={billingStatus}
              onChange={(e) => setBillingStatus(e.target.value)}
              className="w-full px-3 py-2 border border-input rounded-md bg-background"
            >
              <option value="processing">Processing</option>
              <option value="sent_to_billing">Sent to Billing</option>
              <option value="invoiced">Invoiced</option>
              <option value="paid">Paid</option>
              <option value="un_billable">Un-billable</option>
            </select>
          </div>

          {/* Status */}
          <div className="space-y-2">
            <Label htmlFor="status">
              Status <span className="text-red-500">*</span>
            </Label>
            {job.status === "completed" ? (
              <div className="w-full px-3 py-2 border border-input rounded-md bg-muted text-muted-foreground">
                Completed (Set automatically by system)
              </div>
            ) : (
              <select
                id="status"
                value={status}
                onChange={(e) => {
                  setStatus(e.target.value as JobStatus)
                  setStatusChanged(true)
                }}
                className="w-full px-3 py-2 border border-input rounded-md bg-background"
                required
              >
                {job.status === "overdue" && status === "overdue" && (
                  <option value="overdue" disabled>
                    Overdue (current)
                  </option>
                )}
                <option value="pending">Pending</option>
                <option value="confirmed">Confirmed</option>
                <option value="cancelled">Cancelled</option>
                <option value="on_hold">On Hold</option>
              </select>
            )}
          </div>

          {/* Scheduled Date */}
          <div className="space-y-2">
            <Label htmlFor="scheduledDate">
              Scheduled Date <span className="text-red-500">*</span>
            </Label>
            <Input
              type="date"
              id="scheduledDate"
              value={scheduledDate}
              onChange={(e) => setScheduledDate(e.target.value)}
              required
            />
          </div>

          {/* Scheduled Time */}
          <div className="space-y-2">
            <Label htmlFor="scheduledTime">
              Scheduled Time <span className="text-red-500">*</span>
            </Label>
            <Input
              type="time"
              id="scheduledTime"
              value={scheduledTime}
              onChange={(e) => setScheduledTime(e.target.value)}
              required
            />
          </div>

          {/* Site Address(es) */}
          <Card>
            <CardHeader>
              <CardTitle>Site Address(es)</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <MultiSelectSite
                sites={filteredLocations}
                selectedSiteIds={selectedSiteIds}
                onChange={handleSiteSelect}
                siteNotes={siteNotes}
                onSiteNotesChange={handleSiteNotesChange}
                onEditSite={handleEditSite}
                onDeleteSite={handleDeleteSite}
              />
            </CardContent>
          </Card>

          {/* Return Trip */}
          <div className="space-y-2">
            <Label htmlFor="returnTrip">Is Return Trip?</Label>
            <div className="flex items-center gap-4 pt-2">
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="returnTrip"
                  checked={returnTripNeeded === true}
                  onChange={() => setReturnTripNeeded(true)}
                />
                Yes
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="returnTrip"
                  checked={returnTripNeeded === false}
                  onChange={() => setReturnTripNeeded(false)}
                />
                No
              </label>
            </div>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Assigned Units</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-2">
              <Button
                type="button"
                onClick={() => setShowUnitSelector(true)}
                variant="outline"
                size="sm"
                disabled={!customerId}
              >
                + Add Existing Unit
              </Button>
              <Button
                type="button"
                onClick={() => {
                  setEditingUnitId(null)
                  setNewUnitName("")
                  setNewUnitMake("")
                  setNewUnitModel("")
                  setNewUnitSerialNumber("")
                  setShowCreateUnit(true)
                }}
                variant="secondary"
                size="sm"
                disabled={!customerId}
              >
                Create New Unit
              </Button>
            </div>

            {!customerId && <p className="text-sm text-muted-foreground">Select a company first to manage units</p>}

            {assignedUnits.length === 0 ? (
              <div className="border border-dashed rounded-lg p-8 text-center">
                <p className="text-sm text-muted-foreground">
                  No units assigned to this job yet. Click &quot;Add Existing Unit&quot; to select units or &quot;Create
                  New Unit&quot; to create one.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {assignedUnits.map((unit) => {
                  const selectedSite = filteredLocations.find((l) => l.id === unit.siteId)

                  return (
                    <div key={unit.id} className="border rounded-lg p-4 space-y-3">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <p className="font-medium">{unit.name}</p>
                          {unit.serialNumber && (
                            <p className="text-sm text-muted-foreground">SN: {unit.serialNumber}</p>
                          )}
                          {(unit.make || unit.model) && (
                            <p className="text-sm text-muted-foreground">
                              {[unit.make, unit.model].filter(Boolean).join(" ")}
                            </p>
                          )}
                        </div>
                        <div className="flex gap-1">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingUnitId(unit.id)
                              setNewUnitName(unit.name)
                              setNewUnitMake(unit.make || "")
                              setNewUnitModel(unit.model || "")
                              setNewUnitSerialNumber(unit.serialNumber || "")
                              setShowCreateUnit(true)
                            }}
                            className="p-2 hover:bg-muted rounded"
                            title="Edit unit details"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRemoveUnit(unit.id)}
                            className="p-2 hover:bg-destructive/20 rounded"
                            title="Remove from job"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      {selectedSiteIds.length > 0 && (
                        <div className="grid gap-3 sm:grid-cols-1">
                          <div>
                            <Label className="text-xs text-muted-foreground">Site Address (optional)</Label>
                            <select
                              className="w-full mt-1 px-3 py-2 border border-input rounded-md bg-background text-sm"
                              value={unit.siteId || ""}
                              onChange={(e) => handleUpdateUnitSite(unit.id, e.target.value || null)}
                            >
                              <option value="">Not assigned to site</option>
                              {selectedSiteIds.map((siteId) => {
                                const site = filteredLocations.find((l) => l.id === siteId)
                                return (
                                  <option key={siteId} value={siteId}>
                                    {site?.name}
                                  </option>
                                )
                              })}
                            </select>
                          </div>
                        </div>
                      )}

                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">Unit Notes (optional)</Label>
                        <textarea
                          value={unit.unitNotes || ""}
                          onChange={(e) => {
                            setAssignedUnits((prev) =>
                              prev.map((u) => (u.id === unit.id ? { ...u, unitNotes: e.target.value } : u)),
                            )
                          }}
                          placeholder="Location within building, special access requirements..."
                          className="w-full px-2 py-1.5 text-xs border border-input rounded-md bg-background resize-y min-h-[50px]"
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Technicians */}
        <div className="space-y-2">
          <Label>
            Technicians Assigned <span className="text-red-500">*</span>
          </Label>
          <div className="border border-input rounded-md p-4 max-h-64 overflow-y-auto">
            {technicians.length === 0 ? (
              <p className="text-sm text-muted-foreground">No technicians available</p>
            ) : (
              <div className="space-y-2">
                <div className="grid grid-cols-[auto_1fr_auto] gap-2 pb-2 border-b border-border text-sm font-medium text-muted-foreground">
                  <div>Assigned</div>
                  <div>Name</div>
                  <div>Lead</div>
                </div>
                {technicians.map((tech) => (
                  <div
                    key={tech.id}
                    className="grid grid-cols-[auto_1fr_auto] gap-2 p-2 hover:bg-muted rounded items-center"
                  >
                    <input
                      type="checkbox"
                      checked={selectedTechnicians.includes(tech.id)}
                      onChange={() => {
                        handleTechnicianToggle(tech.id)
                        if (selectedTechnicians.includes(tech.id) && leadTechnicianId === tech.id) {
                          setLeadTechnicianId(null)
                        }
                      }}
                    />
                    <span className="text-sm">{tech.full_name || "Unknown"}</span>
                    <input
                      type="radio"
                      name="leadTechnician"
                      checked={leadTechnicianId === tech.id}
                      onChange={() => setLeadTechnicianId(tech.id)}
                      disabled={!selectedTechnicians.includes(tech.id)}
                      className="disabled:opacity-30"
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Point(s) of Contact */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <Label>Point(s) of Contact</Label>
            <Button type="button" variant="outline" size="sm" onClick={addContact}>
              Add Contact
            </Button>
          </div>
          <div className="space-y-3">
            {contactsState.map((contact, index) => (
              <div
                key={index}
                className="grid grid-cols-1 md:grid-cols-[1fr_1fr_1fr_auto] gap-3 p-4 border border-border rounded-md"
              >
                <div className="space-y-2">
                  <Label htmlFor={`contact-name-${index}`}>Name</Label>
                  <Input
                    type="text"
                    id={`contact-name-${index}`}
                    value={contact.name}
                    onChange={(e) => updateContact(index, "name", e.target.value)}
                    placeholder="Contact name"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor={`contact-phone-${index}`}>Phone</Label>
                  <Input
                    type="tel"
                    id={`contact-phone-${index}`}
                    value={contact.phone}
                    onChange={(e) => updateContact(index, "phone", e.target.value)}
                    placeholder="(555) 123-4567"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor={`contact-email-${index}`}>Email</Label>
                  <Input
                    type="email"
                    id={`contact-email-${index}`}
                    value={contact.email}
                    onChange={(e) => updateContact(index, "email", e.target.value)}
                    placeholder="name@example.com"
                  />
                </div>
                <div className="flex items-end">
                  {contactsState.length > 1 && (
                    <Button type="button" variant="ghost" size="icon" onClick={() => removeContact(index)}>
                      <X className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Notes */}
        <div className="space-y-2">
          <Label htmlFor="notes">Notes</Label>
          <Input
            type="textarea"
            id="notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Any additional notes..."
            className="w-full px-3 py-2 border border-input rounded-md bg-background min-h-[100px]"
          />
        </div>

        {/* Form Actions */}
        <div className="flex gap-3 justify-end">
          <Button type="button" variant="outline" onClick={() => router.back()} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Saving Changes..." : "Save Changes"}
          </Button>
        </div>
      </form>

      {/* Add/Edit Site Modal */}
      <Dialog open={showAddSite} onOpenChange={setShowAddSite}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingSiteId ? "Edit Site" : "Add New Site"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="siteName">Site Name</Label>
              <Input id="siteName" value={newSiteName} onChange={(e) => setNewSiteName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="siteAddress">Address</Label>
              <Input id="siteAddress" value={newSiteAddress} onChange={(e) => setNewSiteAddress(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="siteAddressLine2">Address Line 2</Label>
              <Input
                id="siteAddressLine2"
                value={newSiteAddressLine2}
                onChange={(e) => setNewSiteAddressLine2(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="siteCity">City</Label>
              <Input id="siteCity" value={newSiteCity} onChange={(e) => setNewSiteCity(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="siteState">State</Label>
                <Input id="siteState" value={newSiteState} onChange={(e) => setNewSiteState(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="siteZipCode">Zip Code</Label>
                <Input id="siteZipCode" value={newSiteZipCode} onChange={(e) => setNewSiteZipCode(e.target.value)} />
              </div>
            </div>
          </div>
          <DialogFooter className="gap-3">
            <Button variant="outline" onClick={() => setShowAddSite(false)}>
              Cancel
            </Button>
            <Button
              onClick={async () => {
                const supabase = createClient()
                const siteData = {
                  name: newSiteName,
                  address: newSiteAddress,
                  address_line_2: newSiteAddressLine2,
                  city: newSiteCity,
                  state: newSiteState,
                  zip_code: newSiteZipCode,
                  customer_id: customerId,
                }

                let result
                if (editingSiteId) {
                  result = await supabase.from("service_locations").update(siteData).eq("id", editingSiteId)
                } else {
                  result = await supabase.from("service_locations").insert([siteData])
                }

                if (result.error) {
                  console.error("Error saving site:", result.error)
                  alert("Failed to save site. Please try again.")
                  return
                }

                const { data: updatedLocations } = await supabase
                  .from("service_locations")
                  .select("*")
                  .eq("customer_id", customerId)

                if (updatedLocations) {
                  setFilteredLocations(updatedLocations)
                }

                setShowAddSite(false)
                setEditingSiteId(null)
                setNewSiteName("")
                setNewSiteAddress("")
                setNewSiteAddressLine2("")
                setNewSiteCity("")
                setNewSiteState("")
                setNewSiteZipCode("")
              }}
            >
              {editingSiteId ? "Update" : "Add"} Site
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showUnitSelector} onOpenChange={setShowUnitSelector}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add Existing Units</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search units by name or serial number..."
                value={unitSearchQuery}
                onChange={(e) => setUnitSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>

            {searchFilteredUnits.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                {availableUnits.length === 0
                  ? "All units are already assigned to this job"
                  : "No units found matching your search"}
              </div>
            ) : (
              <div className="border rounded-md divide-y max-h-96 overflow-y-auto">
                {searchFilteredUnits.map((unit) => {
                  const isSelected = selectedUnitsToAdd.includes(unit.id)
                  return (
                    <div
                      key={unit.id}
                      className={`p-3 cursor-pointer hover:bg-muted transition-colors ${
                        isSelected ? "bg-blue-50 dark:bg-blue-950/30" : ""
                      }`}
                      onClick={() => {
                        setSelectedUnitsToAdd((prev) =>
                          prev.includes(unit.id) ? prev.filter((id) => id !== unit.id) : [...prev, unit.id],
                        )
                      }}
                    >
                      <div className="flex items-start gap-3">
                        <input type="checkbox" checked={isSelected} onChange={() => {}} className="mt-1" />
                        <div className="flex-1">
                          <p className="font-medium">{unit.name}</p>
                          {unit.serialNumber && (
                            <p className="text-sm text-muted-foreground">SN: {unit.serialNumber}</p>
                          )}
                          {(unit.make || unit.model) && (
                            <p className="text-sm text-muted-foreground">
                              {[unit.make, unit.model].filter(Boolean).join(" ")}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setShowUnitSelector(false)
                setSelectedUnitsToAdd([])
                setUnitSearchQuery("")
              }}
            >
              Cancel
            </Button>
            <Button type="button" onClick={handleAddSelectedUnits} disabled={selectedUnitsToAdd.length === 0}>
              Add {selectedUnitsToAdd.length > 0 && `(${selectedUnitsToAdd.length})`} Unit
              {selectedUnitsToAdd.length !== 1 ? "s" : ""}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showCreateUnit} onOpenChange={setShowCreateUnit}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingUnitId ? "Edit Unit" : "Create New Unit"}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label htmlFor="newUnitName">
                Unit Name <span className="text-red-500">*</span>
              </Label>
              <Input
                id="newUnitName"
                value={newUnitName}
                onChange={(e) => setNewUnitName(e.target.value)}
                placeholder="HVAC Unit 1"
                required
              />
            </div>
            <div>
              <Label htmlFor="newUnitMake">Make</Label>
              <Input
                id="newUnitMake"
                value={newUnitMake}
                onChange={(e) => setNewUnitMake(e.target.value)}
                placeholder="Carrier"
              />
            </div>
            <div>
              <Label htmlFor="newUnitModel">Model</Label>
              <Input
                id="newUnitModel"
                value={newUnitModel}
                onChange={(e) => setNewUnitModel(e.target.value)}
                placeholder="30RAP"
              />
            </div>
            <div>
              <Label htmlFor="newUnitSerialNumber">Serial Number</Label>
              <Input
                id="newUnitSerialNumber"
                value={newUnitSerialNumber}
                onChange={(e) => setNewUnitSerialNumber(e.target.value)}
                placeholder="SN123456789"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setShowCreateUnit(false)
                setEditingUnitId(null)
                setNewUnitName("")
                setNewUnitMake("")
                setNewUnitModel("")
                setNewUnitSerialNumber("")
              }}
            >
              Cancel
            </Button>
            <Button type="button" onClick={handleCreateUnit}>
              {editingUnitId ? "Save Changes" : "Create & Assign"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
