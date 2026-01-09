"use server"

import { createClient, createAdminClient } from "./supabase-server"
import { createNotifications, getManagerUserIds } from "./notifications"

export interface Contract {
  id: string
  organization_id: string
  customer_id: string
  vendor_id?: string
  name: string
  agreement_number?: string
  description?: string
  type?: string
  billing_type?: string
  status: string
  start_date?: string
  end_date?: string
  amount?: number
  terms?: string
  notes?: string
  billing_frequency?: string
  service_frequency?: string
  next_billing_date?: string
  next_service_date?: string
  last_service_date?: string
  agreement_length_years?: number
  service_count?: number
  pm_due_next?: string
  unit_information?: string
  created_at: string
  updated_at?: string
}

export interface ContractService {
  id: string
  service_type: "MJPM" | "MNPM"
  frequency_months: number
}

/**
 * Get list of contracts with customer info
 */
export async function listContracts(params: {
  organizationId: string
  status?: string
  customerType?: string
  customerId?: string
  coveragePlan?: string
  viewMode?: "active" | "ended"
}): Promise<
  Array<Contract & { customer_name: string; coverage_plan?: string; services: ContractService[]; vendor_name?: string }>
> {
  const supabase = await createClient()

  let query = supabase
    .from("service_agreements")
    .select(`
      *,
      customer:customers!service_agreements_customer_id_fkey (
        id,
        first_name,
        last_name,
        company_name
      ),
      vendor:vendors!service_agreements_vendor_id_fkey (
        id,
        name
      )
    `)
    .eq("organization_id", params.organizationId)

  // Apply filters
  if (params.status) {
    query = query.eq("status", params.status)
  }
  if (params.customerId) {
    query = query.eq("customer_id", params.customerId)
  }
  if (params.coveragePlan) {
    query = query.eq("type", params.coveragePlan)
  }

  if (params.viewMode === "ended") {
    query = query.in("status", ["ended", "cancelled"])
  } else {
    query = query.not("status", "in", "(ended,cancelled)")
  }

  query = query.order("created_at", { ascending: false })

  const { data: contracts, error } = await query

  if (error) {
    console.error("[v0] Error fetching contracts:", error)
    return []
  }

  if (!contracts || contracts.length === 0) return []

  // Get services for each contract
  const contractIds = contracts.map((c: any) => c.id)
  const { data: services } = await supabase.from("contract_services").select("*").in("contract_id", contractIds)

  return contracts.map((contract: any) => {
    const customerName =
      contract.customer?.company_name ||
      `${contract.customer?.first_name || ""} ${contract.customer?.last_name || ""}`.trim() ||
      "Unknown"

    const contractServices = services?.filter((s: any) => s.contract_id === contract.id) || []

    return {
      ...contract,
      customer_name: customerName,
      vendor_name: contract.vendor?.name || null,
      coverage_plan: contract.type,
      services: contractServices.map((s: any) => ({
        id: s.id,
        service_type: s.service_type,
        frequency_months: s.frequency_months,
      })),
    }
  })
}

/**
 * Get contract detail with customer and services
 */
export async function getContractDetail(contractId: string) {
  const supabase = await createClient()

  const { data: contract, error } = await supabase
    .from("service_agreements")
    .select(`
      *,
      customer:customers!service_agreements_customer_id_fkey (
        id,
        first_name,
        last_name,
        company_name,
        phone,
        email
      ),
      vendor:vendors!service_agreements_vendor_id_fkey (
        id,
        name
      )
    `)
    .eq("id", contractId)
    .single()

  if (error) {
    console.error("[v0] Error fetching contract:", error)
    return null
  }

  // Get services
  const { data: services } = await supabase.from("contract_services").select("*").eq("contract_id", contractId)

  const { data: jobs } = await supabase
    .from("jobs")
    .select(`
      id,
      job_number,
      scheduled_start,
      status,
      service_type,
      title,
      completion_checklists (
        completed_at,
        completed_by,
        users:completed_by (
          full_name
        )
      )
    `)
    .eq("service_agreement_id", contractId)
    .order("scheduled_start", { ascending: false })

  // Map completion data
  const jobsWithCompletion = jobs?.map((job: any) => ({
    ...job,
    completed_at: job.completion_checklists?.[0]?.completed_at || null,
    completed_by_name: job.completion_checklists?.[0]?.users?.full_name || null,
  }))

  const customerName =
    contract.customer?.company_name ||
    `${contract.customer?.first_name || ""} ${contract.customer?.last_name || ""}`.trim() ||
    "Unknown"

  return {
    ...contract,
    customer_name: customerName,
    vendor_name: contract.vendor?.name || null,
    services: services || [],
    jobs: jobsWithCompletion || [],
  }
}

/**
 * Create a new contract with services
 */
export async function createContract(params: {
  organizationId: string
  customerId: string
  vendorId?: string
  name: string
  description?: string
  type?: string
  startDate: string
  endDate: string
  terms?: string
  billingFrequency?: string
  serviceFrequency?: string
  services: Array<{ serviceType: "MJPM" | "MNPM"; frequencyMonths: number }>
  notes?: string
  createdBy: string
  agreementLengthYears?: number
  pmDueNext?: string
  unitInformation?: string
  status?: string // Added status parameter
  billingType?: string
}) {
  const supabase = await createAdminClient()

  console.log("[v0] Creating contract with params:", JSON.stringify(params, null, 2))

  // Generate agreement number
  const timestamp = Date.now()
  const randomStr = Math.random().toString(36).substring(2, 6).toUpperCase()
  const agreementNumber = `AGR-${timestamp}-${randomStr}`

  const totalServices = params.services.reduce((sum, s) => sum + s.frequencyMonths, 0)
  const totalServiceCount = totalServices * (params.agreementLengthYears || 1)

  const { data: contract, error: contractError } = await supabase
    .from("service_agreements")
    .insert({
      organization_id: params.organizationId,
      customer_id: params.customerId,
      vendor_id: params.vendorId || null,
      name: params.name || null,
      description: params.description || null,
      type: params.type || null,
      agreement_number: agreementNumber,
      start_date: params.startDate,
      end_date: params.endDate,
      terms: params.terms || null,
      billing_frequency: params.billingFrequency || null,
      service_frequency: params.serviceFrequency || null,
      notes: params.notes || null,
      status: params.status || "job_creation_needed", // Use provided status or default
      created_by: params.createdBy,
      agreement_length_years: params.agreementLengthYears || 1,
      service_count: totalServiceCount,
      pm_due_next: params.pmDueNext || null,
      unit_information: params.unitInformation || null,
      billing_type: params.billingType || "due_on_receipt",
    })
    .select()
    .single()

  if (contractError) {
    console.error("[v0] Error creating contract:", contractError)
    throw new Error(`Failed to create contract: ${contractError.message}`)
  }

  console.log("[v0] Contract created successfully:", contract.id)

  // Create contract services
  if (params.services.length > 0) {
    const serviceRecords = params.services.map((s) => ({
      organization_id: params.organizationId,
      contract_id: contract.id,
      service_type: s.serviceType,
      frequency_months: s.frequencyMonths,
    }))

    console.log("[v0] Creating contract services:", JSON.stringify(serviceRecords, null, 2))

    const { error: servicesError } = await supabase.from("contract_services").insert(serviceRecords)

    if (servicesError) {
      console.error("[v0] Error creating contract services:", servicesError)
      console.log("[v0] Contract created but services failed to save. Contract ID:", contract.id)
    } else {
      console.log("[v0] Contract services created successfully")
    }
  }

  const managerIds = await getManagerUserIds(params.organizationId, supabase)
  const contractLabel = contract.name || contract.agreement_number || contract.id

  await createNotifications({
    organizationId: params.organizationId,
    recipientUserIds: managerIds,
    type: "contract_created",
    message: `New contract "${contractLabel}" created`,
    relatedEntityType: "contract",
    relatedEntityId: contract.id,
    supabase,
  })

  return contract
}

/**
 * Update existing contract
 */
export async function updateContract(
  contractId: string,
  params: {
    name?: string
    description?: string
    type?: string
    vendorId?: string | null
    startDate?: string
    endDate?: string
    terms?: string
    billingFrequency?: string
    serviceFrequency?: string
    notes?: string
    status?: string
    services?: Array<{ serviceType: "MJPM" | "MNPM"; frequencyMonths: number }>
    agreementLengthYears?: number
    pmDueNext?: string
    unitInformation?: string
    billingType?: string
  },
) {
  const supabase = await createAdminClient()

  // Get contract for notification
  const { data: contract } = await supabase
    .from("service_agreements")
    .select("organization_id, agreement_number, name")
    .eq("id", contractId)
    .single()

  // Update contract
  const updateData: any = {}
  if (params.name !== undefined) updateData.name = params.name
  if (params.description !== undefined) updateData.description = params.description
  if (params.type !== undefined) updateData.type = params.type
  if (params.vendorId !== undefined) updateData.vendor_id = params.vendorId
  if (params.startDate !== undefined) updateData.start_date = params.startDate
  if (params.endDate !== undefined) updateData.end_date = params.endDate
  if (params.terms !== undefined) updateData.terms = params.terms
  if (params.billingFrequency !== undefined) updateData.billing_frequency = params.billingFrequency
  if (params.serviceFrequency !== undefined) updateData.service_frequency = params.serviceFrequency
  if (params.notes !== undefined) updateData.notes = params.notes
  if (params.status !== undefined) updateData.status = params.status
  if (params.agreementLengthYears !== undefined) updateData.agreement_length_years = params.agreementLengthYears
  if (params.pmDueNext !== undefined) updateData.pm_due_next = params.pmDueNext
  if (params.unitInformation !== undefined) updateData.unit_information = params.unitInformation
  if (params.billingType !== undefined) updateData.billing_type = params.billingType

  updateData.updated_at = new Date().toISOString()

  const { error: updateError } = await supabase.from("service_agreements").update(updateData).eq("id", contractId)

  if (updateError) {
    console.error("[v0] Error updating contract:", updateError)
    throw new Error("Failed to update contract")
  }

  // Update services if provided
  if (params.services) {
    // Delete existing services
    await supabase.from("contract_services").delete().eq("contract_id", contractId)

    // Insert new services
    if (params.services.length > 0) {
      const serviceRecords = params.services.map((s) => ({
        organization_id: contract.organization_id,
        contract_id: contractId,
        service_type: s.serviceType,
        frequency_months: s.frequencyMonths,
      }))

      await supabase.from("contract_services").insert(serviceRecords)
    }
  }

  // Send notification to managers
  if (contract) {
    const managerIds = await getManagerUserIds(contract.organization_id, supabase)
    const contractLabel = contract.agreement_number || contract.name || contractId

    await createNotifications({
      organizationId: contract.organization_id,
      recipientUserIds: managerIds,
      type: "contract_updated",
      message: `Contract ${contractLabel} updated`,
      relatedEntityType: "contract",
      relatedEntityId: contractId,
      supabase,
    })
  }
}

/**
 * Delete contract (soft delete by setting status to cancelled)
 */
export async function deleteContract(contractId: string) {
  const supabase = await createAdminClient()

  const { error } = await supabase
    .from("service_agreements")
    .update({ status: "cancelled", updated_at: new Date().toISOString() })
    .eq("id", contractId)

  if (error) {
    console.error("[v0] Error deleting contract:", error)
    throw new Error("Failed to delete contract")
  }
}
