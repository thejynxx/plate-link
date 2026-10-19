import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react"
import type { Session, User } from "@supabase/supabase-js"
import type { Tables } from "@platelink/shared"
import { stopLocationUpdatesTask } from "./location-task"
import { supabase } from "./supabase"

export type UserProfile = Tables<"users">
export type CanteenRow = Tables<"canteens">

export interface SessionContextValue {
  session: Session | null
  user: User | null
  profile: UserProfile | null
  canteen: CanteenRow | null
  loading: boolean
  signOut: () => Promise<void>
  refreshProfile: () => Promise<void>
  refreshCanteen: () => Promise<void>
}

const SessionContext = createContext<SessionContextValue | null>(null)

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [canteen, setCanteen] = useState<CanteenRow | null>(null)
  const [loading, setLoading] = useState(true)

  const loadProfile = useCallback(async (userId: string): Promise<UserProfile | null> => {
    try {
      const { data, error } = await supabase
        .from("users")
        .select("*")
        .eq("id", userId)
        .maybeSingle()

      if (error) {
        console.warn("Failed to load user profile:", error.message)
        return null
      }

      // If user row isn't ready yet (e.g. trigger on signup), retry once after a short delay
      if (!data) {
        await new Promise((resolve) => setTimeout(resolve, 600))
        const { data: retryData } = await supabase
          .from("users")
          .select("*")
          .eq("id", userId)
          .maybeSingle()
        return retryData ?? null
      }

      return data
    } catch (err) {
      console.warn("Error loading user profile:", err)
      return null
    }
  }, [])

  const loadCanteen = useCallback(async (userId: string): Promise<CanteenRow | null> => {
    try {
      const { data, error } = await supabase
        .from("canteens")
        .select("*")
        .eq("id", userId)
        .maybeSingle()

      if (error) {
        console.warn("Failed to load canteen profile:", error.message)
        return null
      }
      return data ?? null
    } catch (err) {
      console.warn("Error loading canteen profile:", err)
      return null
    }
  }, [])

  // Initialize session on mount
  useEffect(() => {
    let isMounted = true

    async function initSession() {
      try {
        const { data } = await supabase.auth.getSession()
        if (!isMounted) return

        const currentSession = data.session
        setSession(currentSession)

        if (currentSession?.user) {
          const userProfile = await loadProfile(currentSession.user.id)
          if (isMounted) {
            setProfile(userProfile)
            if (userProfile?.role === "canteen") {
              const canteenData = await loadCanteen(currentSession.user.id)
              if (isMounted) setCanteen(canteenData)
            }
          }
        } else {
          if (isMounted) {
            setProfile(null)
            setCanteen(null)
          }
        }
      } catch (err) {
        console.warn("Error getting initial session:", err)
      } finally {
        if (isMounted) setLoading(false)
      }
    }

    initSession()

    // Listen to Supabase auth events
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, newSession) => {
      if (!isMounted) return
      setSession(newSession)

      if (newSession?.user) {
        // Load profile from public.users (Rule 2: never user_metadata)
        const userProfile = await loadProfile(newSession.user.id)
        if (isMounted) {
          setProfile(userProfile)
          if (userProfile?.role === "canteen") {
            const canteenData = await loadCanteen(newSession.user.id)
            if (isMounted) setCanteen(canteenData)
          } else {
            setCanteen(null)
          }
          setLoading(false)
        }
      } else {
        if (isMounted) {
          setProfile(null)
          setCanteen(null)
          setLoading(false)
        }
      }
    })

    return () => {
      isMounted = false
      subscription.unsubscribe()
    }
  }, [loadProfile, loadCanteen])

  const refreshProfile = useCallback(async () => {
    if (!session?.user) return
    const userProfile = await loadProfile(session.user.id)
    setProfile(userProfile)
    if (userProfile?.role === "canteen") {
      const canteenData = await loadCanteen(session.user.id)
      setCanteen(canteenData)
    }
  }, [session?.user, loadProfile, loadCanteen])

  const refreshCanteen = useCallback(async () => {
    if (!session?.user) return
    const canteenData = await loadCanteen(session.user.id)
    setCanteen(canteenData)
  }, [session?.user, loadCanteen])

  const signOut = useCallback(async () => {
    try {
      await stopLocationUpdatesTask()
      await supabase.auth.signOut()
    } catch (err) {
      console.warn("Error signing out:", err)
    } finally {
      setSession(null)
      setProfile(null)
      setCanteen(null)
    }
  }, [])

  const value: SessionContextValue = {
    session,
    user: session?.user ?? null,
    profile,
    canteen,
    loading,
    signOut,
    refreshProfile,
    refreshCanteen,
  }

  return (
    <SessionContext.Provider value={value}>
      {children}
    </SessionContext.Provider>
  )
}

export function useSession(): SessionContextValue {
  const context = useContext(SessionContext)
  if (!context) {
    throw new Error("useSession must be used within a SessionProvider")
  }
  return context
}
