import React from "react"
import { ScrollView, StyleSheet, View } from "react-native"
import { HandHeart, LogOut, UtensilsCrossed } from "lucide-react-native"
import {
  Card,
  ChromeHeader,
  EmptyState,
  PressButton,
  Text,
} from "@/components/ui"
import { useSession } from "@/lib/session"
import { useTheme } from "@/theme"

export default function RecipientHomeScreen() {
  const { profile, signOut } = useSession()
  const { theme } = useTheme()

  const orgName = profile?.name ?? "Recipient organisation"

  return (
    <View style={[styles.root, { backgroundColor: theme.colors.canvas }]}>
      <ChromeHeader
        title="Recipient shelter"
        subtitle={orgName}
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
              <HandHeart size={24} color={theme.palette.blushedBrick} />
            </View>
            <View style={styles.cardTitleCol}>
              <Text variant="h3">Community food support</Text>
              <Text variant="small" muted>
                Surplus meal redistribution
              </Text>
            </View>
          </View>
          <Text variant="body" muted style={styles.cardBody}>
            Claim available meals cooked with care by partner campus canteens.
          </Text>
        </Card>

        <EmptyState
          icon={<UtensilsCrossed size={28} color={theme.palette.honeyBronze} />}
          title="Find food — coming in Phase 4"
          description="Direct listing claims and recipient delivery tracking on mobile will arrive in Phase 4."
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
