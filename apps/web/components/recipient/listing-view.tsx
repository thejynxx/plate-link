"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useForm, useWatch } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import {
  ArrowLeft,
  Building2,
  ExternalLink,
  ImageOff,
  Info,
  MapPin,
  MessagesSquare,
  Soup,
} from "lucide-react"
import { toast } from "sonner"
import { Marker } from "react-map-gl/maplibre"
import {
  DEFAULT_CENTER,
  claimListingSchema,
  formatDistance,
  haversineMeters,
  navigationUrl,
  type ClaimListingInput,
  type LatLng,
} from "@platelink/shared"
import { createClient } from "@/lib/supabase/client"
import { fetchListing, recipientKeys } from "@/lib/queries/recipient"
import { openListingChat } from "@/lib/queries/chat"
import { useRealtimeInvalidate } from "@/hooks/use-realtime-invalidate"
import { useRecipientLocation } from "@/hooks/use-recipient-location"
import { BaseMap } from "@/components/maps/base-map"
import { Pin } from "@/components/maps/pin"
import { LocationPicker, type PickedLocation } from "@/components/maps/location-picker"
import { ExpiryCountdown } from "@/components/listings/expiry"
import { FoodTypeMark } from "@/components/listings/food-type-dot"
import { ListingStatusBadge } from "@/components/listings/status-badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
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
import { Textarea } from "@/components/ui/textarea"
import { errorMessage } from "@/lib/utils"

export function ListingView({ id }: { id: string }) {
  const router = useRouter()
  const supabase = createClient()
  const queryClient = useQueryClient()
  const { point: recipientPoint, label: recipientLabel } = useRecipientLocation()

  const [claimOpen, setClaimOpen] = useState(false)

  // Realtime: invalidate when this listing changes status or is claimed
  useRealtimeInvalidate(
    `listing-${id}`,
    [{ table: "food_listings", filter: `id=eq.${id}` }],
    [recipientKeys.listing(id)]
  )

  const {
    data: listing,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: recipientKeys.listing(id),
    queryFn: () => fetchListing(supabase, id),
  })

  // Chat mutation
  const chatMutation = useMutation({
    mutationFn: () => openListingChat(supabase, id),
    onSuccess: (conversationId) => {
      router.push(`/app/messages/${conversationId}`)
    },
    onError: (e) => {
      toast.error(
        errorMessage(e).includes("open_listing_chat")
          ? "Chat isn't set up yet. Run supabase/migrations/0002_chat.sql in Supabase."
          : errorMessage(e, "Couldn't open chat with canteen")
      )
    },
  })

  // Claim mutation
  const claimMutation = useMutation({
    mutationFn: async (values: ClaimListingInput) => {
      const { data, error: rpcError } = await supabase.rpc("claim_listing", {
        p_listing_id: id,
        p_dropoff_address: values.dropoff_address,
        p_dropoff_lat: values.dropoff_lat,
        p_dropoff_lng: values.dropoff_lng,
        p_notes: values.notes?.trim() || undefined,
      })
      if (rpcError) throw rpcError
      return data
    },
    onSuccess: (order) => {
      toast.success("Claimed! A driver will be assigned soon")
      queryClient.invalidateQueries({ queryKey: recipientKeys.all })
      queryClient.invalidateQueries({ queryKey: ["home"] })
      setClaimOpen(false)
      if (order?.id) {
        router.push(`/app/orders/${order.id}`)
      }
    },
    onError: (err: unknown) => {
      const e = err as { code?: string; message?: string }
      const code = e?.code ?? ""
      const msg = e?.message ?? ""
      if (code === "P0001" || msg.includes("P0001") || msg.toLowerCase().includes("no longer available")) {
        toast.error("Someone just claimed this")
      } else if (code === "42501" || msg.includes("42501") || msg.toLowerCase().includes("only recipients")) {
        toast.error("Only NGO accounts can claim food")
      } else {
        toast.error("Couldn't claim right now, try again")
      }
    },
  })

  // Claim form
  const form = useForm<ClaimListingInput>({
    resolver: zodResolver(claimListingSchema),
    defaultValues: {
      dropoff_address: recipientLabel || "",
      dropoff_lat: recipientPoint?.lat ?? DEFAULT_CENTER.lat,
      dropoff_lng: recipientPoint?.lng ?? DEFAULT_CENTER.lng,
      notes: "",
    },
  })

  const dropoffLat = useWatch({ control: form.control, name: "dropoff_lat" })
  const dropoffLng = useWatch({ control: form.control, name: "dropoff_lng" })
  const dropoffAddress = useWatch({ control: form.control, name: "dropoff_address" })
  const notesValue = useWatch({ control: form.control, name: "notes" })

  // Sync recipient location into form when dialog opens
  useEffect(() => {
    if (claimOpen && recipientPoint) {
      if (!form.getValues("dropoff_address") && recipientLabel) {
        form.setValue("dropoff_address", recipientLabel)
      }
      if (!form.getValues("dropoff_lat") && recipientPoint.lat) {
        form.setValue("dropoff_lat", recipientPoint.lat)
      }
      if (!form.getValues("dropoff_lng") && recipientPoint.lng) {
        form.setValue("dropoff_lng", recipientPoint.lng)
      }
    }
  }, [claimOpen, recipientPoint, recipientLabel, form])

  const pickedLocation: PickedLocation | null = useMemo(() => {
    if (typeof dropoffLat === "number" && typeof dropoffLng === "number") {
      return {
        lat: dropoffLat,
        lng: dropoffLng,
        address: dropoffAddress || "",
      }
    }
    return null
  }, [dropoffLat, dropoffLng, dropoffAddress])

  function handleLocationPickerChange(loc: PickedLocation) {
    form.setValue("dropoff_lat", loc.lat, { shouldValidate: true })
    form.setValue("dropoff_lng", loc.lng, { shouldValidate: true })
    form.setValue("dropoff_address", loc.address, { shouldValidate: true })
  }

  if (isLoading) return <ListingDetailSkeleton />
  if (isError) return <ErrorState error={error} onRetry={() => refetch()} />
  if (!listing) {
    return (
      <div className="mx-auto max-w-lg py-12">
        <EmptyState
          icon={Soup}
          title="This food is no longer available"
          description="It may have already been claimed by another recipient or reached its expiry time."
          action={
            <Button asChild variant="secondary">
              <Link href="/app">Back to food near you</Link>
            </Button>
          }
        />
      </div>
    )
  }

  const isAvailable = listing.status === "available"
  const canteen = listing.canteens

  const canteenLat = Number(listing.location_lat ?? canteen?.location_lat)
  const canteenLng = Number(listing.location_lng ?? canteen?.location_lng)
  const hasValidCanteenCoords = Number.isFinite(canteenLat) && Number.isFinite(canteenLng)
  const canteenLatLng: LatLng = hasValidCanteenCoords
    ? { lat: canteenLat, lng: canteenLng }
    : DEFAULT_CENTER

  const distanceMeters =
    hasValidCanteenCoords &&
    Number.isFinite(Number(recipientPoint?.lat)) &&
    Number.isFinite(Number(recipientPoint?.lng))
      ? haversineMeters(recipientPoint, canteenLatLng)
      : null

  const googleMapsUrl = navigationUrl(canteenLatLng, recipientPoint)

  return (
    <div className="flex flex-col gap-6">
      {/* Back button */}
      <div>
        <Link
          href="/app"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          <span>Food near you</span>
        </Link>
      </div>

      {/* Main 2-column layout */}
      <div className="grid gap-6 lg:grid-cols-12">
        {/* Left column: food ticket & details */}
        <div className="space-y-6 lg:col-span-7">
          <article className="ticket overflow-hidden border border-border shadow-xs [filter:drop-shadow(0_1px_0_var(--border-strong))_drop-shadow(0_12px_18px_rgb(50_55_59/0.10))]">
            {/* Food photo */}
            <div className="relative aspect-[16/9] w-full overflow-hidden rounded-t-[14px] bg-muted">
              {listing.photo_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={listing.photo_url}
                  alt={listing.title}
                  className="size-full object-cover"
                />
              ) : (
                <div className="flex size-full items-center justify-center text-muted-foreground">
                  <ImageOff className="size-10" />
                </div>
              )}
              <div className="absolute top-3 right-3 flex items-center gap-2">
                <ListingStatusBadge status={listing.status} />
              </div>
            </div>

            {/* Ticket body */}
            <div className="space-y-4 p-5 sm:p-6">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 space-y-2">
                  <div className="flex flex-wrap items-center gap-2.5">
                    <FoodTypeMark type={listing.food_type} withLabel />
                    {isAvailable && <ExpiryCountdown expiresAt={listing.expires_at} />}
                  </div>
                  <h1 className="font-display text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                    {listing.title}
                  </h1>
                </div>

                <div className="shrink-0 text-right">
                  <p className="font-display text-3xl font-bold tabular-nums text-foreground sm:text-4xl">
                    {listing.quantity}
                  </p>
                  <p className="text-xs font-medium text-muted-foreground">portions</p>
                </div>
              </div>

              {listing.description && (
                <p className="text-sm leading-relaxed whitespace-pre-wrap text-muted-foreground">
                  {listing.description}
                </p>
              )}
            </div>

            {/* Ticket perforation divider and canteen info */}
            <div className="ticket-perf mx-5 space-y-3.5 py-4.5 text-xs sm:mx-6 sm:text-sm">
              <div className="flex items-start gap-2.5">
                <Building2 className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                <div className="min-w-0">
                  <p className="font-semibold text-foreground">
                    {canteen?.org_name ?? "Canteen"}
                  </p>
                  <p className="text-xs text-muted-foreground sm:text-sm">
                    {canteen?.address ?? "Address not provided"}
                  </p>
                </div>
              </div>

              {canteen?.pickup_instructions && (
                <div className="flex items-start gap-2.5 rounded-lg border border-border/60 bg-muted/50 p-3">
                  <Info className="mt-0.5 size-4 shrink-0 text-honey" />
                  <div className="min-w-0 text-xs sm:text-sm">
                    <p className="font-semibold text-foreground">Pickup instructions</p>
                    <p className="mt-0.5 text-muted-foreground">{canteen.pickup_instructions}</p>
                  </div>
                </div>
              )}
            </div>
          </article>
        </div>

        {/* Right column: Map, location info & actions */}
        <div className="space-y-5 lg:col-span-5">
          {/* Realtime flipped banner */}
          {!isAvailable && (
            <div className="flex items-center gap-2.5 rounded-xl border border-honey/40 bg-honey/15 p-4 text-sm font-medium text-foreground">
              <span className="size-2 shrink-0 animate-pulse rounded-full bg-honey" />
              <span>This was just claimed by someone else</span>
            </div>
          )}

          {/* Location map & distance card */}
          <Card className="overflow-hidden">
            <div className="h-64 w-full">
              <BaseMap
                className="size-full rounded-none border-0"
                initialViewState={{
                  longitude: canteenLatLng.lng,
                  latitude: canteenLatLng.lat,
                  zoom: 14,
                }}
              >
                {/* Canteen pin */}
                {hasValidCanteenCoords && (
                  <Marker
                    latitude={Number(canteenLatLng.lat)}
                    longitude={Number(canteenLatLng.lng)}
                    anchor="bottom"
                  >
                    <Pin tone="primary" />
                  </Marker>
                )}

                {/* Recipient current location marker ("you" dot) */}
                {recipientPoint &&
                  Number.isFinite(Number(recipientPoint.lat)) &&
                  Number.isFinite(Number(recipientPoint.lng)) && (
                    <Marker
                      latitude={Number(recipientPoint.lat)}
                      longitude={Number(recipientPoint.lng)}
                      anchor="center"
                    >
                      <div className="relative flex size-5 items-center justify-center" title="Your location">
                        <span className="absolute inline-flex size-full animate-ping rounded-full bg-honey opacity-60" />
                        <span className="relative inline-flex size-3.5 rounded-full border-2 border-white bg-primary shadow-xs" />
                      </div>
                    </Marker>
                  )}
              </BaseMap>
            </div>

            <CardContent className="space-y-3 pt-4 pb-4">
              <div className="flex items-center justify-between gap-3 text-sm">
                <div className="flex items-center gap-1.5 min-w-0">
                  <MapPin className="size-4 shrink-0 text-muted-foreground" />
                  <span className="truncate font-medium text-foreground">
                    {canteen?.address ?? "Canteen location"}
                  </span>
                </div>
                {distanceMeters !== null && (
                  <span className="shrink-0 font-display font-semibold text-foreground">
                    {formatDistance(distanceMeters)} away
                  </span>
                )}
              </div>

              <div className="border-t border-border pt-3">
                <a
                  href={googleMapsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-link hover:underline"
                >
                  <span>Open in Google Maps</span>
                  <ExternalLink className="size-3.5" />
                </a>
              </div>
            </CardContent>
          </Card>

          {/* Action buttons */}
          <div className="space-y-3">
            <Button
              className="w-full text-base font-semibold"
              size="lg"
              disabled={!isAvailable}
              onClick={() => setClaimOpen(true)}
            >
              Claim this food
            </Button>

            <Button
              variant="outline"
              className="w-full text-sm font-semibold"
              size="lg"
              loading={chatMutation.isPending}
              onClick={() => chatMutation.mutate()}
            >
              <MessagesSquare className="size-4" />
              <span>Ask the canteen</span>
            </Button>
          </div>
        </div>
      </div>

      {/* Claim Dialog */}
      <Dialog open={claimOpen} onOpenChange={setClaimOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Claim this food</DialogTitle>
            <DialogDescription>
              Confirm where a volunteer driver should deliver this food.
            </DialogDescription>
          </DialogHeader>

          {!isAvailable && (
            <div className="flex items-center gap-2.5 rounded-xl border border-honey/40 bg-honey/15 p-3.5 text-xs font-medium text-foreground">
              <span className="size-2 shrink-0 animate-pulse rounded-full bg-honey" />
              <span>This was just claimed by someone else.</span>
            </div>
          )}

          <form
            onSubmit={form.handleSubmit((values) => claimMutation.mutate(values))}
            className="space-y-4"
          >
            {/* Drop-off location picker */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">
                Drop-off address & pin <span className="text-destructive">*</span>
              </label>
              <LocationPicker
                value={pickedLocation}
                onChange={handleLocationPickerChange}
              />
              {form.formState.errors.dropoff_address && (
                <p className="text-xs text-destructive">
                  {form.formState.errors.dropoff_address.message}
                </p>
              )}
            </div>

            {/* Notes textarea with counter */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label htmlFor="notes" className="text-xs font-semibold text-foreground">
                  Delivery notes <span className="font-normal text-muted-foreground">(optional)</span>
                </label>
                <span className="text-xs tabular-nums text-muted-foreground">
                  {notesValue?.length ?? 0}/500
                </span>
              </div>
              <Textarea
                id="notes"
                {...form.register("notes")}
                placeholder="Drop-off gate, landmark, contact on-site..."
                maxLength={500}
                rows={3}
              />
              {form.formState.errors.notes && (
                <p className="text-xs text-destructive">
                  {form.formState.errors.notes.message}
                </p>
              )}
            </div>

            <DialogFooter className="pt-2">
              <DialogClose asChild>
                <Button type="button" variant="outline">
                  Cancel
                </Button>
              </DialogClose>
              <Button
                type="submit"
                disabled={!isAvailable}
                loading={claimMutation.isPending}
              >
                Confirm claim
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function ListingDetailSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <Skeleton className="h-5 w-32" />
      <div className="grid gap-6 lg:grid-cols-12">
        <div className="space-y-6 lg:col-span-7">
          <div className="ticket overflow-hidden border border-border">
            <Skeleton className="aspect-[16/9] w-full rounded-none" />
            <div className="space-y-4 p-5 sm:p-6">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-1/3" />
                  <Skeleton className="h-8 w-2/3" />
                </div>
                <Skeleton className="h-10 w-16" />
              </div>
              <Skeleton className="h-14 w-full" />
            </div>
            <div className="ticket-perf mx-5 space-y-3 py-4 sm:mx-6">
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-12 w-full" />
            </div>
          </div>
        </div>

        <div className="space-y-5 lg:col-span-5">
          <Card className="overflow-hidden">
            <Skeleton className="h-64 w-full rounded-none" />
            <CardContent className="space-y-3 pt-4 pb-4">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-1/3" />
            </CardContent>
          </Card>
          <div className="space-y-3">
            <Skeleton className="h-12 w-full rounded-xl" />
            <Skeleton className="h-12 w-full rounded-xl" />
          </div>
        </div>
      </div>
    </div>
  )
}
