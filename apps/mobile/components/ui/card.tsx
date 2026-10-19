import React from "react"
import {
  Pressable,
  StyleSheet,
  View,
  type GestureResponderEvent,
  type StyleProp,
  type ViewStyle,
} from "react-native"
import { useTheme } from "@/theme"

export interface CardProps {
  children: React.ReactNode
  onPress?: (event: GestureResponderEvent) => void
  disabled?: boolean
  style?: StyleProp<ViewStyle>
  accessibilityLabel?: string
  accessibilityHint?: string
}

export function Card({
  children,
  onPress,
  disabled = false,
  style,
  accessibilityLabel,
  accessibilityHint,
}: CardProps) {
  const { theme } = useTheme()

  const cardStyle: ViewStyle = {
    backgroundColor: theme.colors.surface,
    borderColor: theme.colors.border,
    borderRadius: theme.radii.lg,
  }

  if (onPress) {
    return (
      <Pressable
        onPress={!disabled ? onPress : undefined}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        accessibilityHint={accessibilityHint}
        style={({ pressed }) => [
          styles.base,
          cardStyle,
          pressed && styles.pressed,
          disabled && styles.disabled,
          style,
        ]}
      >
        {children}
      </Pressable>
    )
  }

  return (
    <View
      accessibilityRole="none"
      style={[styles.base, cardStyle, style]}
    >
      {children}
    </View>
  )
}

const styles = StyleSheet.create({
  base: {
    borderWidth: 1,
    padding: 16,
    shadowColor: "#32373B",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  pressed: {
    opacity: 0.92,
    transform: [{ translateY: 1 }],
  },
  disabled: {
    opacity: 0.5,
  },
})
