import React from "react"
import { StyleSheet, View } from "react-native"
import { Stack, useRouter } from "expo-router"
import { Compass, Home } from "lucide-react-native"
import { palette } from "@platelink/shared"
import { PressButton, Text } from "@/components/ui"
import { useSession } from "@/lib/session"
import { useTheme } from "@/theme"

export default function NotFoundScreen() {
  const router = useRouter()
  const { theme } = useTheme()
  const { session, profile } = useSession()

  const handleGoHome = () => {
    if (!session) {
      router.replace("/(auth)/login")
      return
    }

    const role = profile?.role
    if (role === "driver") {
      router.replace("/(driver)")
    } else if (role === "user") {
      router.replace("/(recipient)")
    } else if (role === "canteen") {
      router.replace("/canteen")
    } else {
      router.replace("/(auth)/login")
    }
  }

  return (
    <>
      <Stack.Screen options={{ title: "Page not found", headerShown: false }} />
      <View style={[styles.container, { backgroundColor: theme.colors.canvas }]}>
        <View
          style={[
            styles.iconWrapper,
            { backgroundColor: theme.colors.surfaceSunken },
          ]}
        >
          <Compass size={40} color={palette.blushedBrick} />
        </View>

        <Text variant="h2" style={styles.title}>
          Page not found
        </Text>
        <Text variant="body" muted style={styles.description}>
          {"This screen doesn't exist or may have been moved."}
        </Text>

        <View style={styles.buttonWrapper}>
          <PressButton
            variant="default"
            size="md"
            onPress={handleGoHome}
            leftIcon={<Home size={18} color={palette.almondSilk} />}
            accessibilityLabel="Go to home screen"
          >
            Go home
          </PressButton>
        </View>
      </View>
    </>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  iconWrapper: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },
  title: {
    textAlign: "center",
    marginBottom: 8,
  },
  description: {
    textAlign: "center",
    maxWidth: 280,
    marginBottom: 28,
  },
  buttonWrapper: {
    width: "100%",
    maxWidth: 220,
  },
})
