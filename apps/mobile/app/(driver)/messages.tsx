import React from "react"
import { StyleSheet, View } from "react-native"
import { ChromeHeader } from "@/components/ui"
import { ChatInbox } from "@/components/chat/inbox"
import { useTheme } from "@/theme"

export default function DriverMessagesScreen() {
  const { theme } = useTheme()

  return (
    <View style={[styles.root, { backgroundColor: theme.colors.canvas }]}>
      <ChromeHeader
        title="Messages"
        subtitle="Order coordination & discussions"
      />

      <View style={styles.content}>
        <ChatInbox />
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  content: {
    flex: 1,
  },
})
