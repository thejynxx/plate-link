import { z } from "zod"

export const phoneSchema = z
  .string()
  .trim()
  .regex(/^\+?[0-9 ()-]{7,20}$/, "Enter a valid phone number")

export const loginSchema = z.object({
  email: z.email("Enter a valid email"),
  password: z.string().min(1, "Password is required"),
})
export type LoginInput = z.infer<typeof loginSchema>

export const registerSchema = z.object({
  role: z.enum(["canteen", "user", "driver"]),
  name: z.string().trim().min(2, "Name is too short").max(120),
  phone: phoneSchema,
  email: z.email("Enter a valid email"),
  password: z.string().min(8, "At least 8 characters"),
})
export type RegisterInput = z.infer<typeof registerSchema>
