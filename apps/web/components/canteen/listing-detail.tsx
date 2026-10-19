"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { format } from "date-fns"
import { ArrowLeft, Ban, ImageOff, MapPin, MessagesSquare, Pencil, StickyNote, Utensils } from "lucide-react"
import { toast } from "sonner"
import { ORDER_STATUS_LABEL } from "@platelink/shared"
import { createClient } from "@/lib/supabase/client"
import { canteenKeys, fetchListingDetail } from "@/lib/queries/canteen"
import { openOrderChat } from "@/lib/queries/chat"
import { errorMessage } from "@/lib/utils"
import { useRealtimeInvalidate } from "@/hooks/use-realtime-invalidate"
import { ContactCard } from "@/components/orders/contact-card"
import { StatusTimeline, buildSteps } from "@/components/orders/status-timeline"
import { ExpiryCountdown } from "@/components/listings/expiry"
import { FoodTypeMark } from "@/components/listings/food-type-dot"
import { ListingStatusBadge } from "@/components/listings/status-badge"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { ErrorState } from "@/components/ui/error-state"
import { Skeleton } from "@/components/ui/skeleton"

export function ListingDetailView({ id }: { id: string }) {
  const supabase = createClient()
  const queryClient = useQueryClient()
  const [confirmOpen, setConfirmOpen] = useState(false)
  const router = useRouter()
  const chat = useMutation({
    mutationFn: (orderId: string) => openOrderChat(supabase, orderId),
    onSuccess: (conversationId) => router.push(`/canteen/messages/${conversationId}`),
    onError: (e) =>
      toast.error(
        errorMessage(e).includes("open_order_chat")
          ? "Chat isn't set up yet. Run supabase/migrations/0002_chat.sql in Supabase."
          : errorMessage(e, "Couldn't open the chat")
      ),
  })

  const q = useQuery({ queryKey: canteenKeys.listing(id), queryFn: () => fetchListingDetail(supabase, id) })

  useRealtimeInvalidate(
    `listing-${id}`,
    [
      { table: "food_listings", filter: `id=eq.${id}` },
      { table: "orders", filter: `listing_id=eq.${id}` },
    ],
    [canteenKeys.listing(id)]
  )

  const cancel = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("food_listings").update({ status: "cancelled" }).eq("id", id).select("id").single()
      if (error) throw error.code === "PGRST116" ? new Error("It was just claimed — it can no longer be cancelled") : error
    },
    onSuccess: () => {
      toast.success("Listing cancelled")
      setConfirmOpen(false)
      queryClient.invalidateQueries({ queryKey: canteenKeys.all })
    },
    onError: (e) => toast.error(errorMessage(e)),
  })

  if (q.isPending) return <DetailSkeleton />
  if (q.isError) return <ErrorState error={q.error} onRetry={() => q.refetch()} />

  const { listing, order, events, recipient, driver } = q.data
  const steps = buildSteps(listing, order, events)
  const editable = listing.status === "available"

  return (
    <div className="grid gap-6">
      <Link href="/canteen" className="inline-flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> Dashboard
      </Link>

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="grid content-start gap-6">
          <Card className="overflow-hidden">
            <div className="aspect-[16/8] bg-muted">
              {listing.photo_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={listing.photo_url} alt="" className="size-full object-cover" />
              ) : (
                <div className="flex size-full items-center justify-center text-muted-foreground">
                  <ImageOff className="size-8" />
                </div>
              )}
            </div>
            <CardContent className="grid gap-4 pt-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <ListingStatusBadge status={listing.status} />
                    {listing.status === "available" && <ExpiryCountdown expiresAt={listing.expires_at} />}
                  </div>
                  <h1 className="mt-3 text-[2rem] leading-tight font-bold tracking-tight">{listing.title}</h1>
                </div>
                {editable && (
                  <div className="flex gap-2">
                    <Button variant="outline" asChild>
                      <Link href={`/canteen/listings/${id}/edit`}>
                        <Pencil /> Edit
                      </Link>
                    </Button>
                    <Button variant="outline" className="text-destructive hover:text-destructive" onClick={() => setConfirmOpen(true)}>
                      <Ban /> Cancel
                    </Button>
                  </div>
                )}
              </div>
              <dl className="grid gap-3 text-sm sm:grid-cols-3">
                <div>
                  <dt className="text-muted-foreground">Portions</dt>
                  <dd className="mt-0.5 flex items-center gap-1.5 font-medium">
                    <Utensils className="size-4 text-primary" /> <span className="font-display text-lg">{listing.quantity}</span>
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Type</dt>
                  <dd className="mt-0.5 font-medium">
                    <FoodTypeMark type={listing.food_type} withLabel />
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Good until</dt>
                  <dd className="mt-0.5 font-medium">{format(new Date(listing.expires_at), "d MMM, h:mm a")}</dd>
                </div>
              </dl>
              {listing.description && (
                <p className="flex gap-2 rounded-lg bg-muted/60 p-3 text-sm">
                  <StickyNote className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                  {listing.description}
                </p>
              )}
            </CardContent>
          </Card>

          {order && order.status !== "cancelled" && (
            <Card>
              <CardHeader className="flex-row items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <CardTitle>Delivery</CardTitle>
                  <Badge variant="silk">{ORDER_STATUS_LABEL[order.status]}</Badge>
                </div>
                <Button size="sm" variant="dark" loading={chat.isPending} onClick={() => chat.mutate(order.id)}>
                  {!chat.isPending && <MessagesSquare />} Message
                </Button>
              </CardHeader>
              <CardContent className="grid gap-3">
                {recipient && <ContactCard role="Recipient" person={recipient} />}
                {driver ? (
                  <ContactCard role="Driver" person={driver} />
                ) : (
                  <p className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground">Looking for a driver…</p>
                )}
                <p className="flex items-start gap-2 text-sm text-muted-foreground">
                  <MapPin className="mt-0.5 size-4 shrink-0" /> Drop-off: {order.dropoff_address}
                </p>
              </CardContent>
            </Card>
          )}
        </div>

        <Card className="h-fit lg:sticky lg:top-24">
          <CardHeader>
            <CardTitle>Status</CardTitle>
          </CardHeader>
          <CardContent>
            <StatusTimeline steps={steps} />
          </CardContent>
        </Card>
      </div>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel this listing?</DialogTitle>
            <DialogDescription>NGOs will no longer see it. This can&apos;t be undone.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="ghost">Keep it</Button>
            </DialogClose>
            <Button variant="destructive" loading={cancel.isPending} onClick={() => cancel.mutate()}>
              Cancel listing
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function DetailSkeleton() {
  return (
    <div className="grid gap-6">
      <Skeleton className="h-4 w-24" />
      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <Card className="overflow-hidden">
          <Skeleton className="aspect-[16/8] rounded-none" />
          <div className="grid gap-3 p-5">
            <Skeleton className="h-5 w-24" />
            <Skeleton className="h-7 w-2/3" />
            <Skeleton className="h-12 w-full" />
          </div>
        </Card>
        <Card className="grid h-fit gap-5 p-5">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex gap-3">
              <Skeleton className="size-7 rounded-full" />
              <div className="grid flex-1 gap-1.5">
                <Skeleton className="h-3.5 w-28" />
                <Skeleton className="h-3 w-20" />
              </div>
            </div>
          ))}
        </Card>
      </div>
    </div>
  )
}
