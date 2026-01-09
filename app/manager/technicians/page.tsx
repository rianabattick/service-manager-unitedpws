import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { redirect } from "next/navigation"
import { getCurrentUser } from "@/lib/db"
import { createClient } from "@/lib/supabase-server"
import { PageHeader } from "@/components/shared/PageHeader"

interface SearchParams {
  status?: string
  specialty?: string
}

export default async function TechniciansPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const user = await getCurrentUser()

  if (!user) {
    redirect("/login")
  }

  if (!["owner", "admin", "manager", "dispatcher"].includes(user.role)) {
    redirect("/login")
  }

  const supabase = await createClient()

  // Build query for technicians
  const query = supabase
    .from("users")
    .select("id, full_name, email, phone, is_active, created_at, preferences")
    .eq("organization_id", user.organization_id)
    .eq("role", "technician")

  const { data: technicians, error } = await query.order("full_name", { ascending: true })

  if (error) {
    console.error("Error fetching technicians:", error)
  }

  // Get active job counts for each technician
  const techIds = technicians?.map((t) => t.id) || []
  const { data: jobCounts } = await supabase
    .from("job_technicians")
    .select("technician_id, job:jobs!job_technicians_job_id_fkey(status)")
    .in("technician_id", techIds)

  // Calculate statistics for each technician
  const techniciansWithStats = technicians?.map((tech) => {
    const techJobs = jobCounts?.filter((jc: any) => jc.technician_id === tech.id) || []
    const activeJobs = techJobs.filter(
      (jc: any) => jc.job?.status && ["pending", "confirmed", "in_progress"].includes(jc.job.status),
    )

    return {
      ...tech,
      activeJobsCount: activeJobs.length,
      specialty: tech.preferences?.specialty || null,
    }
  })

  const activeCount = techniciansWithStats?.filter((t) => t.is_active).length || 0
  const inactiveCount = techniciansWithStats?.filter((t) => !t.is_active).length || 0

  return (
    <div className="space-y-6">
      {/* Replace header with PageHeader component for branded underline */}
      <PageHeader title="Field Engineers" subtitle="Manage your service field engineers and their assignments" />

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Total Field Engineers</p>
              <p className="text-3xl font-bold">{techniciansWithStats?.length || 0}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Active</p>
              <p className="text-3xl font-bold text-green-600">{activeCount}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Inactive</p>
              <p className="text-3xl font-bold text-gray-500">{inactiveCount}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="border-t" />

      {/* Technicians Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {!techniciansWithStats || techniciansWithStats.length === 0 ? (
          <Card className="col-span-full">
            <CardContent className="py-12">
              <div className="text-center">
                <p className="text-muted-foreground">No field engineers found</p>
                <p className="text-sm text-muted-foreground mt-2">Try adding a new field engineer.</p>
              </div>
            </CardContent>
          </Card>
        ) : (
          techniciansWithStats.map((tech) => (
            <Link key={tech.id} href={`/manager/technicians/${tech.id}`}>
              <Card className="hover:shadow-md transition-shadow h-full">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <CardTitle className="text-lg">{tech.full_name}</CardTitle>
                    <span
                      className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                        tech.is_active
                          ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300"
                          : "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300"
                      }`}
                    >
                      {tech.is_active ? "Active" : "Inactive"}
                    </span>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {tech.specialty && (
                    <div>
                      <p className="text-xs text-muted-foreground">Specialty</p>
                      <p className="text-sm font-medium">{tech.specialty}</p>
                    </div>
                  )}
                  <div>
                    <p className="text-xs text-muted-foreground">Email</p>
                    <p className="text-sm">{tech.email || "—"}</p>
                  </div>
                  {tech.phone && (
                    <div>
                      <p className="text-xs text-muted-foreground">Phone</p>
                      <p className="text-sm">{tech.phone}</p>
                    </div>
                  )}
                  <div className="pt-2 border-t">
                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-primary/10 text-primary">
                      {tech.activeJobsCount} active {tech.activeJobsCount === 1 ? "job" : "jobs"}
                    </span>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))
        )}
      </div>
    </div>
  )
}
