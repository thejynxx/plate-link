import type { ChatParticipant, Tables } from "@platelink/shared"
import type { BrowserSupabase } from "@/lib/supabase/client"

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

export async function fetchInbox(supabase: BrowserSupabase): Promise<Conversation[]> {
  const { data, error } = await supabase.rpc("my_conversations")
  if (error) {
    // 0002_chat.sql not applied yet → show an actionable message instead of a crash
    if (error.code === "PGRST202" || error.message.includes("my_conversations")) {
      throw new Error("Chat isn't set up yet. Run supabase/migrations/0002_chat.sql in the Supabase SQL Editor.")
    }
    throw error
  }
  return data.map((c) => ({
    ...c,
    kind: c.kind as Conversation["kind"],
    unread: Number(c.unread),
    participants: (c.participants ?? []) as unknown as ChatParticipant[],
  }))
}

export const PAGE = 60

export async function fetchMessages(supabase: BrowserSupabase, conversationId: string) {
  const { data, error } = await supabase
    .from("messages")
    .select("*")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: false })
    .limit(PAGE)
  if (error) throw error
  return data.reverse()
}

export async function sendMessage(supabase: BrowserSupabase, conversationId: string, senderId: string, body: string) {
  const { data, error } = await supabase
    .from("messages")
    .insert({ conversation_id: conversationId, sender_id: senderId, body })
    .select("*")
    .single()
  if (error) throw error
  return data
}

export async function markRead(supabase: BrowserSupabase, conversationId: string) {
  await supabase.rpc("mark_conversation_read", { p_conversation_id: conversationId })
}

export async function openOrderChat(supabase: BrowserSupabase, orderId: string) {
  const { data, error } = await supabase.rpc("open_order_chat", { p_order_id: orderId })
  if (error) throw error
  return data
}

export async function openListingChat(supabase: BrowserSupabase, listingId: string) {
  const { data, error } = await supabase.rpc("open_listing_chat", { p_listing_id: listingId })
  if (error) throw error
  return data
}

export const ROLE_NAME: Record<ChatParticipant["role"], string> = {
  canteen: "Canteen",
  user: "NGO",
  driver: "Driver",
}
