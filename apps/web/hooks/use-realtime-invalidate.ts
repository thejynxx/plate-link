"use client"

import { useEffect, useId } from "react"
import { useQueryClient, type QueryKey } from "@tanstack/react-query"
import { createClient } from "@/lib/supabase/client"

type Watch = {
  table: "food_listings" | "orders" | "order_events" | "driver_locations" | "messages" | "conversations"
  filter?: string
}

/**
 * Subscribes to Postgres changes (RLS applies) and invalidates the given
 * React Query keys when anything matching arrives.
 */
export function useRealtimeInvalidate(channelName: string, watches: Watch[], keys: QueryKey[], enabled = true) {
  const queryClient = useQueryClient()
  // Two components may watch the same thing (e.g. nav badge + inbox page); Supabase
  // reuses channels by name, so each hook instance needs its own topic.
  const instance = useId()
  const watchSig = JSON.stringify(watches)
  const keySig = JSON.stringify(keys)

  useEffect(() => {
    if (!enabled) return
    const supabase = createClient()
    const parsedWatches = JSON.parse(watchSig) as Watch[]
    const parsedKeys = JSON.parse(keySig) as QueryKey[]
    const channel = supabase.channel(`${channelName}:${instance}`)

    for (const w of parsedWatches) {
      channel.on(
        "postgres_changes",
        { event: "*", schema: "public", table: w.table, ...(w.filter ? { filter: w.filter } : {}) },
        () => parsedKeys.forEach((queryKey) => queryClient.invalidateQueries({ queryKey }))
      )
    }
    channel.subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [channelName, instance, watchSig, keySig, enabled, queryClient])
}
