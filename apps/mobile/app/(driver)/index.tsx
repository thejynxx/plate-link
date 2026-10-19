import React, { useEffect, useMemo, useRef, useState } from "react"
import {
  Alert,
  FlatList,
  Linking,
  Pressable,
  RefreshControl,
  StyleSheet,
  View,
} from "react-native"
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated"
import { useRouter } from "expo-router"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { format } from "date-fns"
import * as Haptics from "expo-haptics"
import * as Location from "expo-location"
import {
  Camera,
  Map,
  type CameraRef,
  Marker,
  UserLocation,
} from "@maplibre/maplibre-react-native"
import {
  Crosshair,
  MapPin,
  Navigation,
  PowerOff,
  RefreshCw,
  X,
} from "lucide-react-native"
import {
  DEFAULT_CENTER,
  formatDistance,
  haversineMeters,
  MAP_STYLE_DARK,
  MAP_STYLE_LIGHT,
  palette,
} from "@platelink/shared"
import {
  Badge,
  Chip,
  ChromeHeader,
  EmptyState,
  ErrorState,
  PressButton,
  Skeleton,
  Switch,
  Text,
  TicketCard,
  LocationSharingPill,
} from "@/components/ui"
import { useDeliveryTracking, DeliveryLocationPermissionBanner } from "@/lib/use-delivery-tracking"
import { useSession } from "@/lib/session"
import { supabase } from "@/lib/supabase"
import { useTheme } from "@/theme"

export interface AvailablePickup {
  order_id: string
  listing_id: string
  title: string
  quantity: number
  canteen_name: string
  pickup_address: string
  pickup_lat: number
  pickup_lng: number
  dropoff_address: string
  dropoff_lat: number
  dropoff_lng: number
  expires_at: string
  distance_m: number
  created_at: string
}

export default function DriverPickupsScreen() {
  const router = useRouter()
  const { theme, isDark } = useTheme()
  const { user } = useSession()
  const { isSharingLocation } = useDeliveryTracking()
  const queryClient = useQueryClient()
  const cameraRef = useRef<CameraRef>(null)

  // View state: "map" or "list"
  const [viewMode, setViewMode] = useState<"map" | "list">("map")
  const [isOnline, setIsOnline] = useState<boolean>(true)
  const [selectedPickup, setSelectedPickup] = useState<AvailablePickup | null>(null)
  const [isAccepting, setIsAccepting] = useState<boolean>(false)

  // Location state
  const [coords, setCoords] = useState<{ lat: number; lng: number }>(DEFAULT_CENTER)
  const [locationPermissionGranted, setLocationPermissionGranted] = useState<boolean | null>(null)

  // Bottom sheet animation
  const sheetTranslateY = useSharedValue(500)

  // Fetch driver online status
  useEffect(() => {
    if (!user) return
    let isMounted = true

    async function loadDriverStatus() {
      const { data } = await supabase
        .from("drivers")
        .select("is_online")
        .eq("id", user!.id)
        .maybeSingle()

      if (isMounted && data) {
        setIsOnline(data.is_online)
      }
    }

    loadDriverStatus()
    return () => {
      isMounted = false
    }
  }, [user])

  // Request location permission & get current coordinates (user-triggered)
  const requestLocation = async () => {
    try {
      const { status, canAskAgain } = await Location.requestForegroundPermissionsAsync()
      if (status === "granted") {
        setLocationPermissionGranted(true)
        const loc = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        })
        const newCoords = {
          lat: loc.coords.latitude,
          lng: loc.coords.longitude,
        }
        setCoords(newCoords)
        cameraRef.current?.easeTo({
          center: [newCoords.lng, newCoords.lat],
          zoom: 13,
          duration: 800,
        })
      } else {
        setLocationPermissionGranted(false)
        setCoords(DEFAULT_CENTER)
        if (!canAskAgain) {
          Alert.alert(
            "Location permission needed",
            "Plate-Link uses your location to show nearby pickups. Please enable location in system settings.",
            [
              { text: "Cancel", style: "cancel" },
              { text: "Open settings", onPress: () => { void Linking.openSettings() } },
            ]
          )
        }
      }
    } catch {
      setLocationPermissionGranted(false)
      setCoords(DEFAULT_CENTER)
    }
  }

  useEffect(() => {
    let isMounted = true
    const initLocation = async () => {
      try {
        const { status, canAskAgain } = await Location.requestForegroundPermissionsAsync()
        if (!isMounted) return
        if (status === "granted") {
          setLocationPermissionGranted(true)
          const loc = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Balanced,
          })
          if (!isMounted) return
          const newCoords = {
            lat: loc.coords.latitude,
            lng: loc.coords.longitude,
          }
          setCoords(newCoords)
          cameraRef.current?.easeTo({
            center: [newCoords.lng, newCoords.lat],
            zoom: 13,
            duration: 800,
          })
        } else {
          setLocationPermissionGranted(false)
          setCoords(DEFAULT_CENTER)
          if (!canAskAgain) {
            Alert.alert(
              "Location permission needed",
              "Plate-Link uses your location to show nearby pickups. Please enable location in system settings.",
              [
                { text: "Cancel", style: "cancel" },
                { text: "Open settings", onPress: () => { void Linking.openSettings() } },
              ]
            )
          }
        }
      } catch {
        if (!isMounted) return
        setLocationPermissionGranted(false)
        setCoords(DEFAULT_CENTER)
      }
    }
    void initLocation()
    return () => {
      isMounted = false
    }
  }, [])

  // Toggle Driver Online / Offline status
  const handleToggleOnline = async (value: boolean) => {
    setIsOnline(value)
    if (!user) return
    try {
      await supabase
        .from("drivers")
        .update({ is_online: value })
        .eq("id", user.id)
    } catch (err) {
      console.warn("Failed to update driver status:", err)
    }
  }

  // TanStack Query for available pickups
  const {
    data: pickups = [],
    isLoading,
    isError,
    error,
    refetch,
    isRefetching,
  } = useQuery<AvailablePickup[]>({
    queryKey: ["available_pickups", coords.lat, coords.lng],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("available_pickups", {
        p_lat: coords.lat,
        p_lng: coords.lng,
        p_radius_m: 10000,
      })
      if (error) throw error
      return (data as AvailablePickup[]) ?? []
    },
    enabled: isOnline && !!coords,
  })

  // Realtime subscription to orders table (Rule 11: unique channel name per mount)
  useEffect(() => {
    const channelName = `driver-orders-${Math.random().toString(36).substring(2, 9)}`
    const channel = supabase
      .channel(channelName)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "orders" },
        () => {
          queryClient.invalidateQueries({ queryKey: ["available_pickups"] })
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [queryClient])

  // Open / Close Bottom Sheet
  useEffect(() => {
    if (selectedPickup) {
      sheetTranslateY.value = withTiming(0, { duration: 250 })
    } else {
      sheetTranslateY.value = withTiming(500, { duration: 200 })
    }
  }, [selectedPickup, sheetTranslateY])

  const animatedSheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: sheetTranslateY.value }],
  }))

  const handleSelectPickup = (pickup: AvailablePickup) => {
    try {
      Haptics.selectionAsync().catch(() => {})
    } catch {}
    setSelectedPickup(pickup)
  }

  const handleRecenter = () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {})
    } catch {}
    if (locationPermissionGranted === false) {
      void requestLocation()
      return
    }
    cameraRef.current?.easeTo({
      center: [coords.lng, coords.lat],
      zoom: 13,
      duration: 600,
    })
  }

  // Accept Order RPC
  const handleAcceptOrder = async () => {
    if (!selectedPickup) return
    setIsAccepting(true)

    try {
      const { error } = await supabase.rpc("accept_order", {
        p_order_id: selectedPickup.order_id,
      })

      if (error) {
        if (error.code === "42501") {
          Alert.alert("Permission denied", "Only driver accounts can accept deliveries.")
        } else if (error.code === "P0001") {
          Alert.alert("Unable to accept", error.message || "This order is already taken or unavailable.")
        } else {
          Alert.alert("Notice", error.message || "Couldn't accept delivery.")
        }
        return
      }

      try {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
      } catch {}

      Alert.alert(
        "Delivery accepted",
        "Head to the canteen to collect the food portions.",
        [
          {
            text: "View route",
            onPress: () => {
              setSelectedPickup(null)
              queryClient.invalidateQueries({ queryKey: ["available_pickups"] })
              router.push("/(driver)/active" as any)
            },
          },
        ]
      )
    } catch (err: any) {
      Alert.alert("Error", err?.message ?? "An unexpected error occurred.")
    } finally {
      setIsAccepting(false)
    }
  }

  const sortedPickups = useMemo(() => {
    return [...pickups].sort((a, b) => a.distance_m - b.distance_m)
  }, [pickups])

  const mapStyleUrl = isDark ? MAP_STYLE_DARK : MAP_STYLE_LIGHT

  return (
    <View style={[styles.root, { backgroundColor: theme.colors.canvas }]}>
      {/* Structural Gunmetal Chrome Header */}
      <ChromeHeader
        title="Pickups"
        subtitle={
          isOnline
            ? `${pickups.length} available within 10 km`
            : "Driver currently offline"
        }
        rightAction={
          <View style={styles.headerRight}>
            {isSharingLocation && <LocationSharingPill />}
            <Text
              variant="caption"
              style={[styles.onlineStatusText, { color: theme.colors.chromeInk }]}
            >
              {isOnline ? "Online" : "Offline"}
            </Text>
            <Switch
              value={isOnline}
              onValueChange={handleToggleOnline}
              accessibilityLabel="Toggle online status"
            />
          </View>
        }
      />

      {/* Active Delivery Background Location Permission Banner */}
      <DeliveryLocationPermissionBanner />

      {/* Subheader Toolbar: View mode Chips & Refresh button */}
      <View
        style={[
          styles.toolbar,
          {
            backgroundColor: theme.colors.surface,
            borderBottomColor: theme.colors.border,
          },
        ]}
      >
        <View style={styles.chipRow}>
          <Chip
            label="Map"
            selected={viewMode === "map"}
            onPress={() => setViewMode("map")}
          />
          <Chip
            label="List"
            selected={viewMode === "list"}
            onPress={() => setViewMode("list")}
          />
        </View>

        <PressButton
          variant="outline"
          size="sm"
          onPress={() => refetch()}
          loading={isRefetching}
          leftIcon={<RefreshCw size={14} color={theme.colors.ink} />}
          accessibilityLabel="Refresh available pickups"
        >
          Refresh
        </PressButton>
      </View>

      {/* Location Permission Explainer Banner */}
      {locationPermissionGranted === false && (
        <View
          style={[
            styles.permissionBanner,
            { backgroundColor: "rgba(244, 184, 96, 0.2)", borderColor: theme.colors.accent },
          ]}
        >
          <View style={{ flex: 1 }}>
            <Text variant="small" weight="semibold">
              Location permission needed
            </Text>
            <Text variant="caption" muted style={{ marginTop: 2 }}>
              Plate-Link uses your location to show nearby pickups.
            </Text>
          </View>
          <PressButton
            variant="default"
            size="sm"
            onPress={() => Linking.openSettings()}
          >
            Open settings
          </PressButton>
        </View>
      )}

      {/* Main Content Area */}
      <View style={styles.contentArea}>
        {viewMode === "map" ? (
          <View style={styles.mapContainer}>
            {/* Full-Screen MapLibre Map with Free OpenFreeMap OSM Tiles */}
            <Map
              mapStyle={mapStyleUrl}
              style={StyleSheet.absoluteFill}
              attribution={true}
              attributionPosition={{ bottom: 12, left: 12 }}
            >
              <Camera
                ref={cameraRef}
                initialViewState={{
                  center: [coords.lng, coords.lat],
                  zoom: 13,
                }}
              />

              {/* User Location Puck */}
              <UserLocation animated={true} />

              {/* Honey Pins at Available Pickup Points */}
              {isOnline &&
                pickups.map((pickup) => (
                  <Marker
                    key={pickup.order_id}
                    id={pickup.order_id}
                    lngLat={[pickup.pickup_lng, pickup.pickup_lat]}
                    onPress={() => handleSelectPickup(pickup)}
                  >
                    <View style={styles.pinWrapper}>
                      <View
                        style={[
                          styles.pinHead,
                          {
                            backgroundColor: palette.honeyBronze,
                            borderColor: palette.gunmetal,
                          },
                          selectedPickup?.order_id === pickup.order_id && styles.selectedPinHead,
                        ]}
                      >
                        <Text
                          style={[
                            styles.pinCountText,
                            { fontFamily: theme.fonts.displayBold },
                          ]}
                        >
                          {pickup.quantity}
                        </Text>
                      </View>
                      <View
                        style={[
                          styles.pinTail,
                          { borderTopColor: palette.honeyBronze },
                        ]}
                      />
                    </View>
                  </Marker>
                ))}
            </Map>

            {/* Floating Recenter Button */}
            <View style={styles.floatingButtons}>
              <PressButton
                variant="outline"
                size="sm"
                onPress={handleRecenter}
                leftIcon={<Crosshair size={18} color={theme.colors.ink} />}
                accessibilityLabel="Recenter map on your location"
                style={styles.recenterButton}
              >
                Recenter
              </PressButton>
            </View>
          </View>
        ) : (
          /* List View: FlatList of Pickups sorted by distance */
          <View style={styles.listContainer}>
            {isLoading ? (
              <View style={styles.skeletonList}>
                <Skeleton height={140} borderRadius={14} />
                <Skeleton height={140} borderRadius={14} />
              </View>
            ) : isError ? (
              <View style={styles.centerPadded}>
                <ErrorState
                  error={error}
                  message="Couldn't load available pickups"
                  onRetry={() => refetch()}
                />
              </View>
            ) : sortedPickups.length === 0 ? (
              <View style={styles.centerPadded}>
                <EmptyState
                  icon={<MapPin size={28} color={theme.palette.honeyBronze} />}
                  title="No pickups within 10 km right now"
                  description="New food donations appear when canteens finish meal service batches."
                  action={
                    <PressButton variant="outline" size="sm" onPress={() => refetch()}>
                      Check again
                    </PressButton>
                  }
                />
              </View>
            ) : (
              <FlatList
                data={sortedPickups}
                keyExtractor={(item) => item.order_id}
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
                  const distText = formatDistance(item.distance_m)
                  const deliveryDistance = haversineMeters(
                    { lat: item.pickup_lat, lng: item.pickup_lng },
                    { lat: item.dropoff_lat, lng: item.dropoff_lng }
                  )
                  const deliveryDistText = formatDistance(deliveryDistance)

                  return (
                    <TicketCard
                      title={item.title}
                      portions={item.quantity}
                      status="available"
                      meta={`${distText} away at ${item.canteen_name}`}
                      expiryText={`Good until ${format(new Date(item.expires_at), "h:mm a")} (${deliveryDistText} drop-off)`}
                      actionText="View & accept"
                      onPress={() => handleSelectPickup(item)}
                      style={styles.ticketCardItem}
                    />
                  )
                }}
              />
            )}
          </View>
        )}

        {/* Offline Overlay */}
        {!isOnline && (
          <View
            style={[
              styles.offlineOverlay,
              {
                backgroundColor: isDark
                  ? "rgba(30, 34, 37, 0.94)"
                  : "rgba(251, 247, 245, 0.94)",
              },
            ]}
          >
            <View
              style={[
                styles.offlineIconBadge,
                { backgroundColor: theme.colors.surfaceSunken },
              ]}
            >
              <PowerOff size={32} color={theme.colors.inkMuted} />
            </View>
            <Text variant="h2" style={{ textAlign: "center", marginTop: 12 }}>
              You&apos;re offline
            </Text>
            <Text
              variant="body"
              muted
              style={{ textAlign: "center", marginTop: 6, maxWidth: 280 }}
            >
              Go online to view live surplus pickups and accept orders nearby.
            </Text>
            <PressButton
              variant="accent"
              size="md"
              onPress={() => handleToggleOnline(true)}
              style={{ marginTop: 20 }}
            >
              Go online
            </PressButton>
          </View>
        )}
      </View>

      {/* Slide-Up Bottom Sheet for Selected Pickup */}
      {selectedPickup && (
        <Pressable
          style={styles.sheetBackdrop}
          onPress={() => setSelectedPickup(null)}
        >
          <Animated.View
            style={[
              styles.bottomSheet,
              {
                backgroundColor: theme.colors.surface,
                borderColor: theme.colors.borderStrong,
              },
              animatedSheetStyle,
            ]}
          >
            <Pressable
              onPress={(e) => e.stopPropagation()}
              style={styles.sheetInner}
            >
              {/* Drag Handle & Header */}
              <View style={styles.sheetHeader}>
                <View
                  style={[
                    styles.dragHandle,
                    { backgroundColor: theme.colors.borderStrong },
                  ]}
                />
                <Pressable
                  onPress={() => setSelectedPickup(null)}
                  style={styles.sheetCloseBtn}
                  accessibilityLabel="Close details"
                >
                  <X size={20} color={theme.colors.inkMuted} />
                </Pressable>
              </View>

              {/* Pickup Information Details */}
              <View style={styles.sheetBody}>
                <View style={styles.titleRow}>
                  <View style={{ flex: 1, marginRight: 12 }}>
                    <Text variant="h2" style={styles.sheetTitle}>
                      {selectedPickup.title}
                    </Text>
                    <Text variant="small" muted style={{ marginTop: 2 }}>
                      {selectedPickup.canteen_name}
                    </Text>
                  </View>
                  <View style={styles.sheetPortionCol}>
                    <Text
                      tabularNums
                      style={[
                        styles.sheetPortionNum,
                        { fontFamily: theme.fonts.displayBold },
                      ]}
                    >
                      {selectedPickup.quantity}
                    </Text>
                    <Text variant="caption" muted>
                      portions
                    </Text>
                  </View>
                </View>

                {/* Pickup & Drop-Off Routing Route Info */}
                <View
                  style={[
                    styles.routeCard,
                    {
                      backgroundColor: theme.colors.surfaceSunken,
                      borderColor: theme.colors.border,
                    },
                  ]}
                >
                  <View style={styles.routePoint}>
                    <MapPin size={16} color={palette.honeyBronze} />
                    <View style={styles.routeTextCol}>
                      <Text variant="caption" muted>
                        Pickup location
                      </Text>
                      <Text variant="small" weight="medium" numberOfLines={1}>
                        {selectedPickup.pickup_address}
                      </Text>
                    </View>
                  </View>

                  <View
                    style={[
                      styles.routeConnector,
                      { borderColor: theme.colors.borderStrong },
                    ]}
                  />

                  <View style={styles.routePoint}>
                    <Navigation size={16} color={theme.palette.blushedBrick} />
                    <View style={styles.routeTextCol}>
                      <Text variant="caption" muted>
                        Drop-off address
                      </Text>
                      <Text variant="small" weight="medium" numberOfLines={1}>
                        {selectedPickup.dropoff_address}
                      </Text>
                    </View>
                  </View>
                </View>

                {/* Meta details & Delivery Distance */}
                <View style={styles.sheetMetaRow}>
                  <Badge status="available" />
                  <Text variant="small" muted>
                    Transit distance:{" "}
                    {formatDistance(
                      haversineMeters(
                        {
                          lat: selectedPickup.pickup_lat,
                          lng: selectedPickup.pickup_lng,
                        },
                        {
                          lat: selectedPickup.dropoff_lat,
                          lng: selectedPickup.dropoff_lng,
                        }
                      )
                    )}
                  </Text>
                </View>

                {/* Expiry Countdown */}
                <Text variant="caption" muted style={{ marginBottom: 14 }}>
                  Good until {format(new Date(selectedPickup.expires_at), "h:mm a")} today
                </Text>

                {/* Accept Delivery Action Button */}
                <PressButton
                  variant="default"
                  size="lg"
                  fullWidth
                  loading={isAccepting}
                  onPress={handleAcceptOrder}
                >
                  Accept delivery
                </PressButton>
              </View>
            </Pressable>
          </Animated.View>
        </Pressable>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  headerRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  onlineStatusText: {
    marginRight: 6,
    fontSize: 12,
  },
  toolbar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  chipRow: {
    flexDirection: "row",
    gap: 8,
  },
  permissionBanner: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  contentArea: {
    flex: 1,
    position: "relative",
  },
  mapContainer: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  listContainer: {
    flex: 1,
  },
  listContent: {
    padding: 16,
    gap: 14,
  },
  ticketCardItem: {
    marginBottom: 4,
  },
  skeletonList: {
    padding: 16,
    gap: 14,
  },
  centerPadded: {
    padding: 24,
    marginTop: 36,
  },
  floatingButtons: {
    position: "absolute",
    right: 16,
    bottom: 24,
  },
  recenterButton: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 4,
  },
  pinWrapper: {
    alignItems: "center",
    justifyContent: "center",
  },
  pinHead: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 14,
    borderWidth: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3,
    elevation: 4,
  },
  selectedPinHead: {
    transform: [{ scale: 1.15 }],
  },
  pinCountText: {
    fontSize: 13,
    color: palette.gunmetal,
  },
  pinTail: {
    width: 0,
    height: 0,
    borderLeftWidth: 5,
    borderRightWidth: 5,
    borderTopWidth: 6,
    borderLeftColor: "transparent",
    borderRightColor: "transparent",
  },
  offlineOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    zIndex: 20,
  },
  offlineIconBadge: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  sheetBackdrop: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0, 0, 0, 0.4)",
    justifyContent: "flex-end",
    zIndex: 30,
  },
  bottomSheet: {
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    borderTopWidth: 1,
    paddingBottom: 28,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 10,
  },
  sheetInner: {
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  sheetHeader: {
    alignItems: "center",
    position: "relative",
    paddingBottom: 8,
  },
  dragHandle: {
    width: 38,
    height: 4,
    borderRadius: 2,
  },
  sheetCloseBtn: {
    position: "absolute",
    right: 0,
    top: -2,
    padding: 6,
  },
  sheetBody: {
    marginTop: 4,
  },
  titleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 12,
  },
  sheetTitle: {
    fontSize: 22,
    lineHeight: 28,
  },
  sheetPortionCol: {
    alignItems: "flex-end",
  },
  sheetPortionNum: {
    fontSize: 32,
    lineHeight: 34,
  },
  routeCard: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
    marginBottom: 14,
  },
  routePoint: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  routeTextCol: {
    flex: 1,
  },
  routeConnector: {
    borderLeftWidth: 1.5,
    borderStyle: "dashed",
    height: 14,
    marginLeft: 7,
    marginVertical: 3,
  },
  sheetMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
})
