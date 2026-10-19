import React from "react"
import { ScrollView, StyleSheet, View } from "react-native"
import { MessageSquare } from "lucide-react-native"
import {
  ChromeHeader,
  EmptyState,
} from "@/components/ui"
import { useTheme } from "@/theme"

export default function DriverMessagesScreen() {
  const { theme } = useTheme()

  return (
    <View style={[styles.root, { backgroundColor: theme.colors.canvas }]}>
      <ChromeHeader
        title="Messages"
        subtitle="Delivery order discussions"
      />

      <ScrollView contentContainerStyle={styles.content}>
        <EmptyState
          icon={<MessageSquare size={28} color={theme.palette.honeyBronze} />}
          title="Order chats — coming in Phase 4"
          description="Direct chat with canteens and recipient shelters will activate with active orders."
        />
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
})
