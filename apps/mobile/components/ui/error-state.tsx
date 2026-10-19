import React from "react"
import {
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native"
import { AlertTriangle } from "lucide-react-native"
import { useTheme } from "@/theme"
import { PressButton } from "./press-button"
import { Text } from "./text"

export interface ErrorStateProps {
  message?: string
  error?: unknown
  onRetry?: () => void
  style?: StyleProp<ViewStyle>
}

export function ErrorState({
  message,
  error,
  onRetry,
  style,
}: ErrorStateProps) {
  const { theme, isDark } = useTheme()

  const resolvedMessage =
    message ??
    (error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : "Couldn't load information")

  return (
    <View
      accessibilityRole="alert"
      style={[
        styles.container,
        {
          backgroundColor: isDark
            ? "rgba(242, 118, 107, 0.08)"
            : "rgba(179, 38, 30, 0.06)",
          borderColor: isDark
            ? "rgba(242, 118, 107, 0.3)"
            : "rgba(179, 38, 30, 0.25)",
          borderRadius: theme.radii.md,
        },
        style,
      ]}
    >
      <View style={styles.iconWrapper}>
        <AlertTriangle size={24} color={theme.colors.danger} />
      </View>

      <Text
        variant="body"
        weight="medium"
        style={[styles.message, { color: theme.colors.ink }]}
      >
        {resolvedMessage}
      </Text>

      {onRetry ? (
        <View style={styles.retryWrapper}>
          <PressButton variant="outline" size="sm" onPress={onRetry}>
            Try again
          </PressButton>
        </View>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    borderWidth: 1,
    paddingVertical: 24,
    paddingHorizontal: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  iconWrapper: {
    marginBottom: 10,
  },
  message: {
    textAlign: "center",
    maxWidth: 260,
  },
  retryWrapper: {
    marginTop: 14,
  },
})
