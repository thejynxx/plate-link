import type { BrowserSupabase } from "@/lib/supabase/client"
import {
  chatKeys,
  fetchConversations,
  fetchInbox as sharedFetchInbox,
  fetchMessages as sharedFetchMessages,
  sendMessage as sharedSendMessage,
  markRead as sharedMarkRead,
  openOrderChat as sharedOpenOrderChat,
  openListingChat as sharedOpenListingChat,
  ROLE_NAME,
  type Conversation,
  type Message,
  type ChatParticipant,
} from "@platelink/shared"

export type { Conversation, Message, ChatParticipant }
export { chatKeys, fetchConversations, ROLE_NAME }

export const PAGE = 60

export async function fetchInbox(supabase: BrowserSupabase): Promise<Conversation[]> {
  return sharedFetchInbox(supabase)
}

export async function fetchMessages(supabase: BrowserSupabase, conversationId: string) {
  return sharedFetchMessages(supabase, conversationId, PAGE)
}

export async function sendMessage(
  supabase: BrowserSupabase,
  conversationId: string,
  senderId: string,
  body: string
) {
  return sharedSendMessage(supabase, conversationId, senderId, body)
}

export async function markRead(supabase: BrowserSupabase, conversationId: string) {
  return sharedMarkRead(supabase, conversationId)
}

export async function openOrderChat(supabase: BrowserSupabase, orderId: string) {
  return sharedOpenOrderChat(supabase, orderId)
}

export async function openListingChat(supabase: BrowserSupabase, listingId: string) {
  return sharedOpenListingChat(supabase, listingId)
}
