import { runContractNotificationsScan } from "@/lib/contracts-notifications"

export async function GET() {
  const results = await runContractNotificationsScan()

  return Response.json({
    success: true,
    results,
  })
}

export async function POST() {
  const results = await runContractNotificationsScan()

  return Response.json({
    success: true,
    results,
  })
}
