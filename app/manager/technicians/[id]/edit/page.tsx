import { redirect } from "next/navigation"
import { getCurrentUser } from "@/lib/db"
import { createClient } from "@/lib/supabase-server"
import TechnicianForm from "../../TechnicianForm"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"

export default async function EditTechnicianPage({ params }: { params: { id: string } }) {
  const { id } = params
  const user = await getCurrentUser()

  if (!user) {
    redirect("/login")
  }

  if (!["owner", "admin", "manager"].includes(user.role)) {
    redirect("/manager/technicians")
  }

  const supabase = await createClient()

  // Fetch technician details
  const { data: technician, error } = await supabase
    .from("users")
    .select("*")
    .eq("id", id)
    .eq("organization_id", user.organization_id)
    .eq("role", "technician")
    .single()

  if (error || !technician) {
    redirect("/manager/technicians")
  }

  return (
    <div className="space-y-6">
      {/* Back Button */}
      <Link
        href={`/manager/technicians/${id}`}
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Technician
      </Link>

      <div>
        <h1 className="text-3xl font-bold">Edit Technician</h1>
        <p className="text-muted-foreground">Update technician information</p>
      </div>

      <TechnicianForm organizationId={user.organization_id} technician={technician} />
    </div>
  )
}
