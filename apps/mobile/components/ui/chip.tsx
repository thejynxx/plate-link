import React from "react"
import {
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

export interface ChipProps {
  label: string
  selected?: boolean
  disabled?: boolean
  icon?: React.ReactNode
  onPress?: (event: GestureResponderEvent) => void
  style?: StyleProp<ViewStyle>
  accessibilityLabel?: string
}

export function Chip({
  label,
  selected = false,
  disabled = false,
  icon,
  onPress,
  style,
  accessibilityLabel,
}: ChipProps) {
  const { theme, isDark } = useTheme()
  const translateY = useSharedValue(0)

  const edgeDepth = 3

  const handlePressIn = () => {
    if (disabled) return
    try {
      Haptics.selectionAsync().catch(() => {})
    } catch {}
    translateY.value = withTiming(2, { duration: 40 })
  }

  const handlePressOut = () => {
    if (disabled) return
    translateY.value = withTiming(0, { duration: 80 })
  }

  const animatedFaceStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }))

  const faceColor = selected ? theme.colors.accent : theme.colors.surface
  const textColor = selected ? theme.palette.gunmetal : theme.colors.ink
  const borderColor = selected
    ? isDark
      ? theme.colors.accentEdge
      : theme.palette.gunmetal
    : theme.colors.borderStrong
  const edgeColor = selected
    ? isDark
      ? theme.colors.accentEdge
      : theme.palette.gunmetal
    : theme.colors.borderStrong

  return (
    <Pressable
      onPress={!disabled ? onPress : undefined}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      disabled={disabled}
      accessibilityRole="radio"
      accessibilityState={{ checked: selected, disabled }}
      accessibilityLabel={accessibilityLabel ?? label}
      style={[styles.pressableRoot, disabled && styles.disabled, style]}
    >
      <View style={styles.container}>
        {/* 3px bottom edge */}
        <View
          style={[
            styles.edge,
            {
              backgroundColor: edgeColor,
              borderRadius: theme.radii.pill,
              top: edgeDepth,
              bottom: 0,
              left: 0,
              right: 0,
            },
          ]}
        />

        {/* Tactile Chip Face */}
        <Animated.View
          style={[
            styles.face,
            {
              backgroundColor: faceColor,
              borderColor,
              borderRadius: theme.radii.pill,
              marginBottom: edgeDepth,
            },
            animatedFaceStyle,
          ]}
        >
          {icon && <View style={styles.icon}>{icon}</View>}
          <Text
            style={[
              styles.labelText,
              {
                color: textColor,
                fontFamily: selected
                  ? theme.fonts.bodySemiBold
                  : theme.fonts.bodyMedium,
                fontSize: theme.typeScale.sm,
              },
            ]}
          >
            {label}
          </Text>
        </Animated.View>
      </View>
    </Pressable>
  )
}

export interface ChipOption<T = string> {
  label: string
  value: T
  icon?: React.ReactNode
}

export interface ChipGroupProps<T = string> {
  options: ChipOption<T>[]
  value: T
  onChange: (val: T) => void
  disabled?: boolean
  style?: StyleProp<ViewStyle>
}

export function ChipGroup<T extends string = string>({
  options,
  value,
  onChange,
  disabled = false,
  style,
}: ChipGroupProps<T>) {
  return (
    <View
      accessibilityRole="radiogroup"
      style={[styles.groupContainer, style]}
    >
      {options.map((option) => (
        <Chip
          key={String(option.value)}
          label={option.label}
          icon={option.icon}
          selected={value === option.value}
          disabled={disabled}
          onPress={() => onChange(option.value)}
        />
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  pressableRoot: {
    minHeight: 44,
  },
  container: {
    position: "relative",
  },
  edge: {
    position: "absolute",
  },
  face: {
    height: 42,
    minHeight: 42,
    borderWidth: 2,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  icon: {
    marginRight: 6,
  },
  labelText: {
    letterSpacing: -0.1,
  },
  disabled: {
    opacity: 0.5,
  },
  groupContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    alignItems: "center",
  },
})
