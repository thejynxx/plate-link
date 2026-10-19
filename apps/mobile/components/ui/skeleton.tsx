import React, { useEffect, useState } from "react"
import {
  AccessibilityInfo,
  StyleSheet,
  type DimensionValue,
  type StyleProp,
  type ViewStyle,
} from "react-native"
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated"
import { useTheme } from "@/theme"

export interface SkeletonProps {
  width?: DimensionValue
  height?: DimensionValue
  borderRadius?: number
  style?: StyleProp<ViewStyle>
}

export function Skeleton({
  width = "100%",
  height = 16,
  borderRadius,
  style,
}: SkeletonProps) {
  const { theme } = useTheme()
  const [reduceMotion, setReduceMotion] = useState(false)
  const opacity = useSharedValue(0.45)

  useEffect(() => {
    let isMounted = true

    // Check initial reduce-motion setting
    AccessibilityInfo.isReduceMotionEnabled()
      .then((enabled) => {
        if (isMounted) setReduceMotion(enabled)
      })
      .catch(() => {})

    // Listen for changes
    const subscription = AccessibilityInfo.addEventListener(
      "reduceMotionChanged",
      (enabled) => {
        if (isMounted) setReduceMotion(enabled)
      }
    )

    return () => {
      isMounted = false
      subscription.remove()
    }
  }, [])

  useEffect(() => {
    if (reduceMotion) {
      cancelAnimation(opacity)
      opacity.value = 0.6
    } else {
      opacity.value = withRepeat(
        withSequence(
          withTiming(0.85, { duration: 750 }),
          withTiming(0.4, { duration: 750 })
        ),
        -1,
        true
      )
    }
    return () => {
      cancelAnimation(opacity)
    }
  }, [reduceMotion, opacity])

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }))

  return (
    <Animated.View
      accessibilityRole="progressbar"
      accessibilityLabel="Loading content"
      style={[
        styles.skeleton,
        {
          width,
          height,
          backgroundColor: theme.colors.surfaceSunken,
          borderRadius: borderRadius ?? theme.radii.sm,
        },
        animatedStyle,
        style,
      ]}
    />
  )
}

const styles = StyleSheet.create({
  skeleton: {
    overflow: "hidden",
  },
})
