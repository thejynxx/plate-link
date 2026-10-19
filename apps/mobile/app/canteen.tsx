import React from "react"
import { StyleSheet, View } from "react-native"
import { ExternalLink, Globe, LogOut } from "lucide-react-native"
import {
  Card,
  ChromeHeader,
  PressButton,
  Text,
} from "@/components/ui"
import { useSession } from "@/lib/session"
import { useTheme } from "@/theme"

export default function CanteenRedirectScreen() {
  const { profile, signOut } = useSession()
  const { theme } = useTheme()

  const canteenName = profile?.name ?? "Canteen partner"

  return (
    <View style={[styles.root, { backgroundColor: theme.colors.canvas }]}>
      <ChromeHeader
        title="Canteen portal"
        subtitle={canteenName}
        rightAction={
          <PressButton
            variant="ghost"
            size="sm"
            onPress={signOut}
            leftIcon={<LogOut size={16} color={theme.colors.chromeInk} />}
            accessibilityLabel="Sign out"
          >
            Sign out
          </PressButton>
        }
      />

      <View style={styles.container}>
        <Card style={styles.card}>
          <View
            style={[
              styles.iconWrapper,
              { backgroundColor: theme.colors.surfaceSunken },
            ]}
          >
            <Globe size={32} color={theme.colors.accent} />
          </View>

          <Text variant="h2" style={styles.title}>
            Canteens use the web dashboard
          </Text>

          <Text variant="body" muted style={styles.description}>
            Food donors manage surplus listings, monitor order states, and use
            the ML cooking prep planner directly from the desktop browser.
          </Text>

          <View
            style={[
              styles.urlBox,
              {
                backgroundColor: theme.colors.surfaceSunken,
                borderColor: theme.colors.borderStrong,
              },
            ]}
          >
            <ExternalLink size={16} color={theme.colors.primary} />
            <Text
              variant="small"
              weight="semibold"
              style={[styles.urlText, { color: theme.colors.primary }]}
            >
              https://platelink.vercel.app/canteen
            </Text>
          </View>

          <PressButton
            variant="outline"
            size="md"
            fullWidth
            onPress={signOut}
            leftIcon={<LogOut size={16} color={theme.colors.ink} />}
            style={styles.signOutBtn}
          >
            Sign out of mobile
          </PressButton>
        </Card>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  container: {
    flex: 1,
    padding: 24,
    justifyContent: "center",
    alignItems: "center",
  },
  card: {
    width: "100%",
    alignItems: "center",
    paddingVertical: 32,
    paddingHorizontal: 20,
  },
  iconWrapper: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  title: {
    textAlign: "center",
    marginBottom: 8,
  },
  description: {
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 20,
    maxWidth: 320,
  },
  urlBox: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 24,
    gap: 8,
  },
  urlText: {
    letterSpacing: -0.1,
  },
  signOutBtn: {
    marginTop: 4,
  },
})
