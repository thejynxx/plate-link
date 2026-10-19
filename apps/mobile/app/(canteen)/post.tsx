import React, { useMemo, useState } from "react"
import {
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native"
import { useRouter } from "expo-router"
import { useQueryClient } from "@tanstack/react-query"
import * as Haptics from "expo-haptics"
import * as ImageManipulator from "expo-image-manipulator"
import * as ImagePicker from "expo-image-picker"
import {
  Camera,
  Clock,
  Image as ImageIcon,
  Minus,
  Plus,
  Trash2,
  Utensils,
} from "lucide-react-native"
import {
  canteenKeys,
  findDish,
  FOOD_TYPE_LABEL,
  listingSchema,
  palette,
  suggestDishes,
  type DishSuggestion,
  type FoodType,
} from "@platelink/shared"
import {
  Badge,
  Card,
  ChipGroup,
  ChromeHeader,
  PressButton,
  Text,
  WellInput,
} from "@/components/ui"
import { useSession } from "@/lib/session"
import { supabase } from "@/lib/supabase"
import { useTheme } from "@/theme"

const FOOD_TYPE_OPTIONS: { label: string; value: FoodType }[] = [
  { label: "Veg", value: "veg" },
  { label: "Non-veg", value: "non_veg" },
  { label: "Vegan", value: "vegan" },
  { label: "Mixed", value: "mixed" },
]

type ExpiryPreset = "1h" | "2h" | "4h" | "tonight" | "custom"

export default function PostListingScreen() {
  const router = useRouter()
  const { theme } = useTheme()
  const { user, canteen } = useSession()
  const queryClient = useQueryClient()

  // Form states
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [quantity, setQuantity] = useState(25)
  const [foodType, setFoodType] = useState<FoodType>("veg")
  const [hasManuallySetFoodType, setHasManuallySetFoodType] = useState(false)
  const [expiryPreset, setExpiryPreset] = useState<ExpiryPreset>("2h")
  const [customHours, setCustomHours] = useState(2)

  // Photo
  const [photoUri, setPhotoUri] = useState<string | null>(null)
  const [isProcessingPhoto, setIsProcessingPhoto] = useState(false)

  // Dish Autocomplete
  const [dishQuery, setDishQuery] = useState("")
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  // Real-time suggestions from shared dish catalog (Rule 13)
  const suggestions = useMemo(() => {
    if (!dishQuery || dishQuery.trim().length < 2) return []
    return suggestDishes(dishQuery, {}, 6)
  }, [dishQuery])

  // When user picks a suggestion
  const handleSelectDish = (suggestion: DishSuggestion) => {
    Haptics.selectionAsync().catch(() => {})
    setTitle(suggestion.name)
    setDishQuery("")
    setShowSuggestions(false)

    // Auto-set food type if user hasn't explicitly customized it
    if (!hasManuallySetFoodType && suggestion.dish?.foodType) {
      setFoodType(suggestion.dish.foodType)
    }
  }

  // Auto-detect dish match on text change
  const handleTitleChange = (text: string) => {
    setTitle(text)
    setDishQuery(text)
    setShowSuggestions(true)

    const match = findDish(text)
    if (match && !hasManuallySetFoodType) {
      setFoodType(match.foodType)
    }
  }

  // Camera & Gallery Image Picker (Rule 8: bucket/auth.uid/...)
  const handlePickPhoto = async (fromCamera: boolean) => {
    try {
      setIsProcessingPhoto(true)
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {})

      if (fromCamera) {
        const { status } = await ImagePicker.requestCameraPermissionsAsync()
        if (status !== "granted") {
          Alert.alert("Permission needed", "Camera access is needed to capture photos of food.")
          return
        }
      } else {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync()
        if (status !== "granted") {
          Alert.alert("Permission needed", "Photo library access is needed to select food images.")
          return
        }
      }

      const result = fromCamera
        ? await ImagePicker.launchCameraAsync({
            mediaTypes: ["images"],
            allowsEditing: true,
            aspect: [4, 3],
            quality: 0.9,
          })
        : await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ["images"],
            allowsEditing: true,
            aspect: [4, 3],
            quality: 0.9,
          })

      if (!result.canceled && result.assets && result.assets[0]?.uri) {
        const rawUri = result.assets[0].uri
        const width = result.assets[0].width || 1280
        const height = result.assets[0].height || 960

        // Resize to max 1280px maintaining aspect ratio
        const resizeAction =
          width > height
            ? { resize: { width: Math.min(width, 1280) } }
            : { resize: { height: Math.min(height, 1280) } }

        const manipulated = await ImageManipulator.manipulateAsync(
          rawUri,
          [resizeAction],
          { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG }
        )

        setPhotoUri(manipulated.uri)
      }
    } catch (err: any) {
      Alert.alert("Image error", err?.message ?? "Failed to select photo.")
    } finally {
      setIsProcessingPhoto(false)
    }
  }

  // Compute Expiry Date
  const expiresAt = useMemo(() => {
    const now = new Date()
    if (expiryPreset === "1h") return new Date(now.getTime() + 60 * 60 * 1000)
    if (expiryPreset === "2h") return new Date(now.getTime() + 2 * 60 * 60 * 1000)
    if (expiryPreset === "4h") return new Date(now.getTime() + 4 * 60 * 60 * 1000)
    if (expiryPreset === "tonight") {
      const tonight = new Date()
      tonight.setHours(22, 0, 0, 0)
      if (tonight.getTime() <= now.getTime()) {
        tonight.setDate(tonight.getDate() + 1)
      }
      return tonight
    }
    return new Date(now.getTime() + customHours * 60 * 60 * 1000)
  }, [expiryPreset, customHours])

  // Submit Listing
  const handleSubmit = async () => {
    if (!user || !canteen) {
      Alert.alert("Missing canteen profile", "Please complete canteen onboarding before publishing food.")
      return
    }

    setFormError(null)

    // Validate with shared listing schema (Rule 9)
    const validation = listingSchema.safeParse({
      title,
      description: description || undefined,
      food_type: foodType,
      quantity,
      prepared_at: new Date(),
      expires_at: expiresAt,
    })

    if (!validation.success) {
      const firstIssue = validation.error.issues[0]
      setFormError(firstIssue?.message ?? "Please verify listing fields.")
      return
    }

    setIsSubmitting(true)
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {})

      let photoUrl: string | null = null

      // Upload photo if present (Rule 8: food-photos/<auth.uid()>/...)
      if (photoUri) {
        const photoRes = await fetch(photoUri)
        const blob = await photoRes.blob()
        const arrayBuffer = await new Response(blob).arrayBuffer()

        const filename = `${Date.now()}-${Math.random().toString(36).substring(2, 6)}.jpg`
        const storagePath = `${user.id}/${filename}`

        const { error: uploadErr } = await supabase.storage
          .from("food-photos")
          .upload(storagePath, arrayBuffer, {
            contentType: "image/jpeg",
            upsert: true,
          })

        if (!uploadErr) {
          const publicRes = supabase.storage.from("food-photos").getPublicUrl(storagePath)
          photoUrl = publicRes.data.publicUrl
        }
      }

      // Insert into public.food_listings
      const { data: newListing, error: insertErr } = await supabase
        .from("food_listings")
        .insert({
          canteen_id: canteen.id,
          title: title.trim(),
          description: description.trim() || null,
          food_type: foodType,
          quantity,
          photo_url: photoUrl,
          status: "available",
          location_lat: canteen.location_lat,
          location_lng: canteen.location_lng,
          expires_at: expiresAt.toISOString(),
          prepared_at: new Date().toISOString(),
        })
        .select()
        .single()

      if (insertErr) {
        setFormError(insertErr.message)
        return
      }

      // Invalidate queries so home feed and stat board update instantly
      queryClient.invalidateQueries({ queryKey: canteenKeys.active(canteen.id) })
      queryClient.invalidateQueries({ queryKey: canteenKeys.stats() })

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {})

      // Navigate to the newly created listing detail screen
      router.replace({
        pathname: "/canteen-listing/[id]" as any,
        params: { id: newListing.id },
      })
    } catch (err: any) {
      setFormError(err?.message ?? "Failed to publish listing.")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <View style={[styles.root, { backgroundColor: theme.colors.canvas }]}>
      <ChromeHeader
        title="Post surplus food"
        subtitle="Notify nearby NGOs and volunteer drivers"
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
          {formError ? (
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
                {formError}
              </Text>
            </View>
          ) : null}

          {/* Photo Section */}
          <Card style={styles.photoCard}>
            <Text variant="caption" weight="semibold" style={styles.label}>
              Photo of the food (optional)
            </Text>

            {photoUri ? (
              <View style={styles.photoPreviewWrapper}>
                <Image source={{ uri: photoUri }} style={styles.photoPreview} />
                <Pressable
                  onPress={() => setPhotoUri(null)}
                  style={styles.removePhotoButton}
                  accessibilityRole="button"
                  accessibilityLabel="Remove photo"
                >
                  <Trash2 size={16} color="#FFFFFF" />
                </Pressable>
              </View>
            ) : (
              <View style={styles.photoButtonsRow}>
                <PressButton
                  variant="outline"
                  size="sm"
                  onPress={() => handlePickPhoto(true)}
                  leftIcon={<Camera size={16} color={theme.colors.ink} />}
                  loading={isProcessingPhoto}
                  style={{ flex: 1 }}
                >
                  Take photo
                </PressButton>
                <PressButton
                  variant="outline"
                  size="sm"
                  onPress={() => handlePickPhoto(false)}
                  leftIcon={<ImageIcon size={16} color={theme.colors.ink} />}
                  loading={isProcessingPhoto}
                  style={{ flex: 1 }}
                >
                  Gallery
                </PressButton>
              </View>
            )}
          </Card>

          {/* Dish Title with DishAutocomplete */}
          <View style={styles.fieldGroup}>
            <Text variant="caption" weight="semibold" style={styles.label}>
              Dish title *
            </Text>
            <WellInput
              value={title}
              onChangeText={handleTitleChange}
              placeholder="e.g. Veg biryani, Sambar rice, Meals..."
              accessibilityLabel="Dish title"
            />

            {/* Suggestions dropdown */}
            {showSuggestions && suggestions.length > 0 ? (
              <View
                style={[
                  styles.suggestionsList,
                  {
                    backgroundColor: theme.colors.surfaceSunken,
                    borderColor: theme.colors.border,
                  },
                ]}
              >
                {suggestions.map((s) => (
                  <Pressable
                    key={s.name}
                    onPress={() => handleSelectDish(s)}
                    style={[
                      styles.suggestionItem,
                      { borderBottomColor: theme.colors.border },
                    ]}
                  >
                    <Utensils
                      size={15}
                      color={palette.honeyBronze}
                      style={{ marginRight: 8 }}
                    />
                    <View style={{ flex: 1 }}>
                      <Text variant="small" weight="medium">
                        {s.name}
                      </Text>
                      {s.dish?.category ? (
                        <Text variant="caption" muted>
                          {s.dish.category} • {s.dish.foodType}
                        </Text>
                      ) : null}
                    </View>
                    {s.dish?.foodType ? (
                      <Badge variant="silk">
                        {FOOD_TYPE_LABEL[s.dish.foodType]}
                      </Badge>
                    ) : null}
                  </Pressable>
                ))}
              </View>
            ) : null}
          </View>

          {/* Food Type Chips */}
          <View style={styles.fieldGroup}>
            <Text variant="caption" weight="semibold" style={styles.label}>
              Food category *
            </Text>
            <ChipGroup
              options={FOOD_TYPE_OPTIONS}
              value={foodType}
              onChange={(val) => {
                setHasManuallySetFoodType(true)
                setFoodType(val)
              }}
            />
          </View>

          {/* Portions Stepper */}
          <View style={styles.fieldGroup}>
            <Text variant="caption" weight="semibold" style={styles.label}>
              Available portions (meals) *
            </Text>

            <View style={styles.stepperRow}>
              <Pressable
                onPress={() => {
                  Haptics.selectionAsync().catch(() => {})
                  setQuantity((prev) => Math.max(1, prev - 5))
                }}
                style={[
                  styles.stepperBtn,
                  {
                    backgroundColor: theme.colors.surfaceSunken,
                    borderColor: theme.colors.border,
                  },
                ]}
                accessibilityRole="button"
                accessibilityLabel="Decrease portions"
              >
                <Minus size={20} color={theme.colors.ink} />
              </Pressable>

              <View style={styles.quantityDisplay}>
                <Text variant="display" style={{ color: theme.colors.accent }}>
                  {quantity}
                </Text>
                <Text variant="caption" muted>
                  portions
                </Text>
              </View>

              <Pressable
                onPress={() => {
                  Haptics.selectionAsync().catch(() => {})
                  setQuantity((prev) => prev + 5)
                }}
                style={[
                  styles.stepperBtn,
                  {
                    backgroundColor: theme.colors.surfaceSunken,
                    borderColor: theme.colors.border,
                  },
                ]}
                accessibilityRole="button"
                accessibilityLabel="Increase portions"
              >
                <Plus size={20} color={theme.colors.ink} />
              </Pressable>
            </View>

            {/* Quick Presets */}
            <View style={styles.quickChipsRow}>
              {[10, 25, 50, 100, 200].map((num) => (
                <Pressable
                  key={num}
                  onPress={() => {
                    Haptics.selectionAsync().catch(() => {})
                    setQuantity(num)
                  }}
                  style={[
                    styles.quickChip,
                    {
                      backgroundColor:
                        quantity === num
                          ? theme.colors.accent
                          : theme.colors.surfaceSunken,
                      borderColor:
                        quantity === num
                          ? theme.colors.accent
                          : theme.colors.border,
                    },
                  ]}
                >
                  <Text
                    variant="caption"
                    weight={quantity === num ? "bold" : "medium"}
                    style={{
                      color:
                        quantity === num
                          ? palette.gunmetal
                          : theme.colors.ink,
                    }}
                  >
                    {num}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          {/* Expiry Presets */}
          <View style={styles.fieldGroup}>
            <View style={styles.expiryHeaderRow}>
              <Text variant="caption" weight="semibold" style={styles.label}>
                Pickup window / Expiry *
              </Text>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                <Clock size={13} color={palette.honeyBronze} />
                <Text variant="caption" weight="medium" style={{ color: palette.honeyBronze }}>
                  {expiryPreset === "tonight"
                    ? "Tonight 10:00 PM"
                    : expiryPreset === "custom"
                      ? `In ${customHours} hours`
                      : `In ${expiryPreset.replace("h", " hours")}`}
                </Text>
              </View>
            </View>

            <View style={styles.presetsGrid}>
              {(
                [
                  { key: "1h", label: "1 hour" },
                  { key: "2h", label: "2 hours" },
                  { key: "4h", label: "4 hours" },
                  { key: "tonight", label: "Tonight" },
                  { key: "custom", label: "Custom" },
                ] as const
              ).map((preset) => (
                <Pressable
                  key={preset.key}
                  onPress={() => {
                    Haptics.selectionAsync().catch(() => {})
                    setExpiryPreset(preset.key)
                  }}
                  style={[
                    styles.presetBtn,
                    {
                      backgroundColor:
                        expiryPreset === preset.key
                          ? "rgba(244, 184, 96, 0.15)"
                          : theme.colors.surfaceSunken,
                      borderColor:
                        expiryPreset === preset.key
                          ? theme.colors.accent
                          : theme.colors.border,
                    },
                  ]}
                >
                  <Text
                    variant="caption"
                    weight={expiryPreset === preset.key ? "bold" : "medium"}
                    style={{
                      color:
                        expiryPreset === preset.key
                          ? theme.colors.accent
                          : theme.colors.ink,
                    }}
                  >
                    {preset.label}
                  </Text>
                </Pressable>
              ))}
            </View>

            {expiryPreset === "custom" ? (
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 8 }}>
                <Text variant="caption" weight="medium">
                  Hours from now:
                </Text>
                <Pressable
                  onPress={() => {
                    Haptics.selectionAsync().catch(() => {})
                    setCustomHours((prev) => Math.max(1, prev - 1))
                  }}
                  style={styles.stepBtn}
                  accessibilityLabel="Decrease custom expiry hours"
                >
                  <Minus size={14} color={theme.colors.ink} />
                </Pressable>
                <Text variant="body" weight="bold" style={{ minWidth: 24, textAlign: "center" }}>
                  {customHours}h
                </Text>
                <Pressable
                  onPress={() => {
                    Haptics.selectionAsync().catch(() => {})
                    setCustomHours((prev) => Math.min(24, prev + 1))
                  }}
                  style={styles.stepBtn}
                  accessibilityLabel="Increase custom expiry hours"
                >
                  <Plus size={14} color={theme.colors.ink} />
                </Pressable>
              </View>
            ) : null}
          </View>

          {/* Optional Description / Allergen Notes */}
          <View style={styles.fieldGroup}>
            <Text variant="caption" weight="semibold" style={styles.label}>
              Description / notes (optional)
            </Text>
            <WellInput
              value={description}
              onChangeText={setDescription}
              placeholder="e.g. Freshly cooked, includes raita and pickle. Packed in food-grade foil containers."
              multiline
              numberOfLines={3}
              accessibilityLabel="Listing description"
            />
          </View>

          {/* Publish Action Button */}
          <PressButton
            variant="default"
            size="lg"
            fullWidth
            loading={isSubmitting}
            onPress={handleSubmit}
            style={styles.publishBtn}
            accessibilityLabel="Publish surplus food listing"
          >
            Publish to pass
          </PressButton>
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
  errorBanner: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
  photoCard: {
    padding: 14,
    marginBottom: 16,
    gap: 10,
  },
  photoButtonsRow: {
    flexDirection: "row",
    gap: 10,
  },
  photoPreviewWrapper: {
    position: "relative",
    height: 180,
    borderRadius: 12,
    overflow: "hidden",
  },
  photoPreview: {
    width: "100%",
    height: "100%",
  },
  removePhotoButton: {
    position: "absolute",
    top: 10,
    right: 10,
    backgroundColor: "rgba(0, 0, 0, 0.65)",
    padding: 8,
    borderRadius: 20,
  },
  fieldGroup: {
    gap: 8,
    marginBottom: 18,
  },
  label: {
    letterSpacing: -0.1,
  },
  suggestionsList: {
    borderWidth: 1,
    borderRadius: 12,
    marginTop: 4,
    overflow: "hidden",
  },
  suggestionItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  stepperRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  stepperBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  stepBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(74, 88, 89, 0.3)",
    alignItems: "center",
    justifyContent: "center",
  },
  quantityDisplay: {
    alignItems: "center",
  },
  quickChipsRow: {
    flexDirection: "row",
    gap: 8,
    justifyContent: "center",
    marginTop: 10,
  },
  quickChip: {
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
  },
  expiryHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  presetsGrid: {
    flexDirection: "row",
    gap: 8,
  },
  presetBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  publishBtn: {
    marginTop: 10,
  },
})
