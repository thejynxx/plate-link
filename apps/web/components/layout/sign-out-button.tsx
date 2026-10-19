import { LogOut } from "lucide-react"
import { Button } from "@/components/ui/button"

export function SignOutButton({ variant = "ghost" }: { variant?: "ghost" | "outline" }) {
  return (
    <form action="/auth/signout" method="post">
      <Button type="submit" variant={variant}>
        <LogOut /> Sign out
      </Button>
    </form>
  )
}
