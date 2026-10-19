export type RouteGeometry = {
  type: "LineString"
  coordinates: [number, number][]
}

export type RouteResponse = {
  geometry: RouteGeometry
  distanceM: number
  durationS: number
}

/**
 * Fetches a driving route from the server routes proxy (/api/routes).
 * Converts { lat, lng } points into [lng, lat] coordinate tuples.
 * Returns null on any error (callers fall back to a straight line).
 */
export async function fetchRoute(
  points: { lat: number; lng: number }[]
): Promise<RouteResponse | null> {
  if (points.length < 2 || points.length > 4) {
    return null
  }

  try {
    const res = await fetch("/api/routes", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        coordinates: points.map((p) => [p.lng, p.lat]),
      }),
    })

    if (!res.ok) {
      return null
    }

    const data = await res.json()
    if (!data?.geometry || typeof data.distance_m !== "number" || typeof data.duration_s !== "number") {
      return null
    }

    return {
      geometry: data.geometry as RouteGeometry,
      distanceM: data.distance_m,
      durationS: data.duration_s,
    }
  } catch {
    return null
  }
}
