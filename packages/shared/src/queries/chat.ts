import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database, Tables } from "../database.types"
import { messageSchema, type ChatParticipant } from "../schemas/chat"

export type Message = Tables<"messages">

export type Conversation = {
  id: string
  kind: "order" | "listing"
  order_id: string | null
  listing_id: string | null
  title: string
  photo_url: string | null
  order_status: string | null
  last_message_at: string | null
  last_message_preview: string | null
  unread: number
  participants: ChatParticipant[]
  created_at: string
}

export const chatKeys = {
  all: ["chat"] as const,
  inbox: () => [...chatKeys.all, "inbox"] as const,
  thread: (id: string) => [...chatKeys.all, "thread", id] as const,
}

export const ROLE_NAME: Record<ChatParticipant["role"], string> = {
  canteen: "Canteen",
  user: "NGO",
  driver: "Driver",
}

export async function fetchConversations(
  supabase: SupabaseClient<Database>
): Promise<Conversation[]> {
  const { data, error } = await supabase.rpc("my_conversations")
  if (error) {
    if (error.code === "PGRST202" || error.message.includes("my_conversations")) {
      throw new Error(
        "Chat isn't set up yet. Run supabase/migrations/0002_chat.sql in the Supabase SQL Editor."
      )
    }
    throw error
  }
  return (data ?? []).map((c) => ({
    ...c,
    kind: c.kind as Conversation["kind"],
    unread: Number(c.unread),
    participants: (c.participants ?? []) as unknown as ChatParticipant[],
  }))
}

// Alias for web backwards-compatibility
export const fetchInbox = fetchConversations

export const MESSAGES_LIMIT = 200

export async function fetchMessages(
  supabase: SupabaseClient<Database>,
  conversationId: string,
  limit = MESSAGES_LIMIT
): Promise<Message[]> {
  const { data, error } = await supabase
    .from("messages")
    .select("*")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true })
    .limit(limit)

  if (error) throw error
  return data ?? []
}

export async function sendMessage(
  supabase: SupabaseClient<Database>,
  conversationId: string,
  senderId: string,
  body: string
): Promise<Message> {
  const parsed = messageSchema.parse({ body })
  const { data, error } = await supabase
    .from("messages")
    .insert({
      conversation_id: conversationId,
      sender_id: senderId,
      body: parsed.body,
    })
    .select("*")
    .single()

  if (error) throw error
  return data
}

export async function markRead(
  supabase: SupabaseClient<Database>,
  conversationId: string
): Promise<void> {
  const { error } = await supabase.rpc("mark_conversation_read", {
    p_conversation_id: conversationId,
  })
  if (error) {
    console.warn("[chat] markRead error:", error.message)
  }
}

export async function openOrderChat(
  supabase: SupabaseClient<Database>,
  orderId: string
): Promise<string> {
  const { data, error } = await supabase.rpc("open_order_chat", {
    p_order_id: orderId,
  })
  if (error) throw error
  return data as string
}

export async function openListingChat(
  supabase: SupabaseClient<Database>,
  listingId: string
): Promise<string> {
  const { data, error } = await supabase.rpc("open_listing_chat", {
    p_listing_id: listingId,
  })
  if (error) throw error
  return data as string
}
