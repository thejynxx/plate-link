"use client"

import { Home, MessagesSquare, Package, Soup } from "lucide-react"
import { useSession } from "@/components/layout/session-context"
import { AppShell, type NavItem } from "@/components/layout/app-shell"
import { useInbox } from "@/hooks/use-unread"

export function RecipientShell({ children }: { children: React.ReactNode }) {
  const { profile } = useSession()
  const { unread } = useInbox(profile.id)
  const nav: NavItem[] = [
    { href: "/app/home", label: "Home", icon: Home },
    { href: "/app", label: "Find food", icon: Soup, exact: true },
    { href: "/app/orders", label: "My claims", icon: Package },
    { href: "/app/messages", label: "Messages", icon: MessagesSquare, badge: unread },
  ]
  return (
    <AppShell nav={nav} home="/app/home" subtitle={profile.name}>
      {children}
    </AppShell>
  )
}
