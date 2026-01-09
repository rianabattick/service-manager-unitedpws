"use client"

import { createBrowserClient } from "@supabase/ssr"
import type { SupabaseClient } from "@supabase/supabase-js"

let browserClient: SupabaseClient | null = null

let authCache: { user: any; timestamp: number } | null = null
const AUTH_CACHE_DURATION = 15000 // 15 seconds

export function createClient(): SupabaseClient {
  if (browserClient) {
    return browserClient
  }

  browserClient = createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)

  return browserClient
}

export async function getCachedUser() {
  const now = Date.now()

  // Return cached result if still valid
  if (authCache && now - authCache.timestamp < AUTH_CACHE_DURATION) {
    console.log("[v0] Using cached auth result")
    return authCache.user
  }

  try {
    const supabase = createClient()
    const { data, error } = await supabase.auth.getUser()

    if (error) {
      console.log("[v0] Auth check error:", error.message)
      // Don't cache errors, but don't throw either
      return null
    }

    // Cache the result
    authCache = {
      user: data.user,
      timestamp: now,
    }

    return data.user
  } catch (error: any) {
    console.log("[v0] Auth check failed (network):", error?.message)
    // Return cached result even if expired on network error
    return authCache?.user || null
  }
}

export function clearAuthCache() {
  authCache = null
}

export function resetClient() {
  browserClient = null
}
