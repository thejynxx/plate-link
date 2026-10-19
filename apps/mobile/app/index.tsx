import React from "react"
import { StyleSheet, Text, View } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { DISHES, palette } from "@platelink/shared"

export default function HomeScreen() {
  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.brandTitle}>Plate-Link</Text>
          <View style={styles.roleBadge}>
            <Text style={styles.roleText}>Driver app</Text>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardLabel}>Shared catalog</Text>
          <Text style={styles.dishCount}>{DISHES.length}</Text>
          <Text style={styles.cardSubtext}>
            Dishes loaded from @platelink/shared
          </Text>
          <View style={styles.statusIndicator}>
            <View style={styles.dot} />
            <Text style={styles.statusText}>Workspace linked successfully</Text>
          </View>
        </View>
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: palette.gunmetal,
  },
  container: {
    flex: 1,
    backgroundColor: palette.gunmetal,
    paddingHorizontal: 24,
    paddingVertical: 32,
    justifyContent: "center",
  },
  header: {
    alignItems: "center",
    marginBottom: 36,
  },
  brandTitle: {
    fontFamily: "BricolageGrotesque_700Bold",
    fontSize: 40,
    color: palette.almondSilk,
    letterSpacing: -0.5,
  },
  roleBadge: {
    marginTop: 8,
    backgroundColor: palette.ironGrey,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 999,
  },
  roleText: {
    fontFamily: "Geist_600SemiBold",
    fontSize: 14,
    color: palette.honeyBronze,
  },
  card: {
    backgroundColor: "#272C30",
    borderRadius: 20,
    padding: 24,
    alignItems: "center",
    borderWidth: 1,
    borderColor: palette.ironGrey,
  },
  cardLabel: {
    fontFamily: "Geist_500Medium",
    fontSize: 13,
    color: palette.honeyBronze,
    marginBottom: 8,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  dishCount: {
    fontFamily: "BricolageGrotesque_700Bold",
    fontSize: 64,
    color: palette.almondSilk,
    lineHeight: 72,
  },
  cardSubtext: {
    fontFamily: "Geist_400Regular",
    fontSize: 14,
    color: palette.almondSilk,
    opacity: 0.85,
    textAlign: "center",
    marginTop: 4,
  },
  statusIndicator: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 20,
    gap: 8,
    backgroundColor: "rgba(244, 184, 96, 0.15)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: palette.honeyBronze,
  },
  statusText: {
    fontFamily: "Geist_500Medium",
    fontSize: 12,
    color: palette.honeyBronze,
  },
})
