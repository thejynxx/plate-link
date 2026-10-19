import { createBrowserClient } from "@supabase/ssr"
import type { Database } from "@platelink/shared"
import { SUPABASE_ANON_KEY, SUPABASE_URL, assertEnv } from "@/lib/env"

let client: ReturnType<typeof createBrowserClient<Database>> | undefined

/** Browser client — a singleton so Realtime channels share one socket. */
export function createClient() {
  if (client) return client
  assertEnv()
  client = createBrowserClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY)
  return client
}

export type BrowserSupabase = ReturnType<typeof createClient>
