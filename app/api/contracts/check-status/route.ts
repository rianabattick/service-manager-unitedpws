import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase-server"
import { createNotifications, getManagerUserIds } from "@/lib/notifications"

/**
 * Cron job to check contract statuses and send notifications
 * Should be called daily by a scheduled task
 */
export async function GET() {
  try {
    const supabase = await createAdminClient()
    const today = new Date()
    const threeMonthsFromNow = new Date(today)
    threeMonthsFromNow.setMonth(threeMonthsFromNow.getMonth() + 3)

    const { data: overdueContracts } = await supabase
      .from("service_agreements")
      .select("id, organization_id, agreement_number, name, end_date, status")
      .lt("end_date", today.toISOString().split("T")[0])
      .neq("status", "overdue")
      .neq("status", "cancelled")
      .neq("status", "ended")

    if (overdueContracts && overdueContracts.length > 0) {
      for (const contract of overdueContracts) {
        await supabase.from("service_agreements").update({ status: "overdue" }).eq("id", contract.id)

        const managerIds = await getManagerUserIds(contract.organization_id, supabase)
        const contractLabel = contract.name || contract.agreement_number || contract.id

        await createNotifications({
          organizationId: contract.organization_id,
          recipientUserIds: managerIds,
          type: "contract_overdue",
          message: `Contract "${contractLabel}" has passed its end date`,
          relatedEntityType: "contract",
          relatedEntityId: contract.id,
          supabase,
        })
      }
    }

    // Check for contracts ending within 3 months
    const { data: expiringContracts } = await supabase
      .from("service_agreements")
      .select("id, organization_id, agreement_number, name, end_date, status")
      .lte("end_date", threeMonthsFromNow.toISOString().split("T")[0])
      .gte("end_date", today.toISOString().split("T")[0])
      .neq("status", "renewal_needed")
      .neq("status", "cancelled")
      .neq("status", "ended")
      .neq("status", "overdue")

    // Update status to renewal_needed and send notifications
    if (expiringContracts && expiringContracts.length > 0) {
      for (const contract of expiringContracts) {
        // Update status
        await supabase.from("service_agreements").update({ status: "renewal_needed" }).eq("id", contract.id)

        // Send notification
        const managerIds = await getManagerUserIds(contract.organization_id, supabase)
        const contractLabel = contract.name || contract.agreement_number || contract.id
        const endDate = new Date(contract.end_date).toLocaleDateString()

        await createNotifications({
          organizationId: contract.organization_id,
          recipientUserIds: managerIds,
          type: "contract_renewal_needed",
          message: `Contract "${contractLabel}" expires on ${endDate} - renewal needed`,
          relatedEntityType: "contract",
          relatedEntityId: contract.id,
          supabase,
        })
      }
    }

    // Check for contracts that need job creation based on service frequency
    const { data: activeContracts } = await supabase
      .from("service_agreements")
      .select(`
        id,
        organization_id,
        agreement_number,
        name,
        start_date,
        agreement_length_years,
        status
      `)
      .in("status", ["active", "in_progress"])

    if (activeContracts && activeContracts.length > 0) {
      for (const contract of activeContracts) {
        // Get services for this contract
        const { data: services } = await supabase
          .from("contract_services")
          .select("service_type, frequency_months")
          .eq("contract_id", contract.id)

        if (!services || services.length === 0) continue

        const totalPMsPerYear = services.reduce((sum: number, s: any) => sum + s.frequency_months, 0)
        if (totalPMsPerYear === 0) continue

        // Get jobs for this contract
        const { data: jobs } = await supabase
          .from("jobs")
          .select("id, scheduled_start, status")
          .eq("service_agreement_id", contract.id)
          .order("scheduled_start", { ascending: false })

        // Calculate when next job should be scheduled
        const monthsBetweenJobs = 12 / totalPMsPerYear
        const lastJobDate = jobs && jobs.length > 0 ? new Date(jobs[0].scheduled_start) : new Date(contract.start_date)
        const nextJobDue = new Date(lastJobDate)
        nextJobDue.setMonth(nextJobDue.getMonth() + monthsBetweenJobs)

        // Send notification 1 month before next job is due
        const oneMonthBeforeDue = new Date(nextJobDue)
        oneMonthBeforeDue.setMonth(oneMonthBeforeDue.getMonth() - 1)

        if (today >= oneMonthBeforeDue && today < nextJobDue && contract.status !== "job_creation_needed") {
          // Update status
          await supabase.from("service_agreements").update({ status: "job_creation_needed" }).eq("id", contract.id)

          // Send notification
          const managerIds = await getManagerUserIds(contract.organization_id, supabase)
          const contractLabel = contract.name || contract.agreement_number || contract.id
          const dueDate = nextJobDue.toLocaleDateString()

          await createNotifications({
            organizationId: contract.organization_id,
            recipientUserIds: managerIds,
            type: "contract_job_needed",
            message: `Contract "${contractLabel}" - schedule next service by ${dueDate}`,
            relatedEntityType: "contract",
            relatedEntityId: contract.id,
            supabase,
          })
        }
      }
    }

    return NextResponse.json({
      success: true,
      overdueContracts: overdueContracts?.length || 0,
      expiringContracts: expiringContracts?.length || 0,
      activeContracts: activeContracts?.length || 0,
    })
  } catch (error) {
    console.error("[v0] Error checking contract statuses:", error)
    return NextResponse.json({ error: "Failed to check contract statuses" }, { status: 500 })
  }
}
