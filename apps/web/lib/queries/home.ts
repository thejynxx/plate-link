import { DEFAULT_CENTER, type ListingStatus, type OrderStatus } from "@platelink/shared"
import type { BrowserSupabase } from "@/lib/supabase/client"

export const homeKeys = {
  canteen: (id: string) => ["home", "canteen", id] as const,
  recipient: (id: string) => ["home", "recipient", id] as const,
}

export type HomeTicket = {
  id: string
  title: string
  portions: number
  status: ListingStatus | OrderStatus
  kind: "listing" | "order" | "nearby"
  canteen: string
  place: string
  at: string | null
  expiresAt: string
}

/** A canteen's three most recent listings, any status. */
export async function fetchCanteenTickets(supabase: BrowserSupabase, canteenId: string, orgName: string, place: string): Promise<HomeTicket[]> {
  const { data, error } = await supabase
    .from("food_listings")
    .select("id, title, quantity, status, expires_at, updated_at")
    .eq("canteen_id", canteenId)
    .order("created_at", { ascending: false })
    .limit(3)
  if (error) throw error
  return data.map((l) => ({
    id: l.id,
    title: l.title,
    portions: l.quantity,
    status: l.status,
    kind: "listing",
    canteen: orgName,
    place,
    at: l.updated_at,
    expiresAt: l.expires_at,
  }))
}

/** An NGO's latest claims, topped up with food available nearby. */
export async function fetchRecipientTickets(supabase: BrowserSupabase, userId: string): Promise<HomeTicket[]> {
  const { data: orders, error } = await supabase
    .from("orders")
    .select("id, status, created_at, delivered_at, listing:food_listings(title, quantity, expires_at), canteen:canteens(org_name, address)")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(3)
  if (error) throw error

  const tickets: HomeTicket[] = orders.map((o) => ({
    id: o.id,
    title: o.listing?.title ?? "Food",
    portions: o.listing?.quantity ?? 0,
    status: o.status,
    kind: "order",
    canteen: o.canteen?.org_name ?? "Canteen",
    place: (o.canteen?.address ?? "").split(",")[0] ?? "",
    at: o.delivered_at ?? o.created_at,
    expiresAt: o.listing?.expires_at ?? o.created_at,
  }))

  if (tickets.length < 3) {
    const { data: nearby } = await supabase.rpc("nearby_listings", {
      p_lat: DEFAULT_CENTER.lat,
      p_lng: DEFAULT_CENTER.lng,
      p_radius_m: 50000,
    })
    for (const l of (nearby ?? []).slice(0, 3 - tickets.length)) {
      tickets.push({
        id: l.id,
        title: l.title,
        portions: l.quantity,
        status: "available",
        kind: "nearby",
        canteen: l.canteen_name,
        place: `${(l.distance_m / 1000).toFixed(1)} km away`,
        at: null,
        expiresAt: l.expires_at,
      })
    }
  }
  return tickets
}
