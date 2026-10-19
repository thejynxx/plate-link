"use client"

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react"
import { useQuery } from "@tanstack/react-query"
import { LayoutGrid, Map, Soup } from "lucide-react"
import type { MapRef } from "react-map-gl/maplibre"
import type { FoodType } from "@platelink/shared"
import { useRecipientLocation, type RadiusKm } from "@/hooks/use-recipient-location"
import { useRealtimeInvalidate } from "@/hooks/use-realtime-invalidate"
import { createClient } from "@/lib/supabase/client"
import { fetchNearby, recipientKeys } from "@/lib/queries/recipient"
import { RecipientListingCard, RecipientListingCardSkeleton } from "@/components/recipient/recipient-listing-card"
import { RecipientMap } from "@/components/recipient/recipient-map"
import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/ui/empty-state"
import { ErrorState } from "@/components/ui/error-state"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"

type FoodFilter = "all" | FoodType

const FOOD_FILTERS: { value: FoodFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "veg", label: "Veg" },
  { value: "non_veg", label: "Non-veg" },
  { value: "vegan", label: "Vegan" },
]

const RADIUS_NEXT: Record<RadiusKm, RadiusKm | null> = {
  2: 5,
  5: 10,
  10: 20,
  20: null,
}

const STORAGE_VIEW_KEY = "pl:recipient-view"
const viewListeners = new Set<() => void>()

function subscribeView(callback: () => void) {
  viewListeners.add(callback)
  const onStorage = (e: StorageEvent) => {
    if (e.key === STORAGE_VIEW_KEY) callback()
  }
  window.addEventListener("storage", onStorage)
  return () => {
    viewListeners.delete(callback)
    window.removeEventListener("storage", onStorage)
  }
}

function getViewSnapshot(): "feed" | "map" {
  try {
    const v = localStorage.getItem(STORAGE_VIEW_KEY)
    return v === "map" ? "map" : "feed"
  } catch {
    return "feed"
  }
}

function getServerViewSnapshot(): "feed" | "map" {
  return "feed"
}

function setStoredView(next: "feed" | "map") {
  try {
    localStorage.setItem(STORAGE_VIEW_KEY, next)
    for (const l of viewListeners) l()
  } catch {
    // Ignore localStorage write error
  }
}

export function RecipientFeed() {
  const { point, radiusKm, setRadiusKm, status: locationStatus } = useRecipientLocation()
  const supabase = createClient()

  const mobileMapRef = useRef<MapRef | null>(null)
  const [selectedFoodType, setSelectedFoodType] = useState<FoodFilter>("all")
  const [selectedMapId, setSelectedMapId] = useState<string | null>(null)

  const storedView = useSyncExternalStore(subscribeView, getViewSnapshot, getServerViewSnapshot)
  const [overrideView, setOverrideView] = useState<"feed" | "map" | null>(null)
  const activeView = overrideView ?? storedView

  function handleViewChange(v: "feed" | "map") {
    setOverrideView(v)
    setStoredView(v)
    if (v === "map") {
      requestAnimationFrame(() => {
        mobileMapRef.current?.resize()
      })
      setTimeout(() => {
        mobileMapRef.current?.resize()
      }, 50)
    }
  }

  useEffect(() => {
    if (activeView === "map") {
      const raf = requestAnimationFrame(() => {
        mobileMapRef.current?.resize()
      })
      const timer = setTimeout(() => {
        mobileMapRef.current?.resize()
      }, 100)
      return () => {
        cancelAnimationFrame(raf)
        clearTimeout(timer)
      }
    }
  }, [activeView])

  const isLocating = locationStatus === "locating"
  const radiusM = radiusKm * 1000

  // Realtime: invalidate nearby queries on any food_listings mutation
  useRealtimeInvalidate("recipient-nearby-listings", [{ table: "food_listings" }], [recipientKeys.nearby()])

  const {
    data: listings = [],
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: recipientKeys.nearby(point.lat, point.lng, radiusM),
    queryFn: () => fetchNearby(supabase, { lat: point.lat, lng: point.lng, radiusM }),
    enabled: !isLocating,
    staleTime: 30_000,
  })

  const filteredListings = useMemo(() => {
    let list = listings
    if (selectedFoodType !== "all") {
      list = list.filter((l) => l.food_type === selectedFoodType)
    }
    return [...list].sort((a, b) => a.distance_m - b.distance_m)
  }, [listings, selectedFoodType])

  const nextRadius = RADIUS_NEXT[radiusKm]
  const loading = isLocating || isLoading

  return (
    <div className="flex flex-col gap-5">
      {/* Filter and View toggles */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div
          role="radiogroup"
          aria-label="Food type filter"
          className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0"
        >
          {FOOD_FILTERS.map((f) => (
            <button
              key={f.value}
              type="button"
              role="radio"
              aria-checked={selectedFoodType === f.value}
              onClick={() => setSelectedFoodType(f.value)}
              className="chip shrink-0 rounded-full px-3.5 py-1 text-xs font-semibold text-foreground select-none"
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* View toggle (mobile / tablet only, hidden on lg screens) */}
        <div role="radiogroup" aria-label="View mode" className="flex items-center gap-1.5 lg:hidden">
          <button
            type="button"
            role="radio"
            aria-checked={activeView === "feed"}
            onClick={() => handleViewChange("feed")}
            className="chip flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold text-foreground select-none"
          >
            <LayoutGrid className="size-3.5" />
            <span>Feed</span>
          </button>
          <button
            type="button"
            role="radio"
            aria-checked={activeView === "map"}
            onClick={() => handleViewChange("map")}
            className="chip flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold text-foreground select-none"
          >
            <Map className="size-3.5" />
            <span>Map</span>
          </button>
        </div>
      </div>

      {/* Error state */}
      {isError && !loading && (
        <ErrorState error={error} onRetry={() => refetch()} />
      )}

      {/* Mobile view (< lg screens) */}
      <div className="lg:hidden">
        {loading ? (
          activeView === "feed" ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <RecipientListingCardSkeleton key={i} />
              ))}
            </div>
          ) : (
            <div className="h-[420px] w-full overflow-hidden rounded-xl border bg-muted">
              <Skeleton className="size-full rounded-none" />
            </div>
          )
        ) : (
          <>
            <div className={activeView === "feed" ? "block" : "hidden"}>
              {filteredListings.length === 0 ? (
                <EmptyState
                  icon={Soup}
                  title={`No food within ${radiusKm} km right now`}
                  description="Check back a little later or widen your search radius to discover food posted farther out."
                  action={
                    nextRadius ? (
                      <Button variant="secondary" onClick={() => setRadiusKm(nextRadius)}>
                        Widen to {nextRadius} km
                      </Button>
                    ) : undefined
                  }
                />
              ) : (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  {filteredListings.map((l) => (
                    <RecipientListingCard key={l.id} listing={l} />
                  ))}
                </div>
              )}
            </div>
            <div className={cn("h-[420px] w-full", activeView === "map" ? "block" : "hidden")}>
              <RecipientMap
                ref={mobileMapRef}
                listings={filteredListings}
                point={point}
                selectedId={selectedMapId}
                onSelectId={setSelectedMapId}
                className="size-full h-[420px]"
              />
            </div>
          </>
        )}
      </div>

      {/* Desktop view (lg screens: feed left, sticky map right) */}
      <div className="hidden lg:grid lg:grid-cols-12 lg:gap-8">
        <div className="lg:col-span-7">
          {loading ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <RecipientListingCardSkeleton key={i} />
              ))}
            </div>
          ) : filteredListings.length === 0 ? (
            <EmptyState
              icon={Soup}
              title={`No food within ${radiusKm} km right now`}
              description="Check back a little later or widen your search radius to discover food posted farther out."
              action={
                nextRadius ? (
                  <Button variant="secondary" onClick={() => setRadiusKm(nextRadius)}>
                    Widen to {nextRadius} km
                  </Button>
                ) : undefined
              }
            />
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {filteredListings.map((l) => (
                <RecipientListingCard key={l.id} listing={l} />
              ))}
            </div>
          )}
        </div>

        <div className="lg:col-span-5">
          <div className="sticky top-20 h-[calc(100vh-8rem)] min-h-[500px]">
            {loading ? (
              <div className="size-full overflow-hidden rounded-xl border bg-muted">
                <Skeleton className="size-full rounded-none" />
              </div>
            ) : (
              <RecipientMap
                listings={filteredListings}
                point={point}
                selectedId={selectedMapId}
                onSelectId={setSelectedMapId}
                className="size-full h-full"
              />
            )}
          </div>
        </div>
      </div>
    </div>
  )
}



