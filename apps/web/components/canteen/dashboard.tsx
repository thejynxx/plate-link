"use client"

import Link from "next/link"
import { useQuery } from "@tanstack/react-query"
import { ChefHat, Plus, Soup } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { canteenKeys, fetchActiveListings, fetchStats } from "@/lib/queries/canteen"
import { useRealtimeInvalidate } from "@/hooks/use-realtime-invalidate"
import { useSession } from "@/components/layout/session-context"
import { PageHeader } from "@/components/layout/page-header"
import { StatBoard, StatBoardSkeleton } from "@/components/dashboard/stat-card"
import { ListingCard, ListingCardSkeleton } from "@/components/listings/listing-card"
import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/ui/empty-state"
import { ErrorState } from "@/components/ui/error-state"

function greeting() {
  const h = new Date().getHours()
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening"
}

export function CanteenDashboard() {
  const { profile, canteen } = useSession()
  const supabase = createClient()

  const stats = useQuery({ queryKey: canteenKeys.stats(), queryFn: () => fetchStats(supabase) })
  const active = useQuery({ queryKey: canteenKeys.active(), queryFn: () => fetchActiveListings(supabase, profile.id) })

  useRealtimeInvalidate(
    `canteen-dashboard-${profile.id}`,
    [
      { table: "food_listings", filter: `canteen_id=eq.${profile.id}` },
      { table: "orders", filter: `canteen_id=eq.${profile.id}` },
    ],
    [canteenKeys.all]
  )

  return (
    <>
      <PageHeader
        title={`${greeting()}, ${profile.name.split(" ")[0]}`}
        description={canteen?.org_name}
        actions={
          <>
            <Button variant="outline" asChild className="hidden sm:inline-flex">
              <Link href="/canteen/planner">
                <ChefHat /> Plan tomorrow
              </Link>
            </Button>
            <Button asChild>
              <Link href="/canteen/listings/new">
                <Plus /> Post surplus
              </Link>
            </Button>
          </>
        }
      />

      <section aria-label="Your impact">
        {stats.isPending ? (
          <StatBoardSkeleton />
        ) : stats.isError ? (
          <ErrorState error={stats.error} onRetry={() => stats.refetch()} />
        ) : (
          <StatBoard
            stats={[
              { label: "Live listings", value: stats.data.active },
              { label: "Portions donated", value: stats.data.portions, hint: "Counted once delivered" },
              { label: "Deliveries", value: stats.data.delivered },
              { label: "Listings posted", value: stats.data.total },
            ]}
          />
        )}
      </section>

      <section aria-labelledby="active-heading" className="mt-12">
        <div className="mb-5 flex items-baseline justify-between">
          <h2 id="active-heading" className="text-2xl font-bold tracking-tight">
            On the pass
          </h2>
          <Link href="/canteen/history" className="text-sm font-semibold text-link hover:underline">
            View history
          </Link>
        </div>

        {active.isPending ? (
          <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <ListingCardSkeleton key={i} />
            ))}
          </div>
        ) : active.isError ? (
          <ErrorState error={active.error} onRetry={() => active.refetch()} />
        ) : active.data.length === 0 ? (
          <EmptyState
            icon={Soup}
            title="Nothing on the pass"
            description="Food left after service? Post it and NGOs nearby see it straight away."
            action={
              <Button asChild>
                <Link href="/canteen/listings/new">
                  <Plus /> Post surplus food
                </Link>
              </Button>
            }
          />
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
            {active.data.map((l) => (
              <ListingCard key={l.id} listing={l} />
            ))}
          </div>
        )}
      </section>
    </>
  )
}
