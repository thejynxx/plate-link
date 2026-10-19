import React, { useState } from "react"
import {
  StyleSheet,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type ViewStyle,
} from "react-native"
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated"
import { useTheme } from "@/theme"
import { Text } from "./text"

export interface WellInputProps extends TextInputProps {
  label?: string
  hint?: string
  error?: string
  leftIcon?: React.ReactNode
  rightIcon?: React.ReactNode
  containerStyle?: StyleProp<ViewStyle>
}

export function WellInput({
  label,
  hint,
  error,
  leftIcon,
  rightIcon,
  containerStyle,
  style,
  onFocus,
  onBlur,
  editable = true,
  placeholderTextColor,
  ...rest
}: WellInputProps) {
  const { theme } = useTheme()
  const [isFocused, setIsFocused] = useState(false)
  const translateY = useSharedValue(0)

  const hasError = !!error

  const handleFocus = (e: any) => {
    setIsFocused(true)
    translateY.value = withTiming(-1, { duration: 150 })
    onFocus?.(e)
  }

  const handleBlur = (e: any) => {
    setIsFocused(false)
    translateY.value = withTiming(0, { duration: 150 })
    onBlur?.(e)
  }

  const animatedLiftStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }))

  const borderColor = hasError
    ? theme.colors.danger
    : isFocused
      ? theme.colors.primary
      : theme.colors.borderStrong

  const glowColor = hasError
    ? "rgba(200, 62, 77, 0.25)"
    : isFocused
      ? "rgba(244, 184, 96, 0.45)" // Honey glow ring 45%
      : "transparent"

  return (
    <View style={[styles.root, containerStyle]}>
      {label && (
        <Text variant="small" weight="medium" style={styles.label}>
          {label}
        </Text>
      )}

      {/* Honey Glow Ring Outer View */}
      <View
        style={[
          styles.glowRing,
          {
            backgroundColor: glowColor,
            borderRadius: theme.radii.md + 3,
          },
        ]}
      >
        {/* Animated 1px Lift Input Box */}
        <Animated.View
          style={[
            styles.inputContainer,
            {
              backgroundColor: theme.colors.surface,
              borderColor,
              borderRadius: theme.radii.md,
            },
            !editable && styles.disabled,
            animatedLiftStyle,
          ]}
        >
          {leftIcon && <View style={styles.iconLeft}>{leftIcon}</View>}

          <TextInput
            editable={editable}
            onFocus={handleFocus}
            onBlur={handleBlur}
            placeholderTextColor={placeholderTextColor ?? theme.colors.inkMuted}
            style={[
              styles.input,
              {
                color: theme.colors.ink,
                fontFamily: theme.fonts.bodyRegular,
                fontSize: theme.typeScale.base,
              },
              style,
            ]}
            aria-invalid={hasError}
            accessibilityLabel={label ?? rest.accessibilityLabel}
            {...rest}
          />

          {rightIcon && <View style={styles.iconRight}>{rightIcon}</View>}
        </Animated.View>
      </View>

      {/* Error or Hint Message */}
      {hasError ? (
        <Text
          variant="caption"
          accessibilityRole="alert"
          style={[styles.feedbackText, { color: theme.colors.danger }]}
        >
          {error}
        </Text>
      ) : hint ? (
        <Text
          variant="caption"
          muted
          style={styles.feedbackText}
        >
          {hint}
        </Text>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  root: {
    width: "100%",
  },
  label: {
    marginBottom: 6,
  },
  glowRing: {
    padding: 3,
    transitionProperty: "background-color",
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 2,
    minHeight: 48, // Accessible touch target
    paddingHorizontal: 12,
  },
  input: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 4,
    minHeight: 44,
  },
  iconLeft: {
    marginRight: 8,
    justifyContent: "center",
    alignItems: "center",
  },
  iconRight: {
    marginLeft: 8,
    justifyContent: "center",
    alignItems: "center",
  },
  disabled: {
    opacity: 0.6,
  },
  feedbackText: {
    marginTop: 4,
    marginLeft: 4,
  },
})
