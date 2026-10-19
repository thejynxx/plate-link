import React from "react"
import {
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { useTheme } from "@/theme"
import { Text } from "./text"

export interface ChromeHeaderProps {
  title: string
  subtitle?: string
  leftAction?: React.ReactNode
  rightAction?: React.ReactNode
  style?: StyleProp<ViewStyle>
}

export function ChromeHeader({
  title,
  subtitle,
  leftAction,
  rightAction,
  style,
}: ChromeHeaderProps) {
  const { theme } = useTheme()
  const insets = useSafeAreaInsets()

  return (
    <View
      style={[
        styles.root,
        {
          backgroundColor: theme.colors.chrome,
          paddingTop: Math.max(insets.top, 12) + 6,
          borderBottomColor: theme.colors.borderStrong,
        },
        style,
      ]}
    >
      <View style={styles.contentRow}>
        {leftAction ? (
          <View style={styles.actionLeft}>{leftAction}</View>
        ) : null}

        <View style={styles.titleColumn}>
          <Text
            variant="h2"
            weight="bold"
            style={[styles.title, { color: theme.colors.chromeInk }]}
          >
            {title}
          </Text>
          {subtitle ? (
            <Text
              variant="caption"
              style={[styles.subtitle, { color: theme.colors.chromeMuted }]}
            >
              {subtitle}
            </Text>
          ) : null}
        </View>

        {rightAction ? (
          <View style={styles.actionRight}>{rightAction}</View>
        ) : null}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  root: {
    width: "100%",
    paddingBottom: 16,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
  },
  contentRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  titleColumn: {
    flex: 1,
    justifyContent: "center",
  },
  title: {
    fontSize: 22,
    lineHeight: 28,
    letterSpacing: -0.3,
  },
  subtitle: {
    marginTop: 2,
    letterSpacing: -0.1,
  },
  actionLeft: {
    minWidth: 44,
    minHeight: 44,
    justifyContent: "center",
    alignItems: "flex-start",
    marginRight: 12,
  },
  actionRight: {
    minWidth: 44,
    minHeight: 44,
    justifyContent: "center",
    alignItems: "flex-end",
    marginLeft: 12,
  },
})
