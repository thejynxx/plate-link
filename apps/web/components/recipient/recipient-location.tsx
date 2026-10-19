"use client"

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
} from "react"
import { DEFAULT_CENTER, type LatLng } from "@platelink/shared"
import { reverseGeocode } from "@/lib/photon"

export type RadiusKm = 2 | 5 | 10 | 20
export type LocationSource = "gps" | "search" | "default"
export type LocationStatus = "locating" | "ready"

export type RecipientLocationContextValue = {
  point: LatLng
  label: string
  source: LocationSource
  radiusKm: RadiusKm
  status: LocationStatus
  error: string | null
  setPlace: (point: LatLng, label: string) => void
  setRadiusKm: (radius: RadiusKm) => void
  useMyLocation: () => Promise<void>
}

const STORAGE_KEY = "pl:recipient-location"
const listeners = new Set<() => void>()

function notifyListeners() {
  for (const listener of listeners) {
    listener()
  }
}

function subscribeToStorage(callback: () => void) {
  listeners.add(callback)
  const onStorage = (e: StorageEvent) => {
    if (e.key === STORAGE_KEY) callback()
  }
  window.addEventListener("storage", onStorage)
  return () => {
    listeners.delete(callback)
    window.removeEventListener("storage", onStorage)
  }
}

function getStorageSnapshot(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY)
  } catch {
    return null
  }
}

function getServerStorageSnapshot(): string | null {
  return null
}

type SavedLocation = {
  point: LatLng
  label: string
  radiusKm: RadiusKm
  source: LocationSource
}

function parseSavedLocation(raw: string | null): SavedLocation | null {
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw)
    if (
      parsed &&
      typeof parsed.point?.lat === "number" &&
      typeof parsed.point?.lng === "number" &&
      typeof parsed.label === "string"
    ) {
      const radiusKm = ([2, 5, 10, 20] as const).includes(parsed.radiusKm)
        ? (parsed.radiusKm as RadiusKm)
        : 5
      const source = (["gps", "search", "default"] as const).includes(parsed.source)
        ? (parsed.source as LocationSource)
        : "search"
      return {
        point: { lat: parsed.point.lat, lng: parsed.point.lng },
        label: parsed.label,
        radiusKm,
        source,
      }
    }
  } catch {
    // Ignore parse error
  }
  return null
}

function saveLocation(data: SavedLocation) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
    notifyListeners()
  } catch {
    // Ignore localStorage write error
  }
}

export const RecipientLocationContext = createContext<RecipientLocationContextValue | null>(null)

export function RecipientLocationProvider({ children }: { children: React.ReactNode }) {
  const rawStorage = useSyncExternalStore(subscribeToStorage, getStorageSnapshot, getServerStorageSnapshot)
  const saved = useMemo(() => parseSavedLocation(rawStorage), [rawStorage])

  const [isLocating, setIsLocating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // First mount without saved location: attempt geolocation once
  useEffect(() => {
    if (saved) return

    if (typeof navigator === "undefined" || !navigator.geolocation) {
      saveLocation({ point: DEFAULT_CENTER, label: "Chennai", radiusKm: 5, source: "default" })
      return
    }

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const p: LatLng = { lat: pos.coords.latitude, lng: pos.coords.longitude }
        let rev = "your location"
        try {
          const res = await reverseGeocode(p)
          if (res) rev = res
        } catch {
          // Fall back to "your location"
        }
        saveLocation({ point: p, label: rev, radiusKm: 5, source: "gps" })
      },
      () => {
        saveLocation({ point: DEFAULT_CENTER, label: "Chennai", radiusKm: 5, source: "default" })
      },
      { timeout: 8000, enableHighAccuracy: true }
    )
  }, [saved])

  const point = saved?.point ?? DEFAULT_CENTER
  const label = saved?.label ?? "Chennai"
  const radiusKm = saved?.radiusKm ?? 5
  const source = saved?.source ?? "default"
  const status: LocationStatus = isLocating || (!saved && !error) ? "locating" : "ready"

  const setPlace = useCallback(
    (newPoint: LatLng, newLabel: string) => {
      setError(null)
      saveLocation({ point: newPoint, label: newLabel, radiusKm, source: "search" })
    },
    [radiusKm]
  )

  const setRadiusKm = useCallback(
    (newRadius: RadiusKm) => {
      saveLocation({ point, label, radiusKm: newRadius, source })
    },
    [point, label, source]
  )

  const useMyLocation = useCallback(async () => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setError("Location isn't supported by this browser.")
      return
    }

    setIsLocating(true)
    setError(null)

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const p: LatLng = { lat: pos.coords.latitude, lng: pos.coords.longitude }
        let rev = "your location"
        try {
          const res = await reverseGeocode(p)
          if (res) rev = res
        } catch {
          // Fall back to "your location"
        }
        saveLocation({ point: p, label: rev, radiusKm, source: "gps" })
        setIsLocating(false)
      },
      (err) => {
        setIsLocating(false)
        if (err.code === 1) {
          setError("Location access was denied. Search a place instead.")
        } else {
          setError("Couldn't get your location. Search a place instead.")
        }
      },
      { timeout: 8000, enableHighAccuracy: true }
    )
  }, [radiusKm])

  const value = useMemo<RecipientLocationContextValue>(
    () => ({
      point,
      label,
      source,
      radiusKm,
      status,
      error,
      setPlace,
      setRadiusKm,
      useMyLocation,
    }),
    [point, label, source, radiusKm, status, error, setPlace, setRadiusKm, useMyLocation]
  )

  return <RecipientLocationContext.Provider value={value}>{children}</RecipientLocationContext.Provider>
}

export function useRecipientLocation() {
  const ctx = useContext(RecipientLocationContext)
  if (!ctx) {
    throw new Error("useRecipientLocation must be used within a RecipientLocationProvider")
  }
  return ctx
}
