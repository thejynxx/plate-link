import React from "react"
import { StyleSheet, View } from "react-native"
import { useLocalSearchParams, useRouter } from "expo-router"
import { ArrowLeft, CheckCircle2, Clock, Compass } from "lucide-react-native"
import { palette } from "@platelink/shared"
import { Badge, Card, ChromeHeader, PressButton, Text } from "@/components/ui"
import { useTheme } from "@/theme"

export default function OrderPlaceholderScreen() {
  const router = useRouter()
  const { id } = useLocalSearchParams<{ id: string }>()
  const { theme } = useTheme()

  const orderId = id as string

  return (
    <View style={[styles.root, { backgroundColor: theme.colors.canvas }]}>
      <ChromeHeader
        title="Order confirmed"
        subtitle={`Order #${orderId.slice(0, 8)}`}
        leftAction={
          <PressButton
            variant="ghost"
            size="sm"
            onPress={() => router.replace("/(recipient)" as any)}
            leftIcon={<ArrowLeft size={20} color={theme.colors.chromeInk} />}
            accessibilityLabel="Back to food search"
          >
            Find
          </PressButton>
        }
      />

      <View style={styles.content}>
        <Card style={styles.card}>
          <View
            style={[
              styles.iconCircle,
              { backgroundColor: "rgba(244, 184, 96, 0.2)" },
            ]}
          >
            <CheckCircle2 size={40} color={palette.honeyBronze} />
          </View>

          <Text variant="h2" style={styles.title}>
            Food claimed successfully
          </Text>

          <Text variant="body" muted style={styles.description}>
            Your claim has been submitted. A volunteer driver will accept the
            order and pick up the food from the campus canteen for delivery.
          </Text>

          <View style={styles.badgeRow}>
            <Badge status="pending_driver" />
          </View>

          <View style={styles.actions}>
            <PressButton
              variant="default"
              size="md"
              fullWidth
              onPress={() => router.replace("/(recipient)/claims" as any)}
              leftIcon={<Clock size={18} color={palette.almondSilk} />}
              accessibilityLabel="View your claims"
            >
              View my claims
            </PressButton>

            <PressButton
              variant="outline"
              size="md"
              fullWidth
              onPress={() => router.replace("/(recipient)" as any)}
              leftIcon={<Compass size={18} color={theme.colors.ink} />}
              accessibilityLabel="Return to food surplus search"
            >
              Find more food
            </PressButton>
          </View>
        </Card>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  content: {
    flex: 1,
    padding: 20,
    justifyContent: "center",
  },
  card: {
    padding: 24,
    borderRadius: 20,
    alignItems: "center",
  },
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
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
    marginBottom: 16,
  },
  badgeRow: {
    marginBottom: 24,
  },
  actions: {
    width: "100%",
    gap: 10,
  },
})
