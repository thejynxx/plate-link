import React from "react"
import {
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native"
import { useTheme } from "@/theme"
import { Text } from "./text"

export interface EmptyStateProps {
  icon?: React.ReactNode
  title: string
  description?: string
  action?: React.ReactNode
  style?: StyleProp<ViewStyle>
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  style,
}: EmptyStateProps) {
  const { theme, isDark } = useTheme()

  return (
    <View
      accessibilityRole="text"
      style={[
        styles.container,
        {
          borderColor: theme.colors.borderStrong,
          borderRadius: theme.radii.lg,
          backgroundColor: theme.colors.surface,
        },
        style,
      ]}
    >
      {icon ? (
        <View
          style={[
            styles.iconWrapper,
            {
              backgroundColor: isDark ? "#4A3A37" : theme.palette.almondSilk,
            },
          ]}
        >
          {icon}
        </View>
      ) : null}

      <Text
        variant="h3"
        style={[styles.title, { color: theme.colors.ink }]}
      >
        {title}
      </Text>

      {description ? (
        <Text
          variant="body"
          muted
          style={styles.description}
        >
          {description}
        </Text>
      ) : null}

      {action ? <View style={styles.actionWrapper}>{action}</View> : null}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    borderWidth: 2,
    borderStyle: "dashed",
    paddingVertical: 36,
    paddingHorizontal: 24,
    alignItems: "center",
    justifyContent: "center",
    textAlign: "center",
  },
  iconWrapper: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  title: {
    textAlign: "center",
    marginBottom: 6,
  },
  description: {
    textAlign: "center",
    maxWidth: 280,
  },
  actionWrapper: {
    marginTop: 20,
    alignItems: "center",
  },
})
