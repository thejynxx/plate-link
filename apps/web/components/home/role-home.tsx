"use client"

import Link from "next/link"
import { useQuery } from "@tanstack/react-query"
import { format } from "date-fns"
import { ChefHat, MessagesSquare, Package, PlusCircle, Soup, type LucideIcon } from "lucide-react"
import { ORDER_STATUS_LABEL, type ListingStatus, type OrderStatus } from "@platelink/shared"
import { createClient } from "@/lib/supabase/client"
import { canteenKeys, fetchStats } from "@/lib/queries/canteen"
import { fetchCanteenTickets, fetchRecipientTickets, homeKeys, type HomeTicket } from "@/lib/queries/home"
import { useRealtimeInvalidate } from "@/hooks/use-realtime-invalidate"
import { useInbox } from "@/hooks/use-unread"
import { useSession } from "@/components/layout/session-context"
import { TICKET_STATUS_CLASS, TicketStack, type MiniTicketProps } from "@/components/brand/mini-ticket"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"

type Tool = { href: string; icon: LucideIcon; title: string; body: string; badge?: number }

function greeting() {
  const h = new Date().getHours()
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening"
}

const time = (iso: string | null) => (iso ? format(new Date(iso), "h:mm a") : "")

const LISTING_LABEL: Record<ListingStatus, string> = {
  available: "Available",
  claimed: "Claimed",
  picked_up: "Picked up",
  delivered: "Delivered",
  expired: "Expired",
  cancelled: "Cancelled",
}

function orderClass(s: OrderStatus) {
  return s === "completed"
    ? TICKET_STATUS_CLASS.delivered
    : s === "on_the_way"
      ? TICKET_STATUS_CLASS.picked_up
      : s === "cancelled"
        ? TICKET_STATUS_CLASS.cancelled
        : TICKET_STATUS_CLASS.claimed
}

function toTicket(t: HomeTicket, linkBase: string): MiniTicketProps {
  if (t.kind === "listing") {
    const s = t.status as ListingStatus
    const line =
      s === "available"
        ? `Good until ${time(t.expiresAt)}`
        : s === "claimed"
          ? "Claimed, waiting for a driver"
          : s === "picked_up"
            ? "Picked up, on its way to the NGO"
            : s === "delivered"
              ? `Delivered ${time(t.at)}`
              : s === "expired"
                ? `Expired at ${time(t.expiresAt)}`
                : "Cancelled"
    return { title: t.title, portions: t.portions, status: LISTING_LABEL[s], statusClass: TICKET_STATUS_CLASS[s], line, headerLeft: t.canteen, headerRight: t.place, href: `${linkBase}/${t.id}` }
  }
  if (t.kind === "order") {
    const s = t.status as OrderStatus
    return {
      title: t.title,
      portions: t.portions,
      status: ORDER_STATUS_LABEL[s],
      statusClass: orderClass(s),
      line: s === "completed" ? `Delivered ${time(t.at)}` : `Claimed ${time(t.at)} from ${t.canteen}`,
      headerLeft: t.canteen,
      headerRight: t.place,
      href: linkBase,
    }
  }
  return {
    title: t.title,
    portions: t.portions,
    status: "Available nearby",
    statusClass: TICKET_STATUS_CLASS.available,
    line: `Good until ${time(t.expiresAt)}`,
    headerLeft: t.canteen,
    headerRight: t.place,
    href: "/app",
  }
}

const CANTEEN_EXAMPLES: MiniTicketProps[] = [
  { title: "Veg biryani", portions: 40, status: "Available", statusClass: TICKET_STATUS_CLASS.available, line: "Example: what a live listing looks like", muted: true },
  { title: "Chapati & dal", portions: 65, status: "Claimed", statusClass: TICKET_STATUS_CLASS.claimed, line: "Example: an NGO claimed it", muted: true },
  { title: "Curd rice", portions: 30, status: "Delivered", statusClass: TICKET_STATUS_CLASS.delivered, line: "Example: delivered by a volunteer", muted: true },
]
const NGO_EXAMPLES: MiniTicketProps[] = [
  { title: "Veg biryani", portions: 40, status: "Available nearby", statusClass: TICKET_STATUS_CLASS.available, line: "Example: food near you", muted: true },
  { title: "Chapati & dal", portions: 65, status: "Driver assigned", statusClass: TICKET_STATUS_CLASS.claimed, line: "Example: a driver is collecting it", muted: true },
  { title: "Curd rice", portions: 30, status: "Delivered", statusClass: TICKET_STATUS_CLASS.delivered, line: "Example: delivered to you", muted: true },
]

function ToolBand({ tools }: { tools: Tool[] }) {
  return (
    <section className="mt-4 overflow-hidden rounded-3xl bg-chrome text-chrome-foreground">
      <div className="grid gap-2 p-4 sm:p-6 md:grid-cols-3 md:gap-0 md:p-8">
        {tools.map(({ href, icon: Icon, title, body, badge }) => (
          <Link
            key={href}
            href={href}
            className="group relative rounded-r-xl border-l-2 border-honey/70 px-5 py-5 transition-colors hover:bg-white/5 md:mx-2"
          >
            <span className="flex items-center gap-3">
              <Icon className="size-6 text-honey transition-transform group-hover:-translate-y-0.5" />
              {!!badge && <span className="rounded-full bg-primary px-2 py-0.5 text-xs font-bold text-white tabular-nums">{badge} new</span>}
            </span>
            <h2 className="mt-4 text-xl font-semibold">{title}</h2>
            <p className="mt-2 max-w-[38ch] text-sm leading-relaxed text-chrome-muted">{body}</p>
          </Link>
        ))}
      </div>
    </section>
  )
}

export function RoleHome() {
  const { profile, canteen } = useSession()
  const supabase = createClient()
  const isCanteen = profile.role === "canteen"
  const { unread } = useInbox(profile.id)
  const place = (canteen?.address ?? "").split(",")[0] ?? ""

  const tickets = useQuery({
    queryKey: isCanteen ? homeKeys.canteen(profile.id) : homeKeys.recipient(profile.id),
    queryFn: () =>
      isCanteen
        ? fetchCanteenTickets(supabase, profile.id, canteen?.org_name ?? profile.name, place)
        : fetchRecipientTickets(supabase, profile.id),
  })
  const stats = useQuery({ queryKey: canteenKeys.stats(), queryFn: () => fetchStats(supabase), enabled: isCanteen })

  useRealtimeInvalidate(
    `home-${profile.id}`,
    isCanteen
      ? [{ table: "food_listings", filter: `canteen_id=eq.${profile.id}` }, { table: "orders", filter: `canteen_id=eq.${profile.id}` }]
      : [{ table: "orders", filter: `user_id=eq.${profile.id}` }],
    [["home"], canteenKeys.stats()]
  )

  const first = profile.name.split(" ")[0]
  const realTickets = (tickets.data ?? []).map((t) => toTicket(t, isCanteen ? "/canteen/listings" : "/app/orders"))
  const shown = realTickets.length ? realTickets : isCanteen ? CANTEEN_EXAMPLES : NGO_EXAMPLES

  const tools: Tool[] = isCanteen
    ? [
        { href: "/canteen/listings/new", icon: PlusCircle, title: "Post surplus", body: "Snap a photo, set portions and a safe-until time. NGOs nearby see it straight away." },
        { href: "/canteen/planner", icon: ChefHat, title: "Prep planner", body: "Know how many portions to cook before service, so less is left over." },
        { href: "/canteen/messages", icon: MessagesSquare, title: "Messages", body: "Talk to the NGO and the driver for every pickup.", badge: unread },
      ]
    : [
        { href: "/app", icon: Soup, title: "Find food", body: "Browse surplus from canteens within a few kilometres and claim it in one tap." },
        { href: "/app/orders", icon: Package, title: "My claims", body: "See what you've claimed and where the driver is right now." },
        { href: "/app/messages", icon: MessagesSquare, title: "Messages", body: "Chat with the canteen and driver about each pickup.", badge: unread },
      ]

  const summary = isCanteen
    ? stats.data
      ? stats.data.active > 0
        ? `${stats.data.active} ${stats.data.active === 1 ? "listing is" : "listings are"} live right now, and ${stats.data.portions.toLocaleString("en-IN")} portions have reached people so far.`
        : stats.data.portions > 0
          ? `Nothing is listed right now. ${stats.data.portions.toLocaleString("en-IN")} portions from your kitchen have reached people so far.`
          : "Post your first surplus after service and nearby NGOs will see it straight away."
      : " "
    : "Claim surplus from canteens around you and follow it all the way to your door."

  return (
    <div className="-mt-6 sm:-mt-9">
      <section className="grid items-center gap-12 pt-8 pb-14 lg:grid-cols-[1.1fr_1fr] lg:pt-12">
        <div>
          <p className="text-lg text-muted-foreground">
            {greeting()}, {first}
          </p>
          <h1 className="mt-3 max-w-[13ch] text-[clamp(2.4rem,5.6vw,4.2rem)] leading-[0.98] font-extrabold tracking-[-0.035em]">
            {isCanteen ? "Tonight’s leftovers, on someone’s plate by nine." : "Good food nearby, ready for your people."}
          </h1>
          <p className="mt-6 max-w-[46ch] text-lg text-muted-foreground">{summary}</p>
          <div className="mt-9 flex flex-col gap-3 sm:flex-row">
            {isCanteen ? (
              <>
                <Button size="lg" asChild>
                  <Link href="/canteen/listings/new">Post surplus</Link>
                </Button>
                <Button size="lg" variant="outline" asChild>
                  <Link href="/canteen/planner">Plan tomorrow&apos;s cooking</Link>
                </Button>
              </>
            ) : (
              <>
                <Button size="lg" asChild>
                  <Link href="/app">Find food</Link>
                </Button>
                <Button size="lg" variant="outline" asChild>
                  <Link href="/app/orders">My claims</Link>
                </Button>
              </>
            )}
          </div>
        </div>

        <div>
          {tickets.isPending ? (
            <div className="relative mx-auto h-[440px] w-full max-w-[440px]">
              <Skeleton className="absolute top-0 left-0 h-40 w-[min(320px,78vw)] rotate-[-6deg] rounded-2xl" />
              <Skeleton className="absolute top-[128px] right-0 h-40 w-[min(320px,78vw)] rotate-[3deg] rounded-2xl" />
              <Skeleton className="absolute top-[262px] left-6 h-40 w-[min(320px,78vw)] rotate-[-2deg] rounded-2xl" />
            </div>
          ) : (
            <>
              <TicketStack tickets={shown} />
              {!realTickets.length && (
                <p className="mt-2 text-center text-sm text-muted-foreground">
                  {isCanteen ? "Your latest listings will show here." : "Your claims and food nearby will show here."}
                </p>
              )}
              {tickets.isError && (
                <p className="mt-2 text-center text-sm text-destructive">Couldn&apos;t load your latest activity. Refresh to try again.</p>
              )}
            </>
          )}
        </div>
      </section>

      <ToolBand tools={tools} />
    </div>
  )
}
