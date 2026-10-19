import React from "react"
import { Redirect } from "expo-router"
import { BrandedSplash } from "@/components/ui"
import { useSession } from "@/lib/session"

/**
 * Root index route (/) — renders the BrandedSplash while session & profile
 * load from public.users, then redirects to the appropriate role route.
 */
export default function IndexScreen() {
  const { session, profile, loading } = useSession()

  // While checking auth and loading profile from public.users, display branded splash
  if (loading || (session && !profile)) {
    return <BrandedSplash />
  }

  // No active session → redirect to login
  if (!session) {
    return <Redirect href="/(auth)/login" />
  }

  // Role-based routing according to public.users.role (Rule 2)
  const role = profile?.role
  if (role === "driver") {
    return <Redirect href="/(driver)" />
  }

  if (role === "user") {
    return <Redirect href="/(recipient)" />
  }

  if (role === "canteen") {
    return <Redirect href="/canteen" />
  }

  // Fallback if role is unrecognised
  return <Redirect href="/(auth)/login" />
}
