import React, { useEffect, useMemo } from "react"
import {
  FlatList,
  RefreshControl,
  StyleSheet,
  View,
} from "react-native"
import { useRouter } from "expo-router"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { formatDistanceToNow } from "date-fns"
import * as Haptics from "expo-haptics"
import { Plus, Utensils } from "lucide-react-native"
import {
  canteenKeys,
  fetchActiveListings,
  fetchCanteenStats,
  palette,
  type Listing,
} from "@platelink/shared"
import {
  Badge,
  ChromeHeader,
  EmptyState,
  ErrorState,
  PressButton,
  Skeleton,
  Text,
  TicketCard,
} from "@/components/ui"
import { useSession } from "@/lib/session"
import { supabase } from "@/lib/supabase"
import { useTheme } from "@/theme"

export default function CanteenHomeScreen() {
  const router = useRouter()
  const { theme } = useTheme()
  const { profile, canteen } = useSession()
  const queryClient = useQueryClient()

  const canteenId = canteen?.id ?? profile?.id

  // 1. Fetch Canteen Stats (canteen_stats RPC)
  const {
    data: stats,
    isLoading: isStatsLoading,
    refetch: refetchStats,
    isRefetching: isStatsRefetching,
  } = useQuery({
    queryKey: canteenKeys.stats(),
    queryFn: () => fetchCanteenStats(supabase),
  })

  // 2. Fetch Active Listings ("On the pass")
  const {
    data: listings = [],
    isLoading: isListingsLoading,
    isError: isListingsError,
    error: listingsError,
    refetch: refetchListings,
    isRefetching: isListingsRefetching,
  } = useQuery({
    queryKey: canteenKeys.active(canteenId),
    queryFn: () => (canteenId ? fetchActiveListings(supabase, canteenId) : Promise.resolve([])),
    enabled: !!canteenId,
  })

  // 3. Realtime subscription on food_listings for this canteen (Rule 11)
  useEffect(() => {
    if (!canteenId) return

    const channelName = `canteen-active-listings-${canteenId}-${Math.random().toString(36).substring(2, 8)}`
    const channel = supabase
      .channel(channelName)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "food_listings",
          filter: `canteen_id=eq.${canteenId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: canteenKeys.active(canteenId) })
          queryClient.invalidateQueries({ queryKey: canteenKeys.stats() })
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [canteenId, queryClient])

  const onRefresh = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {})
    await Promise.all([refetchStats(), refetchListings()])
  }

  const isRefreshing = isStatsRefetching || isListingsRefetching

  const greeting = useMemo(() => {
    const hour = new Date().getHours()
    if (hour < 12) return "Good morning"
    if (hour < 17) return "Good afternoon"
    return "Good evening"
  }, [])

  const canteenDisplayName = canteen?.org_name || profile?.name || "Kitchen"

  const renderHeader = () => (
    <View>
      {/* StatBoard Strip */}
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
            {isStatsLoading ? "--" : stats?.active ?? 0}
          </Text>
          <Text
            variant="caption"
            style={[styles.statLabel, { color: theme.colors.chromeMuted }]}
          >
            Active listings
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
            {isStatsLoading ? "--" : stats?.portions ?? 0}
          </Text>
          <Text
            variant="caption"
            style={[styles.statLabel, { color: theme.colors.chromeMuted }]}
          >
            Portions donated
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
            style={[styles.statValue, { color: theme.colors.chromeInk }]}
          >
            {isStatsLoading ? "--" : stats?.delivered ?? 0}
          </Text>
          <Text
            variant="caption"
            style={[styles.statLabel, { color: theme.colors.chromeMuted }]}
          >
            Delivered
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
            style={[styles.statValue, { color: theme.colors.chromeMuted }]}
          >
            {isStatsLoading ? "--" : stats?.total ?? 0}
          </Text>
          <Text
            variant="caption"
            style={[styles.statLabel, { color: theme.colors.chromeMuted }]}
          >
            Total posted
          </Text>
        </View>
      </View>

      {/* Section Title & Post Surplus CTA */}
      <View style={styles.sectionHeaderRow}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <Text variant="h3">On the pass</Text>
          <Badge variant="honey">{listings.length}</Badge>
        </View>
        <PressButton
          variant="default"
          size="sm"
          onPress={() => router.push("/(canteen)/post" as any)}
          leftIcon={<Plus size={16} color="#FFFFFF" />}
          accessibilityLabel="Post surplus food listing"
        >
          Post surplus
        </PressButton>
      </View>
    </View>
  )

  const renderItem = ({ item }: { item: Listing }) => {
    const expiryDate = new Date(item.expires_at)
    const expiryText =
      item.status === "expired"
        ? "Expired"
        : `Expires ${formatDistanceToNow(expiryDate, { addSuffix: true })}`

    return (
      <View style={styles.ticketWrap}>
        <TicketCard
          title={item.title}
          portions={item.quantity}
          status={item.status}
          expiryText={expiryText}
          meta={item.food_type.replace("_", " ")}
          photoUrl={item.photo_url || undefined}
          onPress={() => {
            Haptics.selectionAsync().catch(() => {})
            router.push({
              pathname: "/canteen-listing/[id]" as any,
              params: { id: item.id },
            })
          }}
        />
      </View>
    )
  }

  return (
    <View style={[styles.root, { backgroundColor: theme.colors.canvas }]}>
      <ChromeHeader
        title={`${greeting}, ${canteenDisplayName}`}
        subtitle={canteen?.address ?? "Canteen kitchen dashboard"}
        rightAction={
          <PressButton
            variant="ghost"
            size="sm"
            onPress={() => router.push("/(canteen)/post" as any)}
            leftIcon={<Plus size={18} color={theme.colors.chromeInk} />}
            accessibilityLabel="New listing"
          >
            New
          </PressButton>
        }
      />

      {isListingsLoading ? (
        <View style={styles.skeletonContainer}>
          {renderHeader()}
          <View style={{ gap: 14, marginTop: 16 }}>
            <Skeleton style={{ height: 110, borderRadius: 14 }} />
            <Skeleton style={{ height: 110, borderRadius: 14 }} />
            <Skeleton style={{ height: 110, borderRadius: 14 }} />
          </View>
        </View>
      ) : isListingsError ? (
        <View style={{ flex: 1 }}>
          {renderHeader()}
          <ErrorState
            error={listingsError}
            onRetry={onRefresh}
            style={{ marginTop: 32 }}
          />
        </View>
      ) : (
        <FlatList
          data={listings}
          keyExtractor={(item) => item.id}
          ListHeaderComponent={renderHeader}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={onRefresh}
              tintColor={theme.colors.accent}
              colors={[theme.colors.accent]}
            />
          }
          ListEmptyComponent={
            <EmptyState
              icon={<Utensils size={36} color={palette.honeyBronze} />}
              title="Nothing on the pass right now"
              description="When your kitchen prepares extra portions, publish them here for verified NGOs and delivery drivers."
              action={
                <PressButton
                  variant="default"
                  size="md"
                  onPress={() => router.push("/(canteen)/post" as any)}
                  leftIcon={<Plus size={18} color="#FFFFFF" />}
                  style={{ marginTop: 8 }}
                >
                  Post surplus food
                </PressButton>
              }
              style={{ marginTop: 24 }}
            />
          }
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
    justifyContent: "space-between",
    paddingVertical: 14,
    paddingHorizontal: 10,
    borderBottomWidth: 1,
  },
  statCell: {
    flex: 1,
    alignItems: "center",
  },
  statValue: {
    fontSize: 20,
    lineHeight: 24,
    fontWeight: "800",
    letterSpacing: -0.5,
  },
  statLabel: {
    fontSize: 10,
    marginTop: 2,
    textAlign: "center",
    letterSpacing: -0.1,
  },
  statDivider: {
    width: 1,
    height: 30,
    opacity: 0.5,
  },
  sectionHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 12,
  },
  listContent: {
    paddingBottom: 32,
  },
  ticketWrap: {
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  skeletonContainer: {
    flex: 1,
    paddingHorizontal: 16,
  },
})
