import type { BrowserSupabase } from "@/lib/supabase/client"
import {
  canteenKeys,
  fetchActiveListings,
  fetchCanteenListingDetail,
  fetchCanteenStats,
  fetchHistory,
  HISTORY_PAGE_SIZE,
  type CanteenListingDetail,
  type ContactInfo,
  type Listing,
  type Order,
  type OrderEvent,
} from "@platelink/shared"

export type { Listing, Order, OrderEvent, ContactInfo }
export type ListingDetail = CanteenListingDetail
export { canteenKeys, HISTORY_PAGE_SIZE }

export async function fetchStats(supabase: BrowserSupabase) {
  return fetchCanteenStats(supabase)
}

export { fetchActiveListings, fetchHistory }

export async function fetchListingDetail(supabase: BrowserSupabase, id: string): Promise<ListingDetail> {
  return fetchCanteenListingDetail(supabase, id)
}
