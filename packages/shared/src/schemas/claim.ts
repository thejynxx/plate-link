import { z } from "zod"

export const claimListingSchema = z.object({
  dropoff_address: z.string().trim().min(3, "Pick an address or drop a pin"),
  dropoff_lat: z.number().min(-90).max(90),
  dropoff_lng: z.number().min(-180).max(180),
  notes: z.string().trim().max(500, "Notes must be 500 characters or fewer").optional(),
})

export type ClaimListingInput = z.infer<typeof claimListingSchema>
