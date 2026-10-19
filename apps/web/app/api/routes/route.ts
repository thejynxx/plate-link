import { NextResponse, type NextRequest } from "next/server"
import { createClient as createPlainClient } from "@supabase/supabase-js"
import { routeRequestSchema } from "@platelink/shared"
import { createClient } from "@/lib/supabase/server"

type RouteResponseData = {
  geometry: {
    type: "LineString"
    coordinates: [number, number][]
  }
  distance_m: number
  duration_s: number
}

type CacheEntry = {
  data: RouteResponseData
  expiresAt: number
}

const routeCache = new Map<string, CacheEntry>()

function getCacheKey(coordinates: [number, number][]): string {
  const rounded = coordinates.map(([lng, lat]) => [
    Number(lng.toFixed(5)),
    Number(lat.toFixed(5)),
  ])
  return JSON.stringify(rounded)
}

export async function POST(request: NextRequest) {
  let user: { id: string } | null = null

  // 1. Check for Bearer token authorization (e.g. mobile client)
  const authHeader = request.headers.get("authorization")
  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.substring(7).trim()
    if (token) {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
      const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
      if (supabaseUrl && supabaseAnonKey) {
        const plainSupabase = createPlainClient(supabaseUrl, supabaseAnonKey)
        const { data, error } = await plainSupabase.auth.getUser(token)
        if (!error && data.user) {
          user = data.user
        }
      }
    }
  }

  // 2. If no valid Bearer token, fall back to cookie session (web client)
  if (!user) {
    const supabase = await createClient()
    const {
      data: { user: cookieUser },
      error: authError,
    } = await supabase.auth.getUser()

    if (!authError && cookieUser) {
      user = cookieUser
    }
  }

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const parsed = routeRequestSchema.safeParse(body)
  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? "Invalid route request"
    return NextResponse.json({ error: message }, { status: 400 })
  }

  const apiKey = process.env.ORS_API_KEY
  if (!apiKey) {
    return NextResponse.json(
      { error: "Routing isn't configured. Add ORS_API_KEY to apps/web/.env.local." },
      { status: 500 }
    )
  }

  const key = getCacheKey(parsed.data.coordinates)
  const cached = routeCache.get(key)
  const now = Date.now()

  if (cached && cached.expiresAt > now) {
    return NextResponse.json(cached.data)
  }

  try {
    const res = await fetch("https://api.heigit.org/openrouteservice/v2/directions/driving-car/geojson", {
      method: "POST",
      headers: {
        Authorization: apiKey,
        "Content-Type": "application/json",
        Accept: "application/geo+json",
      },
      body: JSON.stringify({ coordinates: parsed.data.coordinates }),
    })

    if (!res.ok) {
      console.error(`ORS directions failed with status ${res.status}: ${res.statusText}`)
      return NextResponse.json({ error: "Couldn't get a route right now." }, { status: 502 })
    }

    const data = await res.json()
    const feature = data?.features?.[0]
    const geometry = feature?.geometry
    const summary = feature?.properties?.summary

    if (!geometry || typeof summary?.distance !== "number" || typeof summary?.duration !== "number") {
      console.error("ORS directions returned invalid feature structure", data)
      return NextResponse.json({ error: "Couldn't get a route right now." }, { status: 502 })
    }

    const payload: RouteResponseData = {
      geometry,
      distance_m: summary.distance,
      duration_s: summary.duration,
    }

    routeCache.set(key, { data: payload, expiresAt: now + 60_000 })

    return NextResponse.json(payload)
  } catch (error) {
    console.error("ORS directions request failed:", error)
    return NextResponse.json({ error: "Couldn't get a route right now." }, { status: 502 })
  }
}
