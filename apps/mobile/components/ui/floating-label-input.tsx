import React, { useEffect, useState } from "react"
import {
  StyleSheet,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type ViewStyle,
} from "react-native"
import Animated, {
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated"
import { useTheme } from "@/theme"
import { Text } from "./text"

export interface FloatingLabelInputProps extends TextInputProps {
  label: string
  hint?: string
  error?: string
  leftIcon?: React.ReactNode
  rightIcon?: React.ReactNode
  containerStyle?: StyleProp<ViewStyle>
}

export function FloatingLabelInput({
  label,
  hint,
  error,
  leftIcon,
  rightIcon,
  containerStyle,
  style,
  value,
  defaultValue,
  onFocus,
  onBlur,
  onChangeText,
  editable = true,
  ...rest
}: FloatingLabelInputProps) {
  const { theme, isDark } = useTheme()
  const [isFocused, setIsFocused] = useState(false)
  const [internalValue, setInternalValue] = useState(value ?? defaultValue ?? "")

  const hasValue = (value !== undefined ? value : internalValue).length > 0
  const isLifted = isFocused || hasValue

  const progress = useSharedValue(isLifted ? 1 : 0)
  const liftValue = useSharedValue(0)

  useEffect(() => {
    progress.value = withTiming(isLifted ? 1 : 0, { duration: 160 })
  }, [isLifted, progress])

  const hasError = !!error

  const handleFocus = (e: any) => {
    setIsFocused(true)
    liftValue.value = withTiming(-1, { duration: 150 })
    onFocus?.(e)
  }

  const handleBlur = (e: any) => {
    setIsFocused(false)
    liftValue.value = withTiming(0, { duration: 150 })
    onBlur?.(e)
  }

  const handleChangeText = (text: string) => {
    if (value === undefined) {
      setInternalValue(text)
    }
    onChangeText?.(text)
  }

  const animatedLiftStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: liftValue.value }],
  }))

  const animatedLabelStyle = useAnimatedStyle(() => {
    const translateY = interpolate(progress.value, [0, 1], [0, -11])
    const scale = interpolate(progress.value, [0, 1], [1, 0.78])
    return {
      transform: [{ translateY }, { scale }],
    }
  })

  const labelColor = hasError
    ? theme.colors.danger
    : isFocused
      ? isDark
        ? theme.colors.accent
        : theme.colors.primary
      : theme.colors.inkMuted

  const borderColor = hasError
    ? theme.colors.danger
    : isFocused
      ? theme.colors.primary
      : theme.colors.borderStrong

  const glowColor = hasError
    ? "rgba(200, 62, 77, 0.25)"
    : isFocused
      ? "rgba(244, 184, 96, 0.45)"
      : "transparent"

  return (
    <View style={[styles.root, containerStyle]}>
      {/* Outer Honey Glow Ring */}
      <View
        style={[
          styles.glowRing,
          {
            backgroundColor: glowColor,
            borderRadius: theme.radii.md + 3,
          },
        ]}
      >
        {/* Well Input Container */}
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

          <View style={styles.fieldWrapper}>
            {/* Animated Floating Label */}
            <Animated.View
              pointerEvents="none"
              style={[styles.floatingLabelContainer, animatedLabelStyle]}
            >
              <Text
                style={[
                  styles.labelStyle,
                  {
                    color: labelColor,
                    fontFamily:
                      isLifted && isFocused
                        ? theme.fonts.bodySemiBold
                        : theme.fonts.bodyRegular,
                  },
                ]}
              >
                {label}
              </Text>
            </Animated.View>

            {/* Input Field */}
            <TextInput
              editable={editable}
              value={value !== undefined ? value : internalValue}
              onChangeText={handleChangeText}
              onFocus={handleFocus}
              onBlur={handleBlur}
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
              accessibilityLabel={label}
              {...rest}
            />
          </View>

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
        <Text variant="caption" muted style={styles.feedbackText}>
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
  glowRing: {
    padding: 3,
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 2,
    minHeight: 56, // Accessible touch target with room for floating label
    paddingHorizontal: 12,
  },
  fieldWrapper: {
    flex: 1,
    justifyContent: "center",
    position: "relative",
    height: 52,
  },
  floatingLabelContainer: {
    position: "absolute",
    left: 4,
    transformOrigin: "left center",
    zIndex: 1,
  },
  labelStyle: {
    fontSize: 15,
  },
  input: {
    flex: 1,
    paddingTop: 18,
    paddingBottom: 4,
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
