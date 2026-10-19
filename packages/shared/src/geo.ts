export type LatLng = { lat: number; lng: number }

/** Great-circle distance in metres. */
export function haversineMeters(a: LatLng, b: LatLng) {
  const R = 6371000
  const toRad = (d: number) => (d * Math.PI) / 180
  const dLat = toRad(b.lat - a.lat)
  const dLng = toRad(b.lng - a.lng)
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}

export function formatDistance(meters: number) {
  return meters < 1000 ? `${Math.round(meters)} m` : `${(meters / 1000).toFixed(1)} km`
}

export function formatDuration(seconds: number) {
  const m = Math.round(seconds / 60)
  if (m < 60) return `${m} min`
  return `${Math.floor(m / 60)} h ${m % 60} min`
}

/** Opens Google Maps navigation (free URL scheme, no API key). */
export function navigationUrl(dest: LatLng, origin?: LatLng) {
  const p = new URLSearchParams({ api: "1", destination: `${dest.lat},${dest.lng}`, travelmode: "driving" })
  if (origin) p.set("origin", `${origin.lat},${origin.lng}`)
  return `https://www.google.com/maps/dir/?${p.toString()}`
}

/** Photon (OSM) feature → readable address line. */
export type PhotonFeature = {
  geometry: { coordinates: [number, number] }
  properties: {
    name?: string
    housenumber?: string
    street?: string
    district?: string
    locality?: string
    city?: string
    state?: string
    postcode?: string
    country?: string
    osm_id?: number
    osm_type?: string
  }
}

export function photonLabel(f: PhotonFeature) {
  const p = f.properties
  const street = [p.housenumber, p.street].filter(Boolean).join(" ")
  const parts = [p.name, street, p.district ?? p.locality, p.city, p.state, p.postcode]
  return [...new Set(parts.filter(Boolean))].join(", ")
}
