import type { Metadata } from "next"
import { RoleHome } from "@/components/home/role-home"

export const metadata: Metadata = { title: "Home" }

export default function RecipientHomePage() {
  return <RoleHome />
}
