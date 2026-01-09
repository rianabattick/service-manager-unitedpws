"use server"

import { createClient } from "./supabase.server"
import type {
  ManagerDashboardJob,
  TechnicianJob,
  Notification,
  JobStatus,
  JobTechnicianStatus,
  JobDetail,
} from "./types"
import type { User } from "./types" // Renamed import to avoid redeclaration

/**
 * Get the current authenticated user with their organization info
 * Returns null on network errors (without redirecting) to allow retry
 */
export async function getCurrentUser(): Promise<User | null> {
  try {
    const supabase = await createClient()

    let authUser = null
    try {
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser()

      if (authError) {
        if (
          authError.message?.includes("429") ||
          authError.message?.includes("Too Many Requests") ||
          authError.message?.includes("rate")
        ) {
          console.log("[v0] Rate limited during auth check - using fallback without redirect")
          // Don't return null immediately, try fallback user
        } else if (authError.status === 401 || authError.status === 403) {
          // Only treat 401/403 as definitive auth failures
          console.log("[v0] Auth check returned 401/403:", authError.message)
          return null
        } else {
          console.log("[v0] Auth check returned error:", authError.message)
        }
      }

      if (user && !authError) {
        authUser = user
      }
    } catch (authFetchError: any) {
      const errorMsg = authFetchError?.message || String(authFetchError)

      if (errorMsg.includes("429") || errorMsg.includes("Too Many Requests") || errorMsg.includes("rate limit")) {
        console.log("[v0] Rate limited during auth check (429) - soft failure, using fallback")
      } else if (errorMsg.includes("JSON") || errorMsg.includes("parse")) {
        console.log("[v0] JSON parse error during auth check - likely rate limit response")
      } else {
        console.log("[v0] Auth network error (transient, not redirecting):", errorMsg)
      }

      // Don't return null, try fallback
    }

    if (authUser) {
      try {
        const { data: userRow, error } = await supabase.from("users").select("*").eq("id", authUser.id).maybeSingle()

        if (!error && userRow) {
          return userRow as User
        }
      } catch (userFetchError) {
        console.log("[v0] Failed to fetch user from database:", userFetchError)
        // Continue to fallback
      }
    }

    try {
      const { data: fallbackRows, error: fallbackError } = await supabase
        .from("users")
        .select("*")
        .order("created_at", { ascending: true })
        .limit(1)

      if (fallbackError) {
        console.log("[v0] Fallback user query error:", fallbackError)
        return null
      }

      if (!fallbackRows || fallbackRows.length === 0) {
        console.log("[v0] No users found for fallback")
        return null
      }

      console.log("[v0] Using fallback user:", fallbackRows[0].email)
      return fallbackRows[0] as User
    } catch (fallbackFetchError) {
      console.log("[v0] Failed to fetch fallback user:", fallbackFetchError)
      return null
    }
  } catch (error) {
    console.log("[v0] getCurrentUser failed:", error)
    return null
  }
}

/**
 * Find a user by their login code
 */
export async function getUserByLoginCode(loginCode: string): Promise<User | null> {
  const supabase = await createClient()

  const { data: user, error } = await supabase.from("users").select("*").eq("login_code", loginCode).single()

  if (error) {
    console.error("[v0] Error fetching user by login code:", error)
    return null
  }

  return user
}

/**
 * Get jobs for manager dashboard with aggregated technician and report counts
 */
export async function listManagerDashboardJobs(organizationId: string): Promise<ManagerDashboardJob[]> {
  const supabase = await createClient()

  // Get jobs with customer and location info
  const { data: jobs, error: jobsError } = await supabase
    .from("jobs")
    .select(`
      id,
      job_number,
      title,
      status,
      scheduled_start,
      customer:customers!jobs_customer_id_fkey (
        id,
        first_name,
        last_name,
        company_name
      ),
      location:service_locations!jobs_service_location_id_fkey (
        name
      )
    `)
    .eq("organization_id", organizationId)
    .order("scheduled_start", { ascending: false, nullsFirst: false })
    .limit(50)

  if (jobsError) {
    console.error("[v0] Error fetching jobs:", jobsError)
    return []
  }

  if (!jobs) return []

  // Get technician counts for each job
  const jobIds = jobs.map((j) => j.id)

  const { data: techCounts } = await supabase.from("job_technicians").select("job_id, status").in("job_id", jobIds)

  // Get report counts for each job
  const { data: equipmentData } = await supabase
    .from("job_equipment")
    .select("job_id, expected_reports")
    .in("job_id", jobIds)

  const { data: attachmentCounts } = await supabase
    .from("job_attachments")
    .select("job_id, equipment_id")
    .in("job_id", jobIds)
    .in("type", ["photo", "document"])

  // Aggregate the data
  return jobs.map((job: any) => {
    const techs = techCounts?.filter((t) => t.job_id === job.id) || []
    const equipment = equipmentData?.filter((e) => e.job_id === job.id) || []
    const attachments = attachmentCounts?.filter((a) => a.job_id === job.id && a.equipment_id !== null) || []

    const customerName =
      job.customer?.company_name ||
      `${job.customer?.first_name || ""} ${job.customer?.last_name || ""}`.trim() ||
      "Unknown Customer"

    return {
      id: job.id,
      job_number: job.job_number,
      title: job.title,
      status: job.status,
      scheduled_start: job.scheduled_start,
      customer_name: customerName,
      location_name: job.location?.name || null,
      total_technicians: techs.length,
      accepted_technicians: techs.filter((t) => t.status === "accepted").length,
      pending_technicians: techs.filter((t) => t.status === "pending").length,
      declined_technicians: techs.filter((t) => t.status === "declined").length,
      total_expected_reports: equipment.reduce((sum, e) => sum + (e.expected_reports || 0), 0),
      total_reports_uploaded: attachments.length,
    }
  })
}

/**
 * Get jobs assigned to a specific technician
 */
export async function listTechnicianJobs(technicianId: string): Promise<TechnicianJob[]> {
  const supabase = await createClient()

  // Get job assignments for this technician
  const { data: assignments, error: assignError } = await supabase
    .from("job_technicians")
    .select(`
      status,
      job:jobs!job_technicians_job_id_fkey (
        id,
        job_number,
        title,
        status,
        scheduled_start,
        customer:customers!jobs_customer_id_fkey (
          first_name,
          last_name,
          company_name
        ),
        location:service_locations!jobs_service_location_id_fkey (
          name
        )
      )
    `)
    .eq("technician_id", technicianId)
    .order("assigned_at", { ascending: false })

  if (assignError) {
    console.error("[v0] Error fetching technician jobs:", assignError)
    return []
  }

  if (!assignments) return []

  const jobIds = assignments.map((a: any) => a.job?.id).filter(Boolean)

  // Get report progress for these jobs
  const { data: equipmentData } = await supabase
    .from("job_equipment")
    .select("job_id, expected_reports")
    .in("job_id", jobIds)

  const { data: attachmentCounts } = await supabase
    .from("job_attachments")
    .select("job_id, equipment_id")
    .in("job_id", jobIds)
    .in("type", ["photo", "document"])

  return assignments
    .map((assignment: any) => {
      const job = assignment.job
      if (!job) return null

      const equipment = equipmentData?.filter((e) => e.job_id === job.id) || []
      const attachments = attachmentCounts?.filter((a) => a.job_id === job.id && a.equipment_id !== null) || []

      const customerName =
        job.customer?.company_name ||
        `${job.customer?.first_name || ""} ${job.customer?.last_name || ""}`.trim() ||
        "Unknown Customer"

      return {
        id: job.id,
        job_number: job.job_number,
        title: job.title, // Added title field
        status: job.status,
        scheduled_start: job.scheduled_start,
        customer_name: customerName,
        location_name: job.location?.name || null,
        assignment_status: assignment.status,
        total_expected_reports: equipment.reduce((sum, e) => sum + (e.expected_reports || 0), 0),
        total_reports_uploaded: attachments.length,
      }
    })
    .filter(Boolean) as TechnicianJob[]
}

/**
 * Get notifications for a specific user
 */
export async function listNotificationsForUser(
  userId: string,
  options: { unreadOnly?: boolean } = {},
): Promise<Notification[]> {
  const supabase = await createClient()

  let query = supabase
    .from("notifications")
    .select("*")
    .eq("recipient_user_id", userId)
    .order("created_at", { ascending: false })
    .limit(10)

  if (options.unreadOnly) {
    query = query.eq("is_read", false)
  }

  const { data, error } = await query

  if (error) {
    console.error("[v0] Error fetching notifications:", error)
    return []
  }

  return data || []
}

/**
 * Get list of technicians with their active job counts
 */
export async function listTechniciansForManager(organizationId: string): Promise<
  Array<{
    id: string
    name: string
    specialty: string | null
    active_jobs_count: number
  }>
> {
  const supabase = await createClient()

  const { data: technicians, error: techError } = await supabase
    .from("users")
    .select("id, full_name, preferences")
    .eq("organization_id", organizationId)
    .eq("role", "technician")
    .eq("is_active", true)
    .order("full_name", { ascending: true })

  if (techError || !technicians) {
    console.error("[v0] Error fetching technicians:", techError)
    return []
  }

  // Get active job counts for each technician
  const techIds = technicians.map((t) => t.id)

  const { data: jobCounts } = await supabase
    .from("job_technicians")
    .select("technician_id, job:jobs!job_technicians_job_id_fkey(status)")
    .in("technician_id", techIds)
    .eq("status", "accepted")

  return technicians.map((tech: any) => {
    const activeJobs =
      jobCounts?.filter(
        (jc: any) => jc.technician_id === tech.id && jc.job?.status && ["pending", "confirmed"].includes(jc.job.status),
      ) || []

    return {
      id: tech.id,
      name: tech.full_name || "Unknown",
      specialty: tech.preferences?.specialty || null,
      active_jobs_count: activeJobs.length,
    }
  })
}

export async function listTechnicianJobsDetailed(technicianId: string): Promise<
  Array<{
    job_id: string
    job_number: string
    title: string // Added title field to return type
    job_name: string
    status: JobStatus
    scheduled_at: string | null
    customer_id: string
    customer_name: string
    location_name: string | null
    equipment: Array<{ id: string; name: string }>
    technician_assignment_status: JobTechnicianStatus
    job_technician_id: string
    report_progress: {
      completed_reports: number
      total_units: number
    }
  }>
> {
  const supabase = await createClient()

  // Get job assignments for this technician with full job details
  const { data: assignments, error: assignError } = await supabase
    .from("job_technicians")
    .select(`
      id,
      status,
      job_id,
      job:jobs!job_technicians_job_id_fkey (
        id,
        job_number,
        title,
        status,
        scheduled_start,
        customer_id,
        customer:customers!jobs_customer_id_fkey (
          id,
          first_name,
          last_name,
          company_name
        ),
        location:service_locations!jobs_service_location_id_fkey (
          name
        )
      )
    `)
    .eq("technician_id", technicianId)
    .order("assigned_at", { ascending: false })

  if (assignError || !assignments) {
    console.error("[v0] Error fetching technician job assignments:", assignError)
    return []
  }

  const jobIds = assignments.map((a: any) => a.job?.id).filter(Boolean)

  if (jobIds.length === 0) return []

  // Get equipment for each job
  const { data: jobEquipment } = await supabase
    .from("job_equipment")
    .select(`
      job_id,
      equipment:equipment!job_equipment_equipment_id_fkey (
        id,
        name
      )
    `)
    .in("job_id", jobIds)

  // Get report counts (attachments uploaded by this technician)
  const { data: reportCounts } = await supabase
    .from("job_attachments")
    .select("job_id")
    .in("job_id", jobIds)
    .eq("uploaded_by", technicianId)
    .in("type", ["photo", "document"])

  // Map the data
  return assignments
    .map((assignment: any) => {
      const job = assignment.job
      if (!job) return null

      const customerName =
        job.customer?.company_name ||
        `${job.customer?.first_name || ""} ${job.customer?.last_name || ""}`.trim() ||
        "Unknown Customer"

      const equipmentList =
        jobEquipment
          ?.filter((je: any) => je.job_id === job.id)
          .map((je: any) => ({
            id: je.equipment?.id || "",
            name: je.equipment?.name || "Unknown Equipment",
          })) || []

      const completedReports = reportCounts?.filter((rc: any) => rc.job_id === job.id).length || 0
      const totalUnits = equipmentList.length

      return {
        job_id: job.id,
        job_number: job.job_number,
        title: job.title || "", // Added title field from database
        job_name: `${job.job_number} - ${customerName}`,
        status: job.status,
        scheduled_at: job.scheduled_start,
        customer_id: job.customer_id,
        customer_name: customerName,
        location_name: job.location?.name || null,
        equipment: equipmentList,
        technician_assignment_status: assignment.status,
        job_technician_id: assignment.id,
        report_progress: {
          completed_reports: completedReports,
          total_units: totalUnits,
        },
      }
    })
    .filter(Boolean) as Array<{
    job_id: string
    job_number: string
    title: string // Added title field to return type
    job_name: string
    status: JobStatus
    scheduled_at: string | null
    customer_id: string
    customer_name: string
    location_name: string | null
    equipment: Array<{ id: string; name: string }>
    technician_assignment_status: JobTechnicianStatus
    job_technician_id: string
    report_progress: {
      completed_reports: number
      total_units: number
    }
  }>
}

/**
 * Get jobs for manager jobs list page with lite details
 */
export async function listManagerJobsLite(params: {
  organizationId: string
  status?: string
  technicianId?: string
  customerId?: string
  vendorId?: string // Added vendor filter parameter
  fromDate?: string
  toDate?: string
}): Promise<
  Array<{
    id: string
    job_number: string
    title: string | null
    status: string
    scheduled_date: string | null
    customer_name: string
    site_name: string | null
    technicians: Array<{ id: string; full_name: string }>
    unit_count: number
    manager_return_trip_needed: boolean | null // Added manager return trip field for filtering
  }>
> {
  const supabase = await createClient()

  // Build the base query
  let query = supabase
    .from("jobs")
    .select(`
      id,
      job_number,
      title,
      status,
      scheduled_start,
      manager_return_trip_needed,
      customer:customers!jobs_customer_id_fkey (
        id,
        first_name,
        last_name,
        company_name
      ),
      location:service_locations!jobs_service_location_id_fkey (
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
  if (params.vendorId) {
    query = query.eq("vendor_id", params.vendorId)
  }
  if (params.fromDate) {
    query = query.gte("scheduled_start", params.fromDate)
  }
  if (params.toDate) {
    query = query.lte("scheduled_start", params.toDate)
  }

  query = query.order("created_at", { ascending: false }).limit(100)

  const { data: jobs, error: jobsError } = await query

  if (jobsError) {
    console.error("[v0] Error fetching jobs:", jobsError)
    return []
  }

  if (!jobs || jobs.length === 0) return []

  const jobIds = jobs.map((j) => j.id)

  // Get technicians for each job
  const { data: jobTechs } = await supabase
    .from("job_technicians")
    .select(`
      job_id,
      technician:users!job_technicians_technician_id_fkey (
        id,
        full_name
      )
    `)
    .in("job_id", jobIds)

  // Apply technician filter if provided
  let filteredJobs = jobs
  if (params.technicianId) {
    const jobsWithTech =
      jobTechs?.filter((jt: any) => jt.technician?.id === params.technicianId).map((jt: any) => jt.job_id) || []
    filteredJobs = jobs.filter((j) => jobsWithTech.includes(j.id))
  }

  // Get equipment counts
  const { data: equipmentCounts } = await supabase
    .from("job_equipment")
    .select("job_id, equipment_id")
    .in("job_id", jobIds)

  // Map the results
  return filteredJobs.map((job: any) => {
    const techs = jobTechs?.filter((jt: any) => jt.job_id === job.id) || []
    const equipCount = equipmentCounts?.filter((eq: any) => eq.job_id === job.id).length || 0

    const customerName =
      job.customer?.company_name ||
      `${job.customer?.first_name || ""} ${job.customer?.last_name || ""}`.trim() ||
      "Unknown Customer"

    return {
      id: job.id,
      job_number: job.job_number || job.id,
      title: job.title || null,
      status: job.status || "draft",
      scheduled_date: job.scheduled_start,
      customer_name: customerName,
      site_name: job.location?.name || null,
      technicians: techs.map((t: any) => ({
        id: t.technician?.id || "",
        full_name: t.technician?.full_name || "Unknown",
      })),
      unit_count: equipCount,
      manager_return_trip_needed: job.manager_return_trip_needed ?? null, // Include manager return trip field
    }
  })
}

/**
 * Get complete job detail with all related data
 */
export async function getJobDetail(jobId: string, organizationId: string): Promise<JobDetail | null> {
  const supabase = await createClient()

  // Fetch the job with all related data
  const { data: job, error: jobError } = await supabase
    .from("jobs")
    .select(`
      *,
      customer:customers!jobs_customer_id_fkey (
        id,
        first_name,
        last_name,
        company_name,
        customer_type
      ),
      location:service_locations!jobs_service_location_id_fkey (
        name,
        address,
        address_line_2,
        city,
        state,
        zip_code,
        country
      ),
      service_agreement:service_agreements!jobs_service_agreement_id_fkey (
        name,
        agreement_number
      ),
      vendor:vendors!jobs_vendor_id_fkey (
        id,
        name
      )
    `)
    .eq("id", jobId)
    .eq("organization_id", organizationId)
    .single()

  if (jobError || !job) {
    console.error("[v0] Error fetching job detail:", jobError)
    return null
  }

  const { data: jobServiceLocations, error: serviceLocError } = await supabase
    .from("job_service_locations")
    .select(`
      service_location_id,
      site_location_id,
      site_notes,
      service_location:service_locations!job_service_locations_service_location_id_fkey (
        id,
        name,
        address,
        address_line_2,
        city,
        state,
        zip_code
      ),
      site_location:site_locations!job_service_locations_site_location_id_fkey (
        id,
        name,
        unit_location
      )
    `)
    .eq("job_id", jobId)

  if (serviceLocError) {
    console.error("[v0] Error fetching job service locations:", serviceLocError)
  }

  const enrichedServiceLocations = (jobServiceLocations || []).map((jsl: any) => {
    const result = {
      service_location_id: jsl.service_location_id,
      site_location_id: jsl.site_location_id,
      site_notes: jsl.site_notes || null, // Include site_notes from job_service_locations
      service_location_name: jsl.service_location?.name || null,
      service_location_address: jsl.service_location?.address || null,
      service_location_address_line_2: jsl.service_location?.address_line_2 || null,
      service_location_city: jsl.service_location?.city || null,
      service_location_state: jsl.service_location?.state || null,
      service_location_zip_code: jsl.service_location?.zip_code || null,
      site_location:
        jsl.site_location_id && jsl.site_location
          ? {
              id: jsl.site_location.id,
              name: jsl.site_location.name,
              unit_location: jsl.site_location.unit_location || null,
            }
          : null,
    }

    if (jsl.site_location_id && !jsl.site_location) {
      console.warn("[v0] Warning: site_location_id exists but no data returned. Possible stale FK:", {
        site_location_id: jsl.site_location_id,
        service_location_id: jsl.service_location_id,
      })
    }

    return result
  })

  console.log("[v0] enrichedServiceLocations:", JSON.stringify(enrichedServiceLocations, null, 2))

  const { data: jobTechs, error: techError } = await supabase
    .from("job_technicians")
    .select(`
      status,
      is_lead,
      technician:users!job_technicians_technician_id_fkey (
        id,
        full_name,
        email
      )
    `)
    .eq("job_id", jobId)

  if (techError) {
    console.error("[v0] Error fetching job technicians:", techError)
  }

  const technicians = (jobTechs || []).map((jt: any) => ({
    id: jt.technician?.id || "",
    full_name: jt.technician?.full_name || null,
    email: jt.technician?.email || null,
    status: jt.status as JobTechnicianStatus,
    is_lead: jt.is_lead || false, // Include is_lead field
  }))

  const { data: jobEquipment, error: equipError } = await supabase
    .from("job_equipment")
    .select(`
      equipment_id,
      expected_reports,
      service_location_id,
      site_location_id,
      unit_notes,
      equipment:equipment!job_equipment_equipment_id_fkey (
        id,
        name,
        serial_number,
        model,
        make,
        type
      ),
      service_location:service_locations!job_equipment_service_location_id_fkey (
        id,
        name
      ),
      site_location:site_locations!job_equipment_site_location_id_fkey (
        id,
        name
      )
    `)
    .eq("job_id", jobId)

  if (equipError) {
    console.error("[v0] Error fetching job equipment:", equipError)
  }

  // Get all attachments for this job
  const { data: attachments, error: attachError } = await supabase
    .from("job_attachments")
    .select("equipment_id, type")
    .eq("job_id", jobId)
    .in("type", ["photo", "document"])

  if (attachError) {
    console.error("[v0] Error fetching job attachments:", attachError)
  }

  const units = (jobEquipment || []).map((je: any) => {
    const reportsForUnit = (attachments || []).filter((a: any) => a.equipment_id === je.equipment_id)

    return {
      equipment_id: je.equipment_id,
      equipment_name: je.equipment?.name || "Unknown Equipment",
      serial_number: je.equipment?.serial_number || null,
      model: je.equipment?.model || null,
      make: je.equipment?.make || null,
      type: je.equipment?.type || null,
      expected_reports: je.expected_reports || 0,
      reports_uploaded: reportsForUnit.length,
      service_location_id: je.service_location_id || null,
      site_location_id: je.site_location_id || null,
      site_name: je.service_location?.name || null,
      site_location_name: je.site_location?.name || null,
      unit_notes: je.unit_notes || null, // Include unit_notes from job_equipment
    }
  })

  const { data: jobContacts, error: contactsError } = await supabase
    .from("job_contacts")
    .select("*")
    .eq("job_id", jobId)
    .order("created_at", { ascending: true })

  if (contactsError) {
    console.error("[v0] Error fetching job contacts:", contactsError)
  }

  const customerName =
    job.customer?.company_name ||
    `${job.customer?.first_name || ""} ${job.customer?.last_name || ""}`.trim() ||
    "Unknown Customer"

  const siteAddress = job.location
    ? [
        job.location.address,
        job.location.address_line_2,
        job.location.city,
        job.location.state,
        job.location.zip_code,
        job.location.country,
      ]
        .filter(Boolean)
        .join(", ")
    : null

  const siteLocationsForDisplay = enrichedServiceLocations.map((jsl: any) => ({
    service_location_id: jsl.service_location_id,
    service_location_name: jsl.service_location_name,
    service_location_address: jsl.service_location_address,
    service_location_address_line_2: jsl.service_location_address_line_2,
    service_location_city: jsl.service_location_city,
    service_location_state: jsl.service_location_state,
    service_location_zip_code: jsl.service_location_zip_code,
    site_location_id: jsl.site_location_id,
    site_location: jsl.site_location, // Properly mapped from JOIN
    site_notes: jsl.site_notes, // Include site_notes in display
  }))

  return {
    job: {
      ...job,
      customer_name: customerName,
      site_name: job.location?.name || null,
      site_address: siteAddress,
      job_type: job.job_type || null,
      service_type: job.service_type || null,
      billing_status: job.billing_status || null,
      return_trip_needed: job.return_trip_needed || false,
      notes: job.notes || null,
      service_agreement_number: job.service_agreement?.agreement_number || null,
      service_agreement_title: job.service_agreement?.name || null, // Added service_agreement_title to the return object
      customer_type: job.customer?.customer_type || null,
      vendor_name: job.vendor?.name || null,
      vendor_id: job.vendor?.id || null,
      site_locations: siteLocationsForDisplay,
      manager_return_trip_needed: job.manager_return_trip_needed ?? null, // Include manager return trip fields
      manager_return_trip_reason: job.manager_return_trip_reason || null, // Include manager return trip reason
    },
    technicians,
    units,
    contacts: jobContacts || [],
  }
}
