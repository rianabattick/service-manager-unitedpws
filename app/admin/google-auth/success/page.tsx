"use client"

import { useSearchParams } from "next/navigation"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Check, Copy } from "lucide-react"

export default function GoogleAuthSuccessPage() {
  const searchParams = useSearchParams()
  const refreshToken = searchParams.get("refresh_token")
  const [copied, setCopied] = useState(false)

  const handleCopy = () => {
    if (refreshToken) {
      navigator.clipboard.writeText(refreshToken)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  if (!refreshToken) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="max-w-md w-full bg-destructive/10 border border-destructive rounded-lg p-6">
          <h1 className="text-xl font-bold text-destructive mb-2">No Refresh Token Received</h1>
          <p className="text-muted-foreground">Please try the authorization process again.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="max-w-2xl w-full space-y-6">
        <div className="text-center space-y-2">
          <div className="mx-auto w-16 h-16 bg-green-500/10 rounded-full flex items-center justify-center mb-4">
            <Check className="w-8 h-8 text-green-500" />
          </div>
          <h1 className="text-3xl font-bold">Authorization Successful!</h1>
          <p className="text-muted-foreground">Your refresh token has been generated</p>
        </div>

        <div className="bg-card border rounded-lg p-6 space-y-4">
          <div className="space-y-2">
            <h2 className="font-semibold">Your Refresh Token:</h2>
            <div className="bg-muted p-4 rounded-md font-mono text-xs break-all">{refreshToken}</div>
            <Button onClick={handleCopy} className="w-full bg-transparent" variant="outline">
              {copied ? (
                <>
                  <Check className="mr-2 h-4 w-4" />
                  Copied!
                </>
              ) : (
                <>
                  <Copy className="mr-2 h-4 w-4" />
                  Copy to Clipboard
                </>
              )}
            </Button>
          </div>
        </div>

        <div className="bg-muted/50 border rounded-lg p-6 space-y-4">
          <h3 className="font-semibold">Next Steps:</h3>
          <ol className="list-decimal list-inside space-y-3 text-sm">
            <li>
              Go to your{" "}
              <a
                href="https://vercel.com/dashboard"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                Vercel Dashboard
              </a>
            </li>
            <li>Navigate to your project settings → Environment Variables</li>
            <li>
              Add a new variable:
              <div className="mt-2 bg-background border rounded p-3 space-y-2">
                <div>
                  <strong>Name:</strong> <code className="bg-muted px-2 py-1 rounded">GOOGLE_REFRESH_TOKEN</code>
                </div>
                <div>
                  <strong>Value:</strong> <span className="text-muted-foreground">(paste the token above)</span>
                </div>
              </div>
            </li>
            <li>Save the environment variable</li>
            <li>Redeploy your application for the changes to take effect</li>
          </ol>
        </div>

        <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-4">
          <p className="text-sm text-yellow-700 dark:text-yellow-400">
            <strong>Important:</strong> Store this refresh token securely. You won't be able to see it again. If you
            lose it, you'll need to re-authorize.
          </p>
        </div>
      </div>
    </div>
  )
}
