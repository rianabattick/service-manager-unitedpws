"use client"

import type React from "react"
import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Plus, X } from "lucide-react"
import { VendorSelect } from "@/components/shared/VendorSelect"
import { createContract, updateContract, type Contract } from "@/lib/contracts"

interface ContractFormProps {
  contract?: Contract & { services?: any[] }
  customers: Array<{ id: string; name: string; company_name?: string; first_name?: string; last_name?: string }>
  organizationId: string
  userId: string
}

export function ContractForm({
  contract,
  customers: initialCustomers = [],
  organizationId,
  userId,
}: ContractFormProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [customers, setCustomers] = useState(initialCustomers)

  useEffect(() => {
    if (initialCustomers && initialCustomers.length > 0) {
      return
    }

    const abortController = new AbortController()
    let mounted = true

    const fetchCustomers = async () => {
      try {
        const response = await fetch(`/api/customers?organizationId=${organizationId}`, {
          signal: abortController.signal,
        })

        if (!response.ok) {
          console.error("[v0] Failed to fetch customers:", response.status)
          return
        }

        if (mounted) {
          const data = await response.json()
          setCustomers(data)
        }
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") {
          return
        }
        console.error("[v0] Error fetching customers:", error)
      }
    }

    fetchCustomers()

    return () => {
      mounted = false
      abortController.abort()
    }
  }, [organizationId, initialCustomers])

  const [customerId, setCustomerId] = useState(contract?.customer_id || "")
  const [customerType, setCustomerType] = useState<"direct" | "subcontract">("direct")
  const [vendorId, setVendorId] = useState<string | undefined>(contract?.vendor_id || undefined)
  const [title, setTitle] = useState(contract?.name || "")
  const [coveragePlan, setCoveragePlan] = useState(contract?.type || "")
  const [agreementLengthYears, setAgreementLengthYears] = useState(1)
  const [startDate, setStartDate] = useState(contract?.start_date || "")
  const [endDate, setEndDate] = useState(contract?.end_date || "")
  const [serviceNotes, setServiceNotes] = useState(contract?.notes || "")
  const [pmDueNext, setPmDueNext] = useState("")
  const [unitInformation, setUnitInformation] = useState("")
  const [notes, setNotes] = useState(contract?.notes || "")
  const [status, setStatus] = useState(contract?.status || "job_creation_needed")
  const [billingType, setBillingType] = useState(contract?.billing_type || "due_on_receipt")
  const [services, setServices] = useState<Array<{ serviceType: "MJPM" | "MNPM"; frequencyMonths: number }>>(
    contract?.services?.map((s) => ({ serviceType: s.service_type, frequencyMonths: s.frequency_months })) || [],
  )

  const totalPMsPerYear = services.reduce((sum, service) => sum + service.frequencyMonths, 0)

  const addService = () => {
    setServices([...services, { serviceType: "MJPM", frequencyMonths: 1 }])
  }

  const removeService = (index: number) => {
    setServices(services.filter((_, i) => i !== index))
  }

  const updateService = (index: number, field: "serviceType" | "frequencyMonths", value: any) => {
    const updated = [...services]
    updated[index] = { ...updated[index], [field]: value }
    setServices(updated)
  }

  const handleAddCompany = async () => {
    if (!newCompanyName) {
      alert("Please provide a company name")
      return
    }

    try {
      const response = await fetch("/api/customers/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
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
        }),
      })

      if (!response.ok) {
        throw new Error("Failed to create customer")
      }

      const data = await response.json()

      setCustomers([
        ...customers,
        {
          id: data.id,
          name: data.company_name || `${data.first_name} ${data.last_name}`,
          company_name: data.company_name,
          first_name: data.first_name,
          last_name: data.last_name,
        },
      ])
      setCustomerId(data.id)
      setShowAddCompany(false)
      setNewCompanyType("commercial")
      setNewCompanyName("")
      setNewCompanyEmail("")
      setNewCompanyPhone("")
      setNewCompanyAddress("")
      setNewCompanyCity("")
      setNewCompanyState("")
      setNewCompanyZipCode("")
    } catch (err) {
      console.error("[v0] Error adding company:", err)
      alert("Failed to add company")
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    console.log("[v0] Form submitted")

    try {
      if (contract) {
        console.log("[v0] Updating contract:", contract.id)
        await updateContract(contract.id, {
          name: title,
          type: coveragePlan,
          vendorId: vendorId || null,
          startDate,
          endDate,
          notes: serviceNotes,
          services,
          agreementLengthYears,
          pmDueNext: pmDueNext || undefined,
          unitInformation: unitInformation || undefined,
          status,
          billingType,
        })
        console.log("[v0] Contract updated, redirecting to:", `/manager/contracts/${contract.id}`)
        window.location.href = `/manager/contracts/${contract.id}`
      } else {
        console.log("[v0] Creating new contract")
        const newContract = await createContract({
          organizationId,
          customerId,
          vendorId,
          name: title,
          type: coveragePlan,
          startDate,
          endDate,
          services,
          notes: serviceNotes,
          createdBy: userId,
          agreementLengthYears,
          pmDueNext: pmDueNext || undefined,
          unitInformation: unitInformation || undefined,
          status,
          billingType,
        })
        console.log("[v0] Contract created successfully:", newContract.id)
        console.log("[v0] Redirecting to:", `/manager/contracts/${newContract.id}`)
        window.location.href = `/manager/contracts/${newContract.id}`
      }
    } catch (error) {
      console.error("[v0] Error saving contract:", error)
      alert(`Failed to save contract: ${error instanceof Error ? error.message : "Unknown error"}`)
    } finally {
      setLoading(false)
    }
  }

  const [showAddCompany, setShowAddCompany] = useState(false)
  const [newCompanyType, setNewCompanyType] = useState("commercial")
  const [newCompanyName, setNewCompanyName] = useState("")
  const [newCompanyEmail, setNewCompanyEmail] = useState("")
  const [newCompanyPhone, setNewCompanyPhone] = useState("")
  const [newCompanyAddress, setNewCompanyAddress] = useState("")
  const [newCompanyCity, setNewCompanyCity] = useState("")
  const [newCompanyState, setNewCompanyState] = useState("")
  const [newCompanyZipCode, setNewCompanyZipCode] = useState("")

  return (
    <Card>
      <CardContent className="pt-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="customer">
              Customer <span className="text-red-500">*</span>
            </Label>
            <div className="flex gap-2">
              <select
                id="customer"
                value={customerId}
                onChange={(e) => setCustomerId(e.target.value)}
                className="flex-1 px-3 py-2 border border-input rounded-md bg-background"
                required
                disabled={!!contract}
              >
                <option value="">Select a customer...</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.company_name || `${c.first_name || ""} ${c.last_name || ""}`.trim() || "Unknown"}
                  </option>
                ))}
              </select>
              {!contract && (
                <Button type="button" onClick={() => setShowAddCompany(true)} variant="outline">
                  + Add
                </Button>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="customerType">
              Customer Type <span className="text-red-500">*</span>
            </Label>
            <Select value={customerType} onValueChange={(val: "direct" | "subcontract") => setCustomerType(val)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="direct">Direct</SelectItem>
                <SelectItem value="subcontract">Subcontract</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {customerType === "subcontract" && (
            <div className="space-y-2">
              <VendorSelect
                value={vendorId}
                onValueChange={setVendorId}
                organizationId={organizationId}
                userId={userId}
              />
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="title">
              Contract Title <span className="text-red-500">*</span>
            </Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Annual Maintenance Contract"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="status">
              Status <span className="text-red-500">*</span>
            </Label>
            <Select value={status} onValueChange={setStatus} required>
              <SelectTrigger>
                <SelectValue placeholder="Select status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="job_creation_needed">Job Creation Needed</SelectItem>
                <SelectItem value="in_progress">In Progress</SelectItem>
                <SelectItem value="renewal_needed">Renewal Needed</SelectItem>
                <SelectItem value="on_hold">On Hold</SelectItem>
                <SelectItem value="overdue">Overdue</SelectItem>
                <SelectItem value="ended">Ended</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="coveragePlan">
              Type of Coverage <span className="text-red-500">*</span>
            </Label>
            <Select value={coveragePlan} onValueChange={setCoveragePlan} required>
              <SelectTrigger>
                <SelectValue placeholder="Select coverage plan" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="gold">Gold</SelectItem>
                <SelectItem value="Remedial">Remedial</SelectItem>
                <SelectItem value="PM Contract">PM Contract</SelectItem>
                <SelectItem value="Pseudo Gold">Pseudo Gold</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="agreementLength">
              Length of Agreement (Years) <span className="text-red-500">*</span>
            </Label>
            <Input
              type="number"
              id="agreementLength"
              value={agreementLengthYears}
              onChange={(e) => setAgreementLengthYears(Number.parseInt(e.target.value) || 1)}
              min="1"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="startDate">
              Start Date <span className="text-red-500">*</span>
            </Label>
            <Input
              type="date"
              id="startDate"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="endDate">
              End Date <span className="text-red-500">*</span>
            </Label>
            <Input type="date" id="endDate" value={endDate} onChange={(e) => setEndDate(e.target.value)} required />
          </div>

          <div className="space-y-4">
            <Label>
              Number of PMs per Year <span className="text-red-500">*</span>
            </Label>
            <p className="text-sm text-muted-foreground">
              Select services and specify how many times each service is included per year
            </p>
            <div className="space-y-3">
              {services.map((service, index) => (
                <div key={index} className="flex items-center gap-4 p-4 border border-border rounded-md">
                  <Select
                    value={service.serviceType}
                    onValueChange={(val: "MJPM" | "MNPM") => updateService(index, "serviceType", val)}
                  >
                    <SelectTrigger className="w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="MJPM">MJPM</SelectItem>
                      <SelectItem value="MNPM">MNPM</SelectItem>
                    </SelectContent>
                  </Select>
                  <div className="flex items-center gap-2 ml-auto">
                    <Label htmlFor={`freq-${index}`}>Quantity:</Label>
                    <Input
                      type="number"
                      id={`freq-${index}`}
                      value={service.frequencyMonths}
                      onChange={(e) => updateService(index, "frequencyMonths", Number.parseInt(e.target.value) || 1)}
                      className="w-20"
                      min="1"
                    />
                  </div>
                  <Button type="button" onClick={() => removeService(index)} variant="outline" size="icon">
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              <Button type="button" onClick={addService} variant="outline" className="w-full bg-transparent">
                <Plus className="h-4 w-4 mr-2" />
                Add Service
              </Button>
            </div>
            {services.length > 0 && (
              <p className="text-sm font-medium text-muted-foreground">
                {totalPMsPerYear} PM{totalPMsPerYear !== 1 ? "s" : ""} per year
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="serviceNotes">Service Notes</Label>
            <Textarea
              id="serviceNotes"
              value={serviceNotes}
              onChange={(e) => setServiceNotes(e.target.value)}
              rows={3}
              placeholder="Add service-specific notes..."
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="pmDueNext">PM Due Next</Label>
            <Input type="date" id="pmDueNext" value={pmDueNext} onChange={(e) => setPmDueNext(e.target.value)} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="unitInformation">Unit Information</Label>
            <Textarea
              id="unitInformation"
              value={unitInformation}
              onChange={(e) => setUnitInformation(e.target.value)}
              rows={3}
              placeholder="Add unit/equipment information..."
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="billingType">
              Type of Billing <span className="text-red-500">*</span>
            </Label>
            <Select value={billingType} onValueChange={setBillingType} required>
              <SelectTrigger>
                <SelectValue placeholder="Select billing type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="annual">Annual</SelectItem>
                <SelectItem value="quarterly">Quarterly</SelectItem>
                <SelectItem value="semi_annual">Semi-annual</SelectItem>
                <SelectItem value="due_on_receipt">Due on Receipt</SelectItem>
                <SelectItem value="billed_after_service">Billed After Service</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={4}
              placeholder="Add any additional notes..."
            />
          </div>

          <div className="flex items-center justify-end gap-4 pt-4 border-t">
            <Button type="button" variant="outline" onClick={() => router.back()} disabled={loading}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? (contract ? "Updating..." : "Creating...") : contract ? "Update Contract" : "Create Contract"}
            </Button>
          </div>
        </form>

        {showAddCompany && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-background border rounded-lg p-6 max-w-md w-full mx-4 max-h-[90vh] overflow-y-auto">
              <h3 className="text-lg font-semibold mb-4">Add New Customer</h3>
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
                    Customer Name <span className="text-red-500">*</span>
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
                  Add Customer
                </Button>
                <Button
                  type="button"
                  onClick={() => {
                    setShowAddCompany(false)
                    setNewCompanyType("commercial")
                    setNewCompanyName("")
                    setNewCompanyEmail("")
                    setNewCompanyPhone("")
                    setNewCompanyAddress("")
                    setNewCompanyCity("")
                    setNewCompanyState("")
                    setNewCompanyZipCode("")
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
      </CardContent>
    </Card>
  )
}
