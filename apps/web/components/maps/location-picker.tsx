"use client"

import { useCallback, useRef, useState } from "react"
import { Marker, type MapLayerMouseEvent, type MapRef, type MarkerDragEvent } from "react-map-gl/maplibre"
import { LocateFixed } from "lucide-react"
import { toast } from "sonner"
import { DEFAULT_CENTER, type LatLng } from "@platelink/shared"
import { reverseGeocode, type PlaceResult } from "@/lib/photon"
import { BaseMap } from "@/components/maps/base-map"
import { Pin } from "@/components/maps/pin"
import { PlaceAutocomplete } from "@/components/maps/place-autocomplete"
import { Button } from "@/components/ui/button"

export type PickedLocation = LatLng & { address: string }

type Props = {
  value: PickedLocation | null
  onChange: (value: PickedLocation) => void
  className?: string
}

/**
 * Address search + draggable pin. Photon is weak on Indian building-level
 * addresses, so the pin is the source of truth for coordinates.
 */
export function LocationPicker({ value, onChange, className }: Props) {
  const mapRef = useRef<MapRef>(null)
  const [locating, setLocating] = useState(false)
  const center = value ?? DEFAULT_CENTER

  const setPoint = useCallback(
    async (point: LatLng, address?: string) => {
      onChange({ ...point, address: address ?? value?.address ?? "" })
      if (!address) {
        const label = await reverseGeocode(point).catch(() => null)
        onChange({ ...point, address: label ?? `${point.lat.toFixed(5)}, ${point.lng.toFixed(5)}` })
      }
    },
    [onChange, value?.address]
  )

  function flyTo(point: LatLng) {
    mapRef.current?.flyTo({ center: [point.lng, point.lat], zoom: 16, duration: 900 })
  }

  function onSelect(p: PlaceResult) {
    setPoint({ lat: p.lat, lng: p.lng }, p.label)
    flyTo(p)
  }

  function useMyLocation() {
    if (!navigator.geolocation) return toast.error("Location isn't available in this browser")
    setLocating(true)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const point = { lat: pos.coords.latitude, lng: pos.coords.longitude }
        setLocating(false)
        setPoint(point)
        flyTo(point)
      },
      () => {
        setLocating(false)
        toast.error("Couldn't get your location — allow location access or drop a pin.")
      },
      { enableHighAccuracy: true, timeout: 10_000 }
    )
  }

  return (
    <div className={className}>
      <div className="flex gap-2">
        <div className="flex-1">
          <PlaceAutocomplete near={value ?? undefined} onSelect={onSelect} />
        </div>
        <Button type="button" variant="outline" onClick={useMyLocation} loading={locating} aria-label="Use my location">
          {!locating && <LocateFixed />}
          <span className="hidden sm:inline">My location</span>
        </Button>
      </div>
      <BaseMap
        ref={mapRef}
        className="mt-3 h-72 sm:h-80"
        initialViewState={{ latitude: center.lat, longitude: center.lng, zoom: value ? 16 : 12 }}
        onClick={(e: MapLayerMouseEvent) => setPoint({ lat: e.lngLat.lat, lng: e.lngLat.lng })}
        cursor="crosshair"
      >
        {value && (
          <Marker
            latitude={value.lat}
            longitude={value.lng}
            anchor="bottom"
            draggable
            onDragEnd={(e: MarkerDragEvent) => setPoint({ lat: e.lngLat.lat, lng: e.lngLat.lng })}
          >
            <Pin />
          </Marker>
        )}
      </BaseMap>
      <p className="mt-2 text-xs text-muted-foreground">
        Click the map or drag the pin to the exact pickup gate. Drivers navigate to the pin, not the text address.
      </p>
    </div>
  )
}
