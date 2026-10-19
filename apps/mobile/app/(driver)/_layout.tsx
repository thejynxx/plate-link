import React from "react"
import { Tabs } from "expo-router"
import { Bike, MapPin, MessageSquare, User } from "lucide-react-native"
import { palette } from "@platelink/shared"
import { DeliveryTrackingProvider } from "@/lib/use-delivery-tracking"
import { useTheme } from "@/theme"

export default function DriverTabsLayout() {
  const { theme, isDark } = useTheme()

  return (
    <DeliveryTrackingProvider>
      <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: isDark ? "#16191B" : palette.gunmetal,
          borderTopColor: isDark ? "#2A3135" : "#3E4549",
          borderTopWidth: 1,
          height: 60,
          paddingBottom: 6,
          paddingTop: 6,
        },
        tabBarActiveTintColor: palette.honeyBronze,
        tabBarInactiveTintColor: "#9AA6A7",
        tabBarLabelStyle: {
          fontFamily: theme.fonts.bodyMedium,
          fontSize: 11,
          letterSpacing: -0.1,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Pickups",
          tabBarIcon: ({ color, size }) => (
            <MapPin size={size - 2} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="active"
        options={{
          title: "Active",
          tabBarIcon: ({ color, size }) => (
            <Bike size={size - 2} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="messages"
        options={{
          title: "Messages",
          tabBarIcon: ({ color, size }) => (
            <MessageSquare size={size - 2} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          tabBarIcon: ({ color, size }) => (
            <User size={size - 2} color={color} />
          ),
        }}
      />
    </Tabs>
    </DeliveryTrackingProvider>
  )
}
