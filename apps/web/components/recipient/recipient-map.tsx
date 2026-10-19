"use client"

import { forwardRef, useCallback, useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { Marker, Popup, type MapRef } from "react-map-gl/maplibre"
import { DEFAULT_CENTER, formatDistance, haversineMeters, type LatLng } from "@platelink/shared"
import { BaseMap } from "@/components/maps/base-map"
import { Pin } from "@/components/maps/pin"
import { Button } from "@/components/ui/button"
import type { NearbyListing } from "@/lib/queries/recipient"

export type RecipientMapProps = {
  listings: NearbyListing[]
  point: LatLng
  className?: string
  selectedId?: string | null
  onSelectId?: (id: string | null) => void
}

function getPrefersReducedMotion(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return false
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches
}

export const RecipientMap = forwardRef<MapRef, RecipientMapProps>(function RecipientMap(
  { listings, point, className, selectedId, onSelectId },
  forwardedRef
) {
  const internalMapRef = useRef<MapRef | null>(null)
  const [internalSelectedId, setInternalSelectedId] = useState<string | null>(null)
  const [mapLoaded, setMapLoaded] = useState(false)

  const activeId = selectedId !== undefined ? selectedId : internalSelectedId
  const setActiveId = onSelectId ?? setInternalSelectedId

  const selectedListing = listings.find((l) => l.id === activeId) ?? null

  const setMapRef = useCallback(
    (instance: MapRef | null) => {
      internalMapRef.current = instance
      if (typeof forwardedRef === "function") {
        forwardedRef(instance)
      } else if (forwardedRef) {
        forwardedRef.current = instance
      }
    },
    [forwardedRef]
  )

  const rawRecipientLng = Number(point?.lng)
  const rawRecipientLat = Number(point?.lat)
  const hasValidRecipient = Number.isFinite(rawRecipientLng) && Number.isFinite(rawRecipientLat)
  const recipientLng = hasValidRecipient ? rawRecipientLng : DEFAULT_CENTER.lng
  const recipientLat = hasValidRecipient ? rawRecipientLat : DEFAULT_CENTER.lat
  const recipientCoords = useMemo<LatLng>(
    () => ({ lat: recipientLat, lng: recipientLng }),
    [recipientLat, recipientLng]
  )

  const validListings = useMemo(() => {
    return listings.filter((l) => {
      const lat = Number(l?.location_lat)
      const lng = Number(l?.location_lng)
      return Number.isFinite(lat) && Number.isFinite(lng)
    })
  }, [listings])

  const fitBounds = useCallback(() => {
    if (!mapLoaded) return
    const map = internalMapRef.current
    if (!map) return

    const duration = getPrefersReducedMotion() ? 0 : 600

    const allWithin100m =
      validListings.length > 0 &&
      validListings.every((l) => {
        if (typeof l.distance_m === "number" && Number.isFinite(l.distance_m)) {
          return l.distance_m <= 100
        }
        return (
          haversineMeters(recipientCoords, {
            lat: Number(l.location_lat),
            lng: Number(l.location_lng),
          }) <= 100
        )
      })

    // If there are 0 results, or every point is within ~100 m of the recipient,
    // just center on the recipient at zoom 14 instead of fitBounds.
    if (validListings.length === 0 || allWithin100m) {
      map.flyTo({ center: [recipientLng, recipientLat], zoom: 14, duration })
      return
    }

    const container = map.getContainer?.()
    if (container && (container.clientWidth === 0 || container.clientHeight === 0)) {
      const handleResize = () => {
        map.off("resize", handleResize)
        fitBounds()
      }
      map.once("resize", handleResize)
      return
    }

    let minLng = recipientLng
    let maxLng = recipientLng
    let minLat = recipientLat
    let maxLat = recipientLat

    for (const l of validListings) {
      const lng = Number(l.location_lng)
      const lat = Number(l.location_lat)
      if (lng < minLng) minLng = lng
      if (lng > maxLng) maxLng = lng
      if (lat < minLat) minLat = lat
      if (lat > maxLat) maxLat = lat
    }

    let padding = 48
    if (container) {
      const width = container.clientWidth
      const height = container.clientHeight
      if (width > 0 && height > 0) {
        const minDim = Math.min(width, height)
        if (minDim <= padding * 2) {
          padding = Math.max(0, Math.floor(minDim / 2) - 4)
        }
      }
    }

    map.fitBounds(
      [
        [minLng, minLat],
        [maxLng, maxLat],
      ],
      { padding, maxZoom: 15, duration }
    )
  }, [mapLoaded, validListings, recipientCoords, recipientLng, recipientLat])

  const handleLoad = useCallback(() => {
    setMapLoaded(true)
    internalMapRef.current?.resize()
  }, [])

  useEffect(() => {
    if (mapLoaded) {
      fitBounds()
    }
  }, [mapLoaded, fitBounds])

  return (
    <BaseMap
      ref={setMapRef}
      onLoad={handleLoad}
      initialViewState={{ longitude: recipientLng, latitude: recipientLat, zoom: 13 }}
      className={className}
    >
      {/* Recipient current location marker ("you" dot) */}
      {hasValidRecipient && (
        <Marker latitude={Number(point.lat)} longitude={Number(point.lng)} anchor="center">
          <div className="relative flex size-5 items-center justify-center" title="Your location">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-honey opacity-60" />
            <span className="relative inline-flex size-3.5 rounded-full border-2 border-white bg-primary shadow-xs" />
          </div>
        </Marker>
      )}

      {/* Listing pins */}
      {validListings.map((l) => {
        const isSelected = l.id === activeId
        const lat = Number(l.location_lat)
        const lng = Number(l.location_lng)
        return (
          <Marker
            key={l.id}
            latitude={lat}
            longitude={lng}
            anchor="bottom"
            onClick={(e) => {
              e.originalEvent.stopPropagation()
              setActiveId(isSelected ? null : l.id)
            }}
          >
            <button
              type="button"
              className="cursor-pointer transition-transform hover:scale-110 focus:outline-none"
              aria-label={`View ${l.title}`}
            >
              <Pin tone={isSelected ? "warning" : "primary"} />
            </button>
          </Marker>
        )
      })}

      {/* Info popup on selected listing */}
      {selectedListing &&
        Number.isFinite(Number(selectedListing.location_lat)) &&
        Number.isFinite(Number(selectedListing.location_lng)) && (
          <Popup
            latitude={Number(selectedListing.location_lat)}
            longitude={Number(selectedListing.location_lng)}
            anchor="bottom"
            offset={36}
            onClose={() => setActiveId(null)}
            closeOnClick={false}
            className="z-30"
          >
            <div className="flex flex-col gap-2 p-1 min-w-[200px] max-w-[240px]">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="line-clamp-1 font-display text-sm font-semibold text-foreground">
                    {selectedListing.title}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">{selectedListing.canteen_name}</p>
                </div>
                <div className="shrink-0 text-right">
                  <span className="font-display text-lg font-bold tabular-nums text-foreground">
                    {selectedListing.quantity}
                  </span>
                  <span className="block text-[10px] text-muted-foreground">portions</span>
                </div>
              </div>
              <div className="flex items-center justify-between gap-2 border-t border-border pt-2">
                <span className="text-xs font-semibold text-muted-foreground">
                  {formatDistance(selectedListing.distance_m)}
                </span>
                <Button asChild size="sm" className="h-7 px-3 text-xs">
                  <Link href={`/app/listings/${selectedListing.id}`}>View</Link>
                </Button>
              </div>
            </div>
          </Popup>
        )}
    </BaseMap>
  )
})

