import { z } from "zod"

export const listingSchema = z
  .object({
    title: z.string().trim().min(2, "Title is too short").max(120),
    description: z.string().trim().max(1000).optional(),
    food_type: z.enum(["veg", "non_veg", "vegan", "mixed"]),
    quantity: z.number({ error: "Enter portions" }).int().positive("Must be at least 1").max(10000),
    prepared_at: z.date().optional(),
    expires_at: z.date({ error: "Pick an expiry time" }),
  })
  .refine((v) => v.expires_at.getTime() > Date.now() + 60_000, {
    path: ["expires_at"],
    message: "Expiry must be in the future",
  })
  .refine((v) => !v.prepared_at || v.prepared_at < v.expires_at, {
    path: ["prepared_at"],
    message: "Prepared time must be before expiry",
  })
export type ListingInput = z.infer<typeof listingSchema>
