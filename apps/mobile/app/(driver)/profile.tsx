import React, { useEffect } from "react"
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native"
import { useRouter } from "expo-router"
import { useQuery } from "@tanstack/react-query"
import { Controller, useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as Haptics from "expo-haptics"
import Constants from "expo-constants"
import {
  Bike,
  ChevronRight,
  Clock,
  LogOut,
  Save,
} from "lucide-react-native"
import {
  driverProfileSchema,
  palette,
  type DriverProfileInput,
  type VehicleType,
} from "@platelink/shared"
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

const VEHICLE_OPTIONS: { label: string; value: VehicleType }[] = [
  { label: "Bike", value: "bike" },
  { label: "Scooter", value: "scooter" },
  { label: "Car", value: "car" },
  { label: "Van", value: "van" },
  { label: "Other", value: "other" },
]

const THEME_OPTIONS: { label: string; value: "system" | "light" | "dark" }[] = [
  { label: "System", value: "system" },
  { label: "Light", value: "light" },
  { label: "Dark", value: "dark" },
]

export default function DriverProfileScreen() {
  const router = useRouter()
  const { user, profile, refreshProfile, signOut } = useSession()
  const { theme, preference, setMode } = useTheme()

  // 1. Fetch driver-specific row from public.drivers
  const {
    data: driverRecord,
    refetch: refetchDriver,
  } = useQuery({
    queryKey: ["driver_row", user?.id],
    queryFn: async () => {
      if (!user?.id) return null
      const { data, error } = await supabase
        .from("drivers")
        .select("id, vehicle_type, vehicle_number, is_online")
        .eq("id", user.id)
        .maybeSingle()

      if (error) {
        console.warn("[driver-profile] Failed to load driver row:", error.message)
        return null
      }
      return data
    },
    enabled: !!user?.id,
  })

  // 2. Setup react-hook-form with zod schema
  const {
    control,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<DriverProfileInput>({
    resolver: zodResolver(driverProfileSchema),
    defaultValues: {
      name: profile?.name ?? "",
      phone: profile?.phone ?? "",
      vehicle_type: (driverRecord?.vehicle_type as VehicleType) ?? "bike",
      vehicle_number: driverRecord?.vehicle_number ?? "",
    },
  })

  // Update default values when profile or driver row finishes loading
  useEffect(() => {
    if (!isDirty && (profile || driverRecord)) {
      reset({
        name: profile?.name ?? "",
        phone: profile?.phone ?? "",
        vehicle_type: (driverRecord?.vehicle_type as VehicleType) ?? "bike",
        vehicle_number: driverRecord?.vehicle_number ?? "",
      })
    }
  }, [profile, driverRecord, isDirty, reset])

  // 3. Save profile handler
  const onSubmit = async (values: DriverProfileInput) => {
    if (!user?.id) return

    try {
      // Update public.users (allowed columns: name, phone)
      const { error: userError } = await supabase
        .from("users")
        .update({
          name: values.name.trim(),
          phone: values.phone.trim() || null,
        })
        .eq("id", user.id)

      if (userError) throw userError

      // Update public.drivers (allowed columns: vehicle_type, vehicle_number)
      const { error: driverError } = await supabase
        .from("drivers")
        .update({
          vehicle_type: values.vehicle_type,
          vehicle_number: values.vehicle_number?.trim() || null,
        })
        .eq("id", user.id)

      if (driverError) throw driverError

      try {
        await Haptics.notificationAsync(
          Haptics.NotificationFeedbackType.Success
        )
      } catch {}

      await refreshProfile()
      await refetchDriver()
      Alert.alert(
        "Profile saved",
        "Your contact details and vehicle information have been updated."
      )
    } catch (err: any) {
      console.warn("[driver-profile] Save error:", err)
      Alert.alert(
        "Unable to save profile",
        err?.message ?? "An error occurred while saving your details."
      )
    }
  }

  const initial = (profile?.name ? profile.name.trim().charAt(0) : "D").toUpperCase()
  const appVersion = Constants.expoConfig?.version ?? "1.0.0"

  return (
    <View style={[styles.root, { backgroundColor: theme.colors.canvas }]}>
      {/* Structural Gunmetal Chrome Header */}
      <ChromeHeader
        title="Profile"
        subtitle={profile?.name ?? "Volunteer driver"}
        rightAction={
          <PressButton
            variant="ghost"
            size="sm"
            onPress={signOut}
            leftIcon={<LogOut size={16} color={theme.colors.chromeInk} />}
            accessibilityLabel="Sign out of account"
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
          showsVerticalScrollIndicator={false}
        >
          {/* Avatar & Driver Identity Card */}
          <Card style={styles.card}>
            <View style={styles.identityRow}>
              <View
                style={[
                  styles.avatarCircle,
                  {
                    backgroundColor: palette.almondSilk,
                    borderColor: palette.honeyBronze,
                  },
                ]}
              >
                <Text
                  variant="h1"
                  style={[styles.avatarInitial, { color: palette.gunmetal }]}
                >
                  {initial}
                </Text>
              </View>

              <View style={styles.identityTextCol}>
                <Text variant="h2" numberOfLines={1}>
                  {profile?.name || "Volunteer driver"}
                </Text>
                <Text variant="caption" muted numberOfLines={1} style={{ marginTop: 2 }}>
                  {user?.email ?? "Driver account"}
                </Text>
                <View style={styles.rolePillRow}>
                  <View
                    style={[
                      styles.rolePill,
                      {
                        backgroundColor: "rgba(244, 184, 96, 0.2)",
                        borderColor: palette.honeyBronze,
                      },
                    ]}
                  >
                    <Bike size={12} color={palette.honeyBronze} />
                    <Text
                      variant="caption"
                      weight="bold"
                      style={[styles.rolePillText, { color: palette.honeyBronze }]}
                    >
                      Volunteer driver
                    </Text>
                  </View>
                </View>
              </View>
            </View>
          </Card>

          {/* Delivery History Navigation Card */}
          <Pressable
            onPress={() => router.push("/(driver)/history" as any)}
            style={({ pressed }) => [
              styles.navCard,
              {
                backgroundColor: pressed
                  ? theme.colors.surfaceSunken
                  : theme.colors.surface,
                borderColor: theme.colors.border,
              },
            ]}
            accessibilityRole="button"
            accessibilityLabel="View completed delivery missions"
          >
            <View
              style={[
                styles.navIconCircle,
                { backgroundColor: "rgba(244, 184, 96, 0.2)" },
              ]}
            >
              <Clock size={20} color={palette.honeyBronze} />
            </View>
            <View style={styles.navTextCol}>
              <Text variant="body" weight="semibold">
                Delivery history
              </Text>
              <Text variant="caption" muted style={{ marginTop: 2 }}>
                View completed food rescue missions & stats
              </Text>
            </View>
            <ChevronRight size={20} color={theme.colors.inkMuted} />
          </Pressable>

          {/* Driver & Vehicle Details Form */}
          <Card style={styles.card}>
            <Text variant="h3" style={styles.sectionHeader}>
              Driver information
            </Text>

            {/* Full Name */}
            <View style={styles.fieldGroup}>
              <Text variant="caption" weight="medium" style={styles.fieldLabel}>
                Full name
              </Text>
              <Controller
                control={control}
                name="name"
                render={({ field: { onChange, onBlur, value } }) => (
                  <WellInput
                    value={value}
                    onChangeText={onChange}
                    onBlur={onBlur}
                    placeholder="e.g. Alex Morgan"
                    error={errors.name?.message}
                    accessibilityLabel="Driver full name"
                  />
                )}
              />
            </View>

            {/* Phone Number */}
            <View style={styles.fieldGroup}>
              <Text variant="caption" weight="medium" style={styles.fieldLabel}>
                Phone number
              </Text>
              <Controller
                control={control}
                name="phone"
                render={({ field: { onChange, onBlur, value } }) => (
                  <WellInput
                    value={value}
                    onChangeText={onChange}
                    onBlur={onBlur}
                    placeholder="+91 98765 43210"
                    keyboardType="phone-pad"
                    error={errors.phone?.message}
                    accessibilityLabel="Driver phone number"
                  />
                )}
              />
              <Text variant="caption" muted style={styles.fieldHint}>
                Canteens and recipients may call during active delivery.
              </Text>
            </View>

            <View
              style={[styles.divider, { backgroundColor: theme.colors.border }]}
            />

            <Text variant="h3" style={styles.sectionHeader}>
              Vehicle details
            </Text>

            {/* Vehicle Type ChipGroup */}
            <View style={styles.fieldGroup}>
              <Text variant="caption" weight="medium" style={styles.fieldLabel}>
                Vehicle type
              </Text>
              <Controller
                control={control}
                name="vehicle_type"
                render={({ field: { onChange, value } }) => (
                  <ChipGroup<VehicleType>
                    options={VEHICLE_OPTIONS}
                    value={value}
                    onChange={onChange}
                  />
                )}
              />
            </View>

            {/* Vehicle Number */}
            <View style={styles.fieldGroup}>
              <Text variant="caption" weight="medium" style={styles.fieldLabel}>
                Vehicle registration number
              </Text>
              <Controller
                control={control}
                name="vehicle_number"
                render={({ field: { onChange, onBlur, value } }) => (
                  <WellInput
                    value={value ?? ""}
                    onChangeText={onChange}
                    onBlur={onBlur}
                    placeholder="e.g. DL 01 AB 1234"
                    autoCapitalize="characters"
                    error={errors.vehicle_number?.message}
                    accessibilityLabel="Vehicle registration number"
                  />
                )}
              />
            </View>

            {/* Save Button */}
            <PressButton
              variant="default"
              size="md"
              fullWidth
              onPress={() => void handleSubmit(onSubmit)()}
              loading={isSubmitting}
              disabled={!isDirty || isSubmitting}
              leftIcon={<Save size={18} color={palette.almondSilk} />}
              style={styles.saveButton}
              accessibilityLabel="Save profile changes"
            >
              Save details
            </PressButton>
          </Card>

          {/* Theme Row */}
          <Card style={styles.card}>
            <Text variant="h3" style={styles.sectionHeader}>
              Appearance
            </Text>
            <Text variant="small" muted style={{ marginBottom: 12 }}>
              Choose your preferred visual theme for the app.
            </Text>

            <ChipGroup<"system" | "light" | "dark">
              options={THEME_OPTIONS}
              value={preference}
              onChange={(val) => {
                try {
                  Haptics.selectionAsync().catch(() => {})
                } catch {}
                setMode(val)
              }}
            />
          </Card>

          {/* Sign Out Card */}
          <Card style={styles.card}>
            <Text variant="h3" style={styles.sectionHeader}>
              Account
            </Text>
            <Text variant="small" muted style={{ marginBottom: 16 }}>
              Signing out will stop active background location sharing.
            </Text>

            <PressButton
              variant="outline"
              size="md"
              fullWidth
              onPress={signOut}
              leftIcon={<LogOut size={18} color={theme.colors.ink} />}
              accessibilityLabel="Sign out of driver account"
            >
              Sign out
            </PressButton>
          </Card>

          {/* App Version Footer */}
          <View style={styles.footer}>
            <Text variant="caption" muted style={styles.footerText}>
              Plate-Link v{appVersion}
            </Text>
            <Text variant="caption" muted style={styles.footerSubText}>
              Real-time food surplus redistribution
            </Text>
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
    padding: 16,
    gap: 14,
  },
  card: {
    padding: 16,
    borderRadius: 16,
  },
  identityRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  avatarCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 16,
  },
  avatarInitial: {
    fontSize: 28,
    lineHeight: 32,
  },
  identityTextCol: {
    flex: 1,
  },
  rolePillRow: {
    flexDirection: "row",
    marginTop: 6,
  },
  rolePill: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    borderWidth: 1,
    gap: 5,
  },
  rolePillText: {
    fontSize: 11,
  },
  navCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    gap: 12,
  },
  navIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  navTextCol: {
    flex: 1,
  },
  sectionHeader: {
    marginBottom: 12,
  },
  fieldGroup: {
    marginBottom: 14,
  },
  fieldLabel: {
    marginBottom: 6,
    fontSize: 12,
  },
  fieldHint: {
    marginTop: 4,
    fontSize: 11,
  },
  divider: {
    height: 1,
    marginVertical: 14,
  },
  saveButton: {
    marginTop: 8,
  },
  footer: {
    alignItems: "center",
    paddingVertical: 16,
    gap: 4,
  },
  footerText: {
    fontSize: 12,
    fontWeight: "600",
  },
  footerSubText: {
    fontSize: 11,
  },
})
