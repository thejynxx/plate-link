import React from "react"
import { ActivityIndicator, StyleSheet, Text as RNText, View } from "react-native"
import { palette } from "@platelink/shared"

export function BrandedSplash() {
  return (
    <View
      style={styles.splashContainer}
      accessibilityRole="progressbar"
      accessibilityLabel="Loading Plate-Link"
    >
      <RNText style={styles.splashBrand}>Plate-Link</RNText>
      <RNText style={styles.splashSubtitle}>Food surplus redistribution</RNText>
      <ActivityIndicator
        size="small"
        color={palette.honeyBronze}
        style={styles.splashSpinner}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  splashContainer: {
    flex: 1,
    backgroundColor: palette.gunmetal,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  splashBrand: {
    fontFamily: "BricolageGrotesque_700Bold",
    fontSize: 42,
    color: palette.almondSilk,
    letterSpacing: -0.5,
  },
  splashSubtitle: {
    fontFamily: "Geist_500Medium",
    fontSize: 14,
    color: palette.almondSilk,
    opacity: 0.8,
    marginTop: 6,
    letterSpacing: -0.2,
  },
  splashSpinner: {
    marginTop: 28,
  },
})
