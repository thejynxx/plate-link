"use client"

import { useState, useSyncExternalStore } from "react"
import { LocateFixed, MapPin } from "lucide-react"
import type { LatLng } from "@platelink/shared"
import { useRecipientLocation, type LocationStatus, type RadiusKm } from "@/hooks/use-recipient-location"
import { PlaceAutocomplete } from "@/components/maps/place-autocomplete"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Sheet, SheetContent, SheetDescription, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { Skeleton } from "@/components/ui/skeleton"

const RADIUS_OPTIONS: RadiusKm[] = [2, 5, 10, 20]

function subscribe(callback: () => void) {
  const mql = window.matchMedia("(max-width: 639px)")
  mql.addEventListener("change", callback)
  return () => mql.removeEventListener("change", callback)
}

function getSnapshot() {
  return window.matchMedia("(max-width: 639px)").matches
}

function getServerSnapshot() {
  return false
}

function useIsMobile() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}

function LocationPanel({
  point,
  radiusKm,
  setRadiusKm,
  setPlace,
  useMyLocation,
  status,
  error,
  onClose,
}: {
  point: LatLng
  radiusKm: RadiusKm
  setRadiusKm: (r: RadiusKm) => void
  setPlace: (point: LatLng, label: string) => void
  useMyLocation: () => Promise<void>
  status: LocationStatus
  error: string | null
  onClose: () => void
}) {
  return (
    <div className="flex flex-col gap-4">
      <div className="space-y-1.5">
        <label className="text-xs font-semibold text-muted-foreground">Search area or landmark</label>
        <PlaceAutocomplete
          near={point}
          onSelect={(p) => {
            setPlace({ lat: p.lat, lng: p.lng }, p.label)
            onClose()
          }}
          placeholder="Search landmark, street or area"
        />
      </div>

      <div className="space-y-1.5">
        <label className="text-xs font-semibold text-muted-foreground">Radius</label>
        <div role="radiogroup" aria-label="Search radius" className="grid grid-cols-4 gap-2">
          {RADIUS_OPTIONS.map((r) => {
            const checked = radiusKm === r
            return (
              <button
                key={r}
                type="button"
                role="radio"
                aria-checked={checked}
                onClick={() => setRadiusKm(r)}
                className="chip flex items-center justify-center rounded-xl py-2 text-xs font-semibold text-foreground select-none"
              >
                {r} km
              </button>
            )
          })}
        </div>
      </div>

      <div className="space-y-1.5">
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={useMyLocation}
          loading={status === "locating"}
          className="w-full gap-2"
        >
          <LocateFixed className="size-4 shrink-0" />
          <span>Use my location</span>
        </Button>
        {error && <p className="text-xs text-destructive">{error}</p>}
      </div>
    </div>
  )
}

export function LocationBar() {
  const { point, label, radiusKm, setRadiusKm, setPlace, useMyLocation, status, error } = useRecipientLocation()
  const isMobile = useIsMobile()
  const [open, setOpen] = useState(false)

  if (status === "locating") {
    return (
      <div className="flex items-center justify-between gap-3 rounded-xl border bg-card px-3.5 py-2.5 shadow-xs">
        <div className="flex min-w-0 items-center gap-2">
          <MapPin className="size-4 shrink-0 text-muted-foreground animate-pulse" />
          <Skeleton className="h-4 w-44 sm:w-64" />
        </div>
        <Skeleton className="h-8 w-16 rounded-md" />
      </div>
    )
  }

  const trigger = (
    <Button variant="outline" size="sm" className="shrink-0">
      Change
    </Button>
  )

  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border bg-card px-3.5 py-2.5 text-sm shadow-xs">
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <MapPin className="size-4 shrink-0 text-primary" />
        <p className="min-w-0 flex-1 truncate text-sm text-muted-foreground" title={label}>
          Showing food within <span className="font-semibold text-foreground">{radiusKm} km</span> of{" "}
          <span className="font-semibold text-foreground" title={label}>
            {label}
          </span>
        </p>
      </div>

      {isMobile ? (
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>{trigger}</SheetTrigger>
          <SheetContent side="bottom" className="p-4">
            <SheetTitle className="font-display text-base">Change location</SheetTitle>
            <SheetDescription className="text-xs">
              Search a place or adjust your search radius.
            </SheetDescription>
            <div className="mt-2">
              <LocationPanel
                point={point}
                radiusKm={radiusKm}
                setRadiusKm={setRadiusKm}
                setPlace={setPlace}
                useMyLocation={useMyLocation}
                status={status}
                error={error}
                onClose={() => setOpen(false)}
              />
            </div>
          </SheetContent>
        </Sheet>
      ) : (
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>{trigger}</PopoverTrigger>
          <PopoverContent align="end" className="w-84 p-4">
            <div className="mb-3">
              <h4 className="font-display text-sm font-semibold text-foreground">Change location</h4>
              <p className="text-xs text-muted-foreground">Search a place or adjust your search radius.</p>
            </div>
            <LocationPanel
              point={point}
              radiusKm={radiusKm}
              setRadiusKm={setRadiusKm}
              setPlace={setPlace}
              useMyLocation={useMyLocation}
              status={status}
              error={error}
              onClose={() => setOpen(false)}
            />
          </PopoverContent>
        </Popover>
      )}
    </div>
  )
}
