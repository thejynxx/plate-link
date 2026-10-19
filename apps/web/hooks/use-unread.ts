"use client"

import { useQuery } from "@tanstack/react-query"
import { createClient } from "@/lib/supabase/client"
import { chatKeys, fetchInbox } from "@/lib/queries/chat"
import { useRealtimeInvalidate } from "@/hooks/use-realtime-invalidate"

/** Inbox + total unread, kept live. Shared by the nav badge and the Messages page. */
export function useInbox(userId: string) {
  const supabase = createClient()
  const q = useQuery({ queryKey: chatKeys.inbox(), queryFn: () => fetchInbox(supabase), retry: false })
  // conversations rows change on every new message (preview/time), RLS limits it to my threads
  useRealtimeInvalidate(`inbox-${userId}`, [{ table: "conversations" }], [chatKeys.inbox()], !q.isError)
  const unread = (q.data ?? []).reduce((n, c) => n + c.unread, 0)
  return { ...q, unread }
}
