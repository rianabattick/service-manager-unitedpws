export const dynamic = "force-dynamic"
export const revalidate = 0

import { getCurrentUser } from "@/lib/db"
import { ContractForm } from "../ContractForm"
import { createClient } from "@/lib/supabase-server"

export default async function NewContractPage() {
  const user = await getCurrentUser()

  if (!user) {
    return (
      <div className="space-y-6">
        <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-6">
          <h2 className="text-lg font-semibold text-yellow-900">Session Temporarily Unavailable</h2>
          <p className="mt-2 text-sm text-yellow-700">
            Unable to load your session. This may be due to a temporary connectivity issue in the preview environment.
          </p>
          <p className="mt-2 text-sm text-yellow-700">
            <strong>To continue:</strong>
          </p>
          <ul className="mt-2 list-disc list-inside text-sm text-yellow-700">
            <li>Refresh this page</li>
            <li>
              Or{" "}
              <a href="/login" className="underline font-medium">
                log in again
              </a>
            </li>
          </ul>
        </div>
      </div>
    )
  }

  if (!["owner", "admin", "manager"].includes(user.role)) {
    return (
      <div className="space-y-6">
        <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-6">
          <h2 className="text-lg font-semibold text-yellow-900">Access Denied</h2>
          <p className="mt-2 text-sm text-yellow-700">
            You do not have permission to create contracts. Please contact your administrator.
          </p>
        </div>
      </div>
    )
  }

  let customers: Array<{
    id: string
    first_name: string
    last_name: string
    company_name: string
  }> = []

  try {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from("customers")
      .select("id, first_name, last_name, company_name")
      .eq("organization_id", user.organization_id)
      .eq("is_active", true)
      .order("company_name")

    if (!error && data) {
      customers = data
    } else if (error) {
      console.error("[v0] Error fetching customers:", error)
    }
  } catch (error) {
    console.error("[v0] Failed to fetch customers from database:", error)
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Create Contract</h1>
        <p className="text-muted-foreground">Create a new service agreement</p>
      </div>

      <ContractForm organizationId={user.organization_id} customers={customers} userId={user.id} />
    </div>
  )
}
