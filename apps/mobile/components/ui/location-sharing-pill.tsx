import React, { useEffect } from "react"
import { StyleSheet, View } from "react-native"
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated"
import { palette } from "@platelink/shared"
import { Text } from "./text"

export function LocationSharingPill() {
  const pulseOpacity = useSharedValue(1)

  useEffect(() => {
    pulseOpacity.value = withRepeat(
      withTiming(0.35, { duration: 900 }),
      -1,
      true
    )
  }, [pulseOpacity])

  const dotAnimatedStyle = useAnimatedStyle(() => ({
    opacity: pulseOpacity.value,
  }))

  return (
    <View
      style={styles.pill}
      accessibilityRole="status"
      accessibilityLabel="Location broadcasting active: Sharing location"
    >
      <Animated.View style={[styles.dot, dotAnimatedStyle]} />
      <Text variant="caption" style={styles.label}>
        Sharing location
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    backgroundColor: "rgba(244, 184, 96, 0.16)",
    borderWidth: 1,
    borderColor: "rgba(244, 184, 96, 0.45)",
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: palette.honeyBronze,
  },
  label: {
    color: palette.honeyBronze,
    fontSize: 11,
    lineHeight: 14,
    fontWeight: "600",
    letterSpacing: -0.1,
  },
})
