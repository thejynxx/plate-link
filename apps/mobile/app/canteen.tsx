import React, { useEffect, useRef, useState } from "react"
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native"
import { Redirect, useRouter } from "expo-router"
import { Controller, useForm, useWatch } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as Haptics from "expo-haptics"
import * as Location from "expo-location"
import {
  Camera,
  Map,
  Marker,
  type CameraRef,
} from "@maplibre/maplibre-react-native"
import { Crosshair, LogOut, MapPin, Store, Utensils } from "lucide-react-native"
import {
  canteenOnboardingSchema,
  DEFAULT_CENTER,
  MAP_STYLE_DARK,
  MAP_STYLE_LIGHT,
  palette,
  reverseGeocode,
  searchPlaces,
  type CanteenOnboardingInput,
  type LatLng,
  type PlaceResult,
} from "@platelink/shared"
import {
  Card,
  ChromeHeader,
  PressButton,
  Text,
  WellInput,
} from "@/components/ui"
import { useSession } from "@/lib/session"
import { supabase } from "@/lib/supabase"
import { useTheme } from "@/theme"

export default function CanteenOnboardingScreen() {
  const router = useRouter()
  const { theme, isDark } = useTheme()
  const { user, profile, canteen, refreshCanteen, signOut } = useSession()

  const mapCameraRef = useRef<CameraRef | null>(null)
  const [searchQuery, setSearchQuery] = useState("")
  const [searchResults, setSearchResults] = useState<PlaceResult[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [isLocating, setIsLocating] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  const {
    control,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<CanteenOnboardingInput>({
    resolver: zodResolver(canteenOnboardingSchema),
    defaultValues: {
      org_name: "",
      address: "",
      location_lat: DEFAULT_CENTER.lat,
      location_lng: DEFAULT_CENTER.lng,
      pickup_instructions: "",
    },
  })

  const [contactPhone, setContactPhone] = useState(profile?.phone ?? "")

  const lat = useWatch({ control, name: "location_lat" })
  const lng = useWatch({ control, name: "location_lng" })

  const mapStyleUrl = isDark ? MAP_STYLE_DARK : MAP_STYLE_LIGHT

  // Search Photon places on text input with debounce
  useEffect(() => {
    if (!searchQuery || searchQuery.trim().length < 3) {
      return
    }

    let active = true

    const timer = setTimeout(async () => {
      setIsSearching(true)
      try {
        const results = await searchPlaces(searchQuery, { lat, lng })
        if (active) setSearchResults(results.slice(0, 5))
      } catch {
        if (active) setSearchResults([])
      } finally {
        if (active) setIsSearching(false)
      }
    }, 350)

    return () => {
      active = false
      clearTimeout(timer)
    }
  }, [searchQuery, lat, lng])

  const handleSelectPlace = (place: PlaceResult) => {
    Haptics.selectionAsync().catch(() => {})
    setValue("location_lat", place.lat, { shouldValidate: true })
    setValue("location_lng", place.lng, { shouldValidate: true })
    setValue("address", place.label, { shouldValidate: true })
    setValue("place_id", place.id)
    setSearchQuery("")
    setSearchResults([])

    mapCameraRef.current?.flyTo({ center: [place.lng, place.lat], duration: 1000 })
  }

  const handleUseCurrentLocation = async () => {
    setIsLocating(true)
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {})
      const { status } = await Location.requestForegroundPermissionsAsync()
      if (status !== "granted") {
        Alert.alert("Permission needed", "Please grant location access to pick up food from your canteen.")
        return
      }

      const loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      })

      const coords: LatLng = {
        lat: loc.coords.latitude,
        lng: loc.coords.longitude,
      }

      setValue("location_lat", coords.lat, { shouldValidate: true })
      setValue("location_lng", coords.lng, { shouldValidate: true })

      mapCameraRef.current?.flyTo({ center: [coords.lng, coords.lat], duration: 1000 })

      const addr = await reverseGeocode(coords).catch(() => null)
      if (addr) {
        setValue("address", addr, { shouldValidate: true })
      }
    } catch (err: any) {
      Alert.alert("Location error", err?.message ?? "Could not retrieve current position.")
    } finally {
      setIsLocating(false)
    }
  }

  const onSubmit = async (values: CanteenOnboardingInput) => {
    if (!user) return
    setSubmitError(null)

    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {})

      // 1. Optionally update contact phone in public.users if changed
      if (contactPhone && contactPhone !== profile?.phone) {
        await supabase
          .from("users")
          .update({ phone: contactPhone })
          .eq("id", user.id)
      }

      // 2. Insert into public.canteens
      const { error } = await supabase.from("canteens").insert({
        id: user.id,
        org_name: values.org_name,
        address: values.address,
        location_lat: values.location_lat,
        location_lng: values.location_lng,
        place_id: values.place_id || null,
        pickup_instructions: values.pickup_instructions || null,
      })

      if (error) {
        setSubmitError(error.message)
        return
      }

      // 3. Refresh canteen in context and navigate to portal
      await refreshCanteen()
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {})
      router.replace("/(canteen)" as any)
    } catch (err: any) {
      setSubmitError(err?.message ?? "Failed to save canteen details.")
    }
  }

  // If already onboarded, redirect straight to the canteen portal tabs
  if (canteen) {
    return <Redirect href={"/(canteen)" as any} />
  }

  const firstName = profile?.name ? profile.name.split(" ")[0] : "partner"

  return (
    <View style={[styles.root, { backgroundColor: theme.colors.canvas }]}>
      <ChromeHeader
        title="Set up your canteen"
        subtitle="Where should drivers pick up food?"
        rightAction={
          <PressButton
            variant="ghost"
            size="sm"
            onPress={signOut}
            leftIcon={<LogOut size={16} color={theme.colors.chromeInk} />}
            accessibilityLabel="Sign out"
          >
            Sign out
          </PressButton>
        }
      />

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Welcome Card */}
          <Card style={styles.welcomeCard}>
            <View style={styles.welcomeHeader}>
              <View
                style={[
                  styles.iconCircle,
                  { backgroundColor: "rgba(244, 184, 96, 0.2)" },
                ]}
              >
                <Store size={22} color={palette.honeyBronze} />
              </View>
              <View style={{ flex: 1 }}>
                <Text variant="h3">Hi {firstName} — welcome</Text>
                <Text variant="caption" muted style={{ marginTop: 2 }}>
                  Tell us where your kitchen is located. All surplus listings you
                  publish will use this pickup point.
                </Text>
              </View>
            </View>
          </Card>

          {submitError ? (
            <View
              style={[
                styles.errorBanner,
                {
                  backgroundColor: "rgba(200, 62, 77, 0.1)",
                  borderColor: theme.colors.danger,
                },
              ]}
            >
              <Text variant="small" style={{ color: theme.colors.danger }}>
                {submitError}
              </Text>
            </View>
          ) : null}

          {/* Form */}
          <View style={styles.form}>
            {/* Canteen Name */}
            <View style={styles.fieldGroup}>
              <Text variant="caption" weight="semibold" style={styles.label}>
                Canteen / organisation name *
              </Text>
              <Controller
                control={control}
                name="org_name"
                render={({ field: { onChange, onBlur, value } }) => (
                  <WellInput
                    value={value}
                    onChangeText={onChange}
                    onBlur={onBlur}
                    placeholder="e.g. VIT Chennai — Food Court A"
                    accessibilityLabel="Canteen organisation name"
                  />
                )}
              />
              {errors.org_name ? (
                <Text variant="caption" style={styles.fieldError}>
                  {errors.org_name.message}
                </Text>
              ) : null}
            </View>

            {/* Contact Phone */}
            <View style={styles.fieldGroup}>
              <Text variant="caption" weight="semibold" style={styles.label}>
                Contact phone number
              </Text>
              <WellInput
                value={contactPhone}
                onChangeText={setContactPhone}
                placeholder="Phone for drivers to reach your kitchen"
                keyboardType="phone-pad"
                accessibilityLabel="Contact phone number"
              />
            </View>

            {/* Address Search */}
            <View style={styles.fieldGroup}>
              <View style={styles.addressHeaderRow}>
                <Text variant="caption" weight="semibold" style={styles.label}>
                  Kitchen location & address *
                </Text>
                <PressButton
                  variant="outline"
                  size="sm"
                  loading={isLocating}
                  onPress={handleUseCurrentLocation}
                  leftIcon={<Crosshair size={14} color={theme.colors.ink} />}
                  accessibilityLabel="Use current GPS location"
                >
                  Use GPS
                </PressButton>
              </View>

              <WellInput
                value={searchQuery}
                onChangeText={(text) => {
                  setSearchQuery(text)
                  if (!text || text.trim().length < 3) {
                    setSearchResults([])
                  }
                }}
                placeholder="Search campus, street or landmark..."
                accessibilityLabel="Search pickup address"
              />

              {isSearching ? (
                <View style={{ paddingVertical: 6, alignItems: "center" }}>
                  <ActivityIndicator size="small" color={palette.honeyBronze} />
                </View>
              ) : null}

              {/* Photon Search Results */}
              {searchResults.length > 0 ? (
                <View
                  style={[
                    styles.searchResults,
                    {
                      backgroundColor: theme.colors.surfaceSunken,
                      borderColor: theme.colors.border,
                    },
                  ]}
                >
                  {searchResults.map((p) => (
                    <Pressable
                      key={p.id}
                      onPress={() => handleSelectPlace(p)}
                      style={[
                        styles.resultItem,
                        { borderBottomColor: theme.colors.border },
                      ]}
                    >
                      <MapPin
                        size={15}
                        color={palette.honeyBronze}
                        style={{ marginRight: 8 }}
                      />
                      <Text variant="small" numberOfLines={1} style={{ flex: 1 }}>
                        {p.label}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              ) : null}
            </View>

            {/* Small MapLibre Map with Tap Pin */}
            <View style={styles.mapWrap}>
              <Map
                mapStyle={mapStyleUrl}
                style={StyleSheet.absoluteFill}
                attribution={true}
                attributionPosition={{ bottom: 4, left: 4 }}
                onPress={async (e: any) => {
                  const coords = e?.geometry?.coordinates as [number, number] | undefined
                  if (coords && coords.length === 2) {
                    Haptics.selectionAsync().catch(() => {})
                    const newPt: LatLng = { lat: coords[1], lng: coords[0] }
                    setValue("location_lat", newPt.lat, { shouldValidate: true })
                    setValue("location_lng", newPt.lng, { shouldValidate: true })
                    const addr = await reverseGeocode(newPt).catch(() => null)
                    if (addr) setValue("address", addr, { shouldValidate: true })
                  }
                }}
              >
                <Camera
                  ref={mapCameraRef}
                  initialViewState={{
                    center: [lng, lat],
                    zoom: 14,
                  }}
                />
                <Marker id="canteen-pin" lngLat={[lng, lat]}>
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
            <Text variant="caption" muted style={{ marginTop: -10 }}>
              Tap map to adjust the pin exactly over your pickup gate.
            </Text>

            {/* Detailed Address Text */}
            <View style={styles.fieldGroup}>
              <Text variant="caption" weight="semibold" style={styles.label}>
                Address shown to drivers *
              </Text>
              <Controller
                control={control}
                name="address"
                render={({ field: { onChange, onBlur, value } }) => (
                  <WellInput
                    value={value}
                    onChangeText={onChange}
                    onBlur={onBlur}
                    placeholder="Gate number, building, floor or street address"
                    accessibilityLabel="Pickup address shown to drivers"
                  />
                )}
              />
              {errors.address ? (
                <Text variant="caption" style={styles.fieldError}>
                  {errors.address.message}
                </Text>
              ) : null}
            </View>

            {/* Pickup Instructions */}
            <View style={styles.fieldGroup}>
              <Text variant="caption" weight="semibold" style={styles.label}>
                Pickup instructions (optional)
              </Text>
              <Controller
                control={control}
                name="pickup_instructions"
                render={({ field: { onChange, onBlur, value } }) => (
                  <WellInput
                    value={value ?? ""}
                    onChangeText={onChange}
                    onBlur={onBlur}
                    placeholder="e.g. Report to Counter 4 at the back kitchen entrance. Ask for Mr. Ramesh."
                    multiline
                    numberOfLines={3}
                    accessibilityLabel="Pickup instructions"
                  />
                )}
              />
              {errors.pickup_instructions ? (
                <Text variant="caption" style={styles.fieldError}>
                  {errors.pickup_instructions.message}
                </Text>
              ) : null}
            </View>

            {/* Submit Button */}
            <PressButton
              variant="default"
              size="lg"
              fullWidth
              loading={isSubmitting}
              onPress={() => handleSubmit(onSubmit)()}
              style={{ marginTop: 12 }}
              accessibilityLabel="Save canteen and continue"
            >
              Save and continue
            </PressButton>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  )
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  scrollContent: {
    padding: 18,
    paddingBottom: 40,
  },
  welcomeCard: {
    marginBottom: 16,
    padding: 16,
  },
  welcomeHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  errorBanner: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
  form: {
    gap: 16,
  },
  fieldGroup: {
    gap: 6,
  },
  label: {
    letterSpacing: -0.1,
  },
  addressHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  fieldError: {
    color: palette.blushedBrick,
    marginTop: 2,
  },
  searchResults: {
    borderWidth: 1,
    borderRadius: 10,
    marginTop: 4,
    overflow: "hidden",
  },
  resultItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  mapWrap: {
    height: 180,
    borderRadius: 14,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
  },
  pinWrapper: {
    alignItems: "center",
    justifyContent: "center",
  },
  pinHead: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
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
})
