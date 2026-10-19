import type { Metadata } from "next"
import { CanteenDashboard } from "@/components/canteen/dashboard"

export const metadata: Metadata = { title: "Dashboard" }

export default function CanteenHome() {
  return <CanteenDashboard />
}
