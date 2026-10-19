import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { getCanteen, requireRole } from "@/lib/auth"
import { Logo } from "@/components/brand/logo"
import { ThemeToggle } from "@/components/theme-toggle"
import { OnboardingForm } from "@/components/canteen/onboarding-form"
import { SignOutButton } from "@/components/layout/sign-out-button"

export const metadata: Metadata = { title: "Set up your canteen" }

export default async function OnboardingPage() {
  const profile = await requireRole("canteen")
  if (await getCanteen(profile.id)) redirect("/canteen/home")

  return (
    <div className="min-h-screen">
      <header className="flex items-center justify-between px-4 py-5 sm:px-6">
        <Logo href="/onboarding" />
        <div className="flex items-center gap-1">
          <ThemeToggle />
          <SignOutButton />
        </div>
      </header>
      <main className="mx-auto max-w-2xl px-4 pb-16">
        <div className="mb-6">
          <p className="text-sm font-medium text-primary">Step 1 of 1</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">Where should drivers pick up?</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Hi {profile.name.split(" ")[0]} — tell us about your canteen. Every listing you post uses this location.
          </p>
        </div>
        <OnboardingForm userId={profile.id} />
      </main>
    </div>
  )
}
