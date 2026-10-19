import React from "react"
import { ScrollView, StyleSheet, View } from "react-native"
import { LogOut, Navigation, Truck } from "lucide-react-native"
import {
  Card,
  ChromeHeader,
  EmptyState,
  PressButton,
  Text,
} from "@/components/ui"
import { useSession } from "@/lib/session"
import { useTheme } from "@/theme"

export default function DriverHomeScreen() {
  const { profile, signOut } = useSession()
  const { theme } = useTheme()

  const driverName = profile?.name ?? "Driver"

  return (
    <View style={[styles.root, { backgroundColor: theme.colors.canvas }]}>
      <ChromeHeader
        title="Driver dashboard"
        subtitle={`Welcome, ${driverName}`}
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

      <ScrollView contentContainerStyle={styles.content}>
        <Card style={styles.card}>
          <View style={styles.cardHeader}>
            <View
              style={[
                styles.iconBadge,
                { backgroundColor: theme.colors.surfaceSunken },
              ]}
            >
              <Truck size={24} color={theme.palette.blushedBrick} />
            </View>
            <View style={styles.cardTitleCol}>
              <Text variant="h3">Pickups near you</Text>
              <Text variant="small" muted>
                Active delivery dispatch
              </Text>
            </View>
          </View>
          <Text variant="body" muted style={styles.cardBody}>
            Real-time surplus pickup requests from nearby campus dining halls.
          </Text>
        </Card>

        <EmptyState
          icon={<Navigation size={28} color={theme.palette.honeyBronze} />}
          title="Pickups near you — coming in 3.3"
          description="GPS dispatch, turn-by-turn routing, and pickup confirmation will activate in Task 3.3."
          style={styles.emptyState}
        />
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  content: {
    padding: 20,
    gap: 18,
  },
  card: {
    padding: 18,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  iconBadge: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  cardTitleCol: {
    flex: 1,
  },
  cardBody: {
    marginTop: 4,
  },
  emptyState: {
    marginTop: 8,
  },
})
