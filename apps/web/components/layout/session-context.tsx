"use client"

import { createContext, useContext } from "react"
import type { Tables } from "@platelink/shared"

export type SessionValue = {
  profile: Tables<"users">
  canteen?: Tables<"canteens"> | null
}

const SessionContext = createContext<SessionValue | null>(null)

export function SessionProvider({ value, children }: { value: SessionValue; children: React.ReactNode }) {
  return <SessionContext value={value}>{children}</SessionContext>
}

/** Profile resolved server-side in the route-group layout. */
export function useSession() {
  const ctx = useContext(SessionContext)
  if (!ctx) throw new Error("useSession must be used inside a role layout")
  return ctx
}
