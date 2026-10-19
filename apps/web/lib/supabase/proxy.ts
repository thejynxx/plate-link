import { NextResponse, type NextRequest } from "next/server"
import { createServerClient } from "@supabase/ssr"
import type { Database } from "@platelink/shared"
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "@/lib/env"

const PROTECTED_PREFIXES = ["/canteen", "/app", "/onboarding", "/dashboard"]
const AUTH_PAGES = ["/login", "/register"]

/**
 * Refreshes the Supabase session on every request and does the cheap
 * signed-in/signed-out redirect. Role checks happen in the route-group
 * layouts (they need a DB read, which doesn't belong in the proxy).
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request })
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return response

  const supabase = createServerClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
        response = NextResponse.next({ request })
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options))
        Object.entries(headers).forEach(([key, value]) => response.headers.set(key, value))
      },
    },
  })

  // Do not put code between createServerClient and getClaims(): it refreshes the token.
  const { data } = await supabase.auth.getClaims()
  const signedIn = Boolean(data?.claims?.sub)
  const { pathname } = request.nextUrl

  const redirect = (to: string, keepNext = false) => {
    const url = request.nextUrl.clone()
    url.pathname = to
    url.search = keepNext ? `?next=${encodeURIComponent(pathname)}` : ""
    const res = NextResponse.redirect(url)
    response.cookies.getAll().forEach((c) => res.cookies.set(c))
    return res
  }

  if (!signedIn && PROTECTED_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    return redirect("/login", true)
  }
  if (signedIn && AUTH_PAGES.includes(pathname)) {
    return redirect("/dashboard")
  }
  return response
}
