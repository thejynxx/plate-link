import React, { useEffect } from "react"
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  View,
} from "react-native"
import { Controller, useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import * as Haptics from "expo-haptics"
import Constants from "expo-constants"
import { LogOut, Save, Store } from "lucide-react-native"
import { palette, phoneSchema } from "@platelink/shared"
import {
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

const canteenEditSchema = z.object({
  name: z.string().trim().min(2, "Contact name is too short").max(120),
  phone: phoneSchema,
  org_name: z.string().trim().min(2, "Canteen name is too short").max(160),
  address: z.string().trim().min(5, "Address is too short"),
  pickup_instructions: z.string().trim().max(500).optional(),
})

type CanteenEditInput = z.infer<typeof canteenEditSchema>

const THEME_OPTIONS: { label: string; value: "system" | "light" | "dark" }[] = [
  { label: "System", value: "system" },
  { label: "Light", value: "light" },
  { label: "Dark", value: "dark" },
]

export default function CanteenProfileScreen() {
  const { user, profile, canteen, refreshProfile, refreshCanteen, signOut } = useSession()
  const { theme, preference, setMode } = useTheme()

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<CanteenEditInput>({
    resolver: zodResolver(canteenEditSchema),
    defaultValues: {
      name: profile?.name ?? "",
      phone: profile?.phone ?? "",
      org_name: canteen?.org_name ?? "",
      address: canteen?.address ?? "",
      pickup_instructions: canteen?.pickup_instructions ?? "",
    },
  })

  useEffect(() => {
    if (!isDirty && (profile || canteen)) {
      reset({
        name: profile?.name ?? "",
        phone: profile?.phone ?? "",
        org_name: canteen?.org_name ?? "",
        address: canteen?.address ?? "",
        pickup_instructions: canteen?.pickup_instructions ?? "",
      })
    }
  }, [profile, canteen, isDirty, reset])

  const onSubmit = async (values: CanteenEditInput) => {
    if (!user?.id) return

    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {})

      // 1. Update public.users
      const { error: userErr } = await supabase
        .from("users")
        .update({
          name: values.name.trim(),
          phone: values.phone.trim() || null,
        })
        .eq("id", user.id)

      if (userErr) throw userErr

      // 2. Update public.canteens
      if (canteen?.id) {
        const { error: canteenErr } = await supabase
          .from("canteens")
          .update({
            org_name: values.org_name.trim(),
            address: values.address.trim(),
            pickup_instructions: values.pickup_instructions?.trim() || null,
          })
          .eq("id", canteen.id)

        if (canteenErr) throw canteenErr
      }

      await Promise.all([refreshProfile(), refreshCanteen()])
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {})
      Alert.alert("Changes saved", "Your canteen details have been updated.")
    } catch (err: any) {
      Alert.alert("Unable to save", err?.message ?? "Failed to save profile changes.")
    }
  }

  const handleSignOut = () => {
    Alert.alert(
      "Sign out",
      "Are you sure you want to sign out of Plate-Link?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Sign out",
          style: "destructive",
          onPress: async () => {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {})
            await signOut()
          },
        },
      ]
    )
  }

  const initial = (canteen?.org_name || profile?.name || "C").trim().charAt(0).toUpperCase()
  const appVersion = Constants.expoConfig?.version ?? "1.0.0"

  return (
    <View style={[styles.root, { backgroundColor: theme.colors.canvas }]}>
      <ChromeHeader
        title="Kitchen profile"
        subtitle="Organisation details & app preferences"
        rightAction={
          <PressButton
            variant="ghost"
            size="sm"
            onPress={handleSignOut}
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
          {/* Avatar Banner Card */}
          <Card style={styles.headerCard}>
            <View
              style={[
                styles.avatarCircle,
                { backgroundColor: theme.colors.chrome },
              ]}
            >
              <Text
                variant="h1"
                style={{ color: theme.colors.accent, fontSize: 28 }}
              >
                {initial}
              </Text>
            </View>

            <View style={{ flex: 1 }}>
              <Text variant="h3">
                {canteen?.org_name ?? "Campus Canteen"}
              </Text>
              <Text variant="small" muted style={{ marginTop: 2 }}>
                {user?.email}
              </Text>
              <View style={styles.roleBadgeRow}>
                <View
                  style={[
                    styles.rolePill,
                    { backgroundColor: "rgba(244, 184, 96, 0.15)" },
                  ]}
                >
                  <Store size={12} color={palette.honeyBronze} />
                  <Text
                    variant="caption"
                    weight="bold"
                    style={{ color: palette.honeyBronze, marginLeft: 4 }}
                  >
                    Verified Canteen
                  </Text>
                </View>
              </View>
            </View>
          </Card>

          {/* Org Details Form */}
          <Card style={styles.sectionCard}>
            <Text variant="h3" style={styles.sectionTitle}>
              Canteen details
            </Text>

            {/* Canteen Name */}
            <View style={styles.fieldGroup}>
              <Text variant="caption" weight="semibold" style={styles.label}>
                Canteen / Organisation name *
              </Text>
              <Controller
                control={control}
                name="org_name"
                render={({ field: { onChange, onBlur, value } }) => (
                  <WellInput
                    value={value}
                    onChangeText={onChange}
                    onBlur={onBlur}
                    placeholder="Organisation name"
                    accessibilityLabel="Canteen name"
                  />
                )}
              />
              {errors.org_name ? (
                <Text variant="caption" style={styles.fieldError}>
                  {errors.org_name.message}
                </Text>
              ) : null}
            </View>

            {/* Contact Person Name */}
            <View style={styles.fieldGroup}>
              <Text variant="caption" weight="semibold" style={styles.label}>
                Contact person name *
              </Text>
              <Controller
                control={control}
                name="name"
                render={({ field: { onChange, onBlur, value } }) => (
                  <WellInput
                    value={value}
                    onChangeText={onChange}
                    onBlur={onBlur}
                    placeholder="Your name"
                    accessibilityLabel="Contact person name"
                  />
                )}
              />
              {errors.name ? (
                <Text variant="caption" style={styles.fieldError}>
                  {errors.name.message}
                </Text>
              ) : null}
            </View>

            {/* Contact Phone */}
            <View style={styles.fieldGroup}>
              <Text variant="caption" weight="semibold" style={styles.label}>
                Contact phone number
              </Text>
              <Controller
                control={control}
                name="phone"
                render={({ field: { onChange, onBlur, value } }) => (
                  <WellInput
                    value={value}
                    onChangeText={onChange}
                    onBlur={onBlur}
                    placeholder="Phone number"
                    keyboardType="phone-pad"
                    accessibilityLabel="Contact phone number"
                  />
                )}
              />
              {errors.phone ? (
                <Text variant="caption" style={styles.fieldError}>
                  {errors.phone.message}
                </Text>
              ) : null}
            </View>

            {/* Address */}
            <View style={styles.fieldGroup}>
              <Text variant="caption" weight="semibold" style={styles.label}>
                Pickup address shown to drivers *
              </Text>
              <Controller
                control={control}
                name="address"
                render={({ field: { onChange, onBlur, value } }) => (
                  <WellInput
                    value={value}
                    onChangeText={onChange}
                    onBlur={onBlur}
                    placeholder="Address"
                    accessibilityLabel="Pickup address"
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
                Pickup instructions
              </Text>
              <Controller
                control={control}
                name="pickup_instructions"
                render={({ field: { onChange, onBlur, value } }) => (
                  <WellInput
                    value={value ?? ""}
                    onChangeText={onChange}
                    onBlur={onBlur}
                    placeholder="Who to ask for, which counter, timings..."
                    multiline
                    numberOfLines={3}
                    accessibilityLabel="Pickup instructions"
                  />
                )}
              />
            </View>

            <PressButton
              variant="default"
              size="md"
              fullWidth
              loading={isSubmitting}
              onPress={() => handleSubmit(onSubmit)()}
              leftIcon={<Save size={16} color="#FFFFFF" />}
              style={{ marginTop: 8 }}
            >
              Save details
            </PressButton>
          </Card>

          {/* Theme Preference */}
          <Card style={styles.sectionCard}>
            <Text variant="h3" style={styles.sectionTitle}>
              Appearance
            </Text>
            <ChipGroup
              options={THEME_OPTIONS}
              value={preference}
              onChange={(mode) => setMode(mode)}
            />
          </Card>

          {/* Sign Out Card */}
          <Card style={styles.sectionCard}>
            <Text variant="h3" style={styles.sectionTitle}>
              Account session
            </Text>
            <Text variant="caption" muted style={{ marginBottom: 12 }}>
              Signed in as {user?.email} (Role: {profile?.role})
            </Text>
            <PressButton
              variant="outline"
              size="md"
              fullWidth
              onPress={handleSignOut}
              leftIcon={<LogOut size={16} color={palette.blushedBrick} />}
              style={{ borderColor: palette.blushedBrick }}
            >
              Sign out of Plate-Link
            </PressButton>
          </Card>

          <Text variant="caption" muted style={styles.versionText}>
            Plate-Link v{appVersion} • Canteen Edition
          </Text>
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
    padding: 16,
    paddingBottom: 40,
    gap: 16,
  },
  headerCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    gap: 16,
  },
  avatarCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: "center",
    justifyContent: "center",
  },
  roleBadgeRow: {
    flexDirection: "row",
    marginTop: 6,
  },
  rolePill: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  sectionCard: {
    padding: 16,
    gap: 14,
  },
  sectionTitle: {
    marginBottom: 4,
  },
  fieldGroup: {
    gap: 6,
  },
  label: {
    letterSpacing: -0.1,
  },
  fieldError: {
    color: palette.blushedBrick,
    marginTop: 2,
  },
  versionText: {
    textAlign: "center",
    marginTop: 8,
  },
})
