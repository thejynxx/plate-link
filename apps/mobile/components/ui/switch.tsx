import React, { useEffect } from "react"
import {
  Pressable,
  StyleSheet,
  type StyleProp,
  type ViewStyle,
} from "react-native"
import Animated, {
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated"
import * as Haptics from "expo-haptics"
import { useTheme } from "@/theme"

export interface SwitchProps {
  value: boolean
  onValueChange: (value: boolean) => void
  disabled?: boolean
  accessibilityLabel?: string
  style?: StyleProp<ViewStyle>
}

const TRACK_WIDTH = 52
const TRACK_HEIGHT = 30
const KNOB_SIZE = 24
const PADDING = 3
const TRAVEL_DISTANCE = TRACK_WIDTH - KNOB_SIZE - PADDING * 2 // 52 - 24 - 6 = 22

export function Switch({
  value,
  onValueChange,
  disabled = false,
  accessibilityLabel = "Toggle switch",
  style,
}: SwitchProps) {
  const { theme, isDark } = useTheme()
  const progress = useSharedValue(value ? 1 : 0)

  useEffect(() => {
    progress.value = withTiming(value ? 1 : 0, { duration: 180 })
  }, [value, progress])

  const handlePress = () => {
    if (disabled) return
    try {
      Haptics.selectionAsync().catch(() => {})
    } catch {}
    onValueChange(!value)
  }

  const offColor = isDark ? theme.colors.borderStrong : "#D9C3BA"
  const onColor = theme.colors.accent

  const animatedTrackStyle = useAnimatedStyle(() => {
    const backgroundColor = interpolateColor(
      progress.value,
      [0, 1],
      [offColor, onColor]
    )
    return { backgroundColor }
  })

  const animatedKnobStyle = useAnimatedStyle(() => {
    const translateX = progress.value * TRAVEL_DISTANCE
    return {
      transform: [{ translateX }],
    }
  })

  return (
    <Pressable
      onPress={handlePress}
      disabled={disabled}
      accessibilityRole="switch"
      accessibilityState={{ checked: value, disabled }}
      accessibilityLabel={accessibilityLabel}
      style={[styles.touchTarget, disabled && styles.disabled, style]}
    >
      <Animated.View
        style={[
          styles.track,
          {
            borderRadius: theme.radii.pill,
          },
          animatedTrackStyle,
        ]}
      >
        <Animated.View
          style={[
            styles.knob,
            {
              backgroundColor: theme.colors.surface,
              borderRadius: KNOB_SIZE / 2,
            },
            animatedKnobStyle,
          ]}
        />
      </Animated.View>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  touchTarget: {
    minWidth: 44,
    minHeight: 44, // Minimum 44px accessible touch target
    justifyContent: "center",
    alignItems: "center",
    padding: 6,
  },
  track: {
    width: TRACK_WIDTH,
    height: TRACK_HEIGHT,
    padding: PADDING,
    justifyContent: "center",
  },
  knob: {
    width: KNOB_SIZE,
    height: KNOB_SIZE,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 2.5,
    elevation: 2,
  },
  disabled: {
    opacity: 0.5,
  },
})
