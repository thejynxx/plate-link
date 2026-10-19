import React, { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  ActivityIndicator,
  Alert,
  Image,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native"
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated"
import { useRouter } from "expo-router"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import * as Haptics from "expo-haptics"
import * as ImageManipulator from "expo-image-manipulator"
import * as ImagePicker from "expo-image-picker"
import * as Location from "expo-location"
import {
  Camera,
  GeoJSONSource,
  Layer,
  Map,
  Marker,
  UserLocation,
  type CameraRef,
} from "@maplibre/maplibre-react-native"
import {
  Bike,
  Camera as CameraIcon,
  CheckCircle2,
  Clock,
  Compass,
  MapPin,
  MessageSquare,
  Navigation,
  Phone,
  RotateCcw,
  Utensils,
  X,
} from "lucide-react-native"
import {
  DEFAULT_CENTER,
  formatDistance,
  haversineMeters,
  MAP_STYLE_DARK,
  MAP_STYLE_LIGHT,
  navigationUrl,
  palette,
} from "@platelink/shared"
import {
  Badge,
  Card,
  ChromeHeader,
  EmptyState,
  LocationSharingPill,
  PressButton,
  Text,
  TicketCard,
} from "@/components/ui"
import { fetchRoute, type RouteResult } from "@/lib/routes"
import { useSession } from "@/lib/session"
import { supabase } from "@/lib/supabase"
import {
  DeliveryLocationPermissionBanner,
  useDeliveryTracking,
} from "@/lib/use-delivery-tracking"
import { useTheme } from "@/theme"

export interface ActiveOrderDetail {
  id: string
  listing_id: string
  canteen_id: string
  user_id: string
  driver_id: string | null
  status: "driver_assigned" | "on_the_way"
  dropoff_address: string
  dropoff_lat: number
  dropoff_lng: number
  notes: string | null
  accepted_at: string | null
  picked_up_at: string | null
  listing?: {
    id: string
    title: string
    quantity: number
    food_type: string
    description: string | null
    expires_at: string
    location_lat: number
    location_lng: number
  } | null
  canteen?: {
    id: string
    org_name: string
    address: string
    location_lat: number
    location_lng: number
    pickup_instructions: string | null
    user?: {
      name: string
      phone: string | null
    } | null
  } | null
}

export default function DriverActiveScreen() {
  const router = useRouter()
  const { theme, isDark } = useTheme()
  const { user } = useSession()
  const { isSharingLocation } = useDeliveryTracking()
  const queryClient = useQueryClient()
  const cameraRef = useRef<CameraRef>(null)

  // Driver current coordinates for map & routing
  const [driverCoords, setDriverCoords] = useState<[number, number]>([
    DEFAULT_CENTER.lng,
    DEFAULT_CENTER.lat,
  ])

  // Route calculation & caching
  const [routeResult, setRouteResult] = useState<RouteResult | null>(null)
  const [isRouting, setIsRouting] = useState(false)
  const lastRouteFetchRef = useRef<number>(0)

  // Proof photo modal state
  const [proofModalVisible, setProofModalVisible] = useState(false)
  const [proofTargetStatus, setProofTargetStatus] = useState<
    "picked_up" | "delivered" | null
  >(null)
  const [capturedPhotoUri, setCapturedPhotoUri] = useState<string | null>(null)
  const [isSubmittingProof, setIsSubmittingProof] = useState(false)

  // Success completed animation
  const [isDeliveredSuccess, setIsDeliveredSuccess] = useState(false)
  const successScale = useSharedValue(0.6)
  const successOpacity = useSharedValue(0)

  // 1. Fetch detailed active order
  const {
    data: activeOrder = null,
    isLoading,
  } = useQuery<ActiveOrderDetail | null>({
    queryKey: ["driver_active_order_detail", user?.id],
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
          notes,
          accepted_at,
          picked_up_at,
          listing:food_listings(
            id,
            title,
            quantity,
            food_type,
            description,
            expires_at,
            location_lat,
            location_lng
          ),
          canteen:canteens(
            id,
            org_name,
            address,
            location_lat,
            location_lng,
            pickup_instructions,
            user:users(
              name,
              phone
            )
          )
        `
        )
        .eq("driver_id", user.id)
        .in("status", ["driver_assigned", "on_the_way"])
        .order("accepted_at", { ascending: false })
        .limit(1)
        .maybeSingle()

      if (error) {
        console.warn("[active-order] Query error:", error)
        return null
      }
      return (data as unknown as ActiveOrderDetail) ?? null
    },
    enabled: !!user?.id,
  })

  // 2. Realtime listener on orders table filtered by current order id (Rule 11)
  useEffect(() => {
    if (!activeOrder?.id) return
    const channelName = `driver-active-order-${activeOrder.id}-${Math.random().toString(36).substring(2, 8)}`
    const channel = supabase
      .channel(channelName)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "orders",
          filter: `id=eq.${activeOrder.id}`,
        },
        () => {
          queryClient.invalidateQueries({
            queryKey: ["driver_active_order_detail"],
          })
          queryClient.invalidateQueries({
            queryKey: ["driver_active_order"],
          })
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [activeOrder?.id, queryClient])

  // 3. Track continuous GPS location of driver
  useEffect(() => {
    let sub: Location.LocationSubscription | null = null
    let isMounted = true

    async function startWatchingPos() {
      try {
        const pos = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        })
        if (isMounted) {
          setDriverCoords([pos.coords.longitude, pos.coords.latitude])
        }
        sub = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.Balanced,
            timeInterval: 4000,
            distanceInterval: 10,
          },
          (loc) => {
            if (isMounted && loc.coords) {
              setDriverCoords([loc.coords.longitude, loc.coords.latitude])
            }
          }
        )
      } catch {}
    }

    void startWatchingPos()

    return () => {
      isMounted = false
      sub?.remove()
    }
  }, [])

  // 4. Determine current destination target based on active delivery stage
  // driver_assigned -> Canteen pickup; on_the_way -> Drop-off address
  const targetCoords = useMemo<[number, number] | null>(() => {
    if (!activeOrder) return null
    if (activeOrder.status === "driver_assigned") {
      const lat =
        activeOrder.canteen?.location_lat ??
        activeOrder.listing?.location_lat ??
        DEFAULT_CENTER.lat
      const lng =
        activeOrder.canteen?.location_lng ??
        activeOrder.listing?.location_lng ??
        DEFAULT_CENTER.lng
      return [lng, lat]
    }
    return [activeOrder.dropoff_lng, activeOrder.dropoff_lat]
  }, [activeOrder])

  // 5. Fetch driving route with ORS / fallback every 30 s
  const updateRoute = useCallback(async () => {
    if (!targetCoords || !driverCoords) return
    setIsRouting(true)
    lastRouteFetchRef.current = Date.now()

    const points: [number, number][] = [driverCoords, targetCoords]
    const result = await fetchRoute(points)
    setIsRouting(false)

    if (result) {
      setRouteResult(result)
    }
  }, [driverCoords, targetCoords])

  useEffect(() => {
    let isMounted = true
    if (!activeOrder || !targetCoords || !driverCoords) return

    const now = Date.now()
    if (now - lastRouteFetchRef.current < 30_000 && routeResult) {
      return
    }

    lastRouteFetchRef.current = now
    const run = async () => {
      const points: [number, number][] = [driverCoords, targetCoords]
      const result = await fetchRoute(points)
      if (isMounted && result) {
        setRouteResult(result)
      }
    }

    void run()

    return () => {
      isMounted = false
    }
  }, [activeOrder, targetCoords, driverCoords, routeResult])

  // Straight line fallback GeoJSON if ORS route is unavailable
  const fallbackLineGeoJson = useMemo(() => {
    if (!targetCoords || !driverCoords) return null
    return {
      type: "Feature" as const,
      geometry: {
        type: "LineString" as const,
        coordinates: [driverCoords, targetCoords],
      },
      properties: {},
    }
  }, [driverCoords, targetCoords])

  // Estimated arrival time / distance
  const etaInfo = useMemo(() => {
    if (routeResult) {
      const minutes = Math.max(1, Math.round(routeResult.durationS / 60))
      return {
        etaText: `~${minutes} min`,
        distText: formatDistance(routeResult.distanceM),
      }
    }
    if (targetCoords && driverCoords) {
      const distM = haversineMeters(
        { lat: driverCoords[1], lng: driverCoords[0] },
        { lat: targetCoords[1], lng: targetCoords[0] }
      )
      const minutes = Math.max(1, Math.round((distM / (30_000 / 3600)) / 60))
      return {
        etaText: `~${minutes} min`,
        distText: formatDistance(distM),
      }
    }
    return { etaText: "--", distText: "--" }
  }, [routeResult, driverCoords, targetCoords])

  // 6. Navigate action deep-link (Rule 7: navigationUrl from shared)
  const handleNavigate = () => {
    if (!targetCoords) return
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {})
      const url = navigationUrl({
        lat: targetCoords[1],
        lng: targetCoords[0],
      })
      void Linking.openURL(url)
    } catch {
      Alert.alert("Unable to open map", "Could not launch navigation application.")
    }
  }

  // 7. Call canteen contact phone
  const handleCallCanteen = () => {
    const phone = activeOrder?.canteen?.user?.phone
    if (phone) {
      void Linking.openURL(`tel:${phone}`)
    } else {
      Alert.alert(
        "No phone number",
        "The canteen has not registered a contact phone number."
      )
    }
  }

  // 8. Open proof photo sheet
  const handleOpenProofModal = (status: "picked_up" | "delivered") => {
    try {
      Haptics.selectionAsync().catch(() => {})
    } catch {}
    setProofTargetStatus(status)
    setCapturedPhotoUri(null)
    setProofModalVisible(true)
  }

  // 9. Take photo with camera and compress with expo-image-manipulator
  const handleTakePhoto = async () => {
    try {
      const perm = await ImagePicker.requestCameraPermissionsAsync()
      if (!perm.granted) {
        Alert.alert(
          "Camera permission required",
          "Plate-Link uses the camera for optional pickup and delivery proof photos. Please enable camera access in settings.",
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
        return
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ["images"],
        allowsEditing: false,
        quality: 0.9,
      })

      if (!result.canceled && result.assets && result.assets[0]?.uri) {
        const rawUri = result.assets[0].uri
        const width = result.assets[0].width || 1280
        const height = result.assets[0].height || 720

        // Resize to max 1280px maintaining aspect ratio
        const resizeAction =
          width > height
            ? { resize: { width: Math.min(width, 1280) } }
            : { resize: { height: Math.min(height, 1280) } }

        const manipulated = await ImageManipulator.manipulateAsync(
          rawUri,
          [resizeAction],
          { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG }
        )

        setCapturedPhotoUri(manipulated.uri)
      }
    } catch (err: any) {
      Alert.alert("Camera error", err?.message ?? "Failed to capture photo.")
    }
  }

  // 10. Submit proof & trigger RPC (mark_picked_up or mark_delivered)
  const handleSubmitProof = async (skipPhoto: boolean = false) => {
    if (!activeOrder || !proofTargetStatus || !user) return
    setIsSubmittingProof(true)

    try {
      let proofPath: string | null = null

      if (!skipPhoto && capturedPhotoUri) {
        const filename =
          proofTargetStatus === "picked_up" ? "pickup.jpg" : "delivery.jpg"
        const storagePath = `${user.id}/${activeOrder.id}/${filename}`

        // Convert local URI to ArrayBuffer for Supabase Storage in React Native (Rule 8)
        const photoRes = await fetch(capturedPhotoUri)
        const blob = await photoRes.blob()
        const arrayBuffer = await new Response(blob).arrayBuffer()

        const { error: uploadErr } = await supabase.storage
          .from("delivery-proofs")
          .upload(storagePath, arrayBuffer, {
            contentType: "image/jpeg",
            upsert: true,
          })

        if (!uploadErr) {
          proofPath = storagePath
        } else {
          console.warn("[proof-upload] Storage upload failed:", uploadErr.message)
        }
      }

      if (proofTargetStatus === "picked_up") {
        const { error } = await supabase.rpc("mark_picked_up", {
          p_order_id: activeOrder.id,
          p_proof_path: proofPath ?? undefined,
        })

        if (error) {
          Alert.alert(
            "Couldn't confirm pickup",
            error.code === "P0001"
              ? error.message
              : "Unable to update pickup status. Please try again."
          )
          return
        }

        try {
          await Haptics.notificationAsync(
            Haptics.NotificationFeedbackType.Success
          )
        } catch {}

        setProofModalVisible(false)
        await queryClient.invalidateQueries({
          queryKey: ["driver_active_order_detail"],
        })
        await queryClient.invalidateQueries({
          queryKey: ["driver_active_order"],
        })
      } else if (proofTargetStatus === "delivered") {
        const { error } = await supabase.rpc("mark_delivered", {
          p_order_id: activeOrder.id,
          p_proof_path: proofPath ?? undefined,
        })

        if (error) {
          Alert.alert(
            "Couldn't confirm delivery",
            error.code === "P0001"
              ? error.message
              : "Unable to complete delivery. Please try again."
          )
          return
        }

        try {
          await Haptics.notificationAsync(
            Haptics.NotificationFeedbackType.Success
          )
        } catch {}

        setProofModalVisible(false)
        setIsDeliveredSuccess(true)

        // Animate success check
        successScale.value = withSpring(1, { damping: 12 })
        successOpacity.value = withTiming(1, { duration: 250 })

        // Invalidate queries and navigate back to Pickups after 2 s
        await queryClient.invalidateQueries({
          queryKey: ["driver_active_order_detail"],
        })
        await queryClient.invalidateQueries({
          queryKey: ["driver_active_order"],
        })

        setTimeout(() => {
          setIsDeliveredSuccess(false)
          router.navigate("/(driver)")
        }, 2000)
      }
    } catch (err: any) {
      Alert.alert("Error", err?.message ?? "An unexpected error occurred.")
    } finally {
      setIsSubmittingProof(false)
    }
  }

  // 11. Release order confirmation
  const handleReleaseOrder = () => {
    if (!activeOrder) return
    Alert.alert(
      "Release delivery?",
      "The order will return to the available pickups pool for other drivers to claim.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Release delivery",
          style: "destructive",
          onPress: async () => {
            try {
              const { error } = await supabase.rpc("release_order", {
                p_order_id: activeOrder.id,
              })

              if (error) {
                Alert.alert(
                  "Unable to release",
                  error.code === "P0001"
                    ? error.message
                    : "Failed to release the delivery order."
                )
                return
              }

              try {
                await Haptics.notificationAsync(
                  Haptics.NotificationFeedbackType.Success
                )
              } catch {}

              await queryClient.invalidateQueries({
                queryKey: ["driver_active_order_detail"],
              })
              await queryClient.invalidateQueries({
                queryKey: ["driver_active_order"],
              })
            } catch (err: any) {
              Alert.alert("Error", err?.message ?? "Unexpected release error.")
            }
          },
        },
      ]
    )
  }

  const mapStyleUrl = isDark ? MAP_STYLE_DARK : MAP_STYLE_LIGHT

  const successAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: successScale.value }],
    opacity: successOpacity.value,
  }))

  return (
    <View style={[styles.root, { backgroundColor: theme.colors.canvas }]}>
      {/* Structural Gunmetal Chrome Header */}
      <ChromeHeader
        title="Active delivery"
        subtitle={
          activeOrder
            ? activeOrder.status === "on_the_way"
              ? "Food in transit to recipient"
              : "Proceed to canteen for pickup"
            : "No delivery in progress"
        }
        rightAction={isSharingLocation ? <LocationSharingPill /> : undefined}
      />

      {/* Background Location Required Banner */}
      <DeliveryLocationPermissionBanner />

      {/* Main Container */}
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={palette.honeyBronze} />
          <Text variant="body" muted style={{ marginTop: 12 }}>
            Loading active delivery...
          </Text>
        </View>
      ) : activeOrder ? (
        <View style={styles.content}>
          {/* Top Map Section (top ~52%) */}
          <View style={styles.mapContainer}>
            <Map
              mapStyle={mapStyleUrl}
              style={StyleSheet.absoluteFill}
              attribution={true}
              attributionPosition={{ bottom: 8, left: 8 }}
            >
              <Camera
                ref={cameraRef}
                initialViewState={{
                  center: [driverCoords[0], driverCoords[1]],
                  zoom: 13.5,
                }}
              />

              {/* Driver Location Puck */}
              <UserLocation animated={true} />

              {/* Canteen Pin */}
              {activeOrder.canteen && (
                <Marker
                  id="canteen-marker"
                  lngLat={[
                    activeOrder.canteen.location_lng,
                    activeOrder.canteen.location_lat,
                  ]}
                >
                  <View style={styles.pinWrapper}>
                    <View
                      style={[
                        styles.pinHead,
                        {
                          backgroundColor:
                            activeOrder.status === "driver_assigned"
                              ? palette.honeyBronze
                              : palette.ironGrey,
                          borderColor: palette.gunmetal,
                        },
                      ]}
                    >
                      <Utensils size={14} color={palette.gunmetal} />
                    </View>
                    <View
                      style={[
                        styles.pinTail,
                        {
                          borderTopColor:
                            activeOrder.status === "driver_assigned"
                              ? palette.honeyBronze
                              : palette.ironGrey,
                        },
                      ]}
                    />
                  </View>
                </Marker>
              )}

              {/* Drop-off Pin */}
              <Marker
                id="dropoff-marker"
                lngLat={[activeOrder.dropoff_lng, activeOrder.dropoff_lat]}
              >
                <View style={styles.pinWrapper}>
                  <View
                    style={[
                      styles.pinHead,
                      {
                        backgroundColor:
                          activeOrder.status === "on_the_way"
                            ? palette.blushedBrick
                            : palette.ironGrey,
                        borderColor: palette.gunmetal,
                      },
                    ]}
                  >
                    <MapPin size={14} color={palette.almondSilk} />
                  </View>
                  <View
                    style={[
                      styles.pinTail,
                      {
                        borderTopColor:
                          activeOrder.status === "on_the_way"
                            ? palette.blushedBrick
                            : palette.ironGrey,
                      },
                    ]}
                  />
                </View>
              </Marker>

              {/* Driving Route from ORS */}
              {routeResult?.geometry ? (
                <GeoJSONSource
                  id="ors-route-source"
                  data={routeResult.geometry as any}
                >
                  <Layer
                    id="ors-route-line"
                    type="line"
                    style={{
                      lineColor: palette.honeyBronze,
                      lineWidth: 5,
                      lineCap: "round",
                      lineJoin: "round",
                    }}
                  />
                </GeoJSONSource>
              ) : (
                /* Dashed Straight Line Fallback */
                fallbackLineGeoJson && (
                  <GeoJSONSource
                    id="fallback-line-source"
                    data={fallbackLineGeoJson as any}
                  >
                    <Layer
                      id="fallback-dashed-line"
                      type="line"
                      style={{
                        lineColor: palette.ironGrey,
                        lineWidth: 3,
                        lineDasharray: [2, 2],
                      }}
                    />
                  </GeoJSONSource>
                )
              )}
            </Map>

            {/* Floating Map Re-center & Route Refresh */}
            <View style={styles.mapFloatCol}>
              <PressButton
                variant="outline"
                size="sm"
                onPress={() => {
                  try {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(
                      () => {}
                    )
                  } catch {}
                  cameraRef.current?.easeTo({
                    center: [driverCoords[0], driverCoords[1]],
                    zoom: 14,
                    duration: 600,
                  })
                }}
                leftIcon={<Compass size={16} color={theme.colors.ink} />}
                accessibilityLabel="Center on your position"
                style={styles.floatBtn}
              >
                Me
              </PressButton>

              <PressButton
                variant="outline"
                size="sm"
                onPress={() => void updateRoute()}
                loading={isRouting}
                leftIcon={<RotateCcw size={14} color={theme.colors.ink} />}
                accessibilityLabel="Refresh route directions"
                style={styles.floatBtn}
              >
                Route
              </PressButton>
            </View>
          </View>

          {/* Bottom Control & Order Summary Panel */}
          <ScrollView
            style={styles.bottomScroll}
            contentContainerStyle={styles.bottomContent}
            showsVerticalScrollIndicator={false}
          >
            {/* Stage Badge & ETA Row */}
            <View style={styles.stageRow}>
              <Badge
                status={
                  activeOrder.status === "on_the_way"
                    ? "on_the_way"
                    : "driver_assigned"
                }
              />
              <View style={styles.etaPill}>
                <Clock size={14} color={palette.honeyBronze} />
                <Text
                  variant="caption"
                  style={{
                    color: palette.honeyBronze,
                    fontFamily: theme.fonts.displayBold,
                  }}
                >
                  ETA {etaInfo.etaText} ({etaInfo.distText})
                </Text>
              </View>
            </View>

            {/* TicketCard Summary */}
            <TicketCard
              title={activeOrder.listing?.title ?? "Food surplus package"}
              portions={activeOrder.listing?.quantity ?? 0}
              status="claimed"
              meta={activeOrder.canteen?.org_name ?? "Partner campus canteen"}
              expiryText={activeOrder.notes || activeOrder.listing?.description || undefined}
            />

            {/* Addresses Card */}
            <Card style={styles.addressesCard}>
              {/* Pickup Address */}
              <View style={styles.addressBlock}>
                <View
                  style={[
                    styles.addressIconWrapper,
                    {
                      backgroundColor:
                        activeOrder.status === "driver_assigned"
                          ? "rgba(244, 184, 96, 0.2)"
                          : theme.colors.surfaceSunken,
                    },
                  ]}
                >
                  <Utensils
                    size={16}
                    color={
                      activeOrder.status === "driver_assigned"
                        ? palette.honeyBronze
                        : theme.colors.inkMuted
                    }
                  />
                </View>
                <View style={styles.addressTextCol}>
                  <Text variant="caption" muted>
                    Pickup at canteen
                  </Text>
                  <Text variant="body" weight="semibold">
                    {activeOrder.canteen?.org_name ?? "Campus Canteen"}
                  </Text>
                  <Text variant="small" muted style={{ marginTop: 2 }}>
                    {activeOrder.canteen?.address ?? "Address pending"}
                  </Text>
                  {activeOrder.canteen?.pickup_instructions ? (
                    <Text
                      variant="caption"
                      style={{ color: palette.honeyBronze, marginTop: 4 }}
                    >
                      Note: {activeOrder.canteen.pickup_instructions}
                    </Text>
                  ) : null}
                </View>
              </View>

              <View
                style={[
                  styles.addressDivider,
                  { backgroundColor: theme.colors.border },
                ]}
              />

              {/* Drop-off Address */}
              <View style={styles.addressBlock}>
                <View
                  style={[
                    styles.addressIconWrapper,
                    {
                      backgroundColor:
                        activeOrder.status === "on_the_way"
                          ? "rgba(200, 62, 77, 0.15)"
                          : theme.colors.surfaceSunken,
                    },
                  ]}
                >
                  <MapPin
                    size={16}
                    color={
                      activeOrder.status === "on_the_way"
                        ? palette.blushedBrick
                        : theme.colors.inkMuted
                    }
                  />
                </View>
                <View style={styles.addressTextCol}>
                  <Text variant="caption" muted>
                    Drop-off address
                  </Text>
                  <Text variant="body" weight="semibold">
                    {activeOrder.dropoff_address}
                  </Text>
                  {activeOrder.notes ? (
                    <Text variant="caption" muted style={{ marginTop: 4 }}>
                      Delivery instructions: {activeOrder.notes}
                    </Text>
                  ) : null}
                </View>
              </View>
            </Card>

            {/* Action Buttons */}
            <View style={styles.actionCol}>
              {/* Primary Stage Transition Button */}
              {activeOrder.status === "driver_assigned" ? (
                <PressButton
                  variant="default"
                  size="lg"
                  onPress={() => handleOpenProofModal("picked_up")}
                  leftIcon={<Bike size={20} color={palette.almondSilk} />}
                  accessibilityLabel="Confirm food picked up at canteen"
                >
                  Picked up
                </PressButton>
              ) : (
                <PressButton
                  variant="default"
                  size="lg"
                  onPress={() => handleOpenProofModal("delivered")}
                  leftIcon={<CheckCircle2 size={20} color={palette.almondSilk} />}
                  accessibilityLabel="Confirm delivery complete to recipient"
                >
                  Delivered
                </PressButton>
              )}

              {/* Turn-by-Turn Navigation */}
              <PressButton
                variant="accent"
                size="md"
                onPress={handleNavigate}
                leftIcon={<Navigation size={18} color={palette.gunmetal} />}
                accessibilityLabel="Open turn-by-turn navigation map"
              >
                Navigate
              </PressButton>

              {/* Communication Row: Call & Message */}
              <View style={styles.commRow}>
                <PressButton
                  variant="outline"
                  size="sm"
                  onPress={handleCallCanteen}
                  leftIcon={<Phone size={16} color={theme.colors.ink} />}
                  style={{ flex: 1 }}
                  accessibilityLabel="Call canteen contact"
                >
                  Call canteen
                </PressButton>

                <PressButton
                  variant="outline"
                  size="sm"
                  onPress={() => {
                    Alert.alert(
                      "Chat coming soon",
                      "Direct order chat with canteen and recipient will be available in Phase 3.5b."
                    )
                  }}
                  leftIcon={<MessageSquare size={16} color={theme.colors.ink} />}
                  style={{ flex: 1 }}
                  accessibilityLabel="Message canteen"
                >
                  Message
                </PressButton>
              </View>

              {/* Release Button (driver_assigned only) */}
              {activeOrder.status === "driver_assigned" && (
                <PressButton
                  variant="ghost"
                  size="sm"
                  onPress={handleReleaseOrder}
                  style={styles.releaseBtn}
                  accessibilityLabel="Release delivery back to pool"
                >
                  Release delivery
                </PressButton>
              )}
            </View>
          </ScrollView>
        </View>
      ) : (
        /* Empty State: No Active Delivery */
        <View style={styles.emptyWrap}>
          <EmptyState
            icon={<Navigation size={32} color={palette.honeyBronze} />}
            title="No active delivery"
            description="You don't currently have an assigned pickup. Check the pickups map to claim available surplus food."
            action={
              <PressButton
                variant="default"
                size="md"
                onPress={() => router.navigate("/(driver)")}
                leftIcon={<Compass size={18} color={palette.almondSilk} />}
              >
                Find pickups
              </PressButton>
            }
          />
        </View>
      )}

      {/* Proof Photo Modal */}
      <Modal
        visible={proofModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setProofModalVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View
            style={[
              styles.modalCard,
              {
                backgroundColor: theme.colors.surface,
                borderColor: theme.colors.border,
              },
            ]}
          >
            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <View style={{ flex: 1 }}>
                <Text variant="h3">
                  {proofTargetStatus === "picked_up"
                    ? "Confirm food pickup"
                    : "Confirm delivery"}
                </Text>
                <Text variant="small" muted style={{ marginTop: 2 }}>
                  Add a photo (optional)
                </Text>
              </View>
              <Pressable
                onPress={() => setProofModalVisible(false)}
                hitSlop={12}
                accessibilityRole="button"
                accessibilityLabel="Close confirmation dialog"
              >
                <X size={20} color={theme.colors.inkMuted} />
              </Pressable>
            </View>

            {/* Photo Preview or Capture Button */}
            {capturedPhotoUri ? (
              <View style={styles.previewBox}>
                <Image
                  source={{ uri: capturedPhotoUri }}
                  style={styles.previewImg}
                  resizeMode="cover"
                />
                <PressButton
                  variant="outline"
                  size="sm"
                  onPress={handleTakePhoto}
                  leftIcon={<RotateCcw size={14} color={theme.colors.ink} />}
                  style={styles.retakeBtn}
                >
                  Retake photo
                </PressButton>
              </View>
            ) : (
              <Pressable
                onPress={handleTakePhoto}
                style={[
                  styles.cameraPromptBox,
                  {
                    backgroundColor: theme.colors.surfaceSunken,
                    borderColor: theme.colors.border,
                  },
                ]}
                accessibilityRole="button"
                accessibilityLabel="Take photo with camera"
              >
                <View
                  style={[
                    styles.cameraCircle,
                    { backgroundColor: "rgba(244, 184, 96, 0.2)" },
                  ]}
                >
                  <CameraIcon size={28} color={palette.honeyBronze} />
                </View>
                <Text variant="body" weight="semibold" style={{ marginTop: 8 }}>
                  Take photo with camera
                </Text>
                <Text variant="caption" muted style={{ marginTop: 2 }}>
                  Clear view of food portions or delivery handoff
                </Text>
              </Pressable>
            )}

            {/* Action Buttons */}
            <View style={styles.modalActionCol}>
              <PressButton
                variant="default"
                size="md"
                onPress={() => void handleSubmitProof(false)}
                loading={isSubmittingProof}
                accessibilityLabel="Confirm and upload proof photo"
              >
                {capturedPhotoUri ? "Confirm with photo" : "Confirm"}
              </PressButton>

              <PressButton
                variant="ghost"
                size="md"
                onPress={() => void handleSubmitProof(true)}
                disabled={isSubmittingProof}
                accessibilityLabel="Skip photo and confirm status"
              >
                Skip photo
              </PressButton>
            </View>
          </View>
        </View>
      </Modal>

      {/* Delivered Success Full-Screen Overlay */}
      {isDeliveredSuccess && (
        <View style={styles.successOverlay}>
          <Animated.View
            style={[
              styles.successCard,
              { backgroundColor: theme.colors.surface },
              successAnimatedStyle,
            ]}
          >
            <View style={styles.successIconBadge}>
              <CheckCircle2 size={54} color={palette.honeyBronze} />
            </View>
            <Text variant="h1" style={styles.successTitle}>
              Delivery complete!
            </Text>
            <Text variant="body" muted style={styles.successSubtitle}>
              Food portions delivered with care. Returning to pickups...
            </Text>
          </Animated.View>
        </View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  content: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  emptyWrap: {
    flex: 1,
    padding: 24,
    justifyContent: "center",
  },
  mapContainer: {
    height: "50%",
    position: "relative",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(0, 0, 0, 0.1)",
  },
  pinWrapper: {
    alignItems: "center",
    justifyContent: "center",
  },
  pinHead: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3,
    elevation: 4,
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
  mapFloatCol: {
    position: "absolute",
    right: 14,
    bottom: 14,
    gap: 8,
  },
  floatBtn: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 3,
  },
  bottomScroll: {
    flex: 1,
  },
  bottomContent: {
    padding: 16,
    gap: 14,
    paddingBottom: 32,
  },
  stageRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  etaPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
    backgroundColor: "rgba(244, 184, 96, 0.16)",
    borderWidth: 1,
    borderColor: "rgba(244, 184, 96, 0.4)",
  },
  addressesCard: {
    padding: 16,
    gap: 12,
  },
  addressBlock: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  addressIconWrapper: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
  },
  addressTextCol: {
    flex: 1,
  },
  addressDivider: {
    height: 1,
    width: "100%",
  },
  actionCol: {
    gap: 10,
    marginTop: 4,
  },
  commRow: {
    flexDirection: "row",
    gap: 10,
  },
  releaseBtn: {
    alignSelf: "center",
    marginTop: 4,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.65)",
    justifyContent: "flex-end",
  },
  modalCard: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 1,
    padding: 24,
    gap: 18,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 10,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
  },
  cameraPromptBox: {
    height: 150,
    borderRadius: 16,
    borderWidth: 1,
    borderStyle: "dashed",
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
  },
  cameraCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
  },
  previewBox: {
    alignItems: "center",
    gap: 12,
  },
  previewImg: {
    width: "100%",
    height: 190,
    borderRadius: 14,
  },
  retakeBtn: {
    alignSelf: "center",
  },
  modalActionCol: {
    gap: 8,
    marginTop: 6,
  },
  successOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0, 0, 0, 0.75)",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    zIndex: 99,
  },
  successCard: {
    width: "100%",
    maxWidth: 320,
    borderRadius: 22,
    padding: 28,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 12,
  },
  successIconBadge: {
    marginBottom: 16,
  },
  successTitle: {
    textAlign: "center",
    marginBottom: 8,
  },
  successSubtitle: {
    textAlign: "center",
    lineHeight: 20,
  },
})
