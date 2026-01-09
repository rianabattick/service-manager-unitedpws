import { redirect } from "next/navigation"
import { getCurrentUser } from "@/lib/db"
import TechnicianForm from "../TechnicianForm"

export default async function NewTechnicianPage() {
  const user = await getCurrentUser()

  if (!user) {
    redirect("/login")
  }

  if (!["owner", "admin", "manager"].includes(user.role)) {
    redirect("/manager/technicians")
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Add New Technician</h1>
        <p className="text-muted-foreground">Create a new technician account</p>
      </div>

      <TechnicianForm organizationId={user.organization_id} />
    </div>
  )
}
