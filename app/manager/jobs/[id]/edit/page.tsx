import { redirect, notFound } from "next/navigation"
import { getCurrentUser, getJobDetail } from "@/lib/db"
import { createClient } from "@/lib/supabase-server"
import JobEditForm from "./JobEditForm"

export default async function JobEditPage({ params }: { params: { id: string } }) {
  const { id } = params

  // Validate UUID format
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  if (!uuidRegex.test(id)) {
    notFound()
  }

  const user = await getCurrentUser()

  if (!user) {
    redirect("/login")
  }

  const isManager = ["owner", "admin", "manager", "dispatcher"].includes(user.role)

  if (!isManager) {
    redirect("/technician")
  }

  // Fetch job detail
  const jobDetail = await getJobDetail(id, user.organization_id)

  if (!jobDetail) {
    notFound()
  }

  const supabase = await createClient()

  const [
    { data: customers },
    { data: serviceLocations },
    { data: equipment },
    { data: technicians },
    { data: serviceAgreements },
    { data: vendors },
  ] = await Promise.all([
    supabase.from("customers").select("*").eq("organization_id", user.organization_id).order("company_name"),
    supabase.from("service_locations").select("*").eq("organization_id", user.organization_id).order("name"),
    supabase.from("equipment").select("*").eq("organization_id", user.organization_id).order("name"),
    supabase
      .from("users")
      .select("*")
      .eq("organization_id", user.organization_id)
      .eq("role", "technician")
      .eq("is_active", true)
      .order("full_name"),
    supabase
      .from("service_agreements")
      .select("*")
      .eq("organization_id", user.organization_id)
      .order("agreement_number"),
    supabase
      .from("vendors")
      .select("id, name")
      .eq("organization_id", user.organization_id)
      .eq("is_active", true)
      .order("name"),
  ])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Edit Job: {jobDetail.job.title || "Untitled Job"}</h1>
        <p className="text-muted-foreground">Update job details and assignments</p>
      </div>

      <JobEditForm
        jobId={id}
        jobDetail={jobDetail}
        customers={customers || []}
        serviceLocations={serviceLocations || []}
        equipment={equipment || []}
        technicians={technicians || []}
        serviceAgreements={serviceAgreements || []}
        vendors={vendors || []}
        organizationId={user.organization_id}
      />
    </div>
  )
}
