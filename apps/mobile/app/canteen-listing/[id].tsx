import React, { useEffect, useRef, useState } from "react"
import {
  Alert,
  Image,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native"
import { useLocalSearchParams, useRouter } from "expo-router"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { format, formatDistanceToNow } from "date-fns"
import * as Haptics from "expo-haptics"
import {
  Camera,
  Map,
  Marker,
  type CameraRef,
} from "@maplibre/maplibre-react-native"
import {
  ArrowLeft,
  Ban,
  Bike,
  Building2,
  Clock,
  Edit3,
  MapPin,
  MessageSquare,
  Navigation,
  Phone,
  Utensils,
  X,
} from "lucide-react-native"
import {
  canteenKeys,
  fetchCanteenListingDetail,
  FOOD_TYPE_LABEL,
  MAP_STYLE_DARK,
  MAP_STYLE_LIGHT,
  openOrderChat,
  ORDER_STATUS_LABEL,
  palette,
  type CanteenListingDetail,
  type DriverLocation,
} from "@platelink/shared"
import {
  Badge,
  Card,
  ChromeHeader,
  ErrorState,
  PressButton,
  Skeleton,
  Text,
  WellInput,
} from "@/components/ui"
import { supabase } from "@/lib/supabase"
import { useTheme } from "@/theme"

export default function CanteenListingDetailScreen() {
  const router = useRouter()
  const { id } = useLocalSearchParams<{ id: string }>()
  const { theme, isDark } = useTheme()
  const queryClient = useQueryClient()
  const listingId = id as string

  const mapCameraRef = useRef<CameraRef | null>(null)
  const [driverLoc, setDriverLoc] = useState<DriverLocation | null>(null)
  const [isOpeningChat, setIsOpeningChat] = useState(false)

  // Edit Modal State
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [editTitle, setEditTitle] = useState("")
  const [editQuantity, setEditQuantity] = useState(25)
  const [editDescription, setEditDescription] = useState("")
  const [isSavingEdit, setIsSavingEdit] = useState(false)

  const mapStyleUrl = isDark ? MAP_STYLE_DARK : MAP_STYLE_LIGHT

  // 1. Fetch listing details
  const {
    data: detail,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery<CanteenListingDetail>({
    queryKey: canteenKeys.listing(listingId),
    queryFn: () => fetchCanteenListingDetail(supabase, listingId),
    enabled: !!listingId,
  })

  const handleOpenEditModal = () => {
    if (!detail?.listing) return
    setEditTitle(detail.listing.title)
    setEditQuantity(detail.listing.quantity)
    setEditDescription(detail.listing.description ?? "")
    setIsEditModalOpen(true)
  }

  // 2. Realtime listener for listing and order changes (Rule 11)
  useEffect(() => {
    if (!listingId) return

    const channelName = `canteen-detail-${listingId}-${Math.random().toString(36).substring(2, 8)}`
    const channel = supabase
      .channel(channelName)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "food_listings",
          filter: `id=eq.${listingId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: canteenKeys.listing(listingId) })
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "orders",
          filter: `listing_id=eq.${listingId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: canteenKeys.listing(listingId) })
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [listingId, queryClient])

  // 3. Live driver GPS telemetry listener when driver assigned
  const driverId = detail?.order?.driver_id
  const orderStatus = detail?.order?.status
  const isDriverActive =
    driverId && (orderStatus === "driver_assigned" || orderStatus === "on_the_way")

  useEffect(() => {
    if (!isDriverActive || !driverId) return

    // Fetch initial driver location
    supabase
      .from("driver_locations")
      .select("current_lat, current_lng, heading, last_updated")
      .eq("driver_id", driverId)
      .maybeSingle()
      .then(({ data }) => {
        if (data) setDriverLoc(data as DriverLocation)
      })

    const locChannelName = `canteen-driver-loc-${driverId}-${Math.random().toString(36).substring(2, 8)}`
    const channel = supabase
      .channel(locChannelName)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "driver_locations",
          filter: `driver_id=eq.${driverId}`,
        },
        (payload) => {
          if (payload.new) {
            setDriverLoc(payload.new as DriverLocation)
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [driverId, isDriverActive])

  // 4. Open chat with NGO / Driver (open_order_chat RPC)
  const handleOpenChat = async () => {
    if (!detail?.order?.id) return
    setIsOpeningChat(true)
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {})
      const conversationId = await openOrderChat(supabase, detail.order.id)
      router.push({
        pathname: "/chat/[id]",
        params: { id: conversationId },
      })
    } catch (err: any) {
      Alert.alert("Chat error", err?.message ?? "Unable to open order chat.")
    } finally {
      setIsOpeningChat(false)
    }
  }

  // 5. Cancel listing (allowed by RLS while available)
  const handleCancelListing = () => {
    Alert.alert(
      "Cancel listing",
      "Are you sure you want to cancel this food listing? It will be removed from nearby recipient feeds.",
      [
        { text: "Keep listing", style: "cancel" },
        {
          text: "Cancel listing",
          style: "destructive",
          onPress: async () => {
            try {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {})
              const { error: cancelErr } = await supabase
                .from("food_listings")
                .update({ status: "cancelled" })
                .eq("id", listingId)

              if (cancelErr) throw cancelErr

              queryClient.invalidateQueries({ queryKey: canteenKeys.listing(listingId) })
              queryClient.invalidateQueries({ queryKey: canteenKeys.all })
              Alert.alert("Listing cancelled", "The listing has been cancelled.")
            } catch (err: any) {
              Alert.alert("Error cancelling", err?.message ?? "Failed to cancel listing.")
            }
          },
        },
      ]
    )
  }

  // 6. Save Edit
  const handleSaveEdit = async () => {
    if (!editTitle.trim() || editQuantity < 1) {
      Alert.alert("Invalid input", "Please provide a title and at least 1 portion.")
      return
    }

    setIsSavingEdit(true)
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {})
      const { error: editErr } = await supabase
        .from("food_listings")
        .update({
          title: editTitle.trim(),
          quantity: editQuantity,
          description: editDescription.trim() || null,
        })
        .eq("id", listingId)

      if (editErr) throw editErr

      await queryClient.invalidateQueries({ queryKey: canteenKeys.listing(listingId) })
      setIsEditModalOpen(false)
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {})
    } catch (err: any) {
      Alert.alert("Update error", err?.message ?? "Failed to update listing.")
    } finally {
      setIsSavingEdit(false)
    }
  }

  if (isLoading) {
    return (
      <View style={[styles.root, { backgroundColor: theme.colors.canvas }]}>
        <ChromeHeader
          title="Listing details"
          subtitle="Loading ticket information..."
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
        <View style={{ padding: 16, gap: 14 }}>
          <Skeleton style={{ height: 160, borderRadius: 16 }} />
          <Skeleton style={{ height: 120, borderRadius: 16 }} />
          <Skeleton style={{ height: 100, borderRadius: 16 }} />
        </View>
      </View>
    )
  }

  if (isError || !detail?.listing) {
    return (
      <View style={[styles.root, { backgroundColor: theme.colors.canvas }]}>
        <ChromeHeader
          title="Listing not found"
          leftAction={
            <PressButton
              variant="ghost"
              size="sm"
              onPress={() => router.back()}
              leftIcon={<ArrowLeft size={20} color={theme.colors.chromeInk} />}
            >
              Back
            </PressButton>
          }
        />
        <ErrorState
          error={error}
          onRetry={refetch}
          style={{ marginTop: 40 }}
        />
      </View>
    )
  }

  const { listing, order, events, recipient, driver } = detail
  const isAvailable = listing.status === "available"

  return (
    <View style={[styles.root, { backgroundColor: theme.colors.canvas }]}>
      <ChromeHeader
        title={listing.title}
        subtitle={`Ticket #${listing.id.slice(0, 8)}`}
        leftAction={
          <PressButton
            variant="ghost"
            size="sm"
            onPress={() => router.back()}
            leftIcon={<ArrowLeft size={20} color={theme.colors.chromeInk} />}
            accessibilityLabel="Back to canteen home"
          >
            Pass
          </PressButton>
        }
        rightAction={
          isAvailable ? (
            <View style={{ flexDirection: "row", gap: 6 }}>
              <PressButton
                variant="ghost"
                size="sm"
                onPress={handleOpenEditModal}
                leftIcon={<Edit3 size={16} color={theme.colors.chromeInk} />}
                accessibilityLabel="Edit listing"
              >
                Edit
              </PressButton>
              <PressButton
                variant="ghost"
                size="sm"
                onPress={handleCancelListing}
                leftIcon={<Ban size={16} color={palette.blushedBrick} />}
                accessibilityLabel="Cancel listing"
              >
                Cancel
              </PressButton>
            </View>
          ) : undefined
        }
      />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Ticket Header Card */}
        <Card style={styles.ticketCard}>
          {listing.photo_url ? (
            <View style={styles.photoWrap}>
              <Image source={{ uri: listing.photo_url }} style={styles.photo} />
            </View>
          ) : null}

          <View style={styles.statusRow}>
            <Badge status={listing.status} />
            <Badge variant="silk">{FOOD_TYPE_LABEL[listing.food_type]}</Badge>
          </View>

          <Text variant="h2" style={{ marginTop: 8 }}>
            {listing.title}
          </Text>

          {/* Quick Metrics */}
          <View style={styles.metricsRow}>
            <View style={styles.metricItem}>
              <Utensils size={18} color={palette.honeyBronze} />
              <View style={{ marginLeft: 8 }}>
                <Text variant="caption" muted>
                  Portions
                </Text>
                <Text variant="h3" style={{ color: theme.colors.accent }}>
                  {listing.quantity}
                </Text>
              </View>
            </View>

            <View style={styles.metricDivider} />

            <View style={styles.metricItem}>
              <Clock size={18} color={palette.blushedBrick} />
              <View style={{ marginLeft: 8 }}>
                <Text variant="caption" muted>
                  Expires
                </Text>
                <Text variant="small" weight="semibold">
                  {format(new Date(listing.expires_at), "h:mm a")}
                </Text>
              </View>
            </View>
          </View>

          {listing.description ? (
            <View
              style={[
                styles.descBox,
                {
                  backgroundColor: theme.colors.surfaceSunken,
                  borderColor: theme.colors.border,
                },
              ]}
            >
              <Text variant="small" muted>
                {listing.description}
              </Text>
            </View>
          ) : null}
        </Card>

        {/* Claim / Order Information */}
        {order && order.status !== "cancelled" ? (
          <Card style={styles.orderCard}>
            <View style={styles.orderCardHeader}>
              <View style={{ flex: 1 }}>
                <Text variant="h3">Order in progress</Text>
                <Text variant="caption" muted style={{ marginTop: 2 }}>
                  Claimed {formatDistanceToNow(new Date(order.created_at), { addSuffix: true })}
                </Text>
              </View>
              <Badge status={order.status} />
            </View>

            {/* Recipient NGO Details */}
            {recipient ? (
              <View style={styles.personRow}>
                <View
                  style={[
                    styles.iconCircle,
                    { backgroundColor: "rgba(244, 184, 96, 0.15)" },
                  ]}
                >
                  <Building2 size={18} color={palette.honeyBronze} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text variant="caption" muted>
                    Recipient organisation
                  </Text>
                  <Text variant="body" weight="semibold">
                    {recipient.name}
                  </Text>
                  {recipient.phone ? (
                    <Pressable
                      onPress={() => Linking.openURL(`tel:${recipient.phone}`)}
                      style={styles.phoneLink}
                    >
                      <Phone size={13} color={palette.honeyBronze} />
                      <Text variant="small" style={{ color: palette.honeyBronze }}>
                        {recipient.phone}
                      </Text>
                    </Pressable>
                  ) : null}
                </View>
              </View>
            ) : null}

            {/* Drop-off Address */}
            <View style={styles.dropoffRow}>
              <MapPin size={16} color={palette.blushedBrick} style={{ marginTop: 2 }} />
              <View style={{ flex: 1, marginLeft: 8 }}>
                <Text variant="caption" muted>
                  Delivery drop-off address
                </Text>
                <Text variant="small" weight="medium">
                  {order.dropoff_address}
                </Text>
              </View>
            </View>

            {/* Driver Card */}
            {driver ? (
              <View style={styles.personRow}>
                <View
                  style={[
                    styles.iconCircle,
                    { backgroundColor: "rgba(74, 88, 89, 0.2)" },
                  ]}
                >
                  <Bike size={18} color={theme.colors.ink} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text variant="caption" muted>
                    Assigned driver
                  </Text>
                  <Text variant="body" weight="semibold">
                    {driver.name}
                  </Text>
                  {driver.phone ? (
                    <Pressable
                      onPress={() => Linking.openURL(`tel:${driver.phone}`)}
                      style={styles.phoneLink}
                    >
                      <Phone size={13} color={palette.honeyBronze} />
                      <Text variant="small" style={{ color: palette.honeyBronze }}>
                        {driver.phone}
                      </Text>
                    </Pressable>
                  ) : null}
                </View>
              </View>
            ) : (
              <View
                style={[
                  styles.waitingDriverBox,
                  {
                    backgroundColor: theme.colors.surfaceSunken,
                    borderColor: theme.colors.border,
                  },
                ]}
              >
                <Clock size={16} color={palette.honeyBronze} />
                <Text variant="small" muted style={{ flex: 1, marginLeft: 8 }}>
                  Looking for an available volunteer driver nearby...
                </Text>
              </View>
            )}

            {/* Live Driver Map Telemetry */}
            {isDriverActive && driverLoc ? (
              <View style={{ marginTop: 8 }}>
                <View style={styles.mapLabelRow}>
                  <Navigation size={14} color={palette.blushedBrick} />
                  <Text variant="caption" weight="semibold" style={{ color: palette.blushedBrick }}>
                    Live driver location
                  </Text>
                </View>
                <View style={styles.smallMapWrap}>
                  <Map
                    mapStyle={mapStyleUrl}
                    style={StyleSheet.absoluteFill}
                    attribution={false}
                  >
                    <Camera
                      ref={mapCameraRef}
                      initialViewState={{
                        center: [driverLoc.current_lng, driverLoc.current_lat],
                        zoom: 14,
                      }}
                    />
                    <Marker
                      id="driver-live-pin"
                      lngLat={[driverLoc.current_lng, driverLoc.current_lat]}
                    >
                      <View style={styles.driverPinHead}>
                        <Bike size={14} color="#FFFFFF" />
                      </View>
                    </Marker>
                  </Map>
                </View>
              </View>
            ) : null}

            {/* Message Action Button */}
            <PressButton
              variant="outline"
              size="md"
              fullWidth
              loading={isOpeningChat}
              onPress={handleOpenChat}
              leftIcon={<MessageSquare size={16} color={theme.colors.ink} />}
              style={{ marginTop: 12 }}
            >
              Message order thread
            </PressButton>
          </Card>
        ) : null}

        {/* Status Timeline Card */}
        <Card style={styles.timelineCard}>
          <Text variant="h3" style={styles.timelineTitle}>
            Status timeline
          </Text>

          {events && events.length > 0 ? (
            <View style={styles.eventsList}>
              {events.map((ev, index) => (
                <View key={ev.id || index} style={styles.eventRow}>
                  <View style={styles.eventIndicator}>
                    <View
                      style={[
                        styles.eventDot,
                        {
                          backgroundColor:
                            index === events.length - 1
                              ? palette.honeyBronze
                              : palette.ironGrey,
                        },
                      ]}
                    />
                    {index < events.length - 1 ? (
                      <View
                        style={[
                          styles.eventLine,
                          { backgroundColor: theme.colors.border },
                        ]}
                      />
                    ) : null}
                  </View>

                  <View style={styles.eventTextWrap}>
                    <Text variant="small" weight="semibold">
                      {ORDER_STATUS_LABEL[ev.to_status] || ev.to_status}
                    </Text>
                    <Text variant="caption" muted>
                      {format(new Date(ev.created_at), "d MMM, h:mm a")}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          ) : (
            <Text variant="small" muted>
              Listed at {format(new Date(listing.created_at), "d MMM, h:mm a")}. Waiting for recipient claim.
            </Text>
          )}
        </Card>
      </ScrollView>

      {/* Edit Listing Modal Sheet */}
      <Modal
        visible={isEditModalOpen}
        animationType="slide"
        transparent
        onRequestClose={() => setIsEditModalOpen(false)}
      >
        <View style={styles.modalBackdrop}>
          <View
            style={[
              styles.modalSheet,
              {
                backgroundColor: theme.colors.surface,
                borderColor: theme.colors.border,
              },
            ]}
          >
            <View style={styles.modalHeader}>
              <Text variant="h3">Edit listing</Text>
              <Pressable
                onPress={() => setIsEditModalOpen(false)}
                hitSlop={10}
                accessibilityRole="button"
                accessibilityLabel="Close edit modal"
              >
                <X size={20} color={theme.colors.inkMuted} />
              </Pressable>
            </View>

            <View style={styles.fieldGroup}>
              <Text variant="caption" weight="semibold">
                Dish title
              </Text>
              <WellInput
                value={editTitle}
                onChangeText={setEditTitle}
                placeholder="Dish title..."
              />
            </View>

            <View style={styles.fieldGroup}>
              <Text variant="caption" weight="semibold">
                Available portions
              </Text>
              <WellInput
                value={String(editQuantity)}
                onChangeText={(v) => setEditQuantity(Number(v) || 0)}
                keyboardType="numeric"
              />
            </View>

            <View style={styles.fieldGroup}>
              <Text variant="caption" weight="semibold">
                Description / notes
              </Text>
              <WellInput
                value={editDescription}
                onChangeText={setEditDescription}
                placeholder="Notes..."
                multiline
                numberOfLines={3}
              />
            </View>

            <PressButton
              variant="default"
              size="lg"
              fullWidth
              loading={isSavingEdit}
              onPress={handleSaveEdit}
              style={{ marginTop: 12 }}
            >
              Save changes
            </PressButton>
          </View>
        </View>
      </Modal>
    </View>
  )
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
    gap: 16,
  },
  ticketCard: {
    padding: 16,
    overflow: "hidden",
  },
  photoWrap: {
    height: 180,
    borderRadius: 12,
    overflow: "hidden",
    marginBottom: 12,
  },
  photo: {
    width: "100%",
    height: "100%",
  },
  statusRow: {
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
  },
  metricsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    paddingVertical: 14,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
    marginTop: 14,
    marginBottom: 8,
  },
  metricItem: {
    flexDirection: "row",
    alignItems: "center",
  },
  metricDivider: {
    width: 1,
    height: 28,
    backgroundColor: "rgba(255, 255, 255, 0.1)",
  },
  descBox: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    marginTop: 8,
  },
  orderCard: {
    padding: 16,
    gap: 14,
  },
  orderCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  personRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  phoneLink: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 2,
  },
  dropoffRow: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  waitingDriverBox: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
  },
  mapLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 6,
  },
  smallMapWrap: {
    height: 150,
    borderRadius: 12,
    overflow: "hidden",
  },
  driverPinHead: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: palette.blushedBrick,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#FFFFFF",
  },
  timelineCard: {
    padding: 16,
  },
  timelineTitle: {
    marginBottom: 12,
  },
  eventsList: {
    gap: 4,
  },
  eventRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  eventIndicator: {
    alignItems: "center",
    width: 16,
  },
  eventDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginTop: 4,
  },
  eventLine: {
    width: 2,
    height: 32,
    marginTop: 2,
  },
  eventTextWrap: {
    paddingBottom: 12,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    justifyContent: "flex-end",
  },
  modalSheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderWidth: 1,
    padding: 20,
    gap: 14,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  fieldGroup: {
    gap: 6,
  },
})
