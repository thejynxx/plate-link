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
import { Heart, LogOut, Save } from "lucide-react-native"
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

const recipientProfileSchema = z.object({
  name: z.string().trim().min(2, "Name is too short").max(120),
  phone: phoneSchema,
})

type RecipientProfileInput = z.infer<typeof recipientProfileSchema>

const THEME_OPTIONS: { label: string; value: "system" | "light" | "dark" }[] = [
  { label: "System", value: "system" },
  { label: "Light", value: "light" },
  { label: "Dark", value: "dark" },
]

export default function RecipientProfileScreen() {
  const { user, profile, refreshProfile, signOut } = useSession()
  const { theme, preference, setMode } = useTheme()

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<RecipientProfileInput>({
    resolver: zodResolver(recipientProfileSchema),
    defaultValues: {
      name: profile?.name ?? "",
      phone: profile?.phone ?? "",
    },
  })

  useEffect(() => {
    if (!isDirty && profile) {
      reset({
        name: profile.name ?? "",
        phone: profile.phone ?? "",
      })
    }
  }, [profile, isDirty, reset])

  const onSubmit = async (values: RecipientProfileInput) => {
    if (!user?.id) return

    try {
      const { error } = await supabase
        .from("users")
        .update({
          name: values.name.trim(),
          phone: values.phone.trim() || null,
        })
        .eq("id", user.id)

      if (error) throw error

      try {
        await Haptics.notificationAsync(
          Haptics.NotificationFeedbackType.Success
        )
      } catch {}

      await refreshProfile()
      Alert.alert("Profile saved", "Your contact details have been updated.")
    } catch (err: any) {
      console.warn("[recipient-profile] Save error:", err)
      Alert.alert(
        "Unable to save profile",
        err?.message ?? "An error occurred while saving your details."
      )
    }
  }

  const initial = (profile?.name ? profile.name.trim().charAt(0) : "N").toUpperCase()
  const appVersion = Constants.expoConfig?.version ?? "1.0.0"

  return (
    <View style={[styles.root, { backgroundColor: theme.colors.canvas }]}>
      <ChromeHeader
        title="Profile"
        subtitle={profile?.name ?? "Recipient NGO"}
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
          {/* Identity Card */}
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
                  {profile?.name || "Recipient NGO"}
                </Text>
                <Text
                  variant="caption"
                  muted
                  numberOfLines={1}
                  style={{ marginTop: 2 }}
                >
                  {user?.email ?? "NGO account"}
                </Text>
                <View style={styles.rolePillRow}>
                  <View
                    style={[
                      styles.rolePill,
                      {
                        backgroundColor: "rgba(200, 62, 77, 0.15)",
                        borderColor: palette.blushedBrick,
                      },
                    ]}
                  >
                    <Heart size={12} color={palette.blushedBrick} />
                    <Text
                      variant="caption"
                      weight="bold"
                      style={[styles.rolePillText, { color: palette.blushedBrick }]}
                    >
                      Food recipient
                    </Text>
                  </View>
                </View>
              </View>
            </View>
          </Card>

          {/* Contact Details Form */}
          <Card style={styles.card}>
            <Text variant="h3" style={styles.sectionHeader}>
              Organization contact details
            </Text>

            {/* Name */}
            <View style={styles.fieldGroup}>
              <Text variant="caption" weight="medium" style={styles.fieldLabel}>
                Organization or contact name
              </Text>
              <Controller
                control={control}
                name="name"
                render={({ field: { onChange, onBlur, value } }) => (
                  <WellInput
                    value={value}
                    onChangeText={onChange}
                    onBlur={onBlur}
                    placeholder="e.g. Community Shelter"
                    error={errors.name?.message}
                    accessibilityLabel="Organization name"
                  />
                )}
              />
            </View>

            {/* Phone */}
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
                    accessibilityLabel="Contact phone number"
                  />
                )}
              />
              <Text variant="caption" muted style={styles.fieldHint}>
                Canteens and volunteer drivers contact you at this number for deliveries.
              </Text>
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
              Sign out of your recipient account on this device.
            </Text>

            <PressButton
              variant="outline"
              size="md"
              fullWidth
              onPress={signOut}
              leftIcon={<LogOut size={18} color={theme.colors.ink} />}
              accessibilityLabel="Sign out of recipient account"
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
