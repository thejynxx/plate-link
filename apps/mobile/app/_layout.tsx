import { useEffect, useState } from "react"
import { ActivityIndicator, StyleSheet, Text as RNText, View } from "react-native"
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
import { palette } from "@platelink/shared"
import { SessionProvider, useSession } from "@/lib/session"
import { ThemeProvider, useTheme } from "@/theme"

SplashScreen.preventAutoHideAsync().catch(() => {})

function BrandedSplash() {
  return (
    <View style={styles.splashContainer}>
      <RNText style={styles.splashBrand}>Plate-Link</RNText>
      <RNText style={styles.splashSubtitle}>Food surplus redistribution</RNText>
      <ActivityIndicator
        size="small"
        color={palette.honeyBronze}
        style={styles.splashSpinner}
      />
    </View>
  )
}

function AuthGate() {
  const { session, profile, loading } = useSession()
  const { theme } = useTheme()
  const segments = useSegments()
  const router = useRouter()

  useEffect(() => {
    if (loading) return
    // Wait until profile from public.users is loaded if session exists (Rule 2)
    if (session && !profile) return

    const inAuthGroup = segments[0] === "(auth)"
    const inDev = segments[0] === "dev"
    if (inDev) return

    if (!session) {
      if (!inAuthGroup) {
        router.replace("/(auth)/login")
      }
      return
    }

    // Role-based routing according to public.users.role
    const role = profile?.role
    if (role === "driver") {
      if (segments[0] !== "(driver)") {
        router.replace("/(driver)/index")
      }
    } else if (role === "user") {
      if (segments[0] !== "(recipient)") {
        router.replace("/(recipient)/index")
      }
    } else if (role === "canteen") {
      if (segments[0] !== "canteen") {
        router.replace("/canteen")
      }
    }
  }, [session, profile, loading, segments, router])

  // While checking auth and loading profile from public.users, display branded splash
  if (loading || (session && !profile)) {
    return <BrandedSplash />
  }

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: theme.colors.canvas },
      }}
    />
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

const styles = StyleSheet.create({
  splashContainer: {
    flex: 1,
    backgroundColor: palette.gunmetal,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  splashBrand: {
    fontFamily: "BricolageGrotesque_700Bold",
    fontSize: 42,
    color: palette.almondSilk,
    letterSpacing: -0.5,
  },
  splashSubtitle: {
    fontFamily: "Geist_500Medium",
    fontSize: 14,
    color: palette.honeyBronze,
    marginTop: 8,
    letterSpacing: -0.2,
  },
  splashSpinner: {
    marginTop: 24,
  },
})
