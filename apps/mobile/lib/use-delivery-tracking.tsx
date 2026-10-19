import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react"
import {
  Alert,
  Linking,
  Modal,
  StyleSheet,
  View,
} from "react-native"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import * as Location from "expo-location"
import { MapPin, ShieldAlert } from "lucide-react-native"
import { palette } from "@platelink/shared"
import { PressButton, Text } from "@/components/ui"
import {
  DRIVER_LOCATION_TASK,
  upsertCurrentDriverLocation,
} from "@/lib/location-task"
import { supabase } from "@/lib/supabase"
import { useSession } from "@/lib/session"
import { useTheme } from "@/theme"

export interface ActiveDeliveryOrder {
  id: string
  listing_id: string
  canteen_id: string
  user_id: string
  driver_id: string | null
  status: "driver_assigned" | "on_the_way"
  dropoff_address: string
  dropoff_lat: number
  dropoff_lng: number
  accepted_at: string | null
  picked_up_at: string | null
  listing?: {
    title: string
    quantity: number
  } | null
}

export interface DeliveryTrackingContextValue {
  activeOrder: ActiveDeliveryOrder | null
  isLoading: boolean
  isSharingLocation: boolean
  showExplanation: boolean
  showPermissionDeniedBanner: boolean
  requestBackgroundPermission: () => Promise<void>
  dismissExplanation: () => void
  refetchActiveOrder: () => void
}

const DeliveryTrackingContext = createContext<DeliveryTrackingContextValue>({
  activeOrder: null,
  isLoading: false,
  isSharingLocation: false,
  showExplanation: false,
  showPermissionDeniedBanner: false,
  requestBackgroundPermission: async () => {},
  dismissExplanation: () => {},
  refetchActiveOrder: () => {},
})

export function useDeliveryTracking() {
  return useContext(DeliveryTrackingContext)
}

export function DeliveryTrackingProvider({
  children,
}: {
  children: React.ReactNode
}) {
  const { user } = useSession()
  const { theme } = useTheme()
  const queryClient = useQueryClient()

  const [isSharingLocation, setIsSharingLocation] = useState(false)
  const [showExplanation, setShowExplanation] = useState(false)
  const [showPermissionDeniedBanner, setShowPermissionDeniedBanner] =
    useState(false)
  const userDismissedExplanationRef = useRef(false)

  // 1. Fetch active order for the current driver
  const {
    data: activeOrder = null,
    isLoading,
    refetch: refetchActiveOrder,
  } = useQuery<ActiveDeliveryOrder | null>({
    queryKey: ["driver_active_order", user?.id],
    queryFn: async () => {
      if (!user?.id) return null
      const { data, error } = await supabase
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
          accepted_at,
          picked_up_at,
          listing:food_listings(title, quantity)
        `
        )
        .eq("driver_id", user.id)
        .in("status", ["driver_assigned", "on_the_way"])
        .order("accepted_at", { ascending: false })
        .limit(1)
        .maybeSingle()

      if (error) {
        console.warn("[delivery-tracking] Error querying active order:", error)
        return null
      }
      return (data as unknown as ActiveDeliveryOrder) ?? null
    },
    enabled: !!user?.id,
  })

  // 2. Realtime listener on orders table filtered by driver_id
  useEffect(() => {
    if (!user?.id) return
    const channelName = `driver-active-order-${user.id}-${Math.random().toString(36).substring(2, 8)}`
    const channel = supabase
      .channel(channelName)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "orders",
          filter: `driver_id=eq.${user.id}`,
        },
        () => {
          queryClient.invalidateQueries({
            queryKey: ["driver_active_order", user.id],
          })
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [user?.id, queryClient])

  // Helper to start the background location task and send immediate location
  const startTracking = useCallback(async () => {
    try {
      const isAlreadyStarted =
        await Location.hasStartedLocationUpdatesAsync(DRIVER_LOCATION_TASK)

      if (!isAlreadyStarted) {
        await Location.startLocationUpdatesAsync(DRIVER_LOCATION_TASK, {
          accuracy: Location.Accuracy.Balanced,
          timeInterval: 5000,
          distanceInterval: 15,
          pausesUpdatesAutomatically: false,
          foregroundService: {
            notificationTitle: "Plate-Link",
            notificationBody: "Sharing your location for an active delivery",
            notificationColor: palette.honeyBronze,
          },
        })
      }

      setIsSharingLocation(true)
      setShowPermissionDeniedBanner(false)

      // Immediate location upsert so canteen and NGO see the driver instantly
      if (user?.id) {
        try {
          const currentLoc = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Balanced,
          })
          await upsertCurrentDriverLocation(user.id, currentLoc)
        } catch (locErr) {
          console.warn(
            "[delivery-tracking] Error getting initial position:",
            locErr
          )
        }
      }
    } catch (err) {
      console.warn("[delivery-tracking] Failed to start location updates:", err)
    }
  }, [user?.id])

  // Helper to stop background location updates
  const stopTracking = useCallback(async () => {
    try {
      const isStarted =
        await Location.hasStartedLocationUpdatesAsync(DRIVER_LOCATION_TASK)
      if (isStarted) {
        await Location.stopLocationUpdatesAsync(DRIVER_LOCATION_TASK)
      }
      setIsSharingLocation(false)
      setShowPermissionDeniedBanner(false)
    } catch (err) {
      console.warn("[delivery-tracking] Failed to stop location updates:", err)
    }
  }, [])

  // 3. User requests background permission (from modal or banner)
  const requestBackgroundPermission = useCallback(async () => {
    try {
      // Ensure foreground first
      const fg = await Location.getForegroundPermissionsAsync()
      if (!fg.granted) {
        const reqFg = await Location.requestForegroundPermissionsAsync()
        if (!reqFg.granted) {
          setShowExplanation(false)
          setShowPermissionDeniedBanner(true)
          return
        }
      }

      const { status, canAskAgain } =
        await Location.requestBackgroundPermissionsAsync()
      setShowExplanation(false)

      if (status === "granted") {
        setShowPermissionDeniedBanner(false)
        await startTracking()
      } else {
        setShowPermissionDeniedBanner(true)
        if (!canAskAgain) {
          Alert.alert(
            "Location permission needed",
            "Plate-Link shares your location with the canteen and NGO only while you have an active delivery. Please enable location permissions in system settings.",
            [
              { text: "Cancel", style: "cancel" },
              {
                text: "Open settings",
                onPress: () => {
                  void Linking.openSettings()
                },
              },
            ]
          )
        }
      }
    } catch (err) {
      console.warn("[delivery-tracking] Permission request failed:", err)
      setShowExplanation(false)
      setShowPermissionDeniedBanner(true)
    }
  }, [startTracking])

  const dismissExplanation = useCallback(() => {
    userDismissedExplanationRef.current = true
    setShowExplanation(false)
    setShowPermissionDeniedBanner(true)
  }, [])

  // 4. Synchronize tracking state when active order changes
  useEffect(() => {
    let isCancelled = false

    async function evaluateTrackingState() {
      // If there is no active delivery or no driver logged in, stop tracking immediately
      if (!activeOrder || !user?.id) {
        await stopTracking()
        if (!isCancelled) {
          setShowExplanation(false)
          setShowPermissionDeniedBanner(false)
          userDismissedExplanationRef.current = false
        }
        return
      }

      // Check foreground permission
      const fg = await Location.getForegroundPermissionsAsync()
      if (!fg.granted) {
        const reqFg = await Location.requestForegroundPermissionsAsync()
        if (!reqFg.granted) {
          if (!isCancelled) {
            setShowPermissionDeniedBanner(true)
          }
          return
        }
      }

      // Check background permission
      const bg = await Location.getBackgroundPermissionsAsync()
      if (bg.granted) {
        if (!isCancelled) {
          setShowPermissionDeniedBanner(false)
          setShowExplanation(false)
          await startTracking()
        }
      } else {
        if (!isCancelled) {
          // If the user hasn't dismissed yet, show the explanation screen BEFORE asking permission
          if (!userDismissedExplanationRef.current) {
            setShowExplanation(true)
          } else {
            setShowPermissionDeniedBanner(true)
          }
        }
      }
    }

    void evaluateTrackingState()

    return () => {
      isCancelled = true
    }
  }, [activeOrder, user?.id, startTracking, stopTracking])

  // Stop tracking on component unmount / logout
  useEffect(() => {
    return () => {
      void stopTracking()
    }
  }, [stopTracking])

  return (
    <DeliveryTrackingContext.Provider
      value={{
        activeOrder,
        isLoading,
        isSharingLocation,
        showExplanation,
        showPermissionDeniedBanner,
        requestBackgroundPermission,
        dismissExplanation,
        refetchActiveOrder,
      }}
    >
      {children}

      {/* Background Location Explanation Modal */}
      <Modal
        visible={showExplanation}
        transparent
        animationType="fade"
        onRequestClose={dismissExplanation}
      >
        <View style={styles.modalOverlay}>
          <View
            style={[
              styles.modalCard,
              {
                backgroundColor: theme.colors.surface,
                borderColor: theme.colors.border,
              },
            ]}
          >
            <View
              style={[
                styles.modalIconBadge,
                { backgroundColor: theme.colors.surfaceSunken },
              ]}
            >
              <MapPin size={28} color={palette.honeyBronze} />
            </View>

            <Text variant="h2" style={styles.modalTitle}>
              Active delivery tracking
            </Text>

            <Text variant="body" muted style={styles.modalBody}>
              Plate-Link shares your location with the canteen and NGO only
              while you have an active delivery.
            </Text>

            <View style={styles.modalActions}>
              <PressButton
                variant="default"
                size="md"
                onPress={requestBackgroundPermission}
                accessibilityLabel="Continue to allow background location"
                style={styles.modalPrimaryBtn}
              >
                Continue
              </PressButton>

              <PressButton
                variant="outline"
                size="md"
                onPress={dismissExplanation}
                accessibilityLabel="Dismiss background location for now"
                style={styles.modalSecondaryBtn}
              >
                Not now
              </PressButton>
            </View>
          </View>
        </View>
      </Modal>
    </DeliveryTrackingContext.Provider>
  )
}

/**
 * Banner displayed when an active delivery is running but background location is denied.
 */
export function DeliveryLocationPermissionBanner() {
  const { showPermissionDeniedBanner, requestBackgroundPermission } =
    useDeliveryTracking()
  const { theme, isDark } = useTheme()

  if (!showPermissionDeniedBanner) return null

  return (
    <View
      style={[
        styles.banner,
        {
          backgroundColor: theme.colors.surfaceSunken,
          borderColor: theme.colors.danger,
        },
      ]}
    >
      <View style={styles.bannerIconCol}>
        <ShieldAlert size={20} color={theme.palette.blushedBrick} />
      </View>
      <View style={styles.bannerTextCol}>
        <Text variant="small" weight="semibold">
          Background location required
        </Text>
        <Text variant="caption" muted style={styles.bannerSubtitle}>
          Live location sharing is paused during active delivery.
        </Text>
      </View>
      <PressButton
        variant="default"
        size="sm"
        onPress={() => {
          void Linking.openSettings()
        }}
        accessibilityLabel="Open system settings"
      >
        Open settings
      </PressButton>
    </View>
  )
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.65)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  modalCard: {
    width: "100%",
    maxWidth: 380,
    borderRadius: 20,
    padding: 24,
    borderWidth: 1,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 8,
  },
  modalIconBadge: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  modalTitle: {
    textAlign: "center",
    marginBottom: 10,
  },
  modalBody: {
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 24,
  },
  modalActions: {
    width: "100%",
    gap: 10,
  },
  modalPrimaryBtn: {
    width: "100%",
  },
  modalSecondaryBtn: {
    width: "100%",
  },
  banner: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    gap: 12,
  },
  bannerIconCol: {
    justifyContent: "center",
    alignItems: "center",
  },
  bannerTextCol: {
    flex: 1,
  },
  bannerSubtitle: {
    marginTop: 2,
  },
})
