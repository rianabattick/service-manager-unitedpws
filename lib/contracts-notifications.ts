"use server"

import { createClient } from "./supabase-server"
import { createNotifications, getManagerUserIds } from "./notifications"

/**
 * Scan contracts and create notifications for renewal and job creation needs
 */
export async function runContractNotificationsScan() {
  const supabase = await createClient()
  const results = {
    renewalNotifications: 0,
    jobNeededNotifications: 0,
    errors: [] as string[],
  }

  try {
    // 1. Contract renewal needed (3 months before end date)
    const threeMonthsFromNow = new Date()
    threeMonthsFromNow.setMonth(threeMonthsFromNow.getMonth() + 3)
    const threeMonthsPlusFiveDays = new Date(threeMonthsFromNow)
    threeMonthsPlusFiveDays.setDate(threeMonthsPlusFiveDays.getDate() + 5)

    const { data: renewalContracts, error: renewalError } = await supabase
      .from("service_agreements")
      .select("id, organization_id, agreement_number")
      .eq("status", "active")
      .gte("end_date", threeMonthsFromNow.toISOString().split("T")[0])
      .lte("end_date", threeMonthsPlusFiveDays.toISOString().split("T")[0])

    if (renewalError) {
      results.errors.push(`Renewal scan error: ${renewalError.message}`)
    } else if (renewalContracts && renewalContracts.length > 0) {
      for (const contract of renewalContracts) {
        const managerIds = await getManagerUserIds(contract.organization_id, supabase)

        await createNotifications({
          organizationId: contract.organization_id,
          recipientUserIds: managerIds,
          type: "contract_renewal_needed",
          message: `Contract ${contract.agreement_number || contract.id} renewal needed`,
          relatedEntityType: "contract",
          relatedEntityId: contract.id,
          supabase,
        })

        results.renewalNotifications++
      }
    }

    // 2. Job creation needed for twice-yearly services
    const fiveMonthsAgo = new Date()
    fiveMonthsAgo.setMonth(fiveMonthsAgo.getMonth() - 5)
    const sixMonthsAgo = new Date()
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6)

    const { data: twiceYearlyContracts, error: twiceYearlyError } = await supabase
      .from("service_agreements")
      .select("id, organization_id, agreement_number")
      .eq("status", "active")
      .eq("service_frequency", "twice_yearly")

    if (twiceYearlyError) {
      results.errors.push(`Twice-yearly scan error: ${twiceYearlyError.message}`)
    } else if (twiceYearlyContracts && twiceYearlyContracts.length > 0) {
      for (const contract of twiceYearlyContracts) {
        // Find most recent completed job for this contract
        const { data: recentJob } = await supabase
          .from("jobs")
          .select("completed_at")
          .eq("service_agreement_id", contract.id)
          .eq("status", "completed")
          .order("completed_at", { ascending: false })
          .limit(1)
          .single()

        if (recentJob && recentJob.completed_at) {
          const completedDate = new Date(recentJob.completed_at)
          if (completedDate <= fiveMonthsAgo && completedDate >= sixMonthsAgo) {
            const managerIds = await getManagerUserIds(contract.organization_id, supabase)

            await createNotifications({
              organizationId: contract.organization_id,
              recipientUserIds: managerIds,
              type: "contract_job_needed",
              message: `Job creation for contract ${contract.agreement_number || contract.id} needed`,
              relatedEntityType: "contract",
              relatedEntityId: contract.id,
              supabase,
            })

            results.jobNeededNotifications++
          }
        }
      }
    }

    return results
  } catch (error: any) {
    results.errors.push(`Scan exception: ${error.message}`)
    return results
  }
}
