import { redirect } from "next/navigation"
import { ROLE_HOME } from "@platelink/shared"
import { getCanteen, getProfile } from "@/lib/auth"

/** Single post-login landing that routes each role to its home. */
export default async function DashboardRedirect() {
  const profile = await getProfile()
  if (!profile) redirect("/login")
  if (profile.role === "canteen" && !(await getCanteen(profile.id))) redirect("/onboarding")
  redirect(ROLE_HOME[profile.role])
}
