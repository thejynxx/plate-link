import { z } from "zod"

export const messageSchema = z.object({
  body: z.string().trim().min(1, "Type a message").max(2000, "Keep it under 2000 characters"),
})
export type MessageInput = z.infer<typeof messageSchema>

export type ChatParticipant = { id: string; name: string; role: "canteen" | "driver" | "user"; phone: string | null }
