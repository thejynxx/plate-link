import React from "react"
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  View,
  type GestureResponderEvent,
  type StyleProp,
  type ViewStyle,
} from "react-native"
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated"
import * as Haptics from "expo-haptics"
import { useTheme } from "@/theme"
import { Text } from "./text"

export type PressButtonVariant =
  | "default"
  | "accent"
  | "dark"
  | "outline"
  | "ghost"

export type PressButtonSize = "sm" | "md" | "lg"

export interface PressButtonProps {
  variant?: PressButtonVariant
  size?: PressButtonSize
  disabled?: boolean
  loading?: boolean
  fullWidth?: boolean
  leftIcon?: React.ReactNode
  rightIcon?: React.ReactNode
  onPress?: (event: GestureResponderEvent) => void
  onPressIn?: (event: GestureResponderEvent) => void
  onPressOut?: (event: GestureResponderEvent) => void
  accessibilityLabel?: string
  accessibilityHint?: string
  style?: StyleProp<ViewStyle>
  children: React.ReactNode
}

export function PressButton({
  variant = "default",
  size = "md",
  disabled = false,
  loading = false,
  fullWidth = false,
  leftIcon,
  rightIcon,
  onPress,
  onPressIn,
  onPressOut,
  accessibilityLabel,
  accessibilityHint,
  style,
  children,
}: PressButtonProps) {
  const { theme, isDark } = useTheme()
  const translateY = useSharedValue(0)

  const isInteractive = !disabled && !loading
  const hasEdge = variant !== "ghost"
  const depth = hasEdge ? theme.pressDepth : 0

  const animatedFaceStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }))

  const handlePressIn = (event: GestureResponderEvent) => {
    if (!isInteractive) return
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {})
    } catch {}
    translateY.value = withTiming(depth, { duration: 40 })
    onPressIn?.(event)
  }

  const handlePressOut = (event: GestureResponderEvent) => {
    if (!isInteractive) return
    translateY.value = withTiming(0, { duration: 80 })
    onPressOut?.(event)
  }

  const colors = getButtonColors(variant, theme, isDark)
  const sizeStyles = getSizeConfig(size, theme)

  return (
    <Pressable
      onPress={isInteractive ? onPress : undefined}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      disabled={!isInteractive}
      accessibilityRole="button"
      accessibilityState={{ disabled: !isInteractive, busy: loading }}
      accessibilityLabel={
        accessibilityLabel ?? (typeof children === "string" ? children : undefined)
      }
      accessibilityHint={accessibilityHint}
      style={[
        styles.outer,
        fullWidth && styles.fullWidth,
        disabled && styles.disabled,
        style,
      ]}
    >
      <View
        style={[
          styles.container,
          fullWidth && styles.fullWidth,
        ]}
      >
        {/* Darker bottom edge */}
        {hasEdge && (
          <View
            style={[
              styles.edge,
              {
                top: depth,
                bottom: 0,
                left: 0,
                right: 0,
                backgroundColor: colors.edge,
                borderRadius: theme.radii.md,
              },
              variant === "outline" && {
                borderWidth: 2,
                borderColor: theme.colors.borderStrong,
              },
            ]}
          />
        )}

        {/* Tactile Face - In normal flow so container shrink-wraps to its width */}
        <Animated.View
          style={[
            styles.face,
            {
              minHeight: sizeStyles.height,
              backgroundColor: colors.face,
              borderRadius: theme.radii.md,
              paddingHorizontal: sizeStyles.paddingHorizontal,
              marginBottom: depth,
            },
            colors.border && {
              borderWidth: 2,
              borderColor: colors.border,
            },
            fullWidth && styles.fullWidth,
            animatedFaceStyle,
          ]}
        >
          <View style={styles.contentRow}>
            {loading ? (
              <ActivityIndicator
                size="small"
                color={colors.text}
                style={styles.spinner}
              />
            ) : (
              leftIcon && <View style={styles.iconMarginRight}>{leftIcon}</View>
            )}
            {typeof children === "string" ? (
              <Text
                style={[
                  styles.buttonText,
                  {
                    color: colors.text,
                    fontSize: sizeStyles.fontSize,
                    fontFamily: theme.fonts.displaySemiBold,
                  },
                ]}
              >
                {children}
              </Text>
            ) : (
              children
            )}
            {!loading && rightIcon && (
              <View style={styles.iconMarginLeft}>{rightIcon}</View>
            )}
          </View>
        </Animated.View>
      </View>
    </Pressable>
  )
}

function getButtonColors(
  variant: PressButtonVariant,
  theme: ReturnType<typeof useTheme>["theme"],
  isDark: boolean
) {
  switch (variant) {
    case "default":
      return {
        face: theme.colors.primary,
        edge: theme.colors.primaryEdge,
        text: theme.colors.primaryInk,
        border: undefined,
      }
    case "accent":
      return {
        face: theme.colors.accent,
        edge: theme.colors.accentEdge,
        text: theme.colors.accentInk,
        border: undefined,
      }
    case "dark":
      return {
        face: theme.colors.chrome,
        edge: isDark ? "#0B0D0E" : "#1B1E20",
        text: theme.colors.chromeInk,
        border: undefined,
      }
    case "outline":
      return {
        face: theme.colors.surface,
        edge: theme.colors.borderStrong,
        text: theme.colors.ink,
        border: theme.colors.borderStrong,
      }
    case "ghost":
      return {
        face: "transparent",
        edge: "transparent",
        text: theme.colors.ink,
        border: undefined,
      }
  }
}

function getSizeConfig(
  size: PressButtonSize,
  theme: ReturnType<typeof useTheme>["theme"]
) {
  switch (size) {
    case "sm":
      return {
        height: 44, // Minimum 44px touch target
        paddingHorizontal: 14,
        fontSize: theme.typeScale.sm, // 14
      }
    case "md":
      return {
        height: 48,
        paddingHorizontal: 18,
        fontSize: theme.typeScale.base, // 16
      }
    case "lg":
      return {
        height: 54,
        paddingHorizontal: 24,
        fontSize: theme.typeScale.lg, // 20
      }
  }
}

const styles = StyleSheet.create({
  outer: {
    alignSelf: "flex-start",
  },
  fullWidth: {
    alignSelf: "stretch",
    width: "100%",
  },
  disabled: {
    opacity: 0.5,
  },
  container: {
    position: "relative",
  },
  edge: {
    position: "absolute",
  },
  face: {
    justifyContent: "center",
    alignItems: "center",
  },
  contentRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  buttonText: {
    letterSpacing: -0.2,
  },
  spinner: {
    marginRight: 8,
  },
  iconMarginRight: {
    marginRight: 8,
  },
  iconMarginLeft: {
    marginLeft: 8,
  },
})
