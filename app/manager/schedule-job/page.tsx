import { redirect } from "next/navigation"
import { getCurrentUser } from "@/lib/db"
import { JobCreateForm } from "./JobCreateForm"
import { createClient } from "@/lib/supabase-server"
import { PageHeader } from "@/components/shared/PageHeader"

export const dynamic = "force-dynamic"
export const revalidate = 0

export default async function NewJobPage() {
  const user = await getCurrentUser()

  if (!user) {
    redirect("/login")
  }

  if (user.role === "technician") {
    redirect("/technician")
  }

  if (!["owner", "admin", "manager", "dispatcher"].includes(user.role)) {
    redirect("/login")
  }

  const supabase = await createClient()

  const [customersResult, locationsResult, equipmentResult, techniciansResult, agreementsResult, vendorsResult] =
    await Promise.all([
      supabase
        .from("customers")
        .select("id, first_name, last_name, company_name")
        .eq("organization_id", user.organization_id),
      supabase
        .from("service_locations")
        .select("id, customer_id, name, address, city, state")
        .eq("organization_id", user.organization_id),
      supabase
        .from("equipment")
        .select("id, customer_id, service_location_id, name, make, model, serial_number")
        .eq("organization_id", user.organization_id),
      supabase
        .from("users")
        .select("id, full_name, email")
        .eq("organization_id", user.organization_id)
        .eq("role", "technician"),
      supabase
        .from("service_agreements")
        .select("id, customer_id, agreement_number, name, type, status")
        .eq("organization_id", user.organization_id),
      supabase
        .from("vendors")
        .select("id, name")
        .eq("organization_id", user.organization_id)
        .eq("is_active", true)
        .order("name"),
    ])

  const customers = customersResult.data || []
  const serviceLocations = locationsResult.data || []
  const equipment = equipmentResult.data || []
  const technicians = techniciansResult.data || []
  const serviceAgreements = agreementsResult.data || []
  const vendors = vendorsResult.data || []

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <PageHeader title="Schedule Job" subtitle="Create a new service job" />

      <JobCreateForm
        organizationId={user.organization_id}
        userId={user.id}
        customers={customers}
        serviceLocations={serviceLocations}
        equipment={equipment}
        technicians={technicians}
        serviceAgreements={serviceAgreements}
        vendors={vendors}
      />
    </div>
  )
}
