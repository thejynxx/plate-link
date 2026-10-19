import type { Database, Tables } from "@platelink/shared"
import type { BrowserSupabase } from "@/lib/supabase/client"

export type NearbyListing = Database["public"]["Functions"]["nearby_listings"]["Returns"][number]

export type ListingDetail = Tables<"food_listings"> & {
  canteens: Pick<
    Tables<"canteens">,
    "org_name" | "address" | "pickup_instructions" | "location_lat" | "location_lng"
  > | null
}

export const recipientKeys = {
  all: ["recipient"] as const,
  nearby: (lat?: number, lng?: number, radiusM?: number) =>
    lat !== undefined && lng !== undefined && radiusM !== undefined
      ? ([...recipientKeys.all, "nearby", lat, lng, radiusM] as const)
      : ([...recipientKeys.all, "nearby"] as const),
  listing: (id: string) => [...recipientKeys.all, "listing", id] as const,
  orders: (userId?: string) =>
    userId ? ([...recipientKeys.all, "orders", userId] as const) : ([...recipientKeys.all, "orders"] as const),
  order: (id: string) => [...recipientKeys.all, "order", id] as const,
}

export type MyClaimOrder = Tables<"orders"> & {
  food_listings: Pick<Tables<"food_listings">, "title" | "photo_url" | "quantity" | "food_type"> | null
  canteens: Pick<Tables<"canteens">, "org_name"> | null
}

export type DriverInfo = {
  name: string
  phone: string | null
  avatar_url: string | null
  vehicle_type: string | null
  vehicle_number: string | null
}

export type DriverLocation = {
  current_lat: number
  current_lng: number
  heading: number | null
  last_updated: string
  speed_mps?: number | null
}

export type OrderTrackingDetail = Tables<"orders"> & {
  food_listings: Tables<"food_listings"> | null
  canteens: Pick<
    Tables<"canteens">,
    "org_name" | "address" | "pickup_instructions" | "location_lat" | "location_lng"
  > | null
  order_events: Tables<"order_events">[]
  driver: DriverInfo | null
  driver_location: DriverLocation | null
}

export async function fetchNearby(
  supabase: BrowserSupabase,
  params: { lat: number; lng: number; radiusM: number }
): Promise<NearbyListing[]> {
  const { data, error } = await supabase.rpc("nearby_listings", {
    p_lat: params.lat,
    p_lng: params.lng,
    p_radius_m: params.radiusM,
  })
  if (error) throw error
  return data ?? []
}

export async function fetchListing(
  supabase: BrowserSupabase,
  id: string
): Promise<ListingDetail | null> {
  const { data, error } = await supabase
    .from("food_listings")
    .select("*, canteens(org_name, address, pickup_instructions, location_lat, location_lng)")
    .eq("id", id)
    .maybeSingle()

  if (error) throw error
  return (data as ListingDetail | null) ?? null
}

export async function fetchMyOrders(
  supabase: BrowserSupabase,
  userId: string
): Promise<MyClaimOrder[]> {
  const { data, error } = await supabase
    .from("orders")
    .select("*, food_listings(title, photo_url, quantity, food_type), canteens(org_name)")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })

  if (error) throw error
  return (data as MyClaimOrder[]) ?? []
}

export async function fetchOrderTracking(
  supabase: BrowserSupabase,
  orderId: string
): Promise<OrderTrackingDetail | null> {
  const { data: order, error } = await supabase
    .from("orders")
    .select(
      "*, food_listings(*), canteens(org_name, address, pickup_instructions, location_lat, location_lng), order_events(*)"
    )
    .eq("id", orderId)
    .maybeSingle()

  if (error) throw error
  if (!order) return null

  const rawEvents = (order.order_events ?? []) as Tables<"order_events">[]
  const events = rawEvents.slice().sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  )

  let driver: DriverInfo | null = null
  let driverLocation: DriverLocation | null = null

  if (order.driver_id) {
    const [userRes, driverRes, locRes] = await Promise.all([
      supabase
        .from("users")
        .select("name, phone, avatar_url")
        .eq("id", order.driver_id)
        .maybeSingle(),
      supabase
        .from("drivers")
        .select("vehicle_type, vehicle_number")
        .eq("id", order.driver_id)
        .maybeSingle(),
      supabase
        .from("driver_locations")
        .select("current_lat, current_lng, heading, last_updated, speed_mps")
        .eq("driver_id", order.driver_id)
        .maybeSingle(),
    ])

    if (userRes.data) {
      driver = {
        name: userRes.data.name,
        phone: userRes.data.phone,
        avatar_url: userRes.data.avatar_url,
        vehicle_type: driverRes.data?.vehicle_type ?? null,
        vehicle_number: driverRes.data?.vehicle_number ?? null,
      }
    }

    if (locRes.data && !locRes.error) {
      driverLocation = locRes.data as DriverLocation
    }
  }

  return {
    ...order,
    order_events: events,
    driver,
    driver_location: driverLocation,
  } as OrderTrackingDetail
}



