import { DEFAULT_CENTER, PHOTON_URL, photonLabel, type LatLng, type PhotonFeature } from "@platelink/shared"

export type PlaceResult = { id: string; label: string; lat: number; lng: number }

function toResult(f: PhotonFeature): PlaceResult {
  const [lng, lat] = f.geometry.coordinates
  return {
    id: `${f.properties.osm_type ?? "x"}${f.properties.osm_id ?? `${lat},${lng}`}`,
    label: photonLabel(f),
    lat,
    lng,
  }
}

/** Free OSM geocoding via Photon. Fair use: debounce input, keep limit small. */
export async function searchPlaces(query: string, near: LatLng = DEFAULT_CENTER, signal?: AbortSignal) {
  const params = new URLSearchParams({
    q: query,
    lat: String(near.lat),
    lon: String(near.lng),
    limit: "6",
    lang: "en",
  })
  const res = await fetch(`${PHOTON_URL}/api/?${params}`, { signal })
  if (!res.ok) throw new Error("Address search is unavailable right now")
  const json = (await res.json()) as { features: PhotonFeature[] }
  return json.features.map(toResult)
}

export async function reverseGeocode(point: LatLng, signal?: AbortSignal) {
  const params = new URLSearchParams({ lat: String(point.lat), lon: String(point.lng), lang: "en" })
  const res = await fetch(`${PHOTON_URL}/reverse?${params}`, { signal })
  if (!res.ok) return null
  const json = (await res.json()) as { features: PhotonFeature[] }
  const f = json.features[0]
  return f ? toResult(f).label : null
}
