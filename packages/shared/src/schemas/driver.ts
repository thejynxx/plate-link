import { z } from "zod"
import { phoneSchema } from "./auth"

export const vehicleTypes = ["bike", "scooter", "car", "van", "other"] as const
export type VehicleType = (typeof vehicleTypes)[number]

export const driverProfileSchema = z.object({
  name: z.string().trim().min(2, "Name is too short").max(120),
  phone: phoneSchema,
  vehicle_type: z.enum(vehicleTypes),
  vehicle_number: z.string().trim().max(30),
})

export type DriverProfileInput = z.infer<typeof driverProfileSchema>
