import React, { useEffect, useMemo } from "react"
import { Tabs } from "expo-router"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { Bike, MapPin, MessageSquare, User } from "lucide-react-native"
import { chatKeys, fetchConversations, palette } from "@platelink/shared"
import { DeliveryTrackingProvider } from "@/lib/use-delivery-tracking"
import { useSession } from "@/lib/session"
import { supabase } from "@/lib/supabase"
import { useTheme } from "@/theme"

export default function DriverTabsLayout() {
  const { theme, isDark } = useTheme()
  const { user } = useSession()
  const queryClient = useQueryClient()

  // 1. Fetch conversations inbox for unread count badge
  const { data: conversations = [] } = useQuery({
    queryKey: chatKeys.inbox(),
    queryFn: () => fetchConversations(supabase),
    enabled: !!user?.id,
  })

  // 2. Realtime listener on conversations + messages (Rule 11)
  useEffect(() => {
    if (!user?.id) return
    const channelName = `driver-tabs-chat-${user.id}-${Math.random().toString(36).substring(2, 8)}`
    const channel = supabase
      .channel(channelName)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "conversations" },
        () => {
          queryClient.invalidateQueries({ queryKey: chatKeys.inbox() })
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "messages" },
        () => {
          queryClient.invalidateQueries({ queryKey: chatKeys.inbox() })
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [user?.id, queryClient])

  const totalUnread = useMemo(() => {
    return conversations.reduce((acc, c) => acc + (c.unread || 0), 0)
  }, [conversations])

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
            tabBarBadge: totalUnread > 0 ? totalUnread : undefined,
            tabBarBadgeStyle: {
              backgroundColor: palette.blushedBrick,
              color: "#FFFFFF",
              fontSize: 10,
              fontWeight: "700",
            },
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
