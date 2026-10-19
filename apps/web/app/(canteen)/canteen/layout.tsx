import { redirect } from "next/navigation"
import { getCanteen, requireRole } from "@/lib/auth"
import { CanteenShell } from "@/components/canteen/canteen-shell"
import { SessionProvider } from "@/components/layout/session-context"

export default async function CanteenLayout({ children }: { children: React.ReactNode }) {
  const profile = await requireRole("canteen")
  const canteen = await getCanteen(profile.id)
  if (!canteen) redirect("/onboarding")

  return (
    <SessionProvider value={{ profile, canteen }}>
      <CanteenShell orgName={canteen.org_name}>{children}</CanteenShell>
    </SessionProvider>
  )
}
