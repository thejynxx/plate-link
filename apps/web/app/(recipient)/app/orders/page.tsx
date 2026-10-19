import type { Metadata } from "next"
import { MyClaims } from "@/components/recipient/my-claims"

export const metadata: Metadata = { title: "My claims" }

export default function RecipientOrdersPage() {
  return <MyClaims />
}

