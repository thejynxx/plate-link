import React, { useEffect, useMemo, useRef, useState } from "react"
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native"
import { useLocalSearchParams, useRouter } from "expo-router"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { formatDistanceToNow } from "date-fns"
import * as Haptics from "expo-haptics"
import * as Location from "expo-location"
import {
  Camera,
  Map,
  Marker,
  UserLocation,
  type CameraRef,
} from "@maplibre/maplibre-react-native"
import {
  AlertTriangle,
  ArrowLeft,
  Clock,
  Crosshair,
  Info,
  MapPin,
  MessageSquare,
  Utensils,
  X,
} from "lucide-react-native"
import {
  claimListing,
  DEFAULT_CENTER,
  fetchListing,
  formatDistance,
  haversineMeters,
  MAP_STYLE_DARK,
  MAP_STYLE_LIGHT,
  openListingChat,
  palette,
  recipientKeys,
  reverseGeocode,
  searchPlaces,
  type LatLng,
  type ListingDetail,
  type PlaceResult,
} from "@platelink/shared"
import {
  Badge,
  Card,
  ChromeHeader,
  ErrorState,
  PressButton,
  Text,
  WellInput,
} from "@/components/ui"
import { supabase } from "@/lib/supabase"
import { useTheme } from "@/theme"

export default function ListingDetailScreen() {
  const router = useRouter()
  const { id } = useLocalSearchParams<{ id: string }>()
  const listingId = id as string

  const { theme, isDark } = useTheme()
  const queryClient = useQueryClient()
  const mapCameraRef = useRef<CameraRef>(null)
  const claimMapCameraRef = useRef<CameraRef>(null)

  // User current location for distance measurement
  const [userLocation, setUserLocation] = useState<LatLng | null>(null)

  // Claim Bottom Sheet state
  const [isClaimSheetVisible, setIsClaimSheetVisible] = useState(false)
  const [isClaiming, setIsClaiming] = useState(false)
  const [isOpeningChat, setIsOpeningChat] = useState(false)

  // Drop-off location state
  const [dropoffCoords, setDropoffCoords] = useState<LatLng>(DEFAULT_CENTER)
  const [dropoffAddress, setDropoffAddress] = useState<string>("")
  const [notes, setNotes] = useState<string>("")
  const [dropoffSearchQuery, setDropoffSearchQuery] = useState("")
  const [dropoffSearchResults, setDropoffSearchResults] = useState<PlaceResult[]>([])
  const [isSearchingDropoff, setIsSearchingDropoff] = useState(false)
  const [now, setNow] = useState(() => Date.now())

  // Keep 'now' ticking for live expiry check without impure renders
  useEffect(() => {
    const timer = setInterval(() => {
      setNow(Date.now())
    }, 15000)
    return () => clearInterval(timer)
  }, [])

  // 1. Fetch current GPS location
  useEffect(() => {
    let isMounted = true
    async function loadPos() {
      try {
        const { status } = await Location.getForegroundPermissionsAsync()
        if (status === "granted") {
          const pos = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Balanced,
          })
          if (isMounted) {
            const loc: LatLng = {
              lat: pos.coords.latitude,
              lng: pos.coords.longitude,
            }
            setUserLocation(loc)
            setDropoffCoords(loc)
            const addr = await reverseGeocode(loc).catch(() => null)
            if (addr && isMounted) {
              setDropoffAddress(addr)
            }
          }
        }
      } catch {}
    }
    void loadPos()
    return () => {
      isMounted = false
    }
  }, [])

  // 2. Fetch Listing details
  const {
    data: listing,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery<ListingDetail | null>({
    queryKey: recipientKeys.listing(listingId),
    queryFn: () => fetchListing(supabase, listingId),
    enabled: !!listingId,
  })

  // 3. Realtime listener on this listing (Rule 11)
  useEffect(() => {
    if (!listingId) return
    const channelName = `listing-detail-${listingId}-${Math.random().toString(36).substring(2, 8)}`
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
          queryClient.invalidateQueries({
            queryKey: recipientKeys.listing(listingId),
          })
          queryClient.invalidateQueries({
            queryKey: recipientKeys.all,
          })
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [listingId, queryClient])

  // 4. Drop-off place search via Photon
  useEffect(() => {
    const q = dropoffSearchQuery.trim()
    const timer = setTimeout(async () => {
      if (!q) {
        setDropoffSearchResults([])
        return
      }
      setIsSearchingDropoff(true)
      try {
        const results = await searchPlaces(
          q,
          dropoffCoords
        )
        setDropoffSearchResults(results)
      } catch (err) {
        console.warn("[claim-search] Error:", err)
      } finally {
        setIsSearchingDropoff(false)
      }
    }, 350)

    return () => clearTimeout(timer)
  }, [dropoffSearchQuery, dropoffCoords])

  // Select place from search
  const handleSelectDropoffPlace = (place: PlaceResult) => {
    try {
      Haptics.selectionAsync().catch(() => {})
    } catch {}
    const newCoords: LatLng = { lat: place.lat, lng: place.lng }
    setDropoffCoords(newCoords)
    setDropoffAddress(place.label)
    setDropoffSearchQuery("")
    setDropoffSearchResults([])
    claimMapCameraRef.current?.easeTo({
      center: [newCoords.lng, newCoords.lat],
      zoom: 14,
      duration: 500,
    })
  }

  // Use current location for drop-off
  const handleUseCurrentLocationDropoff = async () => {
    try {
      Haptics.selectionAsync().catch(() => {})
      const { status } = await Location.requestForegroundPermissionsAsync()
      if (status === "granted") {
        const pos = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        })
        const newCoords: LatLng = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        }
        setDropoffCoords(newCoords)
        claimMapCameraRef.current?.easeTo({
          center: [newCoords.lng, newCoords.lat],
          zoom: 14,
          duration: 500,
        })
        const addr = await reverseGeocode(newCoords).catch(() => null)
        if (addr) setDropoffAddress(addr)
      }
    } catch {}
  }

  // 5. Submit Claim
  const handleConfirmClaim = async () => {
    if (!listing) return
    if (!dropoffAddress.trim()) {
      Alert.alert(
        "Drop-off address required",
        "Please provide an address for volunteer drivers to deliver the food."
      )
      return
    }

    setIsClaiming(true)
    try {
      const order = await claimListing(supabase, {
        listingId: listing.id,
        dropoffAddress: dropoffAddress.trim(),
        dropoffLat: dropoffCoords.lat,
        dropoffLng: dropoffCoords.lng,
        notes: notes.trim() || undefined,
      })

      try {
        await Haptics.notificationAsync(
          Haptics.NotificationFeedbackType.Success
        )
      } catch {}

      setIsClaimSheetVisible(false)
      await queryClient.invalidateQueries({ queryKey: recipientKeys.all })
      router.replace(`/order/${order.id}` as any)
    } catch (err: any) {
      console.warn("[claim-error] Error:", err)
      if (err.code === "P0001" || err.message?.includes("no longer available")) {
        Alert.alert(
          "Already claimed",
          "Someone just claimed this food package."
        )
      } else if (
        err.code === "42501" ||
        err.message?.includes("Only recipients")
      ) {
        Alert.alert(
          "Permission denied",
          "Only NGO accounts can claim food packages."
        )
      } else {
        Alert.alert(
          "Unable to claim",
          err.message ?? "Could not complete claim at this time."
        )
      }
    } finally {
      setIsClaiming(false)
    }
  }

  // 6. Open Listing Question Chat
  const handleOpenChat = async () => {
    if (!listing) return
    setIsOpeningChat(true)
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {})
      const conversationId = await openListingChat(supabase, listing.id)
      router.push(`/chat/${conversationId}` as any)
    } catch (err: any) {
      Alert.alert(
        "Chat unavailable",
        err.message ?? "Could not open a conversation with the canteen."
      )
    } finally {
      setIsOpeningChat(false)
    }
  }

  // Check availability
  const isAvailable = useMemo(() => {
    if (!listing) return false
    return (
      listing.status === "available" &&
      new Date(listing.expires_at).getTime() > now
    )
  }, [listing, now])

  // Distance from user to canteen
  const distanceText = useMemo(() => {
    if (!userLocation || !listing) return null
    const distM = haversineMeters(userLocation, {
      lat: listing.location_lat,
      lng: listing.location_lng,
    })
    return formatDistance(distM)
  }, [userLocation, listing])

  const mapStyleUrl = isDark ? MAP_STYLE_DARK : MAP_STYLE_LIGHT

  if (isLoading) {
    return (
      <View style={[styles.root, { backgroundColor: theme.colors.canvas }]}>
        <ChromeHeader
          title="Loading food..."
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
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={palette.honeyBronze} />
          <Text variant="caption" muted style={{ marginTop: 12 }}>
            Retrieving package details...
          </Text>
        </View>
      </View>
    )
  }

  if (isError || !listing) {
    return (
      <View style={[styles.root, { backgroundColor: theme.colors.canvas }]}>
        <ChromeHeader
          title="Listing"
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
        <View style={styles.centered}>
          <ErrorState
            error={error ?? new Error("Food listing not found.")}
            onRetry={() => {
              void refetch()
            }}
          />
        </View>
      </View>
    )
  }

  const expiresAgoText = formatDistanceToNow(new Date(listing.expires_at), {
    addSuffix: true,
  })

  return (
    <View style={[styles.root, { backgroundColor: theme.colors.canvas }]}>
      {/* Structural Header with Back Button */}
      <ChromeHeader
        title={listing.title}
        subtitle={listing.canteens?.org_name ?? "Campus canteen"}
        leftAction={
          <PressButton
            variant="ghost"
            size="sm"
            onPress={() => router.back()}
            leftIcon={<ArrowLeft size={20} color={theme.colors.chromeInk} />}
            accessibilityLabel="Back to food search"
          >
            Back
          </PressButton>
        }
      />

      {/* Unavailable Honey Banner (Rule 10) */}
      {!isAvailable && (
        <View
          style={[
            styles.unavailableBanner,
            { backgroundColor: "rgba(244, 184, 96, 0.2)" },
          ]}
        >
          <AlertTriangle size={18} color={palette.honeyBronze} />
          <Text
            variant="small"
            weight="semibold"
            style={{ color: palette.honeyBronze, flex: 1, marginLeft: 8 }}
          >
            This food package has been claimed or is no longer available.
          </Text>
        </View>
      )}

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Photo or Icon Banner */}
        {listing.photo_url ? (
          <View style={styles.photoWrapper}>
            <Image
              source={{ uri: listing.photo_url }}
              style={styles.foodPhoto}
              resizeMode="cover"
            />
          </View>
        ) : (
          <View
            style={[
              styles.photoFallback,
              { backgroundColor: theme.colors.surfaceSunken },
            ]}
          >
            <Utensils size={48} color={palette.honeyBronze} />
          </View>
        )}

        {/* Portions & Expiry Card */}
        <Card style={styles.card}>
          <View style={styles.portionsRow}>
            <View style={{ flex: 1 }}>
              <Text
                variant="display"
                style={[styles.bigPortionsText, { color: palette.honeyBronze }]}
              >
                {listing.quantity}
              </Text>
              <Text variant="small" muted>
                {listing.quantity === 1 ? "portion available" : "portions available"}
              </Text>
            </View>

            <View style={styles.badgesCol}>
              <Badge status={listing.status} />
              <View
                style={[
                  styles.foodTypePill,
                  { backgroundColor: theme.colors.surfaceSunken },
                ]}
              >
                <Text variant="caption" weight="semibold">
                  {listing.food_type.replace("_", " ")}
                </Text>
              </View>
            </View>
          </View>

          <View
            style={[styles.divider, { backgroundColor: theme.colors.border }]}
          />

          <View style={styles.metaRow}>
            <Clock size={16} color={palette.honeyBronze} />
            <Text variant="small" muted style={{ marginLeft: 8, flex: 1 }}>
              Expires {expiresAgoText}
            </Text>
            {distanceText && (
              <View style={styles.distPill}>
                <MapPin size={13} color={palette.blushedBrick} />
                <Text
                  variant="caption"
                  weight="semibold"
                  style={{ color: palette.blushedBrick, marginLeft: 3 }}
                >
                  {distanceText}
                </Text>
              </View>
            )}
          </View>

          {listing.description ? (
            <Text variant="body" style={styles.descriptionText}>
              {listing.description}
            </Text>
          ) : null}
        </Card>

        {/* Canteen & Pickup Instructions Card */}
        <Card style={styles.card}>
          <Text variant="h3" style={styles.sectionTitle}>
            Pickup location
          </Text>

          <View style={styles.canteenInfoRow}>
            <View
              style={[
                styles.canteenIconCircle,
                { backgroundColor: "rgba(244, 184, 96, 0.2)" },
              ]}
            >
              <Utensils size={18} color={palette.honeyBronze} />
            </View>
            <View style={{ flex: 1 }}>
              <Text variant="body" weight="semibold">
                {listing.canteens?.org_name ?? "Campus Canteen"}
              </Text>
              <Text variant="small" muted style={{ marginTop: 2 }}>
                {listing.canteens?.address ?? "Address pending"}
              </Text>
            </View>
          </View>

          {listing.canteens?.pickup_instructions ? (
            <View
              style={[
                styles.instructionsBox,
                {
                  backgroundColor: theme.colors.surfaceSunken,
                  borderColor: theme.colors.border,
                },
              ]}
            >
              <Info
                size={16}
                color={palette.honeyBronze}
                style={{ marginTop: 1 }}
              />
              <View style={{ flex: 1, marginLeft: 8 }}>
                <Text variant="caption" weight="bold">
                  Pickup notes
                </Text>
                <Text variant="small" style={{ marginTop: 2 }}>
                  {listing.canteens.pickup_instructions}
                </Text>
              </View>
            </View>
          ) : null}

          {/* Small Canteen Location Map */}
          <View style={styles.smallMapWrap}>
            <Map
              mapStyle={mapStyleUrl}
              style={StyleSheet.absoluteFill}
              attribution={true}
              attributionPosition={{ bottom: 4, left: 4 }}
            >
              <Camera
                ref={mapCameraRef}
                initialViewState={{
                  center: [listing.location_lng, listing.location_lat],
                  zoom: 14,
                }}
              />
              <UserLocation animated={true} />
              <Marker
                id="listing-pin"
                lngLat={[listing.location_lng, listing.location_lat]}
              >
                <View style={styles.pinWrapper}>
                  <View
                    style={[
                      styles.pinHead,
                      {
                        backgroundColor: palette.honeyBronze,
                        borderColor: palette.gunmetal,
                      },
                    ]}
                  >
                    <Utensils size={14} color={palette.gunmetal} />
                  </View>
                  <View
                    style={[
                      styles.pinTail,
                      { borderTopColor: palette.honeyBronze },
                    ]}
                  />
                </View>
              </Marker>
            </Map>
          </View>
        </Card>

        {/* Bottom Actions Bar */}
        <View style={styles.actionCol}>
          <PressButton
            variant="default"
            size="lg"
            fullWidth
            disabled={!isAvailable}
            onPress={() => {
              try {
                Haptics.selectionAsync().catch(() => {})
              } catch {}
              setIsClaimSheetVisible(true)
            }}
            accessibilityLabel="Claim this food package"
          >
            Claim this food
          </PressButton>

          <PressButton
            variant="outline"
            size="md"
            fullWidth
            loading={isOpeningChat}
            onPress={() => void handleOpenChat()}
            leftIcon={<MessageSquare size={18} color={theme.colors.ink} />}
            accessibilityLabel="Ask the canteen a question"
          >
            Ask the canteen
          </PressButton>
        </View>
      </ScrollView>

      {/* Claim Food Modal Sheet */}
      <Modal
        visible={isClaimSheetVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setIsClaimSheetVisible(false)}
      >
        <View style={styles.sheetBackdrop}>
          <View
            style={[
              styles.sheetCard,
              {
                backgroundColor: theme.colors.surface,
                borderColor: theme.colors.border,
              },
            ]}
          >
            <ScrollView
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              {/* Sheet Header */}
              <View style={styles.sheetHeader}>
                <View style={{ flex: 1 }}>
                  <Text variant="h3">Confirm food claim</Text>
                  <Text variant="caption" muted style={{ marginTop: 2 }}>
                    Where should volunteer drivers deliver the meals?
                  </Text>
                </View>
                <Pressable
                  onPress={() => setIsClaimSheetVisible(false)}
                  hitSlop={10}
                  accessibilityRole="button"
                  accessibilityLabel="Close claim sheet"
                >
                  <X size={20} color={theme.colors.inkMuted} />
                </Pressable>
              </View>

              {/* Quick action: use current location */}
              <PressButton
                variant="outline"
                size="sm"
                onPress={handleUseCurrentLocationDropoff}
                leftIcon={<Crosshair size={16} color={theme.colors.ink} />}
                style={{ marginBottom: 12 }}
                accessibilityLabel="Set drop-off to current location"
              >
                Use current location
              </PressButton>

              {/* Search Drop-off Address */}
              <Text variant="caption" weight="medium" style={styles.inputLabel}>
                Drop-off address
              </Text>
              <WellInput
                value={dropoffSearchQuery || dropoffAddress}
                onChangeText={(text) => {
                  setDropoffSearchQuery(text)
                  setDropoffAddress(text)
                }}
                placeholder="Search drop-off address or shelter name..."
                accessibilityLabel="Drop-off address"
              />

              {isSearchingDropoff && (
                <View style={{ paddingVertical: 6, alignItems: "center" }}>
                  <ActivityIndicator size="small" color={palette.honeyBronze} />
                </View>
              )}

              {/* Drop-off search results list */}
              {dropoffSearchResults.length > 0 && (
                <View
                  style={[
                    styles.searchResultsList,
                    {
                      backgroundColor: theme.colors.surfaceSunken,
                      borderColor: theme.colors.border,
                    },
                  ]}
                >
                  {dropoffSearchResults.map((place) => (
                    <Pressable
                      key={place.id}
                      onPress={() => handleSelectDropoffPlace(place)}
                      style={[
                        styles.searchResultItem,
                        { borderBottomColor: theme.colors.border },
                      ]}
                    >
                      <MapPin
                        size={16}
                        color={palette.blushedBrick}
                        style={{ marginRight: 8 }}
                      />
                      <Text variant="small" numberOfLines={1} style={{ flex: 1 }}>
                        {place.label}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              )}

              {/* Mini Drop-off Coordinate Map */}
              <Text
                variant="caption"
                weight="medium"
                style={[styles.inputLabel, { marginTop: 12 }]}
              >
                Pinpoint delivery location
              </Text>
              <View style={styles.claimMiniMap}>
                <Map
                  mapStyle={mapStyleUrl}
                  style={StyleSheet.absoluteFill}
                  attribution={true}
                  attributionPosition={{ bottom: 4, left: 4 }}
                  onPress={async (e: any) => {
                    const coords = e?.geometry?.coordinates as [number, number] | undefined
                    if (coords && coords.length === 2) {
                      const newPt: LatLng = { lat: coords[1], lng: coords[0] }
                      setDropoffCoords(newPt)
                      const addr = await reverseGeocode(newPt).catch(() => null)
                      if (addr) setDropoffAddress(addr)
                    }
                  }}
                >
                  <Camera
                    ref={claimMapCameraRef}
                    initialViewState={{
                      center: [dropoffCoords.lng, dropoffCoords.lat],
                      zoom: 14,
                    }}
                  />
                  <Marker
                    id="dropoff-pin"
                    lngLat={[dropoffCoords.lng, dropoffCoords.lat]}
                  >
                    <View style={styles.pinWrapper}>
                      <View
                        style={[
                          styles.pinHead,
                          {
                            backgroundColor: palette.blushedBrick,
                            borderColor: palette.gunmetal,
                          },
                        ]}
                      >
                        <MapPin size={14} color="#FFFFFF" />
                      </View>
                      <View
                        style={[
                          styles.pinTail,
                          { borderTopColor: palette.blushedBrick },
                        ]}
                      />
                    </View>
                  </Marker>
                </Map>
              </View>
              <Text variant="caption" muted style={{ marginTop: 4 }}>
                Tap the map to adjust the exact delivery gate.
              </Text>

              {/* Delivery Notes */}
              <Text
                variant="caption"
                weight="medium"
                style={[styles.inputLabel, { marginTop: 14 }]}
              >
                Delivery instructions (optional)
              </Text>
              <WellInput
                value={notes}
                onChangeText={setNotes}
                placeholder="e.g. Ring reception bell at back entrance"
                maxLength={500}
                multiline
                style={{ minHeight: 60 }}
                accessibilityLabel="Delivery instructions"
              />

              {/* Confirm Claim Button */}
              <PressButton
                variant="default"
                size="lg"
                fullWidth
                loading={isClaiming}
                onPress={() => void handleConfirmClaim()}
                style={{ marginTop: 16 }}
                accessibilityLabel="Confirm food claim"
              >
                Confirm claim
              </PressButton>
            </ScrollView>
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
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  scrollContent: {
    padding: 16,
    gap: 14,
    paddingBottom: 32,
  },
  unavailableBanner: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  photoWrapper: {
    width: "100%",
    height: 200,
    borderRadius: 16,
    overflow: "hidden",
  },
  foodPhoto: {
    width: "100%",
    height: "100%",
  },
  photoFallback: {
    width: "100%",
    height: 140,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  card: {
    padding: 16,
    borderRadius: 16,
  },
  portionsRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
  },
  bigPortionsText: {
    fontSize: 36,
    lineHeight: 40,
  },
  badgesCol: {
    alignItems: "flex-end",
    gap: 6,
  },
  foodTypePill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  divider: {
    height: 1,
    marginVertical: 12,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  distPill: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    backgroundColor: "rgba(200, 62, 77, 0.12)",
  },
  descriptionText: {
    marginTop: 12,
    lineHeight: 20,
  },
  sectionTitle: {
    marginBottom: 12,
  },
  canteenInfoRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  canteenIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  instructionsBox: {
    flexDirection: "row",
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    marginTop: 12,
  },
  smallMapWrap: {
    height: 160,
    borderRadius: 12,
    overflow: "hidden",
    marginTop: 14,
  },
  pinWrapper: {
    alignItems: "center",
  },
  pinHead: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 3,
  },
  pinTail: {
    width: 0,
    height: 0,
    backgroundColor: "transparent",
    borderStyle: "solid",
    borderLeftWidth: 4,
    borderRightWidth: 4,
    borderTopWidth: 5,
    borderLeftColor: "transparent",
    borderRightColor: "transparent",
    marginTop: -1,
  },
  actionCol: {
    gap: 10,
    marginTop: 6,
  },
  sheetBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  sheetCard: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 1,
    padding: 20,
    maxHeight: "88%",
  },
  sheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 14,
  },
  inputLabel: {
    marginBottom: 6,
  },
  searchResultsList: {
    borderRadius: 10,
    borderWidth: 1,
    marginTop: 6,
    maxHeight: 140,
    overflow: "hidden",
  },
  searchResultItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 10,
    borderBottomWidth: 1,
  },
  claimMiniMap: {
    height: 140,
    borderRadius: 10,
    overflow: "hidden",
    marginTop: 2,
  },
})
