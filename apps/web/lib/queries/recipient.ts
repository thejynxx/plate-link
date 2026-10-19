import type { BrowserSupabase } from "@/lib/supabase/client"
import {
  recipientKeys,
  fetchNearby as sharedFetchNearby,
  fetchListing as sharedFetchListing,
  claimListing as sharedClaimListing,
  cancelOrder as sharedCancelOrder,
  fetchMyOrders as sharedFetchMyOrders,
  fetchOrderTracking as sharedFetchOrderTracking,
  type NearbyListing,
  type ListingDetail,
  type MyClaimOrder,
  type DriverInfo,
  type DriverLocation,
  type OrderTrackingDetail,
  type ClaimListingParams,
} from "@platelink/shared"

export type {
  NearbyListing,
  ListingDetail,
  MyClaimOrder,
  DriverInfo,
  DriverLocation,
  OrderTrackingDetail,
  ClaimListingParams,
}

export { recipientKeys }

export async function fetchNearby(
  supabase: BrowserSupabase,
  params: { lat: number; lng: number; radiusM: number }
): Promise<NearbyListing[]> {
  return sharedFetchNearby(supabase, params)
}

export async function fetchListing(
  supabase: BrowserSupabase,
  id: string
): Promise<ListingDetail | null> {
  return sharedFetchListing(supabase, id)
}

export async function claimListing(
  supabase: BrowserSupabase,
  params: ClaimListingParams
) {
  return sharedClaimListing(supabase, params)
}

export async function cancelOrder(
  supabase: BrowserSupabase,
  orderId: string
) {
  return sharedCancelOrder(supabase, orderId)
}

export async function fetchMyOrders(
  supabase: BrowserSupabase,
  userId: string
): Promise<MyClaimOrder[]> {
  return sharedFetchMyOrders(supabase, userId)
}

export async function fetchOrderTracking(
  supabase: BrowserSupabase,
  orderId: string
): Promise<OrderTrackingDetail | null> {
  return sharedFetchOrderTracking(supabase, orderId)
}
