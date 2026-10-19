import type { BrowserSupabase } from "@/lib/supabase/client"

export const dishKeys = {
  yours: (id: string) => ["dishes", "yours", id] as const,
  nearby: (lat: number, lng: number) => ["dishes", "nearby", lat.toFixed(2), lng.toFixed(2)] as const,
}

/** Titles this canteen has listed before (most recent first, de-duplicated). */
export async function fetchYourDishes(supabase: BrowserSupabase, canteenId: string) {
  const { data, error } = await supabase
    .from("food_listings")
    .select("title")
    .eq("canteen_id", canteenId)
    .order("created_at", { ascending: false })
    .limit(200)
  if (error) throw error
  return [...new Set(data.map((r) => r.title.trim()))]
}

/** What other canteens within 10 km are listing right now. */
export async function fetchNearbyDishes(supabase: BrowserSupabase, lat: number, lng: number, canteenId: string) {
  const { data, error } = await supabase.rpc("nearby_listings", { p_lat: lat, p_lng: lng, p_radius_m: 10000 })
  if (error) return [] // suggestions are best-effort
  return [...new Set(data.filter((r) => r.canteen_id !== canteenId).map((r) => r.title.trim()))]
}
