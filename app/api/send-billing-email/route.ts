import { NextResponse } from "next/server"
import nodemailer from "nodemailer"

export async function POST(req: Request) {
  try {
    const { jobId, jobTitle, jobNumber, jobUrl } = await req.json()

    // 1. Set up the Nodemailer transporter using your App Password
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    })

    // 2. Define the email content
const mailOptions = {
    from: process.env.EMAIL_USER,
    to: "billing@unitedpws.com", 
    // 👇 Updated Subject: Removed the # and Number
    subject: `Ready to Bill: ${jobTitle}`, 
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
        <h2 style="color: #0f172a;">Job Ready for Billing</h2>
        <p style="color: #334155; font-size: 16px;">
          Hello,<br/><br/>
          The job <strong>${jobTitle}</strong> is ready to be billed.
        </p>
        <div style="margin: 30px 0;">
          <a href="${jobUrl}" style="background-color: #020617; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">
            View Job in Power Link
          </a>
        </div>
        <p style="color: #64748b; font-size: 14px;">
          Powered by United Power System
        </p>
      </div>
    `,
  }

    // 3. Send the email!
    await transporter.sendMail(mailOptions)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[Email Error]", error)
    return NextResponse.json({ error: "Failed to send email" }, { status: 500 })
  }
}