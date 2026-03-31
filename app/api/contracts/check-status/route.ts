import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase-server"
import { createNotifications, getManagerUserIds } from "@/lib/notifications"
import nodemailer from "nodemailer"

// --- THE SPEEDBUMP HELPER ---
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

// --- THE EMAIL HELPER ---
async function sendContractEmail(contractLabel: string, statusText: string, contractId: string) {
  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.SUPPORT_EMAIL_USER,
      pass: process.env.SUPPORT_EMAIL_PASS,
    },
  })

  // Safely get the app URL so the button works in both local testing and production
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  const contractUrl = `${appUrl}/manager/contracts/${contractId}`

  const mailOptions = {
    from: process.env.SUPPORT_EMAIL_USER,
    // 👇 ADD YOUR SECOND EMAIL ADDRESS HERE
    to: [
      process.env.SUPPORT_EMAIL_USER || "support@unitedpws.com", 
      process.env.MANAGER_ALERT_EMAIL || "manager@unitedpws.com"
    ], 
    subject: `Contract Update: ${contractLabel} - ${statusText}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
        <h2 style="color: #0f172a;">Contract Status Updated</h2>
        <p style="color: #334155; font-size: 16px;">
          Hello,<br/><br/>
          The contract <strong>${contractLabel}</strong> has automatically updated its status to <strong>${statusText}</strong>. It might be time to schedule a new job or reach out to your POC to renew the contract.
        </p>
        <div style="margin: 30px 0;">
          <a href="${contractUrl}" style="background-color: #020617; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">
            Please view Contract in Power Link
          </a>
        </div>
        <p style="color: #64748b; font-size: 14px;">
          Powered by United Power System
        </p>
      </div>
    `,
  }

  await transporter.sendMail(mailOptions)
}

/**
 * Cron job to check contract statuses and send notifications
 * Should be called daily by a scheduled task
 */
export async function GET() {
  try {
    const supabase = await createAdminClient()
    const today = new Date()
    const todayStr = today.toISOString().split("T")[0]

    // Calculate 3 Months from now (for renewals)
    const threeMonthsFromNow = new Date(today)
    threeMonthsFromNow.setMonth(threeMonthsFromNow.getMonth() + 3)
    const threeMonthsStr = threeMonthsFromNow.toISOString().split("T")[0]

    // Calculate 1 Month from now (for PMs)
    const oneMonthFromNow = new Date(today)
    oneMonthFromNow.setMonth(oneMonthFromNow.getMonth() + 1)
    const oneMonthStr = oneMonthFromNow.toISOString().split("T")[0]

    // --- PART 1: OVERDUE CONTRACTS ---
    const { data: overdueContracts } = await supabase
      .from("service_agreements")
      .select("id, organization_id, agreement_number, name, end_date, status")
      .lt("end_date", todayStr)
      .neq("status", "overdue")
      .neq("status", "cancelled")
      .neq("status", "ended")

    if (overdueContracts && overdueContracts.length > 0) {
      for (const contract of overdueContracts) {
        await supabase.from("service_agreements").update({ status: "overdue" }).eq("id", contract.id)

        const managerIds = await getManagerUserIds(contract.organization_id, supabase)
        // Ensure we don't use the ID as a fallback label
        const contractLabel = contract.name || contract.agreement_number || 'Unnamed Contract'

        await createNotifications({
          organizationId: contract.organization_id,
          recipientUserIds: managerIds,
          type: "contract_overdue",
          message: `Contract "${contractLabel}" has passed its end date`,
          relatedEntityType: "contract",
          relatedEntityId: contract.id,
          supabase,
        })

        // Send Email and wait 2 seconds
        await sendContractEmail(contractLabel, "Overdue", contract.id)
        await delay(2000)
      }
    }

    // --- PART 2: RENEWAL NEEDED (3 Months out) ---
    const { data: expiringContracts } = await supabase
      .from("service_agreements")
      .select("id, organization_id, agreement_number, name, end_date, status")
      .lte("end_date", threeMonthsStr)
      .gte("end_date", todayStr)
      .neq("status", "renewal_needed")
      .neq("status", "cancelled")
      .neq("status", "ended")
      .neq("status", "overdue")

    if (expiringContracts && expiringContracts.length > 0) {
      for (const contract of expiringContracts) {
        await supabase.from("service_agreements").update({ status: "renewal_needed" }).eq("id", contract.id)

        const managerIds = await getManagerUserIds(contract.organization_id, supabase)
        const contractLabel = contract.name || contract.agreement_number || 'Unnamed Contract'
        // Append time to prevent timezone shift issues in formatting
        const endDate = new Date(contract.end_date + 'T12:00:00Z').toLocaleDateString()

        await createNotifications({
          organizationId: contract.organization_id,
          recipientUserIds: managerIds,
          type: "contract_renewal_needed",
          message: `Contract "${contractLabel}" expires on ${endDate} - renewal needed`,
          relatedEntityType: "contract",
          relatedEntityId: contract.id,
          supabase,
        })

        // Send Email and wait 2 seconds
        await sendContractEmail(contractLabel, "Renewal Needed", contract.id)
        await delay(2000)
      }
    }

    // --- PART 3: JOB CREATION NEEDED (1 Month before pm_due_next) ---
    const { data: pmDueContracts } = await supabase
      .from("service_agreements")
      .select("id, organization_id, agreement_number, name, pm_due_next, status")
      .lte("pm_due_next", oneMonthStr) // The PM is due within 1 month (or is already past due)
      .in("status", ["active", "in_progress"]) // Only touch contracts currently in progress

    if (pmDueContracts && pmDueContracts.length > 0) {
      for (const contract of pmDueContracts) {
        if (!contract.pm_due_next) continue; // Safety check

        await supabase.from("service_agreements").update({ status: "job_creation_needed" }).eq("id", contract.id)

        const managerIds = await getManagerUserIds(contract.organization_id, supabase)
        const contractLabel = contract.name || contract.agreement_number || 'Unnamed Contract'
        const dueDate = new Date(contract.pm_due_next + 'T12:00:00Z').toLocaleDateString()

        await createNotifications({
          organizationId: contract.organization_id,
          recipientUserIds: managerIds,
          type: "contract_job_needed",
          message: `Contract "${contractLabel}" - schedule next service by ${dueDate}`,
          relatedEntityType: "contract",
          relatedEntityId: contract.id,
          supabase,
        })

        // Send Email and wait 2 seconds
        await sendContractEmail(contractLabel, "Job Creation Needed", contract.id)
        await delay(2000)
      }
    }

    return NextResponse.json({
      success: true,
      overdueContracts: overdueContracts?.length || 0,
      expiringContracts: expiringContracts?.length || 0,
      pmDueContracts: pmDueContracts?.length || 0,
    })
  } catch (error) {
    console.error("[v0] Error checking contract statuses:", error)
    return NextResponse.json({ error: "Failed to check contract statuses" }, { status: 500 })
  }
}