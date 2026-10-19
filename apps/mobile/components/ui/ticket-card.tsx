import React from "react"
import {
  Pressable,
  StyleSheet,
  View,
  type GestureResponderEvent,
  type StyleProp,
  type ViewStyle,
} from "react-native"
import Svg, { Line } from "react-native-svg"
import { Image } from "expo-image"
import type { ListingStatus } from "@platelink/shared"
import { useTheme } from "@/theme"
import { Badge } from "./badge"
import { Text } from "./text"

export interface TicketCardProps {
  title: string
  portions: number
  status: ListingStatus
  meta?: string
  expiryText?: string
  actionText?: string
  photoUrl?: string
  onPress?: (event: GestureResponderEvent) => void
  disabled?: boolean
  style?: StyleProp<ViewStyle>
}

export function TicketCard({
  title,
  portions,
  status,
  meta,
  expiryText,
  actionText = "View details",
  photoUrl,
  onPress,
  disabled = false,
  style,
}: TicketCardProps) {
  const { theme } = useTheme()

  const accessibleLabel = `${title}, ${portions} portions, status: ${status}${
    meta ? `, ${meta}` : ""
  }`

  const content = (
    <View
      style={[
        styles.ticketContainer,
        {
          backgroundColor: theme.colors.surface,
          borderColor: theme.colors.borderStrong,
          borderRadius: theme.radii.ticket,
        },
      ]}
    >
      {/* Optional Photo */}
      {photoUrl ? (
        <View style={styles.photoContainer}>
          <Image
            source={{ uri: photoUrl }}
            style={styles.photo}
            contentFit="cover"
            transition={200}
          />
          <View style={styles.photoBadgeOverlay}>
            <Badge status={status} />
          </View>
        </View>
      ) : null}

      {/* Main Ticket Info Section */}
      <View style={styles.headerSection}>
        <View style={styles.titleColumn}>
          {!photoUrl && (
            <View style={styles.badgeWrapper}>
              <Badge status={status} />
            </View>
          )}
          <Text
            variant="h3"
            numberOfLines={2}
            style={[styles.title, { color: theme.colors.ink }]}
          >
            {title}
          </Text>
          {meta ? (
            <Text
              variant="small"
              muted
              numberOfLines={1}
              style={styles.metaText}
            >
              {meta}
            </Text>
          ) : null}
        </View>

        {/* Big Portion Counter */}
        <View style={styles.portionColumn}>
          <Text
            tabularNums
            style={[
              styles.portionNumber,
              {
                color: theme.colors.ink,
                fontFamily: theme.fonts.displayBold,
              },
            ]}
          >
            {portions}
          </Text>
          <Text variant="caption" muted style={styles.portionLabel}>
            portions
          </Text>
        </View>
      </View>

      {/* Perforation Line with Half-Circle Cutout Notches */}
      <View style={styles.perforationRow}>
        {/* Left Notch */}
        <View
          style={[
            styles.notch,
            styles.leftNotch,
            {
              backgroundColor: theme.colors.canvas,
              borderColor: theme.colors.borderStrong,
            },
          ]}
        />

        {/* Dashed Perforation Line */}
        <View style={styles.dashedLineContainer}>
          <Svg height="2" width="100%">
            <Line
              x1="0"
              y1="1"
              x2="1000"
              y2="1"
              stroke={theme.colors.borderStrong}
              strokeWidth="2"
              strokeDasharray="6, 5"
            />
          </Svg>
        </View>

        {/* Right Notch */}
        <View
          style={[
            styles.notch,
            styles.rightNotch,
            {
              backgroundColor: theme.colors.canvas,
              borderColor: theme.colors.borderStrong,
            },
          ]}
        />
      </View>

      {/* Ticket Footer / Tear-off Stub */}
      <View style={styles.footerSection}>
        {expiryText ? (
          <Text variant="caption" muted style={styles.expiryText}>
            {expiryText}
          </Text>
        ) : (
          <View />
        )}
        {actionText ? (
          <Text
            variant="small"
            weight="semibold"
            style={{ color: theme.colors.primary }}
          >
            {actionText}
          </Text>
        ) : null}
      </View>
    </View>
  )

  if (onPress) {
    return (
      <Pressable
        onPress={!disabled ? onPress : undefined}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel={accessibleLabel}
        style={({ pressed }) => [
          styles.pressableRoot,
          pressed && styles.pressed,
          disabled && styles.disabled,
          style,
        ]}
      >
        {content}
      </Pressable>
    )
  }

  return (
    <View
      accessibilityRole="text"
      accessibilityLabel={accessibleLabel}
      style={[styles.pressableRoot, style]}
    >
      {content}
    </View>
  )
}

const NOTCH_SIZE = 18

const styles = StyleSheet.create({
  pressableRoot: {
    width: "100%",
  },
  ticketContainer: {
    borderWidth: 1,
    overflow: "hidden",
    position: "relative",
    shadowColor: "#32373B",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  photoContainer: {
    width: "100%",
    height: 140,
    position: "relative",
  },
  photo: {
    width: "100%",
    height: "100%",
  },
  photoBadgeOverlay: {
    position: "absolute",
    top: 10,
    left: 10,
  },
  badgeWrapper: {
    marginBottom: 6,
  },
  headerSection: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 12,
  },
  titleColumn: {
    flex: 1,
    marginRight: 12,
  },
  title: {
    fontSize: 18,
    lineHeight: 23,
  },
  metaText: {
    marginTop: 4,
  },
  portionColumn: {
    alignItems: "flex-end",
    justifyContent: "center",
  },
  portionNumber: {
    fontSize: 34,
    lineHeight: 36,
  },
  portionLabel: {
    marginTop: 1,
  },
  perforationRow: {
    position: "relative",
    height: NOTCH_SIZE,
    justifyContent: "center",
    alignItems: "center",
  },
  notch: {
    position: "absolute",
    width: NOTCH_SIZE,
    height: NOTCH_SIZE,
    borderRadius: NOTCH_SIZE / 2,
    borderWidth: 1,
    zIndex: 10,
  },
  leftNotch: {
    left: -(NOTCH_SIZE / 2),
  },
  rightNotch: {
    right: -(NOTCH_SIZE / 2),
  },
  dashedLineContainer: {
    width: "100%",
    paddingHorizontal: 14,
    overflow: "hidden",
  },
  footerSection: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  expiryText: {
    flex: 1,
  },
  pressed: {
    opacity: 0.94,
    transform: [{ translateY: 1 }],
  },
  disabled: {
    opacity: 0.5,
  },
})
