import React, { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  FlatList,
  Modal,
  Pressable,
  RefreshControl,
  StyleSheet,
  View,
} from "react-native"
import { useRouter } from "expo-router"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import AsyncStorage from "@react-native-async-storage/async-storage"
import * as Location from "expo-location"
import * as Haptics from "expo-haptics"
import {
  Camera,
  Map,
  Marker,
  UserLocation,
  type CameraRef,
} from "@maplibre/maplibre-react-native"
import {
  ChevronRight,
  Crosshair,
  MapPin,
  SlidersHorizontal,
  Utensils,
  X,
} from "lucide-react-native"
import {
  DEFAULT_CENTER,
  formatDistance,
  MAP_STYLE_DARK,
  MAP_STYLE_LIGHT,
  palette,
  recipientKeys,
  reverseGeocode,
  searchPlaces,
  fetchNearby,
  type LatLng,
  type NearbyListing,
  type PlaceResult,
} from "@platelink/shared"
import {
  Card,
  Chip,
  ChromeHeader,
  EmptyState,
  ErrorState,
  PressButton,
  Skeleton,
  Text,
  TicketCard,
  WellInput,
} from "@/components/ui"
import { supabase } from "@/lib/supabase"
import { useTheme } from "@/theme"

const STORAGE_KEY_RADIUS = "platelink_recipient_radius"
const RADIUS_OPTIONS = [2, 5, 10, 20] as const
type RadiusKm = (typeof RADIUS_OPTIONS)[number]

type FoodTypeFilter = "all" | "veg" | "non_veg" | "vegan"
type ViewMode = "map" | "list"

export default function RecipientFindScreen() {
  const router = useRouter()
  const { theme, isDark } = useTheme()
  const queryClient = useQueryClient()
  const cameraRef = useRef<CameraRef>(null)

  // 1. Location state
  const [center, setCenter] = useState<LatLng>(DEFAULT_CENTER)
  const [locationLabel, setLocationLabel] = useState<string>("Campus area")
  const [radiusKm, setRadiusKm] = useState<RadiusKm>(5)
  const [viewMode, setViewMode] = useState<ViewMode>("map")
  const [foodTypeFilter, setFoodTypeFilter] = useState<FoodTypeFilter>("all")
  const [selectedListing, setSelectedListing] = useState<NearbyListing | null>(null)

  // Location search sheet state
  const [isLocationSheetOpen, setIsLocationSheetOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [searchResults, setSearchResults] = useState<PlaceResult[]>([])
  const [isSearchingPlaces, setIsSearchingPlaces] = useState(false)

  // 2. Load persisted radius choice on mount
  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY_RADIUS)
      .then((val) => {
        if (val) {
          const num = parseInt(val, 10)
          if (RADIUS_OPTIONS.includes(num as RadiusKm)) {
            setRadiusKm(num as RadiusKm)
          }
        }
      })
      .catch(() => {})
  }, [])

  // Helper to change and persist radius
  const handleSelectRadius = (r: RadiusKm) => {
    try {
      Haptics.selectionAsync().catch(() => {})
    } catch {}
    setRadiusKm(r)
    AsyncStorage.setItem(STORAGE_KEY_RADIUS, String(r)).catch(() => {})
  }

  // 3. Request foreground location on mount
  const handleUseCurrentLocation = useCallback(async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync()
      if (status === "granted") {
        const loc = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        })
        const newCoords: LatLng = {
          lat: loc.coords.latitude,
          lng: loc.coords.longitude,
        }
        setCenter(newCoords)
        cameraRef.current?.easeTo({
          center: [newCoords.lng, newCoords.lat],
          zoom: 13.5,
          duration: 600,
        })

        // Reverse geocode label
        const address = await reverseGeocode(newCoords).catch(() => null)
        setLocationLabel(address ? address.split(",")[0] : "Your location")
      }
    } catch (err) {
      console.warn("[recipient-find] Location error:", err)
    }
  }, [])

  useEffect(() => {
    let isMounted = true
    async function initCurrentLocation() {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync()
        if (!isMounted || status !== "granted") return
        const loc = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        })
        if (!isMounted) return
        const newCoords: LatLng = {
          lat: loc.coords.latitude,
          lng: loc.coords.longitude,
        }
        setCenter(newCoords)
        cameraRef.current?.easeTo({
          center: [newCoords.lng, newCoords.lat],
          zoom: 13.5,
          duration: 600,
        })

        const address = await reverseGeocode(newCoords).catch(() => null)
        if (isMounted && address) {
          setLocationLabel(address.split(",")[0])
        }
      } catch (err) {
        console.warn("[recipient-find] Location error:", err)
      }
    }

    void initCurrentLocation()

    return () => {
      isMounted = false
    }
  }, [])

  // 4. Query nearby listings
  const {
    data: listings = [],
    isLoading,
    isError,
    error,
    refetch,
    isRefetching,
  } = useQuery<NearbyListing[]>({
    queryKey: recipientKeys.nearby(center.lat, center.lng, radiusKm * 1000),
    queryFn: () =>
      fetchNearby(supabase, {
        lat: center.lat,
        lng: center.lng,
        radiusM: radiusKm * 1000,
      }),
  })

  // 5. Realtime invalidation on food_listings (Rule 11: unique channel name per mount)
  useEffect(() => {
    const channelName = `recipient-find-${Math.random().toString(36).substring(2, 9)}`
    const channel = supabase
      .channel(channelName)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "food_listings" },
        () => {
          queryClient.invalidateQueries({ queryKey: recipientKeys.all })
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [queryClient])

  // 6. Filter listings by food type
  const filteredListings = useMemo(() => {
    if (foodTypeFilter === "all") return listings
    return listings.filter((l) => l.food_type === foodTypeFilter)
  }, [listings, foodTypeFilter])

  // 7. Auto-fit camera to results when map view or listings change
  useEffect(() => {
    if (viewMode === "map" && cameraRef.current && listings.length > 0) {
      const validPoints: [number, number][] = listings
        .filter(
          (l) =>
            typeof l.location_lat === "number" &&
            typeof l.location_lng === "number" &&
            Number.isFinite(l.location_lat) &&
            Number.isFinite(l.location_lng)
        )
        .map((l) => [l.location_lng, l.location_lat])

      validPoints.push([center.lng, center.lat])

      if (validPoints.length === 1) {
        cameraRef.current.easeTo({
          center: validPoints[0],
          zoom: 13.5,
          duration: 600,
        })
      } else {
        const lngs = validPoints.map((p) => p[0])
        const lats = validPoints.map((p) => p[1])
        const minLng = Math.min(...lngs)
        const maxLng = Math.max(...lngs)
        const minLat = Math.min(...lats)
        const maxLat = Math.max(...lats)

        cameraRef.current.fitBounds(
          [minLng, minLat, maxLng, maxLat],
          {
            padding: { top: 60, right: 40, bottom: 160, left: 40 },
            duration: 700,
          }
        )
      }
    }
  }, [listings, viewMode, center])

  // 8. Place Search via Photon
  useEffect(() => {
    const q = searchQuery.trim()
    const timer = setTimeout(async () => {
      if (!q) {
        setSearchResults([])
        return
      }
      setIsSearchingPlaces(true)
      try {
        const results = await searchPlaces(q, center)
        setSearchResults(results)
      } catch (err) {
        console.warn("[recipient-search] Search error:", err)
      } finally {
        setIsSearchingPlaces(false)
      }
    }, 350)

    return () => clearTimeout(timer)
  }, [searchQuery, center])

  const handleSelectPlace = (place: PlaceResult) => {
    try {
      Haptics.selectionAsync().catch(() => {})
    } catch {}
    const newCoords: LatLng = { lat: place.lat, lng: place.lng }
    setCenter(newCoords)
    setLocationLabel(place.label.split(",")[0])
    setIsLocationSheetOpen(false)
    setSearchQuery("")
    cameraRef.current?.easeTo({
      center: [newCoords.lng, newCoords.lat],
      zoom: 13.5,
      duration: 600,
    })
  }

  // Next radius step for empty state button
  const nextRadius = useMemo<RadiusKm | null>(() => {
    if (radiusKm === 2) return 5
    if (radiusKm === 5) return 10
    if (radiusKm === 10) return 20
    return null
  }, [radiusKm])

  const mapStyleUrl = isDark ? MAP_STYLE_DARK : MAP_STYLE_LIGHT

  return (
    <View style={[styles.root, { backgroundColor: theme.colors.canvas }]}>
      {/* Structural Gunmetal Chrome Header */}
      <ChromeHeader
        title="Find food surplus"
        subtitle={`Within ${radiusKm} km of ${locationLabel}`}
        rightAction={
          <PressButton
            variant="ghost"
            size="sm"
            onPress={() => setIsLocationSheetOpen(true)}
            leftIcon={<MapPin size={16} color={theme.colors.chromeInk} />}
            accessibilityLabel="Change location or radius"
          >
            Change
          </PressButton>
        }
      />

      {/* Filter & View Mode Bar */}
      <View
        style={[
          styles.filterBar,
          {
            backgroundColor: theme.colors.surface,
            borderBottomColor: theme.colors.border,
          },
        ]}
      >
        {/* Radius Chips */}
        <View style={styles.radiusRow}>
          {RADIUS_OPTIONS.map((r) => (
            <Chip
              key={r}
              label={`${r} km`}
              selected={radiusKm === r}
              onPress={() => handleSelectRadius(r)}
            />
          ))}
        </View>

        {/* View Mode Toggle: Map | List */}
        <View style={styles.viewToggleRow}>
          <Chip
            label="Map"
            selected={viewMode === "map"}
            onPress={() => {
              try {
                Haptics.selectionAsync().catch(() => {})
              } catch {}
              setViewMode("map")
            }}
          />
          <Chip
            label="List"
            selected={viewMode === "list"}
            onPress={() => {
              try {
                Haptics.selectionAsync().catch(() => {})
              } catch {}
              setViewMode("list")
            }}
          />
        </View>
      </View>

      {/* Main View Area */}
      {viewMode === "map" ? (
        /* MAP VIEW */
        <View style={styles.mapContainer}>
          <Map
            mapStyle={mapStyleUrl}
            style={StyleSheet.absoluteFill}
            attribution={true}
            attributionPosition={{ bottom: 12, left: 12 }}
          >
            <Camera
              ref={cameraRef}
              initialViewState={{
                center: [center.lng, center.lat],
                zoom: 13,
              }}
            />

            {/* You are here Puck */}
            <UserLocation animated={true} />

            {/* Center Reference Marker if custom searched place */}
            <Marker id="center-ref-pin" lngLat={[center.lng, center.lat]}>
              <View style={styles.centerDotOuter}>
                <View style={styles.centerDotInner} />
              </View>
            </Marker>

            {/* Honey Surplus Food Pins */}
            {filteredListings.map((listing) => {
              const isSelected = selectedListing?.id === listing.id
              return (
                <Marker
                  key={listing.id}
                  id={listing.id}
                  lngLat={[listing.location_lng, listing.location_lat]}
                  onPress={() => {
                    try {
                      Haptics.selectionAsync().catch(() => {})
                    } catch {}
                    setSelectedListing(listing)
                  }}
                >
                  <View style={styles.pinWrapper}>
                    <View
                      style={[
                        styles.pinHead,
                        {
                          backgroundColor: palette.honeyBronze,
                          borderColor: isSelected
                            ? theme.colors.ink
                            : palette.gunmetal,
                          transform: [{ scale: isSelected ? 1.15 : 1 }],
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.pinCountText,
                          { fontFamily: theme.fonts.displayBold },
                        ]}
                      >
                        {listing.quantity}
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
              )
            })}
          </Map>

          {/* Floating Recenter Map Button */}
          <View style={styles.recenterFloat}>
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
                  center: [center.lng, center.lat],
                  zoom: 14,
                  duration: 600,
                })
              }}
              leftIcon={<Crosshair size={16} color={theme.colors.ink} />}
              accessibilityLabel="Recenter map"
              style={styles.recenterBtn}
            >
              Center
            </PressButton>
          </View>

          {/* Floating Selected Listing Preview Card */}
          {selectedListing && (
            <View style={styles.previewCardWrap}>
              <Card style={styles.previewCard}>
                <View style={styles.previewHeaderRow}>
                  <View style={{ flex: 1 }}>
                    <Text variant="h3" numberOfLines={1}>
                      {selectedListing.title}
                    </Text>
                    <Text variant="caption" muted numberOfLines={1}>
                      {selectedListing.canteen_name} ·{" "}
                      {formatDistance(selectedListing.distance_m)} away
                    </Text>
                  </View>
                  <Pressable
                    onPress={() => setSelectedListing(null)}
                    hitSlop={8}
                    accessibilityRole="button"
                    accessibilityLabel="Close preview"
                  >
                    <X size={18} color={theme.colors.inkMuted} />
                  </Pressable>
                </View>

                <View style={styles.previewFooterRow}>
                  <View style={styles.portionPill}>
                    <Utensils size={13} color={palette.honeyBronze} />
                    <Text
                      variant="caption"
                      weight="bold"
                      style={{ color: palette.honeyBronze, marginLeft: 4 }}
                    >
                      {selectedListing.quantity} portions
                    </Text>
                  </View>

                  <PressButton
                    variant="default"
                    size="sm"
                    onPress={() => {
                      router.push(`/listing/${selectedListing.id}` as any)
                    }}
                    rightIcon={<ChevronRight size={16} color="#FFFFFF" />}
                    accessibilityLabel="View listing details"
                  >
                    View details
                  </PressButton>
                </View>
              </Card>
            </View>
          )}
        </View>
      ) : (
        /* LIST VIEW */
        <View style={styles.listContainer}>
          {/* Food Type Filter Row */}
          <View style={styles.foodTypeFilterRow}>
            {(
              [
                { label: "All", value: "all" },
                { label: "Veg", value: "veg" },
                { label: "Non-veg", value: "non_veg" },
                { label: "Vegan", value: "vegan" },
              ] as const
            ).map((filter) => (
              <Chip
                key={filter.value}
                label={filter.label}
                selected={foodTypeFilter === filter.value}
                onPress={() => {
                  try {
                    Haptics.selectionAsync().catch(() => {})
                  } catch {}
                  setFoodTypeFilter(filter.value)
                }}
              />
            ))}
          </View>

          {isLoading ? (
            <View style={styles.skeletonList}>
              {[1, 2, 3, 4].map((idx) => (
                <View key={idx} style={styles.skeletonTicket}>
                  <Skeleton width="60%" height={22} borderRadius={6} />
                  <Skeleton
                    width="40%"
                    height={14}
                    borderRadius={4}
                    style={{ marginTop: 10 }}
                  />
                  <Skeleton
                    width="80%"
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
          ) : filteredListings.length === 0 ? (
            <View style={styles.centered}>
              <EmptyState
                icon={<Utensils size={36} color={palette.honeyBronze} />}
                title={`No food within ${radiusKm} km`}
                description={
                  nextRadius
                    ? `Expand search radius to find surplus meals available at nearby campus canteens.`
                    : "No surplus food listings are active in this area right now. Check back soon!"
                }
                action={
                  nextRadius ? (
                    <PressButton
                      variant="default"
                      size="md"
                      onPress={() => handleSelectRadius(nextRadius)}
                      leftIcon={<SlidersHorizontal size={18} color="#FFFFFF" />}
                    >
                      Widen to {nextRadius} km
                    </PressButton>
                  ) : undefined
                }
              />
            </View>
          ) : (
            <FlatList
              data={filteredListings}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.ticketsScrollContent}
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
                    title={item.title}
                    portions={item.quantity}
                    status="available"
                    meta={`${item.canteen_name} · ${formatDistance(item.distance_m)} away`}
                    photoUrl={item.photo_url ?? undefined}
                    onPress={() => {
                      router.push(`/listing/${item.id}` as any)
                    }}
                  />
                </View>
              )}
            />
          )}
        </View>
      )}

      {/* Location Search Modal Sheet */}
      <Modal
        visible={isLocationSheetOpen}
        animationType="slide"
        transparent
        onRequestClose={() => setIsLocationSheetOpen(false)}
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
            {/* Sheet Header */}
            <View style={styles.sheetHeader}>
              <View style={{ flex: 1 }}>
                <Text variant="h3">Change search location</Text>
                <Text variant="caption" muted style={{ marginTop: 2 }}>
                  Search any address or use current GPS
                </Text>
              </View>
              <Pressable
                onPress={() => setIsLocationSheetOpen(false)}
                hitSlop={10}
                accessibilityRole="button"
                accessibilityLabel="Close location search"
              >
                <X size={20} color={theme.colors.inkMuted} />
              </Pressable>
            </View>

            {/* Current Location Button */}
            <PressButton
              variant="outline"
              size="sm"
              onPress={async () => {
                await handleUseCurrentLocation()
                setIsLocationSheetOpen(false)
              }}
              leftIcon={<Crosshair size={16} color={theme.colors.ink} />}
              style={{ marginBottom: 14 }}
              accessibilityLabel="Use current device location"
            >
              Use current location
            </PressButton>

            {/* Search Input */}
            <WellInput
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Search area, landmark or street..."
              accessibilityLabel="Search location input"
            />

            {/* Search Results */}
            <View style={styles.resultsList}>
              {searchResults.length > 0 ? (
                searchResults.map((result) => (
                  <Pressable
                    key={result.id}
                    onPress={() => handleSelectPlace(result)}
                    style={({ pressed }) => [
                      styles.resultItem,
                      {
                        backgroundColor: pressed
                          ? theme.colors.surfaceSunken
                          : "transparent",
                        borderBottomColor: theme.colors.border,
                      },
                    ]}
                  >
                    <MapPin
                      size={18}
                      color={palette.honeyBronze}
                      style={{ marginRight: 10 }}
                    />
                    <Text
                      variant="body"
                      numberOfLines={1}
                      style={{ flex: 1 }}
                    >
                      {result.label}
                    </Text>
                  </Pressable>
                ))
              ) : searchQuery.trim().length > 2 && !isSearchingPlaces ? (
                <Text
                  variant="small"
                  muted
                  style={{ textAlign: "center", marginTop: 20 }}
                >
                  No matching places found. Try another search term.
                </Text>
              ) : null}
            </View>
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
  filterBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    gap: 8,
  },
  radiusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  viewToggleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  mapContainer: {
    flex: 1,
  },
  centerDotOuter: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "rgba(200, 62, 77, 0.25)",
    alignItems: "center",
    justifyContent: "center",
  },
  centerDotInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: palette.blushedBrick,
    borderWidth: 1.5,
    borderColor: "#FFFFFF",
  },
  pinWrapper: {
    alignItems: "center",
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
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 4,
  },
  pinCountText: {
    fontSize: 13,
    color: palette.gunmetal,
  },
  pinTail: {
    width: 0,
    height: 0,
    backgroundColor: "transparent",
    borderStyle: "solid",
    borderLeftWidth: 5,
    borderRightWidth: 5,
    borderTopWidth: 6,
    borderLeftColor: "transparent",
    borderRightColor: "transparent",
    marginTop: -1,
  },
  recenterFloat: {
    position: "absolute",
    top: 14,
    right: 14,
  },
  recenterBtn: {
    backgroundColor: "rgba(255, 255, 255, 0.95)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
    elevation: 3,
  },
  previewCardWrap: {
    position: "absolute",
    bottom: 20,
    left: 16,
    right: 16,
  },
  previewCard: {
    padding: 16,
    borderRadius: 18,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
  },
  previewHeaderRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 12,
  },
  previewFooterRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  portionPill: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: "rgba(244, 184, 96, 0.15)",
  },
  listContainer: {
    flex: 1,
  },
  foodTypeFilterRow: {
    flexDirection: "row",
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
  },
  ticketsScrollContent: {
    padding: 16,
  },
  skeletonList: {
    padding: 16,
    gap: 12,
  },
  skeletonTicket: {
    padding: 16,
    borderRadius: 16,
  },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
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
    maxHeight: "80%",
  },
  sheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
  },
  resultsList: {
    marginTop: 10,
    maxHeight: 260,
  },
  resultItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
  },
})
