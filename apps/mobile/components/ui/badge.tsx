import React, { useEffect } from "react"
import {
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native"
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated"
import {
  LISTING_STATUS_LABEL,
  ORDER_STATUS_LABEL,
  type ListingStatus,
  type OrderStatus,
} from "@platelink/shared"
import { useTheme } from "@/theme"
import { Text } from "./text"

export type BadgeVariant =
  | "default"
  | "honey"
  | "silk"
  | "iron"
  | "gunmetal"
  | "muted"
  | "outline"
  | "destructive"

export interface BadgeProps {
  status?: ListingStatus | OrderStatus
  variant?: BadgeVariant
  label?: string
  children?: React.ReactNode
  style?: StyleProp<ViewStyle>
}

export function Badge({
  status,
  variant,
  label,
  children,
  style,
}: BadgeProps) {
  const { theme, isDark } = useTheme()
  const pulseOpacity = useSharedValue(1)

  const isAvailable = status === "available"

  useEffect(() => {
    if (isAvailable) {
      pulseOpacity.value = withRepeat(
        withSequence(
          withTiming(0.3, { duration: 600 }),
          withTiming(1, { duration: 600 })
        ),
        -1,
        true
      )
    }
  }, [isAvailable, pulseOpacity])

  const animatedDotStyle = useAnimatedStyle(() => ({
    opacity: pulseOpacity.value,
  }))

  const { bg, text, border } = resolveBadgeColors(
    status,
    variant,
    theme,
    isDark
  )

  const displayText =
    label ??
    (children !== undefined
      ? children
      : status
        ? getStatusLabel(status)
        : "")

  return (
    <View
      accessibilityRole="text"
      style={[
        styles.badge,
        {
          backgroundColor: bg,
          borderRadius: theme.radii.pill,
          borderColor: border ?? "transparent",
          borderWidth: border ? 1 : 0,
        },
        style,
      ]}
    >
      {isAvailable && (
        <Animated.View
          style={[
            styles.dot,
            { backgroundColor: text },
            animatedDotStyle,
          ]}
        />
      )}
      {typeof displayText === "string" ? (
        <Text
          style={[
            styles.text,
            {
              color: text,
              fontFamily: theme.fonts.bodySemiBold,
              fontSize: theme.typeScale.xs,
            },
          ]}
        >
          {displayText}
        </Text>
      ) : (
        displayText
      )}
    </View>
  )
}

function getStatusLabel(status: ListingStatus | OrderStatus): string {
  if (status in LISTING_STATUS_LABEL) {
    return LISTING_STATUS_LABEL[status as ListingStatus]
  }
  if (status in ORDER_STATUS_LABEL) {
    return ORDER_STATUS_LABEL[status as OrderStatus]
  }
  return status
}

function resolveBadgeColors(
  status: ListingStatus | OrderStatus | undefined,
  variant: BadgeVariant | undefined,
  theme: ReturnType<typeof useTheme>["theme"],
  isDark: boolean
): { bg: string; text: string; border?: string } {
  // If status is provided, use statusColors mapping
  if (status) {
    switch (status) {
      case "available":
        return {
          bg: theme.statusColors.available[0],
          text: theme.statusColors.available[1],
        }
      case "claimed":
        return {
          bg: theme.statusColors.claimed[0],
          text: theme.statusColors.claimed[1],
        }
      case "picked_up":
        return {
          bg: theme.statusColors.picked_up[0],
          text: theme.statusColors.picked_up[1],
        }
      case "delivered":
        return {
          bg: theme.statusColors.delivered[0],
          text: theme.statusColors.delivered[1],
        }
      case "expired":
        return {
          bg: theme.statusColors.expired[0],
          text: theme.statusColors.expired[1],
        }
      case "cancelled":
        return {
          bg: theme.statusColors.cancelled[0],
          text: theme.statusColors.cancelled[1],
        }
      // Order statuses
      case "pending_driver":
        return {
          bg: theme.statusColors.available[0],
          text: theme.statusColors.available[1],
        }
      case "driver_assigned":
        return {
          bg: theme.statusColors.claimed[0],
          text: theme.statusColors.claimed[1],
        }
      case "on_the_way":
        return {
          bg: theme.statusColors.picked_up[0],
          text: theme.statusColors.picked_up[1],
        }
      case "completed":
        return {
          bg: theme.statusColors.delivered[0],
          text: theme.statusColors.delivered[1],
        }
    }
  }

  // Variant based colors
  switch (variant) {
    case "honey":
      return {
        bg: theme.colors.accent,
        text: theme.palette.gunmetal,
      }
    case "silk":
      return {
        bg: isDark ? "#4A3A37" : theme.palette.almondSilk,
        text: isDark ? theme.palette.almondSilk : "#8F2A36",
      }
    case "iron":
      return {
        bg: theme.palette.ironGrey,
        text: "#FFFFFF",
      }
    case "gunmetal":
      return {
        bg: isDark ? theme.palette.almondSilk : theme.palette.gunmetal,
        text: isDark ? theme.palette.gunmetal : theme.palette.almondSilk,
      }
    case "muted":
      return {
        bg: theme.colors.surfaceSunken,
        text: theme.colors.inkMuted,
        border: theme.colors.border,
      }
    case "outline":
      return {
        bg: "transparent",
        text: theme.colors.ink,
        border: theme.colors.borderStrong,
      }
    case "destructive":
      return {
        bg: isDark ? "#32373B" : "#FDE8E8",
        text: theme.colors.danger,
        border: isDark ? theme.colors.danger : undefined,
      }
    case "default":
    default:
      return {
        bg: theme.colors.primary,
        text: theme.colors.primaryInk,
      }
  }
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 6,
  },
  text: {
    letterSpacing: -0.1,
  },
})
