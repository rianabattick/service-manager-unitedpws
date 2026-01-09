"use server"

import { createAdminClient } from "./supabase-server"
import { createNotifications, getManagerUserIds } from "./notifications"

/**
 * Run contract status and notification scan
 * This should be called periodically (e.g., daily via cron)
 */
export async function runContractStatusAndNotificationScan() {
  const supabase = await createAdminClient()
  const results = {
    renewalNeededCount: 0,
    jobCreationNeededCount: 0,
    errors: [] as string[],
  }

  try {
    // Scan for contracts with end date approaching (3 months)
    const threeMonthsFromNow = new Date()
    threeMonthsFromNow.setMonth(threeMonthsFromNow.getMonth() + 3)

    const { data: expiringContracts } = await supabase
      .from("service_agreements")
      .select("*")
      .lte("end_date", threeMonthsFromNow.toISOString().split("T")[0])
      .not("status", "in", '("ended","cancelled","renewal_needed")')

    if (expiringContracts && expiringContracts.length > 0) {
      for (const contract of expiringContracts) {
        // Check if we already notified recently (within 7 days)
        const sevenDaysAgo = new Date()
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

        if (!contract.last_notified_at || new Date(contract.last_notified_at) < sevenDaysAgo) {
          // Update status to renewal_needed
          await supabase
            .from("service_agreements")
            .update({
              status: "renewal_needed",
              last_notified_at: new Date().toISOString(),
            })
            .eq("id", contract.id)

          // Send notification to managers
          const managerIds = await getManagerUserIds(contract.organization_id, supabase)
          const contractLabel = contract.agreement_number || contract.title || contract.id

          await createNotifications({
            organizationId: contract.organization_id,
            recipientUserIds: managerIds,
            type: "contract_renewal_needed",
            message: `Contract ${contractLabel} end date approaching`,
            relatedEntityType: "contract",
            relatedEntityId: contract.id,
            supabase,
          })

          results.renewalNeededCount++
        }
      }
    }

    // Scan for contracts needing job creation (5 months after last service)
    const { data: contractsWithServices } = await supabase.from("contract_services").select(`
        *,
        contract:service_agreements!contract_services_contract_id_fkey (
          id,
          organization_id,
          agreement_number,
          title,
          status,
          last_notified_at
        )
      `)

    if (contractsWithServices && contractsWithServices.length > 0) {
      for (const contractService of contractsWithServices) {
        const contract = (contractService as any).contract
        if (!contract || contract.status === "ended" || contract.status === "cancelled") {
          continue
        }

        // Get all jobs for this contract and service type
        const { data: allJobs } = await supabase
          .from("jobs")
          .select("scheduled_start")
          .eq("service_agreement_id", contract.id)
          .eq("service_type", contractService.service_type)
          .order("scheduled_start", { ascending: true })

        if (allJobs && allJobs.length > 0) {
          const firstJobDate = new Date(allJobs[0].scheduled_start)
          const totalQuantity = contractService.frequency_months // This is actually the quantity
          const completedJobs = allJobs.length

          // If all services are completed, send reminder 5 months after first job
          if (completedJobs >= totalQuantity) {
            const fiveMonthsAfterFirst = new Date(firstJobDate)
            fiveMonthsAfterFirst.setMonth(fiveMonthsAfterFirst.getMonth() + 5)

            const now = new Date()
            if (now >= fiveMonthsAfterFirst) {
              // Check if we already notified recently (within 7 days)
              const sevenDaysAgo = new Date()
              sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

              if (!contract.last_notified_at || new Date(contract.last_notified_at) < sevenDaysAgo) {
                await supabase
                  .from("service_agreements")
                  .update({
                    status: "job_creation_needed",
                    last_notified_at: new Date().toISOString(),
                  })
                  .eq("id", contract.id)

                const managerIds = await getManagerUserIds(contract.organization_id, supabase)
                const contractLabel = contract.agreement_number || contract.title || contract.id

                await createNotifications({
                  organizationId: contract.organization_id,
                  recipientUserIds: managerIds,
                  type: "contract_job_creation_needed",
                  message: `Job creation needed for contract ${contractLabel} (${completedJobs}/${totalQuantity} services completed)`,
                  relatedEntityType: "contract",
                  relatedEntityId: contract.id,
                  supabase,
                })

                results.jobCreationNeededCount++
              }
            }
          }
        }
      }
    }
  } catch (error: any) {
    console.error("[v0] Error running contract scanner:", error)
    results.errors.push(error.message)
  }

  return results
}
