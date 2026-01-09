import { NextResponse } from "next/server"
import { runContractStatusAndNotificationScan } from "@/lib/contracts-scheduler"

export async function GET() {
  try {
    const results = await runContractStatusAndNotificationScan()
    return NextResponse.json({
      success: true,
      ...results,
    })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}
