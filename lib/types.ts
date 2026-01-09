// Database Types - Matching the Supabase schema

export type UserRole = "owner" | "admin" | "manager" | "technician" | "dispatcher" | "viewer"

export type JobStatus = "pending" | "confirmed" | "completed" | "cancelled" | "on_hold"

export type JobTechnicianStatus = "pending" | "accepted" | "declined" | "cancelled"

export type ServiceAgreementStatus = "draft" | "active" | "expired" | "cancelled"

export type AttachmentType = "photo" | "document" | "video" | "other"

export type NotificationType =
  | "job_assigned"
  | "job_accepted"
  | "job_declined"
  | "report_uploaded"
  | "contract_scheduling_needed"
  | "contract_renewal_needed"
  | "contract_ended"

// Database Table Interfaces

export interface Organization {
  id: string
  name: string
  slug: string
  tax_rate: number
  timezone: string
  currency: string
  settings: Record<string, any>
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface User {
  id: string
  organization_id: string
  email: string
  full_name: string | null
  phone: string | null
  role: UserRole
  login_code: string | null
  avatar_url: string | null
  is_active: boolean
  preferences: Record<string, any>
  created_at: string
  updated_at: string
}

export interface Customer {
  id: string
  organization_id: string
  type: "residential" | "commercial"
  first_name: string | null
  last_name: string | null
  company_name: string | null
  email: string | null
  phone: string | null
  is_active: boolean
  created_at: string
  customer_type: "direct" | "subcontract" | null
}

export interface ServiceLocation {
  id: string
  organization_id: string
  customer_id: string
  name: string
  address: string | null
  city: string | null
  state: string | null
  zip_code: string | null
  is_primary: boolean
  created_at: string
}

export interface Equipment {
  id: string
  organization_id: string
  customer_id: string
  service_location_id: string | null
  name: string
  type: string | null
  make: string | null
  model: string | null
  serial_number: string | null
  is_active: boolean
  created_at: string
}

export interface ServiceAgreement {
  id: string
  organization_id: string
  customer_id: string
  agreement_number: string
  type: "maintenance" | "warranty" | "service_plan"
  status: ServiceAgreementStatus
  start_date: string
  end_date: string | null
  service_frequency: string | null
  last_service_date: string | null
  next_service_date: string | null
  created_at: string
}

export interface Job {
  id: string
  organization_id: string
  customer_id: string
  service_location_id: string | null
  job_number: string
  type: "service_call" | "installation" | "maintenance" | "inspection" | "estimate" | "warranty"
  priority: "low" | "normal" | "high" | "urgent"
  status: JobStatus
  scheduled_start: string | null
  scheduled_end: string | null
  actual_start: string | null
  actual_end: string | null
  assigned_to: string | null
  po_number: string | null
  estimate_number: string | null
  subcontract_company_name: string | null
  created_at: string
  updated_at: string
}

export interface JobTechnician {
  id: string
  job_id: string
  technician_id: string
  status: JobTechnicianStatus
  google_event_id: string | null
  assigned_at: string
  responded_at: string | null
  notes: string | null
  created_at: string
}

export interface JobEquipment {
  id: string
  job_id: string
  equipment_id: string
  expected_reports: number
  notes: string | null
  created_at: string
}

export interface JobAttachment {
  id: string
  job_id: string
  equipment_id: string | null
  type: AttachmentType
  file_url: string
  file_name: string | null
  description: string | null
  uploaded_by: string
  created_at: string
}

export interface Notification {
  id: string
  organization_id: string
  recipient_user_id: string
  type: NotificationType
  message: string
  related_entity_type: string | null
  related_entity_id: string | null
  is_read: boolean
  read_at: string | null
  created_at: string
}

// Helper result types for queries

export interface ManagerDashboardJob {
  id: string
  job_number: string
  status: JobStatus
  scheduled_start: string | null
  customer_name: string
  location_name: string | null
  total_technicians: number
  accepted_technicians: number
  pending_technicians: number
  declined_technicians: number
  total_expected_reports: number
  total_reports_uploaded: number
}

export interface TechnicianJob {
  id: string
  job_number: string
  status: JobStatus
  scheduled_start: string | null
  customer_name: string
  location_name: string | null
  assignment_status: JobTechnicianStatus
  total_expected_reports: number
  total_reports_uploaded: number
}

export interface JobContact {
  id: string
  job_id: string
  name: string
  phone: string
  email: string | null
  created_at: string
}

export interface JobDetail {
  job: Job & {
    customer_name: string
    site_name: string | null
    site_address: string | null
    job_type: string | null
    service_type: string | null
    billing_status: string | null
    return_trip_needed: boolean
    notes: string | null
    service_agreement_number: string | null
    po_number: string | null
    estimate_number: string | null
    customer_type: "direct" | "subcontract" | null
    subcontract_company_name: string | null
    manager_return_trip_needed: boolean | null // Added manager return trip fields
    manager_return_trip_reason: string | null // Added manager return trip reason
  }
  technicians: {
    id: string
    full_name: string | null
    email: string | null
    status: JobTechnicianStatus
    is_lead: boolean // Added is_lead to track lead technician
  }[]
  units: {
    equipment_id: string
    equipment_name: string
    serial_number: string | null
    model: string | null
    make: string | null
    type: string | null
    expected_reports: number
    reports_uploaded: number
  }[]
  contacts: JobContact[]
}
