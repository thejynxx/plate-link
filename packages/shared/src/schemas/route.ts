import { z } from "zod"

export const routeCoordinateSchema = z.tuple([
  z.number().min(-180, "Longitude must be between -180 and 180").max(180, "Longitude must be between -180 and 180"),
  z.number().min(-90, "Latitude must be between -90 and 90").max(90, "Latitude must be between -90 and 90"),
])

export const routeRequestSchema = z.object({
  coordinates: z
    .array(routeCoordinateSchema)
    .min(2, "At least 2 points are required")
    .max(4, "At most 4 points are allowed"),
})

export type RouteCoordinate = z.infer<typeof routeCoordinateSchema>
export type RouteRequest = z.infer<typeof routeRequestSchema>
