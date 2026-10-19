"use client"

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { format } from "date-fns"
import { motion, useReducedMotion } from "framer-motion"
import {
  AlertTriangle,
  ArrowLeft,
  Bike,
  Car,
  Clock,
  MapPin,
  MessageSquare,
  Package,
  Phone,
  Store,
  XCircle,
} from "lucide-react"
import { toast } from "sonner"
import {
  DEFAULT_CENTER,
  haversineMeters,
  ORDER_STATUS_LABEL,
  palette,
  type LatLng,
  type OrderStatus,
} from "@platelink/shared"
import { Layer, Marker, Source, type MapRef } from "react-map-gl/maplibre"
import { createClient } from "@/lib/supabase/client"
import {
  fetchOrderTracking,
  recipientKeys,
  type DriverLocation,
} from "@/lib/queries/recipient"
import { openOrderChat } from "@/lib/queries/chat"
import { fetchRoute } from "@/lib/routes"
import { useNow } from "@/hooks/use-now"
import { useRealtimeInvalidate } from "@/hooks/use-realtime-invalidate"
import { BaseMap } from "@/components/maps/base-map"
import { Pin } from "@/components/maps/pin"
import { buildSteps, StatusTimeline } from "@/components/orders/status-timeline"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
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

export function OrderTracking({ id }: { id: string }) {
  const router = useRouter()
  const supabase = createClient()
  const queryClient = useQueryClient()
  const instanceId = useId()
  const mapRef = useRef<MapRef | null>(null)
  const hasFittedBoundsRef = useRef(false)
  const [mapLoaded, setMapLoaded] = useState(false)
  const [isCancelOpen, setIsCancelOpen] = useState(false)
  const [isOpeningChat, setIsOpeningChat] = useState(false)
  const prefersReducedMotion = useReducedMotion()

  // Realtime order invalidation on orders & order_events
  useRealtimeInvalidate(
    `order-tracking-${id}`,
    [
      { table: "orders", filter: `id=eq.${id}` },
      { table: "order_events", filter: `order_id=eq.${id}` },
    ],
    [recipientKeys.order(id), recipientKeys.orders(), ["home"]]
  )

  // Fetch full tracking order payload
  const {
    data: order,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: recipientKeys.order(id),
    queryFn: () => fetchOrderTracking(supabase, id),
    enabled: !!id,
  })

  // Live driver location: override initial location when realtime pings
  const [liveDriverLocation, setLiveDriverLocation] = useState<DriverLocation | null>(null)
  const driverLocation = liveDriverLocation ?? order?.driver_location ?? null

  const driverId = order?.driver_id

  // Dedicated realtime channel for driver_locations pinging directly into state
  useEffect(() => {
    if (!driverId) return
    const channel = supabase.channel(`driver-loc-${driverId}:${instanceId}`)
    channel
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "driver_locations",
          filter: `driver_id=eq.${driverId}`,
        },
        (payload) => {
          const next = payload.new as DriverLocation | undefined
          if (next && typeof next.current_lat === "number" && typeof next.current_lng === "number") {
            setLiveDriverLocation(next)
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [driverId, instanceId, supabase])

  // Animated driver coordinates with 1s RAF lerp
  const [animatedPos, setAnimatedPos] = useState<{ lat: number; lng: number } | null>(null)
  const currentPosRef = useRef<{ lat: number; lng: number } | null>(null)
  const rafIdRef = useRef<number | null>(null)

  useEffect(() => {
    currentPosRef.current = animatedPos
  }, [animatedPos])

  useEffect(() => {
    if (
      !driverLocation ||
      !Number.isFinite(driverLocation.current_lat) ||
      !Number.isFinite(driverLocation.current_lng)
    ) {
      return
    }

    const target = { lat: driverLocation.current_lat, lng: driverLocation.current_lng }

    if (!currentPosRef.current || prefersReducedMotion) {
      if (rafIdRef.current) {
        cancelAnimationFrame(rafIdRef.current)
        rafIdRef.current = null
      }
      setAnimatedPos(target)
      currentPosRef.current = target
      return
    }

    if (rafIdRef.current) {
      cancelAnimationFrame(rafIdRef.current)
    }

    const start = { ...currentPosRef.current }
    const startTime = performance.now()
    const duration = 1000

    const step = (now: number) => {
      const elapsed = now - startTime
      const progress = Math.min(1, elapsed / duration)
      // Smooth ease-out quad
      const eased = 1 - (1 - progress) * (1 - progress)
      const lat = start.lat + (target.lat - start.lat) * eased
      const lng = start.lng + (target.lng - start.lng) * eased

      const current = { lat, lng }
      currentPosRef.current = current
      setAnimatedPos(current)

      if (progress < 1) {
        rafIdRef.current = requestAnimationFrame(step)
      } else {
        rafIdRef.current = null
      }
    }

    rafIdRef.current = requestAnimationFrame(step)

    return () => {
      if (rafIdRef.current) {
        cancelAnimationFrame(rafIdRef.current)
        rafIdRef.current = null
      }
    }
  }, [driverLocation, prefersReducedMotion])

  // Runtime CSS variable `--primary` reading for GeoJSON line
  const [primaryColor, setPrimaryColor] = useState<string>(palette.blushedBrick)
  useEffect(() => {
    const update = () => {
      if (typeof window === "undefined") return
      const col = getComputedStyle(document.documentElement).getPropertyValue("--primary").trim()
      if (col) setPrimaryColor(col)
    }
    update()
    const observer = new MutationObserver(update)
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] })
    return () => observer.disconnect()
  }, [])

  // Route state & throttled routing
  const [routeState, setRouteState] = useState<{
    coordinates: [number, number][]
    durationS: number | null
    distanceM: number | null
    isFallback: boolean
  } | null>(null)

  const lastRouteRequestRef = useRef<{
    timestamp: number
    driverPos?: LatLng
    status: OrderStatus
  } | null>(null)

  const canteen = order?.canteens

  const orderStatus = order?.status
  const canteenLat = canteen?.location_lat
  const canteenLng = canteen?.location_lng
  const dropoffLat = order?.dropoff_lat
  const dropoffLng = order?.dropoff_lng
  const driverLat = driverLocation?.current_lat
  const driverLng = driverLocation?.current_lng

  useEffect(() => {
    if (!orderStatus || canteenLat == null || canteenLng == null || dropoffLat == null || dropoffLng == null) {
      return
    }

    let origin: LatLng | null = null
    let dest: LatLng | null = null
    let isDriverOrigin = false

    const hasDriver = driverLat != null && driverLng != null && Number.isFinite(driverLat) && Number.isFinite(driverLng)

    if (orderStatus === "driver_assigned") {
      if (hasDriver) {
        origin = { lat: driverLat, lng: driverLng }
        dest = { lat: canteenLat, lng: canteenLng }
        isDriverOrigin = true
      } else {
        origin = { lat: canteenLat, lng: canteenLng }
        dest = { lat: dropoffLat, lng: dropoffLng }
      }
    } else if (orderStatus === "on_the_way") {
      if (hasDriver) {
        origin = { lat: driverLat, lng: driverLng }
        dest = { lat: dropoffLat, lng: dropoffLng }
        isDriverOrigin = true
      } else {
        origin = { lat: canteenLat, lng: canteenLng }
        dest = { lat: dropoffLat, lng: dropoffLng }
      }
    } else {
      origin = { lat: canteenLat, lng: canteenLng }
      dest = { lat: dropoffLat, lng: dropoffLng }
    }

    if (
      !origin ||
      !dest ||
      !Number.isFinite(origin.lat) ||
      !Number.isFinite(origin.lng) ||
      !Number.isFinite(dest.lat) ||
      !Number.isFinite(dest.lng)
    ) {
      return
    }

    const now = Date.now()
    const last = lastRouteRequestRef.current

    if (last) {
      const statusChanged = last.status !== orderStatus
      if (!statusChanged && isDriverOrigin) {
        const elapsed = now - last.timestamp
        if (elapsed < 30_000) return
        if (last.driverPos) {
          const movedM = haversineMeters(last.driverPos, origin)
          if (movedM <= 100) return
        }
      } else if (!statusChanged) {
        return
      }
    }

    lastRouteRequestRef.current = {
      timestamp: now,
      driverPos: isDriverOrigin ? origin : undefined,
      status: orderStatus,
    }

    let active = true

    fetchRoute([origin, dest]).then((res) => {
      if (!active) return
      if (res && res.geometry?.coordinates?.length) {
        setRouteState({
          coordinates: res.geometry.coordinates,
          durationS: res.durationS,
          distanceM: res.distanceM,
          isFallback: false,
        })
      } else {
        setRouteState({
          coordinates: [
            [origin.lng, origin.lat],
            [dest.lng, dest.lat],
          ],
          durationS: null,
          distanceM: null,
          isFallback: true,
        })
      }
    })

    return () => {
      active = false
    }
  }, [orderStatus, canteenLat, canteenLng, dropoffLat, dropoffLng, driverLat, driverLng])

  // GeoJSON route source
  const routeCoordinates = routeState?.coordinates
  const isFallbackRoute = routeState?.isFallback ?? false

  const routeGeoJson: GeoJSON.FeatureCollection<GeoJSON.LineString> = useMemo(() => {
    if (!routeCoordinates || routeCoordinates.length < 2) {
      return { type: "FeatureCollection", features: [] }
    }
    return {
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          properties: {},
          geometry: {
            type: "LineString",
            coordinates: routeCoordinates,
          },
        },
      ],
    }
  }, [routeCoordinates])

  // Fit bounds once after map onLoad
  const fitAllPointsOnce = useCallback(() => {
    if (hasFittedBoundsRef.current || !mapRef.current || !order || !canteen) return

    const pts: [number, number][] = []
    if (Number.isFinite(canteen.location_lng) && Number.isFinite(canteen.location_lat)) {
      pts.push([canteen.location_lng, canteen.location_lat])
    }
    if (Number.isFinite(order.dropoff_lng) && Number.isFinite(order.dropoff_lat)) {
      pts.push([order.dropoff_lng, order.dropoff_lat])
    }
    if (
      driverLocation &&
      Number.isFinite(driverLocation.current_lng) &&
      Number.isFinite(driverLocation.current_lat) &&
      (order.status === "driver_assigned" || order.status === "on_the_way")
    ) {
      pts.push([driverLocation.current_lng, driverLocation.current_lat])
    }

    if (pts.length === 0) return

    const map = mapRef.current
    if (pts.length === 1) {
      map.setCenter({ lng: pts[0][0], lat: pts[0][1] })
      map.setZoom(14)
      hasFittedBoundsRef.current = true
      return
    }

    let minLng = pts[0][0]
    let maxLng = pts[0][0]
    let minLat = pts[0][1]
    let maxLat = pts[0][1]

    for (const [lng, lat] of pts) {
      if (lng < minLng) minLng = lng
      if (lng > maxLng) maxLng = lng
      if (lat < minLat) minLat = lat
      if (lat > maxLat) maxLat = lat
    }

    if (Math.abs(maxLng - minLng) < 0.0001 && Math.abs(maxLat - minLat) < 0.0001) {
      map.setCenter({ lng: minLng, lat: minLat })
      map.setZoom(14)
    } else {
      map.fitBounds(
        [
          [minLng, minLat],
          [maxLng, maxLat],
        ],
        {
          padding: 56,
          maxZoom: 15,
          duration: prefersReducedMotion ? 0 : 800,
        }
      )
    }
    hasFittedBoundsRef.current = true
  }, [order, canteen, driverLocation, prefersReducedMotion])

  useEffect(() => {
    if (mapLoaded && order && canteen) {
      fitAllPointsOnce()
    }
  }, [mapLoaded, order, canteen, fitAllPointsOnce])

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
      setIsCancelOpen(false)
      queryClient.invalidateQueries({ queryKey: recipientKeys.order(id) })
      queryClient.invalidateQueries({ queryKey: recipientKeys.orders() })
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

  // Open chat with order thread
  const handleOpenChat = async () => {
    if (!order) return
    try {
      setIsOpeningChat(true)
      const convId = await openOrderChat(supabase, order.id)
      if (convId) {
        router.push(`/app/messages/${convId}`)
      }
    } catch {
      toast.error("Couldn't open chat, please try again")
    } finally {
      setIsOpeningChat(false)
    }
  }

  // Ticking clock for stale location warning
  const now = useNow(1000)
  const lastUpdatedMs = driverLocation?.last_updated ? new Date(driverLocation.last_updated).getTime() : null
  const elapsedSec = lastUpdatedMs ? Math.max(0, Math.floor((now - lastUpdatedMs) / 1000)) : null
  const isStale = elapsedSec !== null && elapsedSec > 120

  if (isLoading) {
    return <OrderTrackingSkeleton />
  }

  if (isError) {
    return (
      <div className="container mx-auto max-w-5xl px-4 py-8">
        <ErrorState error={error} onRetry={() => refetch()} />
      </div>
    )
  }

  if (!order) {
    return (
      <div className="container mx-auto max-w-5xl px-4 py-8">
        <EmptyState
          icon={Package}
          title="Claim not found"
          description="This order may have expired or you may not have permission to view it."
          action={
            <Button asChild>
              <Link href="/app/orders">Back to my claims</Link>
            </Button>
          }
        />
      </div>
    )
  }

  const steps = order.food_listings
    ? buildSteps(order.food_listings, order, order.order_events ?? [])
    : []

  const canCancel = order.status === "pending_driver" || order.status === "driver_assigned"
  const isDriverAssigned = Boolean(order.driver_id && order.driver)
  const isCar = order.driver?.vehicle_type?.toLowerCase().includes("car")
  const VehicleIcon = isCar ? Car : Bike

  const defaultCenter = canteen
    ? { lng: canteen.location_lng, lat: canteen.location_lat }
    : DEFAULT_CENTER

  return (
    <div className="container mx-auto max-w-6xl px-4 py-6 sm:py-8">
      {/* Back navigation */}
      <div className="mb-4">
        <Link
          href="/app/orders"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-3.5" />
          <span>Back to my claims</span>
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 lg:items-start">
        {/* Left Column: Map */}
        <div className="lg:col-span-7">
          <div className="h-[60vh] min-h-[380px] w-full overflow-hidden rounded-2xl border border-border bg-muted shadow-sm lg:sticky lg:top-20 lg:h-[calc(100vh-7rem)]">
            <BaseMap
              ref={mapRef}
              className="size-full"
              initialViewState={{
                longitude: defaultCenter.lng,
                latitude: defaultCenter.lat,
                zoom: 13,
              }}
              onLoad={() => {
                setMapLoaded(true)
                fitAllPointsOnce()
              }}
            >
              {/* Route line */}
              {routeGeoJson.features.length > 0 && (
                <Source id="order-route" type="geojson" data={routeGeoJson}>
                  {isFallbackRoute ? (
                    <Layer
                      id="route-fallback"
                      type="line"
                      paint={{
                        "line-color": primaryColor,
                        "line-width": 3.5,
                        "line-dasharray": [2, 2],
                        "line-opacity": 0.8,
                      }}
                      layout={{ "line-cap": "round", "line-join": "round" }}
                    />
                  ) : (
                    <Layer
                      id="route-solid"
                      type="line"
                      paint={{
                        "line-color": primaryColor,
                        "line-width": 4,
                        "line-opacity": 0.85,
                      }}
                      layout={{ "line-cap": "round", "line-join": "round" }}
                    />
                  )}
                </Source>
              )}

              {/* Pickup Pin (Canteen) */}
              {canteen && (
                <Marker
                  longitude={canteen.location_lng}
                  latitude={canteen.location_lat}
                  anchor="bottom"
                >
                  <div className="group relative flex flex-col items-center">
                    <Pin tone="warning" />
                    <span className="mt-1 rounded bg-chrome px-1.5 py-0.5 text-[10px] font-semibold text-chrome-foreground shadow-xs">
                      Pickup
                    </span>
                  </div>
                </Marker>
              )}

              {/* Drop-off Pin */}
              <Marker
                longitude={order.dropoff_lng}
                latitude={order.dropoff_lat}
                anchor="bottom"
              >
                <div className="group relative flex flex-col items-center">
                  <Pin tone="primary" />
                  <span className="mt-1 rounded bg-chrome px-1.5 py-0.5 text-[10px] font-semibold text-chrome-foreground shadow-xs">
                    Drop-off
                  </span>
                </div>
              </Marker>

              {/* Driver Marker */}
              {animatedPos && (order.status === "driver_assigned" || order.status === "on_the_way") && (
                <Marker
                  longitude={animatedPos.lng}
                  latitude={animatedPos.lat}
                  anchor="center"
                >
                  <div className="relative flex size-10 items-center justify-center rounded-full bg-chrome text-primary shadow-lg ring-2 ring-primary">
                    <div
                      style={
                        driverLocation?.heading != null
                          ? { transform: `rotate(${driverLocation.heading}deg)` }
                          : undefined
                      }
                      className="transition-transform duration-200"
                    >
                      <VehicleIcon className="size-5 text-accent" />
                    </div>
                  </div>
                </Marker>
              )}
            </BaseMap>
          </div>
        </div>

        {/* Right Column: Panel */}
        <div className="space-y-6 lg:col-span-5">
          {/* Main Title & Status */}
          <div className="ticket overflow-hidden border border-border p-5 shadow-xs">
            <div className="flex items-center justify-between gap-3">
              <OrderStatusBadge status={order.status} />
              {order.food_listings && (
                <span className="text-xs font-semibold text-muted-foreground">
                  {order.food_listings.quantity} {order.food_listings.quantity === 1 ? "portion" : "portions"}
                </span>
              )}
            </div>

            <div className="mt-3">
              <h1 className="font-display text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                {order.food_listings?.title ?? "Food claim"}
              </h1>
              <p className="mt-1 font-display text-base font-semibold text-muted-foreground">
                {canteen?.org_name ?? "Canteen"}
              </p>
            </div>

            {/* ETA Line */}
            <div className="mt-4">
              {order.status === "pending_driver" && (
                <div className="flex items-center gap-2 rounded-xl border border-honey/40 bg-honey/15 px-3.5 py-2.5 text-sm font-semibold text-gunmetal dark:text-honey">
                  <span className="size-2 rounded-full bg-honey animate-pulse" />
                  <span>Looking for a driver</span>
                </div>
              )}

              {(order.status === "driver_assigned" || order.status === "on_the_way") && (
                <div className="flex items-center gap-2 rounded-xl border border-border bg-secondary/40 px-3.5 py-2.5 text-sm font-semibold text-secondary-foreground">
                  <Clock className="size-4 text-primary" />
                  <span>
                    {routeState?.durationS
                      ? `Arriving in ~${Math.max(1, Math.round(routeState.durationS / 60))} min`
                      : order.status === "on_the_way"
                        ? "Driver on the way to drop-off"
                        : "Driver on the way to canteen"}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Celebratory Completed State */}
          {order.status === "completed" && (
            <div className="rounded-2xl border border-primary/20 bg-primary/5 p-6 text-center shadow-xs">
              <div className="flex justify-center">
                <motion.div
                  initial={prefersReducedMotion ? false : { scale: 0, rotate: -20 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ type: "spring", stiffness: 320, damping: 20 }}
                  className="flex size-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-md"
                >
                  <motion.svg
                    className="size-7 stroke-current"
                    viewBox="0 0 24 24"
                    fill="none"
                    strokeWidth={3}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <motion.path
                      d="M5 13l4 4L19 7"
                      initial={prefersReducedMotion ? { pathLength: 1 } : { pathLength: 0 }}
                      animate={{ pathLength: 1 }}
                      transition={{
                        duration: prefersReducedMotion ? 0 : 0.45,
                        ease: "easeOut",
                        delay: prefersReducedMotion ? 0 : 0.15,
                      }}
                    />
                  </motion.svg>
                </motion.div>
              </div>
              <h3 className="mt-3 font-display text-xl font-bold text-foreground">
                Claim completed!
              </h3>
              <p className="mt-1 text-sm text-muted-foreground">
                {order.delivered_at
                  ? `Delivered on ${format(new Date(order.delivered_at), "d MMM, h:mm a")}`
                  : "Food was picked up and delivered successfully"}
              </p>
            </div>
          )}

          {/* Cancelled State */}
          {order.status === "cancelled" && (
            <div className="rounded-2xl border border-border bg-muted/40 p-6 text-center shadow-xs">
              <div className="flex justify-center">
                <div className="flex size-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
                  <XCircle className="size-6" />
                </div>
              </div>
              <h3 className="mt-3 font-display text-xl font-bold text-foreground">
                Claim cancelled
              </h3>
              <p className="mt-1 text-sm text-muted-foreground">
                {order.cancelled_at
                  ? `Cancelled on ${format(new Date(order.cancelled_at), "d MMM, h:mm a")}`
                  : "This claim was cancelled and the food was released"}
              </p>
              <div className="mt-4">
                <Button asChild>
                  <Link href="/app">Find more food</Link>
                </Button>
              </div>
            </div>
          )}

          {/* Driver Card */}
          {isDriverAssigned && order.driver && (
            <div className="rounded-xl border border-border bg-card p-4 shadow-xs space-y-3">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3 min-w-0">
                  <Avatar className="size-11 border border-border shrink-0">
                    {order.driver.avatar_url && (
                      <AvatarImage src={order.driver.avatar_url} alt={order.driver.name} />
                    )}
                    <AvatarFallback>{order.driver.name.slice(0, 2).toUpperCase()}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <p className="font-semibold text-sm text-foreground truncate">
                      {order.driver.name}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {[
                        order.driver.vehicle_type,
                        order.driver.vehicle_number ? `(${order.driver.vehicle_number})` : null,
                      ]
                        .filter(Boolean)
                        .join(" ") || "Driver"}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {order.driver.phone && (
                    <Button variant="outline" size="sm" asChild>
                      <a href={`tel:${order.driver.phone}`} className="flex items-center gap-1.5">
                        <Phone className="size-3.5" />
                        <span>Call</span>
                      </a>
                    </Button>
                  )}
                  <Button
                    variant="dark"
                    size="sm"
                    loading={isOpeningChat}
                    onClick={handleOpenChat}
                    className="gap-1.5"
                  >
                    <MessageSquare className="size-3.5" />
                    <span>Message</span>
                  </Button>
                </div>
              </div>

              {/* Ping status & stale warning */}
              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border/60 pt-2 text-xs">
                <span className="text-muted-foreground">
                  {elapsedSec !== null ? (
                    elapsedSec < 60
                      ? `Last updated ${elapsedSec}s ago`
                      : `Last updated ${Math.floor(elapsedSec / 60)}m ${elapsedSec % 60}s ago`
                  ) : (
                    "Live tracking active"
                  )}
                </span>
                {isStale && (
                  <span className="inline-flex items-center gap-1 rounded-md border border-honey/40 bg-honey/20 px-2 py-0.5 font-medium text-honey-foreground">
                    <AlertTriangle className="size-3 text-honey shrink-0" />
                    <span>Driver location is stale</span>
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Action Row when no driver is assigned yet */}
          {!isDriverAssigned && order.status !== "completed" && order.status !== "cancelled" && (
            <div className="flex items-center gap-2">
              <Button
                variant="dark"
                size="sm"
                loading={isOpeningChat}
                onClick={handleOpenChat}
                className="gap-1.5"
              >
                <MessageSquare className="size-3.5" />
                <span>Message canteen</span>
              </Button>
            </div>
          )}

          {/* Status Timeline */}
          {steps.length > 0 && (
            <div className="rounded-xl border border-border bg-card p-5 shadow-xs">
              <h2 className="mb-3 text-sm font-semibold text-foreground">
                Timeline
              </h2>
              <StatusTimeline steps={steps} />
            </div>
          )}

          {/* Pickup and Drop-off locations info */}
          <div className="rounded-xl border border-border bg-card p-5 shadow-xs space-y-4">
            <h2 className="text-sm font-semibold text-foreground">
              Delivery details
            </h2>

            <div className="flex gap-3 text-sm">
              <Store className="size-4 shrink-0 text-primary mt-0.5" />
              <div className="min-w-0">
                <p className="font-semibold text-foreground">Pickup from {canteen?.org_name}</p>
                <p className="text-xs text-muted-foreground">{canteen?.address ?? "Address provided"}</p>
                {canteen?.pickup_instructions && (
                  <p className="mt-1 text-xs text-muted-foreground italic">
                    &ldquo;{canteen.pickup_instructions}&rdquo;
                  </p>
                )}
              </div>
            </div>

            <div className="flex gap-3 text-sm">
              <MapPin className="size-4 shrink-0 text-primary mt-0.5" />
              <div className="min-w-0">
                <p className="font-semibold text-foreground">Drop-off destination</p>
                <p className="text-xs text-muted-foreground">{order.dropoff_address}</p>
                {order.notes && (
                  <p className="mt-1 text-xs text-muted-foreground italic">
                    &ldquo;{order.notes}&rdquo;
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Cancel claim button (for pending_driver and driver_assigned) */}
          {canCancel && (
            <div className="pt-2">
              <Button
                type="button"
                variant="outline"
                className="w-full text-destructive hover:border-destructive hover:bg-destructive/10"
                onClick={() => setIsCancelOpen(true)}
              >
                Cancel claim
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Confirmation modal for cancellation */}
      <Dialog open={isCancelOpen} onOpenChange={setIsCancelOpen}>
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
              onClick={() => cancelMutation.mutate(order.id)}
            >
              Cancel claim
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function OrderTrackingSkeleton() {
  return (
    <div className="container mx-auto max-w-6xl px-4 py-6 sm:py-8">
      <Skeleton className="mb-4 h-4 w-32" />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 lg:items-start">
        <div className="lg:col-span-7">
          <Skeleton className="h-[60vh] min-h-[380px] w-full rounded-2xl lg:h-[calc(100vh-7rem)]" />
        </div>
        <div className="space-y-6 lg:col-span-5">
          <div className="ticket border border-border p-5 shadow-xs space-y-3">
            <Skeleton className="h-5 w-24 rounded-full" />
            <Skeleton className="h-8 w-3/4" />
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-10 w-full rounded-xl" />
          </div>
          <div className="rounded-xl border border-border bg-card p-4 shadow-xs space-y-3">
            <div className="flex items-center gap-3">
              <Skeleton className="size-11 rounded-full" />
              <div className="space-y-1.5 flex-1">
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-3 w-36" />
              </div>
            </div>
          </div>
          <div className="rounded-xl border border-border bg-card p-5 shadow-xs space-y-4">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-40 w-full" />
          </div>
        </div>
      </div>
    </div>
  )
}
