import "server-only"
import { cache } from "react"
import { redirect } from "next/navigation"
import { ROLE_HOME, type Tables, type UserRole } from "@platelink/shared"
import { createClient } from "@/lib/supabase/server"

export type Profile = Tables<"users">

/** The signed-in user's profile row (role comes from the DB, never from user_metadata). */
export const getProfile = cache(async (): Promise<Profile | null> => {
  const supabase = await createClient()
  const { data: auth } = await supabase.auth.getUser()
  if (!auth.user) return null
  const { data } = await supabase.from("users").select("*").eq("id", auth.user.id).maybeSingle()
  return data
})

/** Guard for a route group: signed in AND has the expected role, otherwise redirect home. */
export async function requireRole(role: UserRole): Promise<Profile> {
  const profile = await getProfile()
  if (!profile) redirect("/login")
  if (profile.role !== role) redirect(ROLE_HOME[profile.role])
  return profile
}

export const getCanteen = cache(async (id: string) => {
  const supabase = await createClient()
  const { data } = await supabase.from("canteens").select("*").eq("id", id).maybeSingle()
  return data
})
