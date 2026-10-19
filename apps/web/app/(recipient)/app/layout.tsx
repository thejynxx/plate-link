import { requireRole } from "@/lib/auth"
import { RecipientShell } from "@/components/recipient/recipient-shell"
import { SessionProvider } from "@/components/layout/session-context"
import { RecipientLocationProvider } from "@/components/recipient/recipient-location"

export default async function RecipientLayout({ children }: { children: React.ReactNode }) {
  const profile = await requireRole("user")
  return (
    <SessionProvider value={{ profile }}>
      <RecipientLocationProvider>
        <RecipientShell>{children}</RecipientShell>
      </RecipientLocationProvider>
    </SessionProvider>
  )
}
