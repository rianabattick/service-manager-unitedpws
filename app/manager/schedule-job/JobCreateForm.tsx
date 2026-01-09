"use client"

import type React from "react"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { createClient } from "@/lib/supabase-client"
import { X, Pencil, Trash2 } from "lucide-react" // Added Pencil and Trash2 imports
import { createJobNotifications } from "./actions" // Import the createJobNotifications function
// Added import for VendorSelect
import VendorSelect from "@/components/shared/VendorSelect"
import { createCalendarInviteForJob } from "@/lib/google-calendar"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { MultiSelectSite } from "@/components/shared/MultiSelectSite"

interface JobCreateFormProps {
  organizationId: string
  userId: string // Changed from userId? to userId
  customers: Array<{
    id: string
    first_name: string | null
    last_name: string | null
    company_name: string | null
    email?: string | null // Added email field
    phone?: string | null // Added phone field
    address?: string | null // Added address field
    city?: string | null // Added city field
    state: string | null // Changed from string | null to string
    zip_code?: string | null // Added zip_code field
  }>
  serviceLocations: Array<{
    id: string
    customer_id: string
    name: string
    address: string | null
    city: string | null
    state: string | null
    zip_code?: string | null // Added zip_code field
  }>
  equipment: Array<{
    id: string
    customer_id: string
    service_location_id: string | null
    name: string
    make: string | null
    model: string | null
    serial_number: string | null
  }>
  technicians: Array<{
    id: string
    full_name: string | null
    email?: string | null // Added email field for technicians
  }>
  serviceAgreements: Array<{
    id: string
    customer_id: string
    agreement_number: string
    name: string // Added name field to type definition
    type: string
    status: string
  }>
  // Added vendors prop
  vendors: Array<{
    id: string
    company_name: string
  }>
}

const SERVICE_OPTIONS = [
  "MJPM",
  "MnPM",
  "Battery PM",
  "Battery Replacement",
  "Battery Load Test",
  "Battery Evaluation",
  "StartUp",
  "Start Up & Training",
  "EM/Troubleshooting",
  "Break/Fix",
  "Standby",
  "Unit Evaluation",
  "Site Evaluation",
  "Capacitor Upgrade", // Added "Capacitor Upgrade" to service options
  "Installation", // Added "Installation" to service options
]

const JOB_TYPE_FIELD_OPTIONS = ["service_call", "installation", "maintenance", "inspection", "estimate", "warranty"]

type JobStatus = "pending" | "confirmed" | "completed" | "cancelled" | "on_hold"

export function JobCreateForm({
  organizationId,
  userId, // Destructure userId prop
  customers,
  serviceLocations,
  equipment,
  technicians,
  serviceAgreements,
  vendors, // Destructure vendors prop
}: JobCreateFormProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Form state
  const [jobTitle, setJobTitle] = useState("")
  const [customerId, setCustomerId] = useState("")
  const [jobTypeField, setJobTypeField] = useState<
    "service_call" | "installation" | "maintenance" | "inspection" | "estimate" | "warranty"
  >("service_call")
  const [jobType, setJobType] = useState<"time_and_materials" | "contracted">("time_and_materials")
  const [contractId, setContractId] = useState("")
  const [serviceType, setServiceType] = useState<string[]>([])
  const [billingStatus, setBillingStatus] = useState("processing")
  const [status, setStatus] = useState<JobStatus>("confirmed")
  const [scheduledDate, setScheduledDate] = useState("")
  const [scheduledTime, setScheduledTime] = useState("")
  // const [serviceLocationId, setServiceLocationId] = useState("") // Replaced
  const [selectedEquipment, setSelectedEquipment] = useState<string[]>([])
  const [returnTripNeeded, setReturnTripNeeded] = useState(false)
  const [selectedTechnicians, setSelectedTechnicians] = useState<string[]>([])
  const [notes, setNotes] = useState("")
  const [poNumber, setPoNumber] = useState("")
  const [estimateNumber, setEstimateNumber] = useState("")
  const [description, setDescription] = useState("") // Added description field
  const [scheduledStart, setScheduledStart] = useState("") // Added scheduledStart
  const [scheduledEnd, setScheduledEnd] = useState("") // Added scheduledEnd

  const [customerType, setCustomerType] = useState<"direct" | "subcontract">("direct")
  const [vendorId, setVendorId] = useState<string>("")
  const [contacts, setContacts] = useState<Array<{ name: string; phone: string; email: string }>>([
    { name: "", phone: "", email: "" },
  ])

  const [leadTechnicianId, setLeadTechnicianId] = useState<string | null>(null)

  const [showAddCompany, setShowAddCompany] = useState(false)
  const [showAddSite, setShowAddSite] = useState(false)
  const [showAddUnit, setShowAddUnit] = useState(false)

  const [editingCompanyId, setEditingCompanyId] = useState<string | null>(null)
  const [editingSiteId, setEditingSiteId] = useState<string | null>(null)
  const [editingUnitId, setEditingUnitId] = useState<string | null>(null)

  const [newCompanyType, setNewCompanyType] = useState("commercial")
  const [newCompanyName, setNewCompanyName] = useState("")
  const [newCompanyEmail, setNewCompanyEmail] = useState("")
  const [newCompanyPhone, setNewCompanyPhone] = useState("")
  const [newCompanyAddress, setNewCompanyAddress] = useState("") // Added new state for address
  const [newCompanyCity, setNewCompanyCity] = useState("") // Added city state for address
  const [newCompanyState, setNewCompanyState] = useState("") // Added state state for address
  const [newCompanyZipCode, setNewCompanyZipCode] = useState("") // Added zip_code state for address

  const [newSiteName, setNewSiteName] = useState("")
  const [newSiteAddress, setNewSiteAddress] = useState("")
  const [newSiteCity, setNewSiteCity] = useState("")
  const [newSiteState, setNewSiteState] = useState("")
  const [newSiteZipCode, setNewSiteZipCode] = useState("")

  const [newUnitName, setNewUnitName] = useState("")
  const [newUnitMake, setNewUnitMake] = useState("")
  const [newUnitModel, setNewUnitModel] = useState("")
  const [newUnitSerialNumber, setNewUnitSerialNumber] = useState("") // This was renamed in updates to newUnitSerial

  const [selectedSiteIds, setSelectedSiteIds] = useState<string[]>([])
  const [siteNotes, setSiteNotes] = useState<Record<string, string>>({})

  // State variables that were undeclared and are now added:
  const [siteLocations, setSiteLocations] = useState<Record<string, Array<{ name: string; unitLocation: string }>>>({})
  const [showAddSiteLocation, setShowAddSiteLocation] = useState<string | null>(null)
  const [newSiteLocationName, setNewSiteLocationName] = useState("")
  const [newSiteLocationUnitLocation, setNewSiteLocationUnitLocation] = useState("")
  const [siteLocationStrings, setSiteLocationStrings] = useState<
    Record<string, Array<{ name: string; unitLocation: string }>>
  >({})

  // Removed: siteLocationStrings, siteLocations, selectedSiteLocationIds,
  // showAddSiteLocation, newSiteLocationName, newSiteLocationUnitLocation,
  // handleSiteLocationsChange, handleAddSiteLocation

  const [unitNotes, setUnitNotes] = useState<Record<string, string>>({})

  const [unitSiteMappings, setUnitSiteMappings] = useState<
    Record<
      string,
      {
        siteId: string | null
      }
    >
  >({})

  // Filtered data based on selections
  const filteredLocations = serviceLocations.filter((loc) => loc.customer_id === customerId)
  const filteredEquipment = equipment.filter((eq) => eq.customer_id === customerId)

  const filteredContracts = serviceAgreements.filter((sa) => sa.customer_id === customerId)

  const handleSiteSelectionChange = async (siteIds: string[]) => {
    setSelectedSiteIds(siteIds)
    setSelectedEquipment([]) // Clear equipment when sites change
  }

  const handleSiteNotesChange = (siteId: string, notes: string) => {
    setSiteNotes((prev) => ({
      ...prev,
      [siteId]: notes,
    }))
  }

  const handleUnitNotesChange = (equipmentId: string, notes: string) => {
    setUnitNotes((prev) => ({
      ...prev,
      [equipmentId]: notes,
    }))
  }

  const handleUnitSiteMapping = (equipmentId: string, siteId: string | null) => {
    setUnitSiteMappings((prev) => ({
      ...prev,
      [equipmentId]: {
        siteId,
      },
    }))
  }

  const handleEquipmentToggle = (equipmentId: string) => {
    setSelectedEquipment((prev) =>
      prev.includes(equipmentId) ? prev.filter((id) => id !== equipmentId) : [...prev, equipmentId],
    )
  }

  const handleTechnicianToggle = (techId: string) => {
    setSelectedTechnicians((prev) => (prev.includes(techId) ? prev.filter((id) => id !== techId) : [...prev, techId]))
  }

  const addContact = () => {
    setContacts([...contacts, { name: "", phone: "", email: "" }])
  }

  const removeContact = (index: number) => {
    if (contacts.length > 1) {
      setContacts(contacts.filter((_, i) => i !== index))
    }
  }

  // Updated contacts update to include email field
  const updateContact = (index: number, field: "name" | "phone" | "email", value: string) => {
    const updated = [...contacts]
    updated[index][field] = value
    setContacts(updated)
  }

  const handleDeleteCompany = async (companyId: string) => {
    if (!confirm("Are you sure you want to delete this company? This action cannot be undone.")) {
      return
    }

    try {
      const supabase = createClient()
      const { error: deleteError } = await supabase.from("customers").delete().eq("id", companyId)

      if (deleteError) throw deleteError

      // Update local state
      // Note: In a real app, you'd want to refetch data or use a state management solution.
      customers.splice(
        customers.findIndex((c) => c.id === companyId),
        1,
      )
      if (customerId === companyId) {
        setCustomerId("")
      }
      alert("Company deleted successfully")
    } catch (err) {
      console.error("[v0] Error deleting company:", err)
      setError(err instanceof Error ? err.message : "Failed to delete company")
    }
  }

  const handleEditCompany = (companyId: string) => {
    const company = customers.find((c) => c.id === companyId)
    if (!company) return

    setEditingCompanyId(companyId)
    setNewCompanyName(company.company_name || "")
    setNewCompanyEmail(company.email || "")
    setNewCompanyPhone(company.phone || "")
    // Pre-fill address fields if they exist in the customer data
    setNewCompanyAddress(company.address || "")
    setNewCompanyCity(company.city || "")
    setNewCompanyState(company.state || "")
    setNewCompanyZipCode(company.zip_code || "")
    setShowAddCompany(true)
  }

  const handleDeleteSite = async (siteId: string) => {
    if (!confirm("Are you sure you want to delete this site? This action cannot be undone.")) {
      return
    }

    try {
      const supabase = createClient()
      const { error: deleteError } = await supabase.from("service_locations").delete().eq("id", siteId)

      if (deleteError) throw deleteError

      // Update local state
      const index = serviceLocations.findIndex((l) => l.id === siteId)
      if (index !== -1) {
        serviceLocations.splice(index, 1)
      }
      // if (serviceLocationId === siteId) { // Removed as serviceLocationId is no longer used directly
      //   setServiceLocationId("")
      // }
      alert("Site deleted successfully")
    } catch (err) {
      console.error("[v0] Error deleting site:", err)
      setError(err instanceof Error ? err.message : "Failed to delete site")
    }
  }

  const handleEditSite = (siteId: string) => {
    const site = serviceLocations.find((l) => l.id === siteId)
    if (!site) return

    setEditingSiteId(siteId)
    setNewSiteName(site.name)
    setNewSiteAddress(site.address || "")
    setNewSiteCity(site.city || "")
    setNewSiteState(site.state || "")
    setNewSiteZipCode(site.zip_code || "")
    setShowAddSite(true)
  }

  const handleDeleteUnit = async (unitId: string) => {
    if (!confirm("Are you sure you want to delete this unit? This action cannot be undone.")) {
      return
    }

    try {
      const supabase = createClient()
      const { error: deleteError } = await supabase.from("equipment").delete().eq("id", unitId)

      if (deleteError) throw deleteError

      // Update local state
      const index = equipment.findIndex((e) => e.id === unitId)
      if (index !== -1) {
        equipment.splice(index, 1)
      }
      setSelectedEquipment(selectedEquipment.filter((id) => id !== unitId))
      alert("Unit deleted successfully")
    } catch (err) {
      console.error("[v0] Error deleting unit:", err)
      setError(err instanceof Error ? err.message : "Failed to delete unit")
    }
  }

  const handleEditUnit = (unitId: string) => {
    const unit = equipment.find((e) => e.id === unitId)
    if (!unit) return

    setEditingUnitId(unitId)
    setNewUnitName(unit.name)
    setNewUnitMake(unit.make || "")
    setNewUnitModel(unit.model || "")
    setNewUnitSerialNumber(unit.serial_number || "")
    setShowAddUnit(true)
  }

  const handleAddCompany = async () => {
    if (!newCompanyName) {
      setError("Please provide a company name")
      return
    }

    try {
      const supabase = createClient()

      if (editingCompanyId) {
        // Update existing company
        const { data, error: updateError } = await supabase
          .from("customers")
          .update({
            company_name: newCompanyName,
            email: newCompanyEmail || null,
            phone: newCompanyPhone || "-",
            address: newCompanyAddress || "-",
            city: newCompanyCity || "-",
            state: newCompanyState || "-",
            zip_code: newCompanyZipCode || "-",
          })
          .eq("id", editingCompanyId)
          .select()
          .single()

        if (updateError) throw updateError

        // Update local state
        const index = customers.findIndex((c) => c.id === editingCompanyId)
        if (index !== -1) {
          customers[index] = { ...customers[index], ...data }
        }
        setEditingCompanyId(null)
      } else {
        // Add new company
        const { data, error: insertError } = await supabase
          .from("customers")
          .insert({
            organization_id: organizationId,
            company_name: newCompanyName,
            first_name: "-",
            last_name: "-",
            email: newCompanyEmail || null,
            phone: newCompanyPhone || "-",
            address: newCompanyAddress || "-",
            city: newCompanyCity || "-",
            state: newCompanyState || "-",
            zip_code: newCompanyZipCode || "-",
            country: "USA",
            type: newCompanyType || "commercial",
            customer_type: customerType,
            is_active: true,
          })
          .select()
          .single()

        if (insertError) throw insertError

        customers.push(data) // This line might cause issues if props are immutable. Consider refetching data or using a state management solution.
        setCustomerId(data.id)
      }

      setShowAddCompany(false)
      // Clear form
      setNewCompanyType("commercial")
      setNewCompanyName("")
      setNewCompanyEmail("")
      setNewCompanyPhone("")
      setNewCompanyAddress("")
      setNewCompanyCity("")
      setNewCompanyState("")
      setNewCompanyZipCode("")
    } catch (err) {
      console.error("[v0] Error saving company:", err)
      setError(err instanceof Error ? err.message : "Failed to save company")
    }
  }

  const handleAddSite = async () => {
    if (!customerId) {
      setError("Please select a company first")
      return
    }

    if (!newSiteName) {
      setError("Please provide a site name")
      return
    }

    try {
      const supabase = createClient()

      if (editingSiteId) {
        // Update existing site
        const { data, error: updateError } = await supabase
          .from("service_locations")
          .update({
            name: newSiteName,
            address: newSiteAddress || "",
            city: newSiteCity || "",
            state: newSiteState || "",
            zip_code: newSiteZipCode || "",
          })
          .eq("id", editingSiteId)
          .select()
          .single()

        if (updateError) throw updateError

        // Update local state
        const index = serviceLocations.findIndex((l) => l.id === editingSiteId)
        if (index !== -1) {
          serviceLocations[index] = { ...serviceLocations[index], ...data }
        }
        setEditingSiteId(null)
      } else {
        // Add new site
        const { data, error: insertError } = await supabase
          .from("service_locations")
          .insert({
            organization_id: organizationId,
            customer_id: customerId,
            name: newSiteName,
            address: newSiteAddress || "",
            city: newSiteCity || "",
            state: newSiteState || "",
            zip_code: newSiteZipCode || "",
          })
          .select()
          .single()

        if (insertError) throw insertError

        serviceLocations.push(data)
        // if (!serviceLocationId) { // Removed as serviceLocationId is no longer used directly
        //   setServiceLocationId(data.id)
        // }
      }

      setShowAddSite(false)
      // Clear form
      setNewSiteName("")
      setNewSiteAddress("")
      setNewSiteCity("")
      setNewSiteState("")
      setNewSiteZipCode("")
    } catch (err) {
      console.error("[v0] Error saving site:", err)
      setError(err instanceof Error ? err.message : "Failed to save site")
    }
  }

  const handleAddUnit = async () => {
    if (!customerId) {
      setError("Please select a company first")
      return
    }

    // Removed site validation for adding unit
    // if (!serviceLocationId) {
    //   setError("Please select a site first")
    //   return
    // }

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
            make: newUnitMake || "",
            model: newUnitModel || "",
            serial_number: newUnitSerialNumber || "",
          })
          .eq("id", editingUnitId)
          .select()
          .single()

        if (updateError) throw updateError

        // Update local state
        const index = equipment.findIndex((e) => e.id === editingUnitId)
        if (index !== -1) {
          equipment[index] = { ...equipment[index], ...data }
        }
        setEditingUnitId(null)
      } else {
        // Add new unit
        const { data, error: insertError } = await supabase
          .from("equipment")
          .insert({
            organization_id: organizationId,
            customer_id: customerId,
            // service_location_id: serviceLocationId, // Removed
            name: newUnitName,
            make: newUnitMake || "",
            model: newUnitModel || "",
            serial_number: newUnitSerialNumber || "",
            type: "-", // Required by database, using placeholder
            is_active: true,
          })
          .select()
          .single()

        if (insertError) throw insertError

        equipment.push(data)
        setSelectedEquipment([...selectedEquipment, data.id])
      }

      setShowAddUnit(false)
      // Clear form
      setNewUnitName("")
      setNewUnitMake("")
      setNewUnitModel("")
      setNewUnitSerialNumber("")
    } catch (err) {
      console.error("[v0] Error saving unit:", err)
      setError(err instanceof Error ? err.message : "Failed to save unit")
    }
  }

  const handleAddSiteLocation = (siteId: string) => {
    if (!newSiteLocationName && !newSiteLocationUnitLocation) {
      alert("Please provide a name or unit location for the site location.")
      return
    }

    setSiteLocations((prev) => ({
      ...prev,
      [siteId]: [
        ...(prev[siteId] || []),
        {
          name: newSiteLocationName,
          unitLocation: newSiteLocationUnitLocation,
        },
      ],
    }))

    setNewSiteLocationName("")
    setNewSiteLocationUnitLocation("")
    setShowAddSiteLocation(null) // Close the modal
  }

  const handleDeleteSiteLocation = (siteId: string, indexToDelete: number) => {
    setSiteLocations((prev) => {
      const updatedSiteLocations = { ...prev }
      if (updatedSiteLocations[siteId]) {
        updatedSiteLocations[siteId] = updatedSiteLocations[siteId].filter((_, index) => index !== indexToDelete)
      }
      return updatedSiteLocations
    })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)

    if (!userId) {
      setError("User not authenticated")
      setIsSubmitting(false) // Added to stop submission if user is not authenticated
      return
    }

    try {
      // Validate required fields
      if (!customerId) {
        alert("Please select a company")
        setIsSubmitting(false)
        return
      }

      if (!jobTitle.trim()) {
        alert("Please enter a job title")
        setIsSubmitting(false)
        return
      }

      if (selectedTechnicians.length === 0) {
        alert("Please select at least one technician")
        setIsSubmitting(false)
        return
      }

      if (serviceType.length === 0) {
        alert("Please select at least one service")
        setIsSubmitting(false)
        return
      }

      if (!scheduledDate || !scheduledTime) {
        alert("Please select a scheduled date and time")
        setIsSubmitting(false)
        return
      }

      // Combine date and time
      const scheduledDateTime = new Date(`${scheduledDate}T${scheduledTime}`)

      // Filter contacts to only those with at least name or phone filled
      const filledContacts = contacts.filter((c) => c.name.trim() || c.phone.trim() || c.email.trim())

      // Validate filled contacts have required fields
      for (const contact of filledContacts) {
        if (!contact.name.trim()) {
          alert("All contacts must have a name")
          setIsSubmitting(false)
          return
        }
        if (!contact.phone.trim()) {
          alert("All contacts must have a phone number")
          setIsSubmitting(false)
          return
        }
      }

      const supabase = createClient()

      // Generate job number
      const timestamp = Date.now()
      const randomStr = Math.random().toString(36).substring(2, 6).toUpperCase()
      const generatedJobNumber = `JOB-${timestamp}-${randomStr}`

      // The 'serviceLocationId' variable was undeclared. It seems it was intended to be derived from 'selectedSiteIds'.
      // We will use the first selected site ID, or null if none are selected.
      const serviceLocationId = selectedSiteIds.length > 0 ? selectedSiteIds[0] : null

      console.log("[v0] Inserting job with data:", {
        organization_id: organizationId,
        customer_id: customerId,
        service_location_id: serviceLocationId || null, // This field is kept for backward compatibility
        job_number: generatedJobNumber,
        title: jobTitle,
        type: "service_call",
        priority: "normal",
        status: status,
        scheduled_start: scheduledDateTime.toISOString(),
        po_number: poNumber || null,
        estimate_number: estimateNumber || null,
        return_trip_needed: returnTripNeeded,
        service_agreement_id: jobType === "contracted" && contractId ? contractId : null,
        notes: notes || null,
        created_by: userId, // Use userId prop directly
        job_type: jobType,
        service_type: serviceType.join(", "),
        billing_status: billingStatus,
        vendor_id: customerType === "subcontract" && vendorId ? vendorId : null,
      })

      // Insert job
      const { data: newJob, error: jobError } = await supabase
        .from("jobs")
        .insert({
          organization_id: organizationId,
          customer_id: customerId,
          service_location_id: serviceLocationId, // Use the derived serviceLocationId
          job_number: generatedJobNumber,
          title: jobTitle,
          type: "service_call", // Assuming 'service_call' is a default or fixed value
          priority: "normal", // Assuming 'normal' is a default or fixed value
          status: status,
          scheduled_start: new Date(`${scheduledDate}T${scheduledTime}`).toISOString(),
          po_number: poNumber || null,
          estimate_number: estimateNumber || null,
          return_trip_needed: returnTripNeeded,
          service_agreement_id: jobType === "contracted" && contractId ? contractId : null,
          notes: notes || null,
          created_by: userId, // Use userId prop directly
          job_type: jobType,
          service_type: serviceType.join(", "),
          billing_status: billingStatus,
          vendor_id: customerType === "subcontract" && vendorId ? vendorId : null,
        })
        .select()
        .single()

      if (jobError) {
        console.error("[v0] Error inserting job:", jobError)
        alert(`Error creating job: ${jobError.message}`)
        setIsSubmitting(false)
        return
      }

      console.log("[v0] Job inserted successfully:", newJob)

      // Process site locations after job creation
      if (selectedSiteIds.length > 0) {
        const jobSiteInserts = []

        for (const siteId of selectedSiteIds) {
          const locations = siteLocations[siteId] || [] // Use siteLocations state

          if (locations.length > 0) {
            // If there are site locations, create one entry per location
            for (const location of locations) {
              // Need to determine how to get a locationId if needed.
              // For now, we'll just link the site and include site-specific notes.
              jobSiteInserts.push({
                job_id: newJob.id,
                service_location_id: siteId,
                site_notes: siteNotes[siteId] || null, // Use siteNotes state
                // If location.name or location.unitLocation are relevant for a separate table, they need to be handled.
                // For now, assume they are part of site_notes or handled elsewhere if needed.
              })
            }
          } else {
            // If no site locations, just link the site address and notes
            jobSiteInserts.push({
              job_id: newJob.id,
              service_location_id: siteId,
              site_notes: siteNotes[siteId] || null,
            })
          }
        }

        // Inserting into job_service_locations table
        const { error: jobSitesError } = await supabase.from("job_service_locations").insert(jobSiteInserts)

        if (jobSitesError) {
          console.error("[v0] Error inserting job sites:", jobSitesError)
          alert(`Error linking job to sites: ${jobSitesError.message}`)
          setIsSubmitting(false)
          return
        }
        console.log("[v0] Job sites inserted successfully")
      }

      if (jobType === "contracted" && contractId) {
        const { error: contractUpdateError } = await supabase
          .from("service_agreements")
          .update({ status: "in_progress" })
          .eq("id", contractId)
          .in("status", ["job_creation_needed"])

        if (contractUpdateError) {
          console.error("[v0] Error updating contract status:", contractUpdateError)
        } else {
          console.log("[v0] Contract status updated to in_progress")
        }
      }

      await createJobNotifications(
        newJob.id,
        newJob.title,
        newJob.job_number,
        selectedTechnicians,
        organizationId, // Use organizationId prop directly
        userId, // Use userId prop directly
      )

      // Insert technicians
      if (selectedTechnicians.length > 0) {
        const technicianInserts = selectedTechnicians.map((techId) => ({
          job_id: newJob.id,
          technician_id: techId,
          status: "accepted",
          assigned_at: new Date().toISOString(),
          is_lead: techId === leadTechnicianId,
        }))

        const { error: techError } = await supabase.from("job_technicians").insert(technicianInserts)

        if (techError) {
          console.error("[v0] Error inserting technicians:", techError)
          alert(`Error assigning technicians: ${techError.message}`)
          setIsSubmitting(false)
          return
        }

        console.log("[v0] Technicians inserted successfully")
      }

      for (const equipmentId of selectedEquipment) {
        await supabase.from("job_equipment").insert({
          job_id: newJob.id,
          equipment_id: equipmentId,
          service_location_id: unitSiteMappings[equipmentId]?.siteId || null,
          unit_notes: unitNotes[equipmentId] || null,
          expected_reports: 1,
        })
      }

      // Insert contacts
      if (filledContacts.length > 0) {
        const contactInserts = filledContacts.map((contact) => ({
          job_id: newJob.id,
          name: contact.name.trim(),
          phone: contact.phone.trim(),
          email: contact.email.trim() || null,
        }))

        const { error: contactError } = await supabase.from("job_contacts").insert(contactInserts)

        if (contactError) {
          console.error("[v0] Error inserting contacts:", contactError)
          alert(`Error adding contacts: ${contactError.message}`)
          setIsSubmitting(false)
          return
        }

        console.log("[v0] Contacts inserted successfully")
      }

      // Send Google Calendar invites
      if (selectedTechnicians.length > 0) {
        console.log("[v0] Sending Google Calendar invites to technicians...")

        const calendarResult = await createCalendarInviteForJob(newJob.id, selectedTechnicians)

        if (!calendarResult.success && calendarResult.error) {
          console.error("[v0] Failed to send calendar invites:", calendarResult.error)
          alert(`Job created successfully! Note: ${calendarResult.error}`)
        } else {
          console.log("[v0] Google Calendar invites sent successfully.")
        }
      } else {
        console.log("[v0] No technicians selected, skipping Google Calendar invites.")
      }

      // Success! Redirect to job detail page
      router.push(`/manager/jobs/${newJob.id}`)
    } catch (error) {
      console.error("[v0] Unexpected error:", error)
      alert("An unexpected error occurred")
      setIsSubmitting(false)
    }
  }

  return (
    <div>
      <form onSubmit={handleSubmit} className="space-y-6">
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
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
            <div className="flex gap-2">
              <select
                id="customer"
                value={customerId}
                onChange={(e) => {
                  setCustomerId(e.target.value)
                  // setServiceLocationId("") // Removed
                  setSelectedEquipment([])
                  setContractId("")
                  setJobTitle("") // Clear job title when company changes
                  setSelectedSiteIds([]) // Clear selected sites
                  setSiteLocations({}) // Clear site locations
                  // setSelectedSiteLocationIds({}) // Removed as it was undeclared
                }}
                className="flex-1 px-3 py-2 border border-input rounded-md bg-background"
                required
              >
                <option value="">Select a company...</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.company_name || `${c.first_name || ""} ${c.last_name || ""}`.trim() || "Unknown"}
                  </option>
                ))}
              </select>
              <Button
                type="button"
                onClick={() => {
                  setEditingCompanyId(null) // Ensure we are in add mode
                  setShowAddCompany(true)
                }}
                variant="outline"
              >
                + Add
              </Button>
              {customerId && (
                <>
                  <Button type="button" onClick={() => handleEditCompany(customerId)} variant="outline" size="icon">
                    <Pencil className="w-4 h-4" />
                  </Button>
                  <Button type="button" onClick={() => handleDeleteCompany(customerId)} variant="outline" size="icon">
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </>
              )}
            </div>
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

          {/* Subcontract Company Name (now Vendor Select) */}
          {customerType === "subcontract" && (
            // Replaced text input with VendorSelect component
            <VendorSelect
              value={vendorId}
              onValueChange={setVendorId}
              organizationId={organizationId}
              userId={userId} // Pass userId prop
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
            <Label htmlFor="poNumber">PO #/ WO #</Label> {/* Changed label from "PO #/ WO #/ TO #" to "PO #/ WO #" */}
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

          {/* Contract (only when job type = contracted) */}
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
                    {sa.name || sa.agreement_number}
                  </option>
                ))}
              </select>
              {customerId && filteredContracts.length === 0 && (
                <p className="text-sm text-muted-foreground">No active contracts for this customer</p>
              )}
            </div>
          )}

          {/* Service */}
          <div className="space-y-2">
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
                    className="w-4 h-4"
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
            <select
              id="status"
              value={status}
              onChange={(e) => setStatus(e.target.value as JobStatus)}
              className="w-full px-3 py-2 border border-input rounded-md bg-background"
              required
            >
              <option value="pending">Pending</option>
              <option value="confirmed">Confirmed</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
              <option value="on_hold">On Hold</option>
            </select>
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

          {/* Site */}
          <div className="space-y-2">
            {/* Changed label from "Site Addresses" to "Site Address(s)" */}
            <Label htmlFor="sites">Site Address(s)</Label>
            <MultiSelectSite
              sites={filteredLocations}
              selectedSiteIds={selectedSiteIds}
              onChange={handleSiteSelectionChange}
              siteNotes={siteNotes}
              onSiteNotesChange={handleSiteNotesChange}
              disabled={!customerId}
              onEditSite={(siteId) => {
                const site = filteredLocations.find((s) => s.id === siteId)
                if (site) {
                  setEditingSiteId(siteId)
                  setNewSiteName(site.name)
                  setNewSiteAddress(site.address || "")
                  setNewSiteCity(site.city || "")
                  setNewSiteState(site.state || "")
                  setNewSiteZipCode(site.zip_code || "")
                  setShowAddSite(true)
                }
              }}
              onDeleteSite={async (siteId) => {
                await handleDeleteSite(siteId)
              }}
            />
            {selectedSiteIds.length === 0 && (
              <p className="text-sm text-muted-foreground mt-1">
                {!customerId
                  ? "Select a company first"
                  : filteredLocations.length === 0
                    ? "No service locations for this customer"
                    : "Select one or more site addresses"}
              </p>
            )}
          </div>

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

        {/* Units */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>Units</Label>
            <Button
              type="button"
              onClick={() => {
                setEditingUnitId(null)
                setShowAddUnit(true)
              }}
              variant="outline"
              size="sm"
              disabled={!customerId}
            >
              + Add Unit
            </Button>
          </div>
          <div className="border border-input rounded-md p-4 max-h-96 overflow-y-auto space-y-3">
            {filteredEquipment.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {customerId ? "No equipment found for this customer" : "Select a company first"}
              </p>
            ) : (
              filteredEquipment.map((eq) => (
                <div key={eq.id} className="p-3 border border-border rounded space-y-2">
                  <div className="flex items-start gap-2">
                    <input
                      type="checkbox"
                      checked={selectedEquipment.includes(eq.id)}
                      onChange={() => handleEquipmentToggle(eq.id)}
                      className="mt-1"
                    />
                    <div className="flex-1">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="font-medium text-sm">{eq.name}</p>
                          {eq.serial_number && <p className="text-xs text-muted-foreground">SN#: {eq.serial_number}</p>}
                        </div>
                        <div className="flex gap-1">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              setEditingUnitId(eq.id)
                              setNewUnitName(eq.name)
                              setNewUnitMake(eq.make || "")
                              setNewUnitModel(eq.model || "")
                              setNewUnitSerialNumber(eq.serial_number || "")
                              setShowAddUnit(true)
                            }}
                            className="p-1 hover:bg-muted rounded"
                            title="Edit unit"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={async (e) => {
                              e.stopPropagation()
                              if (confirm(`Delete unit "${eq.name}"?`)) {
                                await handleDeleteUnit(eq.id)
                              }
                            }}
                            className="p-1 hover:bg-destructive/20 rounded"
                            title="Delete unit"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                  {/* Show site/location selectors only if unit is selected */}
                  {selectedEquipment.includes(eq.id) && selectedSiteIds.length > 0 && (
                    <div className="ml-6 space-y-2 text-sm">
                      <div>
                        <Label className="text-xs">Site Address (optional)</Label>
                        <select
                          className="w-full px-2 py-1 border border-input rounded-md bg-background text-xs"
                          value={unitSiteMappings[eq.id]?.siteId || ""}
                          onChange={(e) => handleUnitSiteMapping(eq.id, e.target.value || null)}
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

                      <div>
                        <Label className="text-xs">Unit Notes (optional)</Label>
                        <textarea
                          value={unitNotes[eq.id] || ""}
                          onChange={(e) => handleUnitNotesChange(eq.id, e.target.value)}
                          placeholder="Location within building, special access requirements..."
                          className="w-full px-2 py-1.5 text-xs border border-input rounded-md bg-background resize-y min-h-[50px]"
                        />
                      </div>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>
              Field Engineer(s) <span className="text-red-500">*</span>{" "}
              <span className="text-muted-foreground text-sm font-normal">(Select at least one)</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {technicians.length === 0 ? (
              <p className="text-sm text-muted-foreground">No field engineers available</p>
            ) : (
              <div className="space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {technicians.map((tech) => (
                    <label
                      key={tech.id}
                      className="flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-muted/50"
                    >
                      <input
                        type="checkbox"
                        checked={selectedTechnicians.includes(tech.id)}
                        onChange={() => {
                          handleTechnicianToggle(tech.id)
                          // Clear lead if unchecking
                          if (selectedTechnicians.includes(tech.id) && leadTechnicianId === tech.id) {
                            setLeadTechnicianId(null)
                          }
                        }}
                        className="w-4 h-4"
                      />
                      <span className="font-medium">{tech.full_name}</span>
                      <input
                        type="radio"
                        name="leadTechnician"
                        checked={leadTechnicianId === tech.id}
                        onChange={() => setLeadTechnicianId(tech.id)}
                        disabled={!selectedTechnicians.includes(tech.id)}
                        className="ml-auto w-4 h-4"
                      />
                      <span className="text-sm text-muted-foreground">Lead</span>
                    </label>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Point(s) of Contact Section */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <Label>Point(s) of Contact</Label>
            <Button type="button" variant="outline" size="sm" onClick={addContact}>
              Add Contact
            </Button>
          </div>
          <div className="space-y-3">
            {contacts.map((contact, index) => (
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
                  {contacts.length > 1 && (
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
          <Textarea
            id="notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={4}
            placeholder="Add any additional notes about this job..."
          />
        </div>

        <div className="flex items-center justify-end gap-4 pt-4 border-t mt-6 max-w-full">
          <Button type="button" variant="outline" onClick={() => router.back()} disabled={loading}>
            Cancel
          </Button>
          <Button type="submit" disabled={loading}>
            {loading ? "Creating Job..." : "Create Job"}
          </Button>
        </div>
      </form>

      {showAddCompany && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-background border rounded-lg p-6 max-w-md w-full mx-4 max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-semibold mb-4">{editingCompanyId ? "Edit Company" : "Add New Company"}</h3>
            <div className="space-y-4">
              <div>
                <Label htmlFor="newCompanyType">Type</Label>
                <select
                  id="newCompanyType"
                  value={newCompanyType}
                  onChange={(e) => setNewCompanyType(e.target.value)}
                  className="w-full px-3 py-2 border border-input rounded-md bg-background"
                >
                  <option value="commercial">Commercial</option>
                  <option value="residential">Residential</option>
                </select>
              </div>
              <div>
                <Label htmlFor="newCompanyName">
                  Company Name <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="newCompanyName"
                  value={newCompanyName}
                  onChange={(e) => setNewCompanyName(e.target.value)}
                  placeholder="Acme Corporation"
                  required
                />
              </div>
              <div>
                <Label htmlFor="newCompanyEmail">Email</Label>
                <Input
                  id="newCompanyEmail"
                  type="email"
                  value={newCompanyEmail}
                  onChange={(e) => setNewCompanyEmail(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="newCompanyPhone">Phone</Label>
                <Input
                  id="newCompanyPhone"
                  type="tel"
                  value={newCompanyPhone}
                  onChange={(e) => setNewCompanyPhone(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="newCompanyAddress">Address</Label>
                <Input
                  id="newCompanyAddress"
                  value={newCompanyAddress}
                  onChange={(e) => setNewCompanyAddress(e.target.value)}
                  placeholder="123 Main St"
                />
              </div>
              <div>
                <Label htmlFor="newCompanyCity">City</Label>
                <Input
                  id="newCompanyCity"
                  value={newCompanyCity}
                  onChange={(e) => setNewCompanyCity(e.target.value)}
                  placeholder="Los Angeles"
                />
              </div>
              <div>
                <Label htmlFor="newCompanyState">State</Label>
                <Input
                  id="newCompanyState"
                  value={newCompanyState}
                  onChange={(e) => setNewCompanyState(e.target.value)}
                  placeholder="CA"
                />
              </div>
              <div>
                <Label htmlFor="newCompanyZipCode">Zip Code</Label>
                <Input
                  id="newCompanyZipCode"
                  value={newCompanyZipCode}
                  onChange={(e) => setNewCompanyZipCode(e.target.value)}
                  placeholder="90210"
                />
              </div>
            </div>
            <div className="flex gap-2 mt-6">
              <Button type="button" onClick={handleAddCompany} className="flex-1">
                {editingCompanyId ? "Save Changes" : "Add Company"}
              </Button>
              <Button
                type="button"
                onClick={() => {
                  setShowAddCompany(false)
                  setEditingCompanyId(null)
                  setNewCompanyType("commercial")
                  setNewCompanyName("")
                  setNewCompanyEmail("")
                  setNewCompanyPhone("")
                  setNewCompanyAddress("") // Clear address field
                  setNewCompanyCity("") // Clear city field
                  setNewCompanyState("") // Clear state field
                  setNewCompanyZipCode("") // Clear zip_code field
                }}
                variant="outline"
                className="flex-1"
              >
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}

      {showAddSite && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-background border rounded-lg p-6 max-w-md w-full mx-4 max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-semibold mb-4">{editingSiteId ? "Edit Site" : "Add New Site"}</h3>
            <div className="space-y-4">
              <div>
                <Label htmlFor="newSiteName">
                  Site Name <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="newSiteName"
                  value={newSiteName}
                  onChange={(e) => setNewSiteName(e.target.value)}
                  placeholder="Main Office"
                  required
                />
              </div>
              <div>
                <Label htmlFor="newSiteAddress">Address</Label>
                <Input
                  id="newSiteAddress"
                  value={newSiteAddress}
                  onChange={(e) => setNewSiteAddress(e.target.value)}
                  placeholder="123 Main St"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="newSiteCity">City</Label>
                  <Input id="newSiteCity" value={newSiteCity} onChange={(e) => setNewSiteCity(e.target.value)} />
                </div>
                <div>
                  <Label htmlFor="newSiteState">State</Label>
                  <Input
                    id="newSiteState"
                    value={newSiteState}
                    onChange={(e) => setNewSiteState(e.target.value)}
                    placeholder="CA"
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="newSiteZipCode">Zip Code</Label>
                <Input
                  id="newSiteZipCode"
                  value={newSiteZipCode}
                  onChange={(e) => setNewSiteZipCode(e.target.value)}
                  placeholder="90210"
                />
              </div>
            </div>
            <div className="flex gap-2 mt-6">
              <Button type="button" onClick={handleAddSite} className="flex-1">
                {editingSiteId ? "Save Changes" : "Add Site"}
              </Button>
              <Button
                type="button"
                onClick={() => {
                  setShowAddSite(false)
                  setEditingSiteId(null)
                  setNewSiteName("")
                  setNewSiteAddress("")
                  setNewSiteCity("")
                  setNewSiteState("")
                  setNewSiteZipCode("")
                }}
                variant="outline"
                className="flex-1"
              >
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}

      {showAddUnit && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-background border rounded-lg p-6 max-w-md w-full mx-4 max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-semibold mb-4">{editingUnitId ? "Edit Unit" : "Add New Unit"}</h3>
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
            <div className="flex gap-2 mt-6">
              <Button type="button" onClick={handleAddUnit} className="flex-1">
                {editingUnitId ? "Save Changes" : "Add Unit"}
              </Button>
              <Button
                type="button"
                onClick={() => {
                  setShowAddUnit(false)
                  setEditingUnitId(null)
                  setNewUnitName("")
                  setNewUnitMake("")
                  setNewUnitModel("")
                  setNewUnitSerialNumber("")
                }}
                variant="outline"
                className="flex-1"
              >
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}

      {showAddSiteLocation && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle>Add Site Location</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Name (optional)</Label>
                <input
                  type="text"
                  value={newSiteLocationName}
                  onChange={(e) => setNewSiteLocationName(e.target.value)}
                  className="w-full px-3 py-2 border border-input rounded-md"
                  placeholder="e.g., North Wing"
                />
              </div>
              <div>
                <Label>Unit Location</Label>
                <input
                  type="text"
                  value={newSiteLocationUnitLocation}
                  onChange={(e) => setNewSiteLocationUnitLocation(e.target.value)}
                  className="w-full px-3 py-2 border border-input rounded-md"
                  placeholder="e.g., Under the stairs, Basement, Roof"
                />
              </div>
              <div className="flex gap-2 justify-end">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setShowAddSiteLocation(null)
                    setNewSiteLocationName("")
                    setNewSiteLocationUnitLocation("")
                  }}
                >
                  Cancel
                </Button>
                <Button type="button" onClick={() => handleAddSiteLocation(showAddSiteLocation)}>
                  Add
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
