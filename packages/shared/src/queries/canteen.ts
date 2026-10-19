import type { SupabaseClient } from "@supabase/supabase-js"
import { ACTIVE_LISTING_STATUSES } from "../constants"
import type { Database, Tables } from "../database.types"

export type Listing = Tables<"food_listings">
export type Order = Tables<"orders">
export type OrderEvent = Tables<"order_events">
export type ContactInfo = Pick<Tables<"users">, "id" | "name" | "phone">

export const canteenKeys = {
  all: ["canteen"] as const,
  stats: () => [...canteenKeys.all, "stats"] as const,
  active: (canteenId?: string) =>
    canteenId ? ([...canteenKeys.all, "active", canteenId] as const) : ([...canteenKeys.all, "active"] as const),
  history: (pageOrCanteenId: number | string, page?: number) =>
    page !== undefined
      ? ([...canteenKeys.all, "history", pageOrCanteenId, page] as const)
      : ([...canteenKeys.all, "history", pageOrCanteenId] as const),
  listing: (id: string) => [...canteenKeys.all, "listing", id] as const,
  canteen: (id: string) => [...canteenKeys.all, "detail", id] as const,
}

export async function fetchCanteenProfile(supabase: SupabaseClient<Database>, canteenId: string) {
  const { data, error } = await supabase.from("canteens").select("*").eq("id", canteenId).maybeSingle()
  if (error) throw error
  return data
}

export async function fetchCanteenStats(supabase: SupabaseClient<Database>) {
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

export async function fetchActiveListings(supabase: SupabaseClient<Database>, canteenId: string) {
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

export async function fetchHistory(supabase: SupabaseClient<Database>, canteenId: string, page: number) {
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

export type CanteenListingDetail = {
  listing: Listing
  order: Order | null
  events: OrderEvent[]
  recipient: ContactInfo | null
  driver: ContactInfo | null
}

export async function fetchCanteenListingDetail(
  supabase: SupabaseClient<Database>,
  id: string
): Promise<CanteenListingDetail> {
  const { data: listing, error } = await supabase.from("food_listings").select("*").eq("id", id).single()
  if (error) throw error

  // Latest non-cancelled order wins; fall back to the most recent one.
  const { data: orders, error: oErr } = await supabase
    .from("orders")
    .select("*")
    .eq("listing_id", id)
    .order("created_at", { ascending: false })
  if (oErr) throw oErr
  const order = orders?.find((o) => o.status !== "cancelled") ?? orders?.[0] ?? null

  let events: OrderEvent[] = []
  let recipient: ContactInfo | null = null
  let driver: ContactInfo | null = null

  if (order) {
    const ids = [order.user_id, order.driver_id].filter((v): v is string => Boolean(v))
    const [ev, people] = await Promise.all([
      supabase.from("order_events").select("*").eq("order_id", order.id).order("created_at"),
      ids.length > 0
        ? supabase.from("users").select("id, name, phone").in("id", ids)
        : Promise.resolve({ data: [] as ContactInfo[], error: null }),
    ])
    if (ev.error) throw ev.error
    if (people.error) throw people.error
    events = ev.data ?? []
    recipient = people.data?.find((p) => p.id === order.user_id) ?? null
    driver = people.data?.find((p) => p.id === order.driver_id) ?? null
  }

  return { listing, order, events, recipient, driver }
}
