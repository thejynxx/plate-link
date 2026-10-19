import React, { useMemo } from "react"
import {
  FlatList,
  RefreshControl,
  StyleSheet,
  View,
} from "react-native"
import { useRouter } from "expo-router"
import { useQuery } from "@tanstack/react-query"
import { format, startOfWeek } from "date-fns"
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Clock,
  MapPin,
  PackageCheck,
  Utensils,
} from "lucide-react-native"
import { palette } from "@platelink/shared"
import {
  Badge,
  Card,
  ChromeHeader,
  EmptyState,
  ErrorState,
  PressButton,
  Skeleton,
  Text,
} from "@/components/ui"
import { useSession } from "@/lib/session"
import { supabase } from "@/lib/supabase"
import { useTheme } from "@/theme"

export interface CompletedOrder {
  id: string
  listing_id: string
  canteen_id: string
  user_id: string
  driver_id: string | null
  status: "completed"
  dropoff_address: string
  dropoff_lat: number
  dropoff_lng: number
  delivered_at: string | null
  created_at: string
  listing?: {
    id: string
    title: string
    quantity: number
    food_type: string
  } | null
  canteen?: {
    id: string
    org_name: string
    address: string
  } | null
}

export default function DriverHistoryScreen() {
  const router = useRouter()
  const { theme } = useTheme()
  const { user } = useSession()

  // Fetch completed deliveries for the current driver
  const {
    data: orders = [],
    isLoading,
    isError,
    error,
    refetch,
    isRefetching,
  } = useQuery<CompletedOrder[]>({
    queryKey: ["driver_completed_history", user?.id],
    queryFn: async () => {
      if (!user?.id) return []

      const { data, error: qErr } = await supabase
        .from("orders")
        .select(
          `
          id,
          listing_id,
          canteen_id,
          user_id,
          driver_id,
          status,
          dropoff_address,
          dropoff_lat,
          dropoff_lng,
          delivered_at,
          created_at,
          listing:food_listings(
            id,
            title,
            quantity,
            food_type
          ),
          canteen:canteens(
            id,
            org_name,
            address
          )
        `
        )
        .eq("driver_id", user.id)
        .eq("status", "completed")
        .order("delivered_at", { ascending: false })

      if (qErr) {
        console.warn("[driver-history] Query error:", qErr)
        throw qErr
      }

      return (data as unknown as CompletedOrder[]) ?? []
    },
    enabled: !!user?.id,
  })

  // Calculate StatBoard summary statistics
  const stats = useMemo(() => {
    const totalDeliveries = orders.length
    const totalPortions = orders.reduce(
      (sum, o) => sum + (o.listing?.quantity || 0),
      0
    )

    const now = new Date()
    const weekStart = startOfWeek(now, { weekStartsOn: 1 }) // Monday start
    const thisWeekCount = orders.filter((o) => {
      const deliveredDate = o.delivered_at
        ? new Date(o.delivered_at)
        : new Date(o.created_at)
      return deliveredDate >= weekStart
    }).length

    return {
      totalDeliveries,
      totalPortions,
      thisWeekCount,
    }
  }, [orders])

  return (
    <View style={[styles.root, { backgroundColor: theme.colors.canvas }]}>
      {/* Structural Gunmetal Chrome Header with Back Button */}
      <ChromeHeader
        title="Delivery history"
        subtitle="Completed food rescue missions"
        leftAction={
          <PressButton
            variant="ghost"
            size="sm"
            onPress={() => router.back()}
            leftIcon={<ArrowLeft size={20} color={theme.colors.chromeInk} />}
            accessibilityLabel="Go back"
          >
            Back
          </PressButton>
        }
      />

      {/* Header StatBoard Strip */}
      <View
        style={[
          styles.statBoard,
          {
            backgroundColor: theme.colors.chrome,
            borderBottomColor: theme.colors.borderStrong,
          },
        ]}
      >
        <View style={styles.statCell}>
          <Text
            variant="h2"
            style={[styles.statValue, { color: theme.colors.accent }]}
          >
            {isLoading ? "--" : stats.totalDeliveries}
          </Text>
          <Text
            variant="caption"
            style={[styles.statLabel, { color: theme.colors.chromeMuted }]}
          >
            Total deliveries
          </Text>
        </View>

        <View
          style={[
            styles.statDivider,
            { backgroundColor: theme.colors.borderStrong },
          ]}
        />

        <View style={styles.statCell}>
          <Text
            variant="h2"
            style={[styles.statValue, { color: theme.palette.almondSilk }]}
          >
            {isLoading ? "--" : stats.totalPortions}
          </Text>
          <Text
            variant="caption"
            style={[styles.statLabel, { color: theme.colors.chromeMuted }]}
          >
            Portions saved
          </Text>
        </View>

        <View
          style={[
            styles.statDivider,
            { backgroundColor: theme.colors.borderStrong },
          ]}
        />

        <View style={styles.statCell}>
          <Text
            variant="h2"
            style={[styles.statValue, { color: theme.colors.accent }]}
          >
            {isLoading ? "--" : stats.thisWeekCount}
          </Text>
          <Text
            variant="caption"
            style={[styles.statLabel, { color: theme.colors.chromeMuted }]}
          >
            This week
          </Text>
        </View>
      </View>

      {/* Content Area */}
      {isLoading ? (
        <View style={styles.skeletonList}>
          {[1, 2, 3, 4].map((idx) => (
            <Card key={idx} style={styles.orderCard}>
              <View style={styles.skeletonHeaderRow}>
                <Skeleton width="60%" height={20} borderRadius={6} />
                <Skeleton width={80} height={22} borderRadius={11} />
              </View>
              <Skeleton
                width="80%"
                height={14}
                borderRadius={4}
                style={{ marginTop: 12 }}
              />
              <Skeleton
                width="95%"
                height={14}
                borderRadius={4}
                style={{ marginTop: 8 }}
              />
              <Skeleton
                width="45%"
                height={12}
                borderRadius={4}
                style={{ marginTop: 14 }}
              />
            </Card>
          ))}
        </View>
      ) : isError ? (
        <View style={styles.centered}>
          <ErrorState
            error={error}
            onRetry={() => {
              void refetch()
            }}
          />
        </View>
      ) : orders.length === 0 ? (
        <View style={styles.centered}>
          <EmptyState
            icon={<PackageCheck size={36} color={palette.honeyBronze} />}
            title="No deliveries yet"
            description="Your completed food rescue deliveries will show up here once delivered."
            action={
              <PressButton
                variant="default"
                size="md"
                onPress={() => router.push("/(driver)" as any)}
                leftIcon={<Utensils size={18} color={palette.almondSilk} />}
              >
                Find pickups
              </PressButton>
            }
          />
        </View>
      ) : (
        <FlatList
          data={orders}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={() => {
                void refetch()
              }}
              tintColor={palette.honeyBronze}
            />
          }
          renderItem={({ item }) => {
            const deliveredDate = item.delivered_at
              ? new Date(item.delivered_at)
              : new Date(item.created_at)
            const deliveredDateStr = format(
              deliveredDate,
              "MMM d, yyyy 'at' h:mm a"
            )

            const portionsCount = item.listing?.quantity ?? 0

            return (
              <Card style={styles.orderCard}>
                {/* Header Row: Title & Badge */}
                <View style={styles.cardHeaderRow}>
                  <View style={{ flex: 1, marginRight: 8 }}>
                    <Text variant="h3" numberOfLines={1}>
                      {item.listing?.title ?? "Surplus food package"}
                    </Text>
                    <Text
                      variant="caption"
                      style={{ color: palette.honeyBronze, marginTop: 2 }}
                    >
                      {portionsCount} {portionsCount === 1 ? "portion" : "portions"}
                    </Text>
                  </View>
                  <Badge status="completed" />
                </View>

                {/* Route Flow: Canteen -> Drop-off */}
                <View
                  style={[
                    styles.routeCard,
                    {
                      backgroundColor: theme.colors.surfaceSunken,
                      borderColor: theme.colors.border,
                    },
                  ]}
                >
                  {/* Origin: Canteen */}
                  <View style={styles.routeRow}>
                    <View
                      style={[
                        styles.routeIconPill,
                        { backgroundColor: "rgba(244, 184, 96, 0.2)" },
                      ]}
                    >
                      <Utensils size={14} color={palette.honeyBronze} />
                    </View>
                    <View style={styles.routeTextCol}>
                      <Text variant="caption" muted>
                        From
                      </Text>
                      <Text variant="small" weight="medium" numberOfLines={1}>
                        {item.canteen?.org_name ?? "Campus canteen"}
                      </Text>
                    </View>
                  </View>

                  {/* Route Indicator Connector */}
                  <View style={styles.routeConnector}>
                    <ArrowRight size={14} color={theme.colors.inkMuted} />
                  </View>

                  {/* Destination: Drop-off Address */}
                  <View style={styles.routeRow}>
                    <View
                      style={[
                        styles.routeIconPill,
                        { backgroundColor: "rgba(200, 62, 77, 0.15)" },
                      ]}
                    >
                      <MapPin size={14} color={palette.blushedBrick} />
                    </View>
                    <View style={styles.routeTextCol}>
                      <Text variant="caption" muted>
                        To
                      </Text>
                      <Text variant="small" weight="medium" numberOfLines={1}>
                        {item.dropoff_address}
                      </Text>
                    </View>
                  </View>
                </View>

                {/* Footer Row: Timestamp & Proof status */}
                <View style={styles.cardFooterRow}>
                  <View style={styles.footerTimeWrap}>
                    <Clock size={13} color={theme.colors.inkMuted} />
                    <Text variant="caption" muted style={{ marginLeft: 6 }}>
                      Delivered {deliveredDateStr}
                    </Text>
                  </View>

                  <View style={styles.verifiedRow}>
                    <CheckCircle2 size={13} color={palette.honeyBronze} />
                    <Text
                      variant="caption"
                      style={{ color: palette.honeyBronze, marginLeft: 4 }}
                    >
                      Handoff verified
                    </Text>
                  </View>
                </View>
              </Card>
            )
          }}
        />
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  statBoard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    paddingVertical: 14,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
  },
  statCell: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  statValue: {
    fontSize: 22,
    lineHeight: 26,
    letterSpacing: -0.5,
  },
  statLabel: {
    marginTop: 2,
    fontSize: 11,
  },
  statDivider: {
    width: 1,
    height: 32,
  },
  listContent: {
    padding: 16,
    gap: 12,
  },
  skeletonList: {
    padding: 16,
    gap: 12,
  },
  skeletonHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  orderCard: {
    padding: 16,
    borderRadius: 16,
  },
  cardHeaderRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  routeCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 10,
    gap: 6,
    marginBottom: 12,
  },
  routeRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  routeIconPill: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },
  routeTextCol: {
    flex: 1,
  },
  routeConnector: {
    paddingLeft: 36,
    marginVertical: -2,
  },
  cardFooterRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 4,
  },
  footerTimeWrap: {
    flexDirection: "row",
    alignItems: "center",
  },
  verifiedRow: {
    flexDirection: "row",
    alignItems: "center",
  },
})
