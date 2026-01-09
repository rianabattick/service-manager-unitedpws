"use client"

import { useSearchParams } from "next/navigation"
import { AlertCircle } from "lucide-react"
import Link from "next/link"

export default function GoogleAuthErrorPage() {
  const searchParams = useSearchParams()
  const message = searchParams.get("message") || "An unknown error occurred"

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="max-w-md w-full space-y-6">
        <div className="text-center space-y-2">
          <div className="mx-auto w-16 h-16 bg-destructive/10 rounded-full flex items-center justify-center mb-4">
            <AlertCircle className="w-8 h-8 text-destructive" />
          </div>
          <h1 className="text-3xl font-bold">Authorization Failed</h1>
          <p className="text-muted-foreground">{message}</p>
        </div>

        <div className="bg-card border rounded-lg p-6 space-y-4">
          <Link
            href="/admin/google-auth"
            className="block w-full bg-primary text-primary-foreground hover:bg-primary/90 font-medium py-2 px-4 rounded-md text-center transition-colors"
          >
            Try Again
          </Link>
        </div>

        <div className="text-center text-sm text-muted-foreground">
          <p>Need help? Contact your administrator</p>
        </div>
      </div>
    </div>
  )
}
