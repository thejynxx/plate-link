import React from "react"
import { ScrollView, StyleSheet, View } from "react-native"
import { Bike, MapPin, Navigation, PackageCheck } from "lucide-react-native"
import { palette } from "@platelink/shared"
import {
  Badge,
  Card,
  ChromeHeader,
  EmptyState,
  LocationSharingPill,
  Text,
} from "@/components/ui"
import {
  useDeliveryTracking,
  DeliveryLocationPermissionBanner,
} from "@/lib/use-delivery-tracking"
import { useTheme } from "@/theme"

export default function DriverActiveScreen() {
  const { theme } = useTheme()
  const { activeOrder, isSharingLocation } = useDeliveryTracking()

  const subtitleText = activeOrder
    ? activeOrder.status === "on_the_way"
      ? "Food in transit to recipient"
      : "Heading to canteen for pickup"
    : "No delivery in progress"

  return (
    <View style={[styles.root, { backgroundColor: theme.colors.canvas }]}>
      <ChromeHeader
        title="Active delivery"
        subtitle={subtitleText}
        rightAction={isSharingLocation ? <LocationSharingPill /> : undefined}
      />

      <DeliveryLocationPermissionBanner />

      <ScrollView contentContainerStyle={styles.content}>
        {activeOrder ? (
          <>
            <Card style={styles.activeCard}>
              <View style={styles.activeCardHeader}>
                <View
                  style={[
                    styles.iconBadge,
                    { backgroundColor: theme.colors.surfaceSunken },
                  ]}
                >
                  <Bike size={24} color={palette.honeyBronze} />
                </View>
                <View style={styles.cardTitleCol}>
                  <Text variant="h3">
                    {activeOrder.listing?.title ?? "Food surplus package"}
                  </Text>
                  <Text variant="small" muted>
                    {activeOrder.listing?.quantity
                      ? `${activeOrder.listing.quantity} portions`
                      : "Portions in transit"}
                  </Text>
                </View>
                <Badge
                  status={
                    activeOrder.status === "on_the_way"
                      ? "on_the_way"
                      : "driver_assigned"
                  }
                />
              </View>

              <View
                style={[
                  styles.divider,
                  { backgroundColor: theme.colors.border },
                ]}
              />

              <View style={styles.addressRow}>
                <MapPin size={18} color={palette.honeyBronze} />
                <View style={styles.addressTextCol}>
                  <Text variant="caption" muted>
                    Drop-off address
                  </Text>
                  <Text variant="body" weight="medium">
                    {activeOrder.dropoff_address}
                  </Text>
                </View>
              </View>

              {isSharingLocation && (
                <View
                  style={[
                    styles.sharingStatusBox,
                    {
                      backgroundColor: "rgba(244, 184, 96, 0.12)",
                      borderColor: "rgba(244, 184, 96, 0.35)",
                    },
                  ]}
                >
                  <LocationSharingPill />
                  <Text
                    variant="caption"
                    style={{ color: palette.honeyBronze, flex: 1 }}
                  >
                    Canteen and NGO are receiving live GPS coordinates.
                  </Text>
                </View>
              )}
            </Card>

            <Card>
              <View style={styles.cardHeader}>
                <View
                  style={[
                    styles.iconBadge,
                    { backgroundColor: theme.colors.surfaceSunken },
                  ]}
                >
                  <PackageCheck size={22} color={palette.blushedBrick} />
                </View>
                <View style={styles.cardTitleCol}>
                  <Text variant="h3">Turn-by-turn routing</Text>
                  <Text variant="small" muted>
                    Verification proofs & delivery steps
                  </Text>
                </View>
              </View>
              <Text variant="body" muted style={styles.cardBody}>
                Full pickup confirmation proofs and delivery verification arrive in
                Phase 3.5.
              </Text>
            </Card>
          </>
        ) : (
          <EmptyState
            icon={<Navigation size={28} color={theme.palette.honeyBronze} />}
            title="No active delivery"
            description="Select an available food surplus pickup on the map to begin."
          />
        )}
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
  activeCard: {
    padding: 18,
    gap: 14,
  },
  activeCardHeader: {
    flexDirection: "row",
    alignItems: "center",
  },
  divider: {
    height: 1,
    width: "100%",
  },
  addressRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  addressTextCol: {
    flex: 1,
  },
  sharingStatusBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
  },
})
