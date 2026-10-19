import type { Metadata } from "next"
import { PrepPlanner } from "@/components/planner/prep-planner"

export const metadata: Metadata = { title: "Prep planner" }

export default function PlannerPage() {
  return <PrepPlanner />
}
