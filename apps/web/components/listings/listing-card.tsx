"use client"

import Link from "next/link"
import { format } from "date-fns"
import { ImageOff } from "lucide-react"
import type { Tables } from "@platelink/shared"
import { Skeleton } from "@/components/ui/skeleton"
import { ExpiryCountdown } from "@/components/listings/expiry"
import { FoodTypeMark } from "@/components/listings/food-type-dot"
import { ListingStatusBadge } from "@/components/listings/status-badge"

/** A listing printed as a kitchen order ticket (KOT). */
export function ListingCard({ listing }: { listing: Tables<"food_listings">; index?: number }) {
  return (
    <Link
      href={`/canteen/listings/${listing.id}`}
      className="group block rounded-[14px] outline-offset-4 transition-transform duration-200 hover:-translate-y-1 hover:rotate-[-0.4deg]"
    >
      <article className="ticket [filter:drop-shadow(0_1px_0_var(--border-strong))_drop-shadow(0_12px_18px_rgb(50_55_59/0.10))]">
        <div className="relative aspect-[16/9] overflow-hidden rounded-t-[14px] bg-muted">
          {listing.photo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={listing.photo_url} alt="" className="size-full object-cover" loading="lazy" />
          ) : (
            <div className="flex size-full items-center justify-center text-muted-foreground">
              <ImageOff className="size-6" />
            </div>
          )}
          <div className="absolute top-3 left-3">
            <ListingStatusBadge status={listing.status} />
          </div>
        </div>
        <div className="flex items-start justify-between gap-3 px-4 pt-3.5 pb-3">
          <div className="min-w-0">
            <h3 className="line-clamp-1 font-display text-[1.05rem] font-semibold">{listing.title}</h3>
            <p className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
              <FoodTypeMark type={listing.food_type} withLabel />
              <span>Posted {format(new Date(listing.created_at), "h:mm a")}</span>
            </p>
          </div>
          <div className="text-right">
            <p className="font-display text-3xl leading-none font-bold tabular-nums">{listing.quantity}</p>
            <p className="text-[11px] text-muted-foreground">portions</p>
          </div>
        </div>
        <div className="ticket-perf mx-4 flex items-center justify-between py-2.5 text-xs">
          {listing.status === "available" ? (
            <ExpiryCountdown expiresAt={listing.expires_at} />
          ) : (
            <span className="text-muted-foreground">Good until {format(new Date(listing.expires_at), "h:mm a")}</span>
          )}
          <span className="font-semibold text-link opacity-0 transition-opacity group-hover:opacity-100">Open</span>
        </div>
      </article>
    </Link>
  )
}

export function ListingCardSkeleton() {
  return (
    <div className="ticket [filter:drop-shadow(0_1px_0_var(--border-strong))]">
      <Skeleton className="aspect-[16/9] rounded-none rounded-t-[14px]" />
      <div className="flex justify-between gap-3 px-4 pt-3.5 pb-3">
        <div className="grid flex-1 gap-2">
          <Skeleton className="h-4 w-2/3" />
          <Skeleton className="h-3 w-1/3" />
        </div>
        <Skeleton className="h-8 w-10" />
      </div>
      <div className="ticket-perf mx-4 py-2.5">
        <Skeleton className="h-3 w-24" />
      </div>
    </div>
  )
}
