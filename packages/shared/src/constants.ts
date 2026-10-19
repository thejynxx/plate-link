import type { Enums } from "./database.types"

export type UserRole = Enums<"user_role">
export type ListingStatus = Enums<"listing_status">
export type OrderStatus = Enums<"order_status">
export type FoodType = Enums<"food_type">

export const ROLE_HOME: Record<UserRole, string> = {
  canteen: "/canteen/home",
  user: "/app/home",
  driver: "/get-the-app",
}

export const ROLE_LABEL: Record<UserRole, string> = {
  canteen: "Canteen",
  user: "NGO / Recipient",
  driver: "Driver",
}

export const FOOD_TYPE_LABEL: Record<FoodType, string> = {
  veg: "Veg",
  non_veg: "Non-veg",
  vegan: "Vegan",
  mixed: "Mixed",
}

export const LISTING_STATUS_LABEL: Record<ListingStatus, string> = {
  available: "Available",
  claimed: "Claimed",
  picked_up: "Picked up",
  delivered: "Delivered",
  expired: "Expired",
  cancelled: "Cancelled",
}

export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  pending_driver: "Waiting for driver",
  driver_assigned: "Driver assigned",
  on_the_way: "On the way",
  completed: "Delivered",
  cancelled: "Cancelled",
}

/** Listing statuses that still need the canteen's attention. */
export const ACTIVE_LISTING_STATUSES: ListingStatus[] = ["available", "claimed", "picked_up"]

/** Default map centre (Chennai) used before geolocation resolves. */
export const DEFAULT_CENTER = { lat: 13.0827, lng: 80.2707 } as const

export const MAP_STYLE_LIGHT = "https://tiles.openfreemap.org/styles/liberty"
export const MAP_STYLE_DARK = "https://tiles.openfreemap.org/styles/dark"

export const PHOTON_URL = "https://photon.komoot.io"

export const STORAGE_BUCKETS = {
  avatars: "avatars",
  foodPhotos: "food-photos",
  deliveryProofs: "delivery-proofs",
} as const
