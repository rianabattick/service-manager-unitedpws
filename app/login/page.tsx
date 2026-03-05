"use client"

import type React from "react"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase-client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import Image from "next/image"

export default function LoginPage() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()
  const supabase = createClient()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (signInError) {
        setError(signInError.message)
        setLoading(false)
        return
      }

      if (!data.user) {
        setError("Sign in failed - no user returned")
        setLoading(false)
        return
      }

      // 🔍 ADD LOGGING HERE
      console.log("[login] Auth user ID:", data.user.id)

      const { data: userProfile, error: profileError } = await supabase
        .from("users")
        .select("*")
        .eq("id", data.user.id)
        .maybeSingle()

      if (profileError) {
        console.error("[login] Failed to load user profile", profileError)
        setError(`Failed to load user profile: ${profileError.message}`)
        setLoading(false)
        return
      }

      if (!userProfile) {
        setError("User profile not found. Please contact your administrator.")
        setLoading(false)
        return
      }

      // Redirect based on role
      if (userProfile.role === "technician") {
        router.push("/technician")
      } else {
        // owner, admin, manager, dispatcher, or any other role
        router.push("/manager")
      }
    } catch (err) {
      setError("An unexpected error occurred")
      console.error("[login] Unexpected error:", err)
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-8">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <div className="flex justify-center mb-6">
            <Image
              src="/images/powerlink-logo.svg"
              alt="Power Link"
              width={300}
              height={90}
              priority
              className="w-72 h-auto"
            />
          </div>
          <CardTitle className="text-2xl font-bold">Sign in</CardTitle>
          <CardDescription>Enter your email and password to access Power Link</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="name@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={loading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={loading}
              />
            </div>

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Signing in..." : "Sign in"}
            </Button>
          </form>

          {/* 👇 Updated Footer Section with Company Affiliation */}
          <div className="mt-6 flex flex-col items-center text-center">
            <p className="text-sm text-muted-foreground mb-4">
              Login credentials will be provided by your administrator
            </p>
            <div className="w-full border-t border-border pt-4">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Powered by <span className="text-foreground font-bold">United Power System</span>
              </p>
            </div>
          </div>
          {/* ☝️ End Updated Footer Section */}

        </CardContent>
      </Card>
    </div>
  )
}