import React, { useEffect, useMemo } from "react"
import { Tabs } from "expo-router"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { Clock, Compass, MessageSquare, User } from "lucide-react-native"
import { chatKeys, fetchConversations, palette } from "@platelink/shared"
import { useSession } from "@/lib/session"
import { supabase } from "@/lib/supabase"
import { useTheme } from "@/theme"

export default function RecipientTabsLayout() {
  const { theme } = useTheme()
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
    const channelName = `recipient-tabs-chat-${user.id}-${Math.random().toString(36).substring(2, 8)}`
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
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: theme.colors.chrome,
          borderTopColor: theme.colors.borderStrong,
          borderTopWidth: 1,
          height: 60,
          paddingBottom: 6,
          paddingTop: 6,
        },
        tabBarActiveTintColor: theme.colors.accent,
        tabBarInactiveTintColor: theme.colors.chromeMuted,
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
          title: "Find",
          tabBarIcon: ({ color, size }) => (
            <Compass size={size - 2} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="claims"
        options={{
          title: "My claims",
          tabBarIcon: ({ color, size }) => (
            <Clock size={size - 2} color={color} />
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
  )
}
