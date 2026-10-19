import React, { useState } from "react"
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  View,
} from "react-native"
import { useRouter } from "expo-router"
import { Controller, useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { loginSchema, type LoginInput } from "@platelink/shared"
import {
  FloatingLabelInput,
  PressButton,
  Text,
} from "@/components/ui"
import { supabase } from "@/lib/supabase"
import { useTheme } from "@/theme"

export default function LoginScreen() {
  const router = useRouter()
  const { theme } = useTheme()
  const [authError, setAuthError] = useState<string | null>(null)

  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  })

  const onSubmit = async ({ email, password }: LoginInput) => {
    setAuthError(null)
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (error) {
        if (error.message.includes("Invalid login credentials")) {
          setAuthError("Incorrect email or password. Please try again.")
        } else if (error.message.includes("fetch") || error.message.includes("network")) {
          setAuthError("Cannot reach the server. Please check your connection.")
        } else {
          setAuthError(error.message)
        }
        return
      }

      // Root auth gate in _layout.tsx will automatically route based on public.users.role!
    } catch (err: any) {
      setAuthError(err?.message ?? "An unexpected error occurred during sign in.")
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
            Sign in
          </Text>
          <Text variant="body" muted style={styles.subtitle}>
            Redistribute surplus food to communities in need.
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

        <View style={styles.form}>
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
                label="Password"
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
            Sign in
          </PressButton>

          <View style={styles.switchRow}>
            <Text variant="body" muted>
              Need an account?
            </Text>
            <PressButton
              variant="ghost"
              size="sm"
              onPress={() => router.push("/(auth)/register")}
            >
              Create account
            </PressButton>
          </View>
        </View>

        {__DEV__ ? (
          <View style={styles.devFooter}>
            <PressButton
              variant="ghost"
              size="sm"
              onPress={() => router.push("/dev/design")}
            >
              Dev: Design system showcase
            </PressButton>
          </View>
        ) : null}
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
    paddingTop: 64,
    paddingBottom: 36,
    justifyContent: "center",
  },
  header: {
    marginBottom: 28,
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
  form: {
    gap: 18,
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
  devFooter: {
    marginTop: 32,
    alignItems: "center",
  },
})
