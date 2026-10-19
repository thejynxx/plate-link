import React, { useState } from "react"
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  View,
} from "react-native"
import { useRouter } from "expo-router"
import { Controller, useForm, useWatch } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { registerSchema, type RegisterInput, type UserRole } from "@platelink/shared"
import {
  ChipGroup,
  FloatingLabelInput,
  PressButton,
  Text,
} from "@/components/ui"
import { supabase } from "@/lib/supabase"
import { useTheme } from "@/theme"

const MOBILE_ROLE_OPTIONS: { label: string; value: UserRole }[] = [
  { label: "Driver", value: "driver" },
  { label: "NGO / recipient", value: "user" },
  { label: "Canteen", value: "canteen" },
]

export default function RegisterScreen() {
  const router = useRouter()
  const { theme } = useTheme()
  const [authError, setAuthError] = useState<string | null>(null)
  const [confirmMessage, setConfirmMessage] = useState<string | null>(null)

  const {
    control,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<RegisterInput>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      role: "driver",
      name: "",
      phone: "",
      email: "",
      password: "",
    },
  })

  // Rule 9: Use useWatch, not watch()
  const role = useWatch({ control, name: "role" })

  const nameLabel =
    role === "user"
      ? "Organisation name"
      : role === "canteen"
        ? "Your name"
        : "Full name"

  const onSubmit = async ({ email, password, role: selectedRole, name, phone }: RegisterInput) => {
    setAuthError(null)
    setConfirmMessage(null)

    try {
      // Pass role and profile details in options.data mirroring the web register form
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            role: selectedRole,
            name,
            phone,
          },
        },
      })

      if (error) {
        if (error.message.includes("User already registered")) {
          setAuthError("An account with this email already exists. Please sign in.")
        } else if (error.message.includes("fetch") || error.message.includes("network")) {
          setAuthError("Cannot reach the server. Please check your connection.")
        } else {
          setAuthError(error.message)
        }
        return
      }

      // If email confirmation is enabled on Supabase, session is null initially
      if (!data.session) {
        setConfirmMessage(
          "Account created! Please check your email inbox to verify your account, then sign in."
        )
        return
      }

      // Root auth gate in _layout.tsx will route automatically based on public.users.role!
    } catch (err: any) {
      setAuthError(err?.message ?? "An error occurred during account creation.")
    }
  }

  return (
    <KeyboardAvoidingView
      style={[styles.root, { backgroundColor: theme.colors.canvas }]}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Text
            variant="display"
            style={[styles.brandTitle, { color: theme.palette.gunmetal }]}
          >
            Plate-Link
          </Text>
          <Text variant="h2" style={styles.screenTitle}>
            Create account
          </Text>
          <Text variant="body" muted style={styles.subtitle}>
            Join as a delivery driver or recipient organisation.
          </Text>
        </View>

        {authError ? (
          <View
            style={[
              styles.errorBanner,
              {
                backgroundColor: "rgba(200, 62, 77, 0.1)",
                borderColor: theme.colors.danger,
              },
            ]}
          >
            <Text
              variant="small"
              weight="medium"
              style={{ color: theme.colors.danger }}
            >
              {authError}
            </Text>
          </View>
        ) : null}

        {confirmMessage ? (
          <View
            style={[
              styles.confirmBanner,
              {
                backgroundColor: "rgba(244, 184, 96, 0.15)",
                borderColor: theme.colors.accent,
              },
            ]}
          >
            <Text
              variant="body"
              weight="medium"
              style={{ color: theme.colors.ink }}
            >
              {confirmMessage}
            </Text>
            <PressButton
              variant="default"
              size="sm"
              onPress={() => router.replace("/(auth)/login")}
              style={{ marginTop: 12 }}
            >
              Go to sign in
            </PressButton>
          </View>
        ) : null}

        <View style={styles.form}>
          {/* Role Picker (Driver or Recipient) */}
          <View style={styles.rolePickerSection}>
            <Text variant="small" weight="semibold" style={styles.rolePickerLabel}>
              Account type
            </Text>
            <ChipGroup
              options={MOBILE_ROLE_OPTIONS}
              value={role}
              onChange={(newRole) => setValue("role", newRole, { shouldValidate: true })}
            />
          </View>

          <Controller
            control={control}
            name="name"
            render={({ field: { onChange, onBlur, value } }) => (
              <FloatingLabelInput
                label={nameLabel}
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                autoCapitalize="words"
                error={errors.name?.message}
              />
            )}
          />

          <Controller
            control={control}
            name="phone"
            render={({ field: { onChange, onBlur, value } }) => (
              <FloatingLabelInput
                label="Phone number"
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                keyboardType="phone-pad"
                error={errors.phone?.message}
              />
            )}
          />

          <Controller
            control={control}
            name="email"
            render={({ field: { onChange, onBlur, value } }) => (
              <FloatingLabelInput
                label="Email address"
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                error={errors.email?.message}
              />
            )}
          />

          <Controller
            control={control}
            name="password"
            render={({ field: { onChange, onBlur, value } }) => (
              <FloatingLabelInput
                label="Password (min 8 characters)"
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                secureTextEntry
                autoCapitalize="none"
                error={errors.password?.message}
              />
            )}
          />

          <PressButton
            variant="default"
            size="lg"
            fullWidth
            loading={isSubmitting}
            onPress={() => handleSubmit(onSubmit)()}
            style={styles.submitButton}
          >
            Create account
          </PressButton>

          <View style={styles.switchRow}>
            <Text variant="body" muted>
              Already registered?
            </Text>
            <PressButton
              variant="ghost"
              size="sm"
              onPress={() => router.push("/(auth)/login")}
            >
              Sign in
            </PressButton>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 54,
    paddingBottom: 40,
    justifyContent: "center",
  },
  header: {
    marginBottom: 24,
  },
  brandTitle: {
    marginBottom: 8,
  },
  screenTitle: {
    marginBottom: 6,
  },
  subtitle: {
    lineHeight: 22,
  },
  errorBanner: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    marginBottom: 20,
  },
  confirmBanner: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },
  form: {
    gap: 18,
  },
  rolePickerSection: {
    marginBottom: 4,
  },
  rolePickerLabel: {
    marginBottom: 8,
  },
  submitButton: {
    marginTop: 6,
  },
  switchRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 12,
  },
})
