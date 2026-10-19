import { useEffect, useState } from "react"
import { Stack, useRouter, useSegments } from "expo-router"
import * as SplashScreen from "expo-splash-screen"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import {
  useFonts,
  BricolageGrotesque_400Regular,
  BricolageGrotesque_600SemiBold,
  BricolageGrotesque_700Bold,
} from "@expo-google-fonts/bricolage-grotesque"
import {
  Geist_400Regular,
  Geist_500Medium,
  Geist_600SemiBold,
} from "@expo-google-fonts/geist"
import { SessionProvider, useSession } from "@/lib/session"
import { ThemeProvider, useTheme } from "@/theme"
import "@/lib/location-task"

SplashScreen.preventAutoHideAsync().catch(() => {})

function AuthGate() {
    const { session, profile, canteen, loading } = useSession()
    const { theme } = useTheme()
    const segments = useSegments()
    const router = useRouter()

    useEffect(() => {
      if (loading) return
      // Wait until profile from public.users is loaded if session exists (Rule 2)
      if (session && !profile) return

      const rootSegment = segments[0] as string | undefined
      if (rootSegment === "dev") {
        if (!__DEV__) {
          router.replace("/(auth)/login")
        }
        return
      }

      // Root index (/) handles its own initial redirection via app/index.tsx
      if (!rootSegment) return

      const inAuthGroup = rootSegment === "(auth)"

      if (!session) {
        if (!inAuthGroup) {
          router.replace("/(auth)/login")
        }
        return
      }

      // Role-based route guard according to public.users.role (Rule 2)
      const role = profile?.role
      if (inAuthGroup) {
        if (role === "driver") {
          router.replace("/(driver)")
        } else if (role === "user") {
          router.replace("/(recipient)")
        } else if (role === "canteen") {
          if (!canteen) {
            router.replace("/canteen")
          } else {
            router.replace("/(canteen)" as any)
          }
        }
        return
      }

      // Allow stack screens outside tab groups for authenticated users
      if (
        rootSegment === "chat" ||
        rootSegment === "listing" ||
        rootSegment === "order" ||
        rootSegment === "canteen-listing"
      ) return

      if (role === "driver" && rootSegment !== "(driver)") {
        router.replace("/(driver)")
      } else if (role === "user" && rootSegment !== "(recipient)") {
        router.replace("/(recipient)")
      } else if (role === "canteen") {
        if (!canteen && rootSegment !== "canteen") {
          router.replace("/canteen")
        } else if (canteen && rootSegment !== "(canteen)") {
          router.replace("/(canteen)" as any)
        }
      }
    }, [session, profile, canteen, loading, segments, router])

    return (
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: theme.colors.canvas },
        }}
      >
        <Stack.Screen name="index" />
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(driver)" />
        <Stack.Screen name="(recipient)" />
        <Stack.Screen name="(canteen)" />
        <Stack.Screen name="canteen" />
        <Stack.Screen name="canteen-listing/[id]" />
        <Stack.Screen name="chat/[id]" />
        <Stack.Screen name="listing/[id]" />
        <Stack.Screen name="order/[id]" />
        <Stack.Screen name="+not-found" />
      </Stack>
    )
}

export default function RootLayout() {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 1000 * 60 * 5,
            retry: 1,
          },
        },
      })
  )

  const [loaded, error] = useFonts({
    BricolageGrotesque_400Regular,
    BricolageGrotesque_600SemiBold,
    BricolageGrotesque_700Bold,
    Geist_400Regular,
    Geist_500Medium,
    Geist_600SemiBold,
  })

  useEffect(() => {
    if (loaded || error) {
      SplashScreen.hideAsync().catch(() => {})
    }
  }, [loaded, error])

  if (!loaded && !error) {
    return null
  }

  return (
    <QueryClientProvider client={queryClient}>
      <SessionProvider>
        <ThemeProvider>
          <AuthGate />
        </ThemeProvider>
      </SessionProvider>
    </QueryClientProvider>
  )
}
