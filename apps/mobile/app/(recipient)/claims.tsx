import React from "react"
import {
  FlatList,
  RefreshControl,
  StyleSheet,
  View,
} from "react-native"
import { useRouter } from "expo-router"
import { useQuery } from "@tanstack/react-query"
import { Clock, Compass } from "lucide-react-native"
import {
  fetchMyOrders,
  palette,
  recipientKeys,
  type MyClaimOrder,
} from "@platelink/shared"
import {
  ChromeHeader,
  EmptyState,
  ErrorState,
  PressButton,
  Skeleton,
  TicketCard,
} from "@/components/ui"
import { useSession } from "@/lib/session"
import { supabase } from "@/lib/supabase"
import { useTheme } from "@/theme"

export default function RecipientClaimsScreen() {
  const router = useRouter()
  const { theme } = useTheme()
  const { user } = useSession()

  const {
    data: orders = [],
    isLoading,
    isError,
    error,
    refetch,
    isRefetching,
  } = useQuery<MyClaimOrder[]>({
    queryKey: recipientKeys.orders(user?.id),
    queryFn: () => (user?.id ? fetchMyOrders(supabase, user.id) : []),
    enabled: !!user?.id,
  })

  return (
    <View style={[styles.root, { backgroundColor: theme.colors.canvas }]}>
      <ChromeHeader
        title="My claims"
        subtitle="Active and completed surplus food claims"
      />

      {isLoading ? (
        <View style={styles.skeletonContainer}>
          {[1, 2, 3].map((key) => (
            <View key={key} style={styles.skeletonCard}>
              <Skeleton width="65%" height={20} borderRadius={6} />
              <Skeleton
                width="40%"
                height={14}
                borderRadius={4}
                style={{ marginTop: 10 }}
              />
              <Skeleton
                width="90%"
                height={14}
                borderRadius={4}
                style={{ marginTop: 8 }}
              />
            </View>
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
            icon={<Clock size={36} color={palette.honeyBronze} />}
            title="No claims yet"
            description="When you claim surplus food packages from campus canteens, your active deliveries and past claims will appear here."
            action={
              <PressButton
                variant="default"
                size="md"
                onPress={() => router.push("/(recipient)" as any)}
                leftIcon={<Compass size={18} color={palette.almondSilk} />}
              >
                Find available food
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
          renderItem={({ item }) => (
            <View style={{ marginBottom: 12 }}>
              <TicketCard
                title={item.food_listings?.title ?? "Food package"}
                portions={item.food_listings?.quantity ?? 0}
                status={item.status}
                meta={item.canteens?.org_name ?? "Campus canteen"}
                expiryText={`Delivery to ${item.dropoff_address}`}
                onPress={() => {
                  router.push(`/order/${item.id}` as any)
                }}
              />
            </View>
          )}
        />
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  skeletonContainer: {
    padding: 16,
    gap: 12,
  },
  skeletonCard: {
    padding: 16,
    borderRadius: 16,
  },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  listContent: {
    padding: 16,
  },
})
