import type { Metadata } from "next"
import { Smartphone } from "lucide-react"
import { Logo } from "@/components/brand/logo"
import { SignOutButton } from "@/components/layout/sign-out-button"

export const metadata: Metadata = { title: "Get the driver app" }

export default function GetTheApp() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 px-4 text-center">
      <Logo />
      <div className="flex size-16 items-center justify-center rounded-2xl bg-secondary text-primary">
        <Smartphone className="size-8" />
      </div>
      <div className="max-w-sm space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Drivers use the Android app</h1>
        <p className="text-sm text-muted-foreground">
          Live navigation and location sharing need your phone. Install the Plate-Link APK and log in with this
          same account.
        </p>
      </div>
      <SignOutButton variant="outline" />
    </div>
  )
}
