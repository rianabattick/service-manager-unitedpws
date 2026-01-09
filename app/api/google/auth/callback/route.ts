import { type NextRequest, NextResponse } from "next/server"

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const code = searchParams.get("code")
  const error = searchParams.get("error")

  // FIX: This helper creates the full URL required by Next.js
  const getRedirectUrl = (path: string) => new URL(path, request.url)

  if (error) {
    return NextResponse.redirect(getRedirectUrl(`/admin/google-auth/error?message=${encodeURIComponent(error)}`))
  }

  if (!code) {
    return NextResponse.redirect(getRedirectUrl(`/admin/google-auth/error?message=No authorization code received`))
  }

  const clientId = process.env.GOOGLE_CLIENT_ID
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET
  
  // Keep this hardcoded exactly as you have it
  const redirectUri = "https://v0-service-manager-1-0.vercel.app/api/google/auth/callback"

  if (!clientId || !clientSecret) {
    console.error("Missing Environment Variables")
    return NextResponse.redirect(getRedirectUrl(`/admin/google-auth/error?message=OAuth credentials not configured`))
  }

  try {
    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }),
    })

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.json()
      console.error("[v0] Token exchange error:", errorData)
      return NextResponse.redirect(
        getRedirectUrl(`/admin/google-auth/error?message=${encodeURIComponent(errorData.error_description || "Failed to exchange code")}`)
      )
    }

    const tokens = await tokenResponse.json()

    // Redirect with the permanent refresh token
    return NextResponse.redirect(getRedirectUrl(`/admin/google-auth/success?refresh_token=${encodeURIComponent(tokens.refresh_token)}`))
    
  } catch (error) {
    console.error("[v0] OAuth callback error:", error)
    return NextResponse.redirect(
      getRedirectUrl(`/admin/google-auth/error?message=${encodeURIComponent(error instanceof Error ? error.message : "Unknown error")}`)
    )
  }
}
