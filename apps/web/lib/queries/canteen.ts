import { ACTIVE_LISTING_STATUSES, type Tables } from "@platelink/shared"
import type { BrowserSupabase } from "@/lib/supabase/client"

export type Listing = Tables<"food_listings">
export type Order = Tables<"orders">
export type OrderEvent = Tables<"order_events">
export type ContactInfo = Pick<Tables<"users">, "id" | "name" | "phone">

export const canteenKeys = {
  all: ["canteen"] as const,
  stats: () => [...canteenKeys.all, "stats"] as const,
  active: () => [...canteenKeys.all, "active"] as const,
  history: (page: number) => [...canteenKeys.all, "history", page] as const,
  listing: (id: string) => [...canteenKeys.all, "listing", id] as const,
}

export async function fetchStats(supabase: BrowserSupabase) {
  const { data, error } = await supabase.rpc("canteen_stats")
  if (error) throw error
  const row = data?.[0]
  return {
    active: Number(row?.active_listings ?? 0),
    total: Number(row?.total_listings ?? 0),
    delivered: Number(row?.deliveries_completed ?? 0),
    portions: Number(row?.portions_donated ?? 0),
  }
}

export async function fetchActiveListings(supabase: BrowserSupabase, canteenId: string) {
  const { data, error } = await supabase
    .from("food_listings")
    .select("*")
    .eq("canteen_id", canteenId)
    .in("status", ACTIVE_LISTING_STATUSES)
    .order("expires_at", { ascending: true })
  if (error) throw error
  return data
}

export const HISTORY_PAGE_SIZE = 15

export async function fetchHistory(supabase: BrowserSupabase, canteenId: string, page: number) {
  const from = page * HISTORY_PAGE_SIZE
  const { data, error, count } = await supabase
    .from("food_listings")
    .select("*, orders(delivered_at, status)", { count: "exact" })
    .eq("canteen_id", canteenId)
    .order("created_at", { ascending: false })
    .range(from, from + HISTORY_PAGE_SIZE - 1)
  if (error) throw error
  return { rows: data, total: count ?? 0 }
}

export type ListingDetail = {
  listing: Listing
  order: Order | null
  events: OrderEvent[]
  recipient: ContactInfo | null
  driver: ContactInfo | null
}

export async function fetchListingDetail(supabase: BrowserSupabase, id: string): Promise<ListingDetail> {
  const { data: listing, error } = await supabase.from("food_listings").select("*").eq("id", id).single()
  if (error) throw error

  // Latest non-cancelled order wins; fall back to the most recent one.
  const { data: orders, error: oErr } = await supabase
    .from("orders")
    .select("*")
    .eq("listing_id", id)
    .order("created_at", { ascending: false })
  if (oErr) throw oErr
  const order = orders.find((o) => o.status !== "cancelled") ?? orders[0] ?? null

  let events: OrderEvent[] = []
  let recipient: ContactInfo | null = null
  let driver: ContactInfo | null = null

  if (order) {
    const ids = [order.user_id, order.driver_id].filter((v): v is string => Boolean(v))
    const [ev, people] = await Promise.all([
      supabase.from("order_events").select("*").eq("order_id", order.id).order("created_at"),
      supabase.from("users").select("id, name, phone").in("id", ids),
    ])
    if (ev.error) throw ev.error
    if (people.error) throw people.error
    events = ev.data
    recipient = people.data.find((p) => p.id === order.user_id) ?? null
    driver = people.data.find((p) => p.id === order.driver_id) ?? null
  }

  return { listing, order, events, recipient, driver }
}
