import { supabase } from "@/lib/supabase"

export type RoutePoint = [number, number] | { lat: number; lng: number }

export interface RouteResult {
  geometry: {
    type: "LineString"
    coordinates: [number, number][]
  }
  distanceM: number
  durationS: number
}

/**
 * Fetch a driving route between 2-4 points from the Plate-Link web API.
 * Uses Bearer token authentication from the current Supabase session.
 * Returns null on any failure.
 */
export async function fetchRoute(
  points: RoutePoint[]
): Promise<RouteResult | null> {
  try {
    if (!points || points.length < 2) {
      return null
    }

    const baseUrl = process.env.EXPO_PUBLIC_WEB_URL ?? "http://127.0.0.1:3000"

    const {
      data: { session },
    } = await supabase.auth.getSession()

    if (!session?.access_token) {
      return null
    }

    // Convert points to [lng, lat] format
    const coordinates: [number, number][] = points.map((p) => {
      if (Array.isArray(p)) {
        return [p[0], p[1]]
      }
      return [p.lng, p.lat]
    })

    const res = await fetch(`${baseUrl}/api/routes`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ coordinates }),
    })

    if (!res.ok) {
      return null
    }

    const data = await res.json()
    if (
      !data ||
      !data.geometry ||
      !Array.isArray(data.geometry.coordinates) ||
      typeof data.distance_m !== "number" ||
      typeof data.duration_s !== "number"
    ) {
      return null
    }

    return {
      geometry: data.geometry,
      distanceM: data.distance_m,
      durationS: data.duration_s,
    }
  } catch (err) {
    console.warn("[routes] Failed to fetch route:", err)
    return null
  }
}
