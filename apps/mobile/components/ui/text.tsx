import React from "react"
import {
  StyleSheet,
  Text as RNText,
  type TextProps as RNTextProps,
  type TextStyle,
} from "react-native"
import { useTheme } from "@/theme"

export type TextVariant =
  | "display"
  | "h1"
  | "h2"
  | "h3"
  | "body"
  | "small"
  | "caption"

export type TextWeight = "regular" | "medium" | "semibold" | "bold"

export interface TextProps extends RNTextProps {
  variant?: TextVariant
  weight?: TextWeight
  muted?: boolean
  color?: string
  tabularNums?: boolean
  children?: React.ReactNode
}

export function Text({
  variant = "body",
  weight,
  muted = false,
  color,
  tabularNums = false,
  style,
  accessibilityRole,
  children,
  ...rest
}: TextProps) {
  const { theme } = useTheme()

  const fontStyle = getTypographyStyle(variant, weight, theme)
  const defaultColor = muted ? theme.colors.inkMuted : theme.colors.ink
  const resolvedColor = color ?? defaultColor

  const defaultRole =
    variant === "h1" || variant === "h2" || variant === "h3"
      ? ("header" as const)
      : ("text" as const)

  return (
    <RNText
      accessibilityRole={accessibilityRole ?? defaultRole}
      style={[
        fontStyle,
        { color: resolvedColor },
        tabularNums && styles.tabularNums,
        style,
      ]}
      {...rest}
    >
      {children}
    </RNText>
  )
}

function getTypographyStyle(
  variant: TextVariant,
  weight: TextWeight | undefined,
  theme: ReturnType<typeof useTheme>["theme"]
): TextStyle {
  const { fonts, typeScale } = theme

  switch (variant) {
    case "display":
      return {
        fontFamily:
          weight === "semibold"
            ? fonts.displaySemiBold
            : weight === "regular"
              ? fonts.displayRegular
              : fonts.displayBold,
        fontSize: typeScale["3xl"], // 39
        lineHeight: 44,
        letterSpacing: -0.5,
      }
    case "h1":
      return {
        fontFamily:
          weight === "semibold"
            ? fonts.displaySemiBold
            : weight === "regular"
              ? fonts.displayRegular
              : fonts.displayBold,
        fontSize: typeScale["2xl"], // 31
        lineHeight: 36,
        letterSpacing: -0.4,
      }
    case "h2":
      return {
        fontFamily:
          weight === "semibold"
            ? fonts.displaySemiBold
            : weight === "regular"
              ? fonts.displayRegular
              : fonts.displayBold,
        fontSize: typeScale.xl, // 25
        lineHeight: 30,
        letterSpacing: -0.3,
      }
    case "h3":
      return {
        fontFamily:
          weight === "bold"
            ? fonts.displayBold
            : weight === "regular"
              ? fonts.displayRegular
              : fonts.displaySemiBold,
        fontSize: typeScale.lg, // 20
        lineHeight: 26,
        letterSpacing: -0.2,
      }
    case "body":
      return {
        fontFamily:
          weight === "bold" || weight === "semibold"
            ? fonts.bodySemiBold
            : weight === "medium"
              ? fonts.bodyMedium
              : fonts.bodyRegular,
        fontSize: typeScale.base, // 16
        lineHeight: 22,
      }
    case "small":
      return {
        fontFamily:
          weight === "bold" || weight === "semibold"
            ? fonts.bodySemiBold
            : weight === "medium"
              ? fonts.bodyMedium
              : fonts.bodyRegular,
        fontSize: typeScale.sm, // 14
        lineHeight: 18,
      }
    case "caption":
      return {
        fontFamily:
          weight === "regular"
            ? fonts.bodyRegular
            : weight === "bold" || weight === "semibold"
              ? fonts.bodySemiBold
              : fonts.bodyMedium,
        fontSize: typeScale.xs, // 12
        lineHeight: 16,
      }
  }
}

const styles = StyleSheet.create({
  tabularNums: {
    fontVariant: ["tabular-nums"],
  },
})
