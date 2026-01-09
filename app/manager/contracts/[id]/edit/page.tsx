import { redirect, notFound } from "next/navigation"
import { getCurrentUser } from "@/lib/db"
import { createClient } from "@/lib/supabase-server" // Updated import to use supabase-server
import { getContractDetail } from "@/lib/contracts"
import { ContractForm } from "../../ContractForm"

export default async function EditContractPage({
  params,
}: {
  params: { id: string }
}) {
  const user = await getCurrentUser()

  if (!user) {
    redirect("/login")
  }

  if (!["owner", "admin", "manager", "dispatcher"].includes(user.role)) {
    redirect("/login")
  }

  const { id } = params
  const contract = await getContractDetail(id)

  if (!contract) {
    notFound()
  }

  const supabase = await createClient()

  // Get customers
  const { data: customers } = await supabase
    .from("customers")
    .select("id, first_name, last_name, company_name")
    .eq("organization_id", user.organization_id)
    .eq("is_active", true)
    .order("company_name", { ascending: true, nullsFirst: false })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Edit Contract</h1>
        <p className="text-muted-foreground">Update contract details and services</p>
      </div>

      <ContractForm
        organizationId={user.organization_id}
        customers={customers || []}
        userId={user.id}
        contract={contract}
      />
    </div>
  )
}
