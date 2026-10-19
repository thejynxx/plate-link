import Link from "next/link"
import { Button } from "@/components/ui/button"

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-4 text-center">
      <p className="text-sm font-medium text-primary">404</p>
      <h1 className="text-2xl font-semibold tracking-tight">That page isn&apos;t on the menu</h1>
      <Button asChild>
        <Link href="/dashboard">Go to my dashboard</Link>
      </Button>
    </div>
  )
}
