import Link from "next/link"
import { Bike, Building2, HandHeart } from "lucide-react"
import { PREP_MODEL_INFO } from "@platelink/shared/prep-model"
import { Logo } from "@/components/brand/logo"
import { ThemeToggle } from "@/components/theme-toggle"
import { Button } from "@/components/ui/button"
import { MiniTicket } from "@/components/brand/mini-ticket"
import { getProfile } from "@/lib/auth"
import { ROLE_HOME } from "@platelink/shared"

const m = PREP_MODEL_INFO.metrics

export default async function Home() {
  const profile = await getProfile().catch(() => null)

  return (
    <div className="relative min-h-screen overflow-hidden">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-4 py-5 sm:px-6">
        <Logo />
        <nav className="flex items-center gap-1 sm:gap-2">
          <ThemeToggle />
          {profile ? (
            <Button asChild>
              <Link href={ROLE_HOME[profile.role]}>Go to my home</Link>
            </Button>
          ) : (
            <>
              <Button variant="ghost" asChild>
                <Link href="/login">Log in</Link>
              </Button>
              <Button asChild className="hidden sm:inline-flex">
                <Link href="/register">Create account</Link>
              </Button>
            </>
          )}
        </nav>
      </header>

      <main>
        <section className="mx-auto grid max-w-6xl items-center gap-14 px-4 pt-10 pb-20 sm:px-6 lg:grid-cols-[1.1fr_1fr] lg:pt-16">
          <div>
            <h1 className="max-w-[13ch] text-[clamp(2.6rem,6.4vw,4.6rem)] leading-[0.98] font-extrabold tracking-[-0.035em]">
              Tonight&apos;s leftovers, on someone&apos;s plate by nine.
            </h1>
            <p className="mt-6 max-w-[46ch] text-lg text-muted-foreground">
              Canteens post surplus food in a minute. Nearby NGOs claim it, a volunteer driver picks it up, and everyone
              watches it move on the map until it&apos;s delivered.
            </p>
            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <Button size="lg" asChild>
                <Link href="/register">Register your canteen</Link>
              </Button>
              <Button size="lg" variant="outline" asChild>
                <Link href="/register">I&apos;m from an NGO</Link>
              </Button>
            </div>
          </div>

          {/* The one orchestrated moment: three tickets fan in, one per stage. */}
          <div className="relative mx-auto h-[440px] w-full max-w-[440px] sm:h-[450px]" aria-hidden>
            <MiniTicket
              className="land-ticket absolute top-0 left-0 rotate-[-6deg]"
              style={{ animationDelay: "0ms" }}
              title="Veg biryani"
              portions={40}
              status="Available"
              statusClass="bg-honey text-gunmetal"
              line="Good until 10:30 pm, 2 NGOs nearby"
            />
            <MiniTicket
              className="land-ticket absolute top-[128px] right-0 rotate-[3deg]"
              style={{ animationDelay: "140ms" }}
              title="Chapati & dal"
              portions={65}
              status="Claimed"
              statusClass="bg-silk text-[#8f2a36]"
              line="Claimed by Anbu Shelter, Tambaram"
            />
            <MiniTicket
              className="land-ticket absolute top-[262px] left-6 rotate-[-2deg]"
              style={{ animationDelay: "280ms" }}
              title="Curd rice"
              portions={30}
              status="Delivered"
              statusClass="bg-gunmetal text-silk"
              line="Delivered 8:42 pm by Karthik on a scooter"
            />
          </div>
        </section>

        <section className="bg-chrome text-chrome-foreground">
          <div className="mx-auto grid max-w-6xl gap-10 px-4 py-16 sm:px-6 md:grid-cols-3">
            {[
              {
                icon: Building2,
                title: "Canteens",
                body: "Snap a photo, set portions and a safe-until time. See who claimed it and when the driver arrives.",
              },
              {
                icon: HandHeart,
                title: "NGOs and shelters",
                body: "Browse food within a few kilometres, claim it in one tap, and chat with the canteen and driver.",
              },
              {
                icon: Bike,
                title: "Volunteer drivers",
                body: "Pick a nearby pickup on the Android app, navigate there, and mark it delivered with a photo.",
              },
            ].map(({ icon: Icon, title, body }) => (
              <div key={title} className="border-l-2 border-honey/70 pl-5">
                <Icon className="size-6 text-honey" />
                <h2 className="mt-4 text-xl font-semibold">{title}</h2>
                <p className="mt-2 max-w-[38ch] text-sm leading-relaxed text-chrome-muted">{body}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
          <div className="grid gap-10 lg:grid-cols-[1fr_1.2fr] lg:items-center">
            <h2 className="max-w-[16ch] text-[clamp(2rem,4vw,3rem)] leading-[1.02] font-bold tracking-[-0.03em]">
              The best surplus is the food you never over-cook.
            </h2>
            <div className="text-lg leading-relaxed text-muted-foreground">
              <p>
                The prep planner forecasts how many portions of each dish you&apos;ll actually sell, then tells you how many to
                cook for your price and food cost.
              </p>
              <p className="mt-4 text-base">
                Tested on <strong className="text-foreground">{m.test_rows.toLocaleString("en-IN")}</strong> real weekly
                kitchen orders, it cut leftovers by{" "}
                <strong className="text-foreground">{m.leftover_reduction_pct}%</strong> and raised the share of demand
                served from {m.fill_rate_naive_pct}% to <strong className="text-foreground">{m.fill_rate_model_pct}%</strong>,
                compared with cooking last week&apos;s numbers.
              </p>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-6 text-xs text-muted-foreground sm:flex-row sm:justify-between sm:px-6">
          <span>Plate-Link, a food surplus network</span>
          <span>Maps © OpenStreetMap contributors</span>
        </div>
      </footer>
    </div>
  )
}
