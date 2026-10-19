import React from "react"
import { ScrollView, StyleSheet, View } from "react-native"
import { LogOut, Phone, ShieldCheck, User } from "lucide-react-native"
import {
  Card,
  ChromeHeader,
  PressButton,
  Text,
} from "@/components/ui"
import { useSession } from "@/lib/session"
import { useTheme } from "@/theme"

export default function DriverProfileScreen() {
  const { profile, signOut } = useSession()
  const { theme } = useTheme()

  const driverName = profile?.name ?? "Driver"
  const driverPhone = profile?.phone ?? "No phone added"

  return (
    <View style={[styles.root, { backgroundColor: theme.colors.canvas }]}>
      <ChromeHeader
        title="Driver profile"
        subtitle={driverName}
        rightAction={
          <PressButton
            variant="ghost"
            size="sm"
            onPress={signOut}
            leftIcon={<LogOut size={16} color={theme.colors.chromeInk} />}
            accessibilityLabel="Sign out"
          >
            Sign out
          </PressButton>
        }
      />

      <ScrollView contentContainerStyle={styles.content}>
        <Card style={styles.card}>
          <View style={styles.avatarRow}>
            <View
              style={[
                styles.avatarCircle,
                { backgroundColor: theme.palette.almondSilk },
              ]}
            >
              <User size={32} color={theme.palette.gunmetal} />
            </View>
            <View style={styles.driverInfo}>
              <Text variant="h2">{driverName}</Text>
              <Text variant="small" muted style={{ marginTop: 2 }}>
                Verified delivery partner
              </Text>
            </View>
          </View>

          <View style={[styles.divider, { backgroundColor: theme.colors.border }]} />

          <View style={styles.infoRow}>
            <Phone size={18} color={theme.colors.inkMuted} />
            <Text variant="body" style={styles.infoText}>
              {driverPhone}
            </Text>
          </View>

          <View style={styles.infoRow}>
            <ShieldCheck size={18} color={theme.colors.accent} />
            <Text variant="body" style={styles.infoText}>
              Plate-Link volunteer network
            </Text>
          </View>

          <PressButton
            variant="outline"
            size="md"
            fullWidth
            onPress={signOut}
            leftIcon={<LogOut size={16} color={theme.colors.ink} />}
            style={{ marginTop: 20 }}
          >
            Sign out
          </PressButton>
        </Card>
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  content: {
    padding: 20,
  },
  card: {
    padding: 20,
  },
  avatarRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  avatarCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 16,
  },
  driverInfo: {
    flex: 1,
  },
  divider: {
    height: 1,
    marginVertical: 18,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
    gap: 12,
  },
  infoText: {
    flex: 1,
  },
})
