"use client"

import { ChefHat, History, Home, LayoutDashboard, MessagesSquare, PlusCircle } from "lucide-react"
import { useSession } from "@/components/layout/session-context"
import { AppShell, type NavItem } from "@/components/layout/app-shell"
import { useInbox } from "@/hooks/use-unread"

export function CanteenShell({ orgName, children }: { orgName: string; children: React.ReactNode }) {
  const { profile } = useSession()
  const { unread } = useInbox(profile.id)
  const nav: NavItem[] = [
    { href: "/canteen/home", label: "Home", icon: Home },
    { href: "/canteen", label: "Dashboard", icon: LayoutDashboard, exact: true },
    { href: "/canteen/listings/new", label: "Post surplus", icon: PlusCircle },
    { href: "/canteen/planner", label: "Prep planner", icon: ChefHat },
    { href: "/canteen/messages", label: "Messages", icon: MessagesSquare, badge: unread },
    { href: "/canteen/history", label: "History", icon: History },
  ]
  return (
    <AppShell nav={nav} home="/canteen/home" subtitle={orgName}>
      {children}
    </AppShell>
  )
}
