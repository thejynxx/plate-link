import { z } from "zod"

export const canteenOnboardingSchema = z.object({
  org_name: z.string().trim().min(2, "Name is too short").max(160),
  address: z.string().trim().min(5, "Pick an address or drop a pin"),
  location_lat: z.number().min(-90).max(90),
  location_lng: z.number().min(-180).max(180),
  place_id: z.string().optional(),
  pickup_instructions: z.string().trim().max(500).optional(),
})
export type CanteenOnboardingInput = z.infer<typeof canteenOnboardingSchema>
