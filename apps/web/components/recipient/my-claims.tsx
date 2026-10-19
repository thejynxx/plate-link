"use client"

import { useState } from "react"
import Link from "next/link"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { formatDistanceToNowStrict } from "date-fns"
import { Building2, ImageOff, MapPin, Package } from "lucide-react"
import { toast } from "sonner"
import { ORDER_STATUS_LABEL, type OrderStatus } from "@platelink/shared"
import { createClient } from "@/lib/supabase/client"
import { fetchMyOrders, recipientKeys, type MyClaimOrder } from "@/lib/queries/recipient"
import { useRealtimeInvalidate } from "@/hooks/use-realtime-invalidate"
import { useSession } from "@/components/layout/session-context"
import { PageHeader } from "@/components/layout/page-header"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { EmptyState } from "@/components/ui/empty-state"
import { ErrorState } from "@/components/ui/error-state"
import { Skeleton } from "@/components/ui/skeleton"

const ACTIVE_STATUSES: OrderStatus[] = ["pending_driver", "driver_assigned", "on_the_way"]
const PAST_STATUSES: OrderStatus[] = ["completed", "cancelled"]

const ORDER_STATUS_VARIANT: Record<OrderStatus, React.ComponentProps<typeof Badge>["variant"]> = {
  pending_driver: "honey",
  driver_assigned: "silk",
  on_the_way: "iron",
  completed: "gunmetal",
  cancelled: "destructive",
}

function OrderStatusBadge({ status }: { status: OrderStatus }) {
  return (
    <Badge variant={ORDER_STATUS_VARIANT[status]}>
      {status === "pending_driver" && <span className="size-1.5 animate-pulse rounded-full bg-current" />}
      {ORDER_STATUS_LABEL[status]}
    </Badge>
  )
}

export function MyClaims() {
  const { profile } = useSession()
  const userId = profile.id
  const supabase = createClient()
  const queryClient = useQueryClient()

  const [tab, setTab] = useState<"active" | "past">("active")
  const [orderToCancel, setOrderToCancel] = useState<MyClaimOrder | null>(null)

  // Realtime: invalidate on orders change for this user
  useRealtimeInvalidate(
    `recipient-orders-${userId}`,
    [{ table: "orders", filter: `user_id=eq.${userId}` }],
    [recipientKeys.orders(userId), ["home"]]
  )

  const {
    data: orders = [],
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: recipientKeys.orders(userId),
    queryFn: () => fetchMyOrders(supabase, userId),
    enabled: !!userId,
  })

  // Cancel order RPC mutation
  const cancelMutation = useMutation({
    mutationFn: async (orderId: string) => {
      const { data, error: rpcError } = await supabase.rpc("cancel_order", {
        p_order_id: orderId,
      })
      if (rpcError) throw rpcError
      return data
    },
    onSuccess: () => {
      toast.success("Claim cancelled")
      setOrderToCancel(null)
      queryClient.invalidateQueries({ queryKey: recipientKeys.orders(userId) })
      queryClient.invalidateQueries({ queryKey: ["home"] })
    },
    onError: (err: unknown) => {
      const e = err as { code?: string; message?: string }
      const code = e?.code ?? ""
      const msg = e?.message ?? ""
      if (code === "P0001" || msg.includes("P0001") || msg.toLowerCase().includes("after pickup")) {
        toast.error("Too late — the driver already picked it up")
      } else {
        toast.error("Couldn't cancel this claim, try again")
      }
    },
  })

  const activeOrders = orders.filter((o) => ACTIVE_STATUSES.includes(o.status))
  const pastOrders = orders.filter((o) => PAST_STATUSES.includes(o.status))
  const currentOrders = tab === "active" ? activeOrders : pastOrders

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="My claims"
        description="Track live food deliveries and view your past claims."
      />

      {/* Tabs as .chip radiogroup */}
      <div role="radiogroup" aria-label="Claims filter" className="flex items-center gap-2">
        <button
          type="button"
          role="radio"
          aria-checked={tab === "active"}
          onClick={() => setTab("active")}
          className="chip flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-semibold text-foreground select-none"
        >
          <span>Active</span>
          <span className="rounded-full bg-muted px-1.5 py-0.5 text-[11px] font-bold tabular-nums text-foreground">
            {activeOrders.length}
          </span>
        </button>
        <button
          type="button"
          role="radio"
          aria-checked={tab === "past"}
          onClick={() => setTab("past")}
          className="chip flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-semibold text-foreground select-none"
        >
          <span>Past</span>
          <span className="rounded-full bg-muted px-1.5 py-0.5 text-[11px] font-bold tabular-nums text-foreground">
            {pastOrders.length}
          </span>
        </button>
      </div>

      {/* Error state */}
      {isError && !isLoading && (
        <ErrorState error={error} onRetry={() => refetch()} />
      )}

      {/* Loading skeleton */}
      {isLoading ? (
        <div className="flex flex-col gap-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <ClaimRowSkeleton key={i} />
          ))}
        </div>
      ) : currentOrders.length === 0 ? (
        /* Empty states */
        tab === "active" ? (
          <EmptyState
            icon={Package}
            title="Nothing on the way"
            description="You don't have any active food deliveries right now."
            action={
              <Button asChild>
                <Link href="/app">Find food</Link>
              </Button>
            }
          />
        ) : (
          <EmptyState
            icon={Package}
            title="No past claims yet"
            description="Food you've claimed and received in the past will show up here."
          />
        )
      ) : (
        /* Orders list */
        <div className="flex flex-col gap-3">
          {currentOrders.map((order) => {
            const canCancel =
              order.status === "pending_driver" || order.status === "driver_assigned"

            return (
              <article
                key={order.id}
                className="ticket group relative overflow-hidden border border-border shadow-xs [filter:drop-shadow(0_1px_0_var(--border-strong))] transition-transform duration-200 hover:-translate-y-0.5"
              >
                <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                  {/* Clickable main order content */}
                  <Link
                    href={`/app/orders/${order.id}`}
                    className="flex min-w-0 flex-1 items-center gap-3.5 outline-offset-4"
                  >
                    {/* Thumbnail */}
                    <div className="size-16 shrink-0 overflow-hidden rounded-lg bg-muted sm:size-20">
                      {order.food_listings?.photo_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={order.food_listings.photo_url}
                          alt=""
                          className="size-full object-cover"
                          loading="lazy"
                        />
                      ) : (
                        <div className="flex size-full items-center justify-center text-muted-foreground">
                          <ImageOff className="size-6" />
                        </div>
                      )}
                    </div>

                    {/* Order details */}
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <OrderStatusBadge status={order.status} />
                        <span className="text-xs text-muted-foreground">
                          claimed {formatDistanceToNowStrict(new Date(order.created_at), { addSuffix: true })}
                        </span>
                      </div>

                      <h3 className="line-clamp-1 font-display text-base font-semibold text-foreground sm:text-lg">
                        {order.food_listings?.title ?? "Food"}
                      </h3>

                      <p className="flex items-center gap-1.5 truncate text-xs font-medium text-muted-foreground">
                        <Building2 className="size-3.5 shrink-0 text-muted-foreground" />
                        <span className="truncate">{order.canteens?.org_name ?? "Canteen"}</span>
                      </p>

                      <p className="flex items-center gap-1 truncate text-xs text-muted-foreground">
                        <MapPin className="size-3 shrink-0 text-muted-foreground" />
                        <span className="truncate">{order.dropoff_address}</span>
                      </p>
                    </div>
                  </Link>

                  {/* Portions & Cancel button */}
                  <div className="flex shrink-0 items-center justify-between gap-3 border-t border-border pt-2 sm:flex-col sm:items-end sm:justify-center sm:border-t-0 sm:pt-0">
                    <div className="text-left sm:text-right">
                      <span className="font-display text-2xl font-bold tabular-nums text-foreground sm:text-3xl">
                        {order.food_listings?.quantity ?? 0}
                      </span>
                      <span className="block text-[11px] text-muted-foreground">portions</span>
                    </div>

                    {canCancel && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.preventDefault()
                          e.stopPropagation()
                          setOrderToCancel(order)
                        }}
                        className="h-8 px-2.5 text-xs font-semibold text-destructive hover:bg-destructive/10 hover:text-destructive"
                      >
                        Cancel claim
                      </Button>
                    )}
                  </div>
                </div>
              </article>
            )
          })}
        </div>
      )}

      {/* Cancel claim confirmation dialog */}
      <Dialog open={!!orderToCancel} onOpenChange={(open) => !open && setOrderToCancel(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Cancel this claim?</DialogTitle>
            <DialogDescription>
              The food goes back on the board for others.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <DialogClose asChild>
              <Button type="button" variant="outline">
                Keep claim
              </Button>
            </DialogClose>
            <Button
              type="button"
              variant="destructive"
              loading={cancelMutation.isPending}
              onClick={() => {
                if (orderToCancel) {
                  cancelMutation.mutate(orderToCancel.id)
                }
              }}
            >
              Cancel claim
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function ClaimRowSkeleton() {
  return (
    <div className="ticket overflow-hidden border border-border p-4 shadow-xs [filter:drop-shadow(0_1px_0_var(--border-strong))]">
      <div className="flex items-center gap-3.5">
        <Skeleton className="size-16 shrink-0 rounded-lg sm:size-20" />
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex items-center gap-2">
            <Skeleton className="h-5 w-24 rounded-full" />
            <Skeleton className="h-3 w-20" />
          </div>
          <Skeleton className="h-5 w-3/4" />
          <Skeleton className="h-3 w-1/3" />
          <Skeleton className="h-3 w-1/2" />
        </div>
        <div className="hidden shrink-0 flex-col items-end gap-2 sm:flex">
          <Skeleton className="h-8 w-12" />
          <Skeleton className="h-7 w-20" />
        </div>
      </div>
    </div>
  )
}
