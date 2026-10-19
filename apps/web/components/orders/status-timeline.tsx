"use client"

import { format } from "date-fns"
import { Check, Circle, XCircle } from "lucide-react"
import type { Tables } from "@platelink/shared"
import { cn } from "@/lib/utils"

type Step = { key: string; label: string; at: string | null; state: "done" | "current" | "upcoming" | "cancelled" }

/** Posted → Claimed → Driver assigned → Picked up → Delivered, from the order + its events. */
export function buildSteps(listing: Tables<"food_listings">, order: Tables<"orders"> | null, events: Tables<"order_events">[]): Step[] {
  const at = (to: string) => events.findLast((e) => e.to_status === to)?.created_at ?? null
  const cancelled = order?.status === "cancelled"

  const raw = [
    { key: "posted", label: "Posted", at: listing.created_at },
    { key: "claimed", label: "Claimed by NGO", at: order ? order.created_at : null },
    { key: "assigned", label: "Driver assigned", at: order?.accepted_at ?? at("driver_assigned") },
    { key: "picked", label: "Picked up", at: order?.picked_up_at ?? at("on_the_way") },
    { key: "delivered", label: "Delivered", at: order?.delivered_at ?? at("completed") },
  ]

  const lastDone = raw.reduce((idx, s, i) => (s.at ? i : idx), 0)
  const steps: Step[] = raw.map((s, i) => ({
    ...s,
    state: i <= lastDone ? "done" : i === lastDone + 1 && !cancelled && listing.status !== "expired" && listing.status !== "cancelled" ? "current" : "upcoming",
  }))

  if (cancelled) steps.splice(lastDone + 1, 0, { key: "cancelled", label: "Claim cancelled", at: order?.cancelled_at ?? null, state: "cancelled" })
  if (listing.status === "expired") steps.splice(lastDone + 1, steps.length, { key: "expired", label: "Expired", at: listing.expires_at, state: "cancelled" })
  if (listing.status === "cancelled") steps.splice(lastDone + 1, steps.length, { key: "lcancel", label: "Listing cancelled", at: listing.updated_at, state: "cancelled" })
  return steps
}

export function StatusTimeline({ steps }: { steps: Step[] }) {
  return (
    <ol className="relative grid gap-0">
      {steps.map((s, i) => (
        <li key={s.key} className="relative flex gap-3 pb-6 last:pb-0">
          {i < steps.length - 1 && (
            <span aria-hidden className={cn("absolute top-7 left-[13px] h-[calc(100%-1.75rem)] w-0.5", s.state === "done" ? "bg-primary" : "bg-border")} />
          )}
          <span
            className={cn(
              "relative z-10 flex size-7 shrink-0 items-center justify-center rounded-full border-2",
              s.state === "done" && "border-primary bg-primary text-primary-foreground",
              s.state === "current" && "border-primary bg-background text-primary",
              s.state === "upcoming" && "border-border bg-background text-muted-foreground",
              s.state === "cancelled" && "border-destructive bg-destructive/10 text-destructive"
            )}
          >
            {s.state === "done" ? (
              <Check className="size-4" />
            ) : s.state === "cancelled" ? (
              <XCircle className="size-4" />
            ) : (
              <Circle className={cn("size-2.5 fill-current", s.state === "current" && "animate-pulse")} />
            )}
          </span>
          <div className="pt-0.5">
            <p className={cn("text-sm font-medium", s.state === "upcoming" && "text-muted-foreground")}>{s.label}</p>
            <p className="text-xs text-muted-foreground">
              {s.at ? format(new Date(s.at), "d MMM, h:mm a") : s.state === "current" ? "Waiting…" : "—"}
            </p>
          </div>
        </li>
      ))}
    </ol>
  )
}
