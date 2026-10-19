import React, { useEffect } from "react"
import {
  FlatList,
  Image,
  Pressable,
  RefreshControl,
  StyleSheet,
  View,
} from "react-native"
import { useRouter } from "expo-router"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { formatDistanceToNow } from "date-fns"
import * as Haptics from "expo-haptics"
import { MessageSquare } from "lucide-react-native"
import {
  chatKeys,
  fetchConversations,
  palette,
} from "@platelink/shared"
import { Badge, EmptyState, ErrorState, Skeleton, Text } from "@/components/ui"
import { supabase } from "@/lib/supabase"
import { useTheme } from "@/theme"

export function ChatInbox() {
  const router = useRouter()
  const { theme } = useTheme()
  const queryClient = useQueryClient()

  // 1. Fetch conversations inbox
  const {
    data: conversations = [],
    isLoading,
    isError,
    error,
    refetch,
    isRefetching,
  } = useQuery({
    queryKey: chatKeys.inbox(),
    queryFn: () => fetchConversations(supabase),
  })

  // 2. Realtime listener on conversations + messages (Rule 11: unique channel name per mount)
  useEffect(() => {
    const channelName = `mobile-chat-inbox-${Math.random().toString(36).substring(2, 9)}`
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
  }, [queryClient])

  const handleOpenConversation = (conversationId: string) => {
    try {
      Haptics.selectionAsync().catch(() => {})
    } catch {}
    router.push(`/chat/${conversationId}` as any)
  }

  // Format relative timestamp
  const formatTime = (isoString: string | null) => {
    if (!isoString) return ""
    try {
      return formatDistanceToNow(new Date(isoString), { addSuffix: false })
    } catch {
      return ""
    }
  }

  if (isLoading) {
    return (
      <View style={styles.skeletonContainer}>
        {[1, 2, 3, 4].map((key) => (
          <View
            key={key}
            style={[
              styles.skeletonRow,
              { borderBottomColor: theme.colors.border },
            ]}
          >
            <Skeleton width={48} height={48} borderRadius={24} />
            <View style={styles.skeletonTextCol}>
              <Skeleton width="60%" height={16} borderRadius={6} />
              <Skeleton
                width="85%"
                height={13}
                borderRadius={6}
                style={{ marginTop: 8 }}
              />
            </View>
          </View>
        ))}
      </View>
    )
  }

  if (isError) {
    return (
      <View style={styles.centered}>
        <ErrorState
          error={error}
          onRetry={() => {
            void refetch()
          }}
        />
      </View>
    )
  }

  if (conversations.length === 0) {
    return (
      <View style={styles.centered}>
        <EmptyState
          icon={<MessageSquare size={32} color={palette.honeyBronze} />}
          title="No conversations yet"
          description="Messages about food surplus orders, pickups, and coordination will appear here."
        />
      </View>
    )
  }

  return (
    <FlatList
      data={conversations}
      keyExtractor={(item) => item.id}
      contentContainerStyle={styles.listContent}
      refreshControl={
        <RefreshControl
          refreshing={isRefetching}
          onRefresh={() => {
            void refetch()
          }}
          tintColor={palette.honeyBronze}
        />
      }
      renderItem={({ item }) => {
        const timeAgo = formatTime(item.last_message_at || item.created_at)

        return (
          <Pressable
            onPress={() => handleOpenConversation(item.id)}
            style={({ pressed }) => [
              styles.conversationRow,
              {
                backgroundColor: pressed
                  ? theme.colors.surfaceSunken
                  : theme.colors.surface,
                borderBottomColor: theme.colors.border,
              },
            ]}
            accessibilityRole="button"
            accessibilityLabel={`${item.title}, ${item.unread > 0 ? `${item.unread} unread messages` : ""}`}
          >
            {/* Avatar / Food thumbnail */}
            <View style={styles.avatarWrap}>
              {item.photo_url ? (
                <Image
                  source={{ uri: item.photo_url }}
                  style={styles.avatarImg}
                  resizeMode="cover"
                />
              ) : (
                <View
                  style={[
                    styles.avatarFallback,
                    { backgroundColor: theme.colors.surfaceSunken },
                  ]}
                >
                  <MessageSquare size={20} color={palette.honeyBronze} />
                </View>
              )}
            </View>

            {/* Conversation details */}
            <View style={styles.detailsCol}>
              <View style={styles.titleRow}>
                <Text
                  variant="body"
                  weight={item.unread > 0 ? "bold" : "semibold"}
                  numberOfLines={1}
                  style={styles.titleText}
                >
                  {item.title}
                </Text>
                {timeAgo ? (
                  <Text variant="caption" muted style={styles.timeText}>
                    {timeAgo}
                  </Text>
                ) : null}
              </View>

              <Text
                variant="small"
                muted={item.unread === 0}
                weight={item.unread > 0 ? "medium" : "regular"}
                numberOfLines={1}
                style={[
                  styles.previewText,
                  item.unread > 0 && { color: theme.colors.ink },
                ]}
              >
                {item.last_message_preview || "No messages yet"}
              </Text>

              {/* Status & Unread Badges */}
              <View style={styles.badgeRow}>
                {item.order_status ? (
                  <Badge status={item.order_status as any} />
                ) : null}

                {item.unread > 0 && (
                  <View style={styles.unreadBadge}>
                    <Text
                      variant="caption"
                      style={styles.unreadCountText}
                    >
                      {item.unread}
                    </Text>
                  </View>
                )}
              </View>
            </View>
          </Pressable>
        )
      }}
    />
  )
}

const styles = StyleSheet.create({
  listContent: {
    paddingVertical: 4,
  },
  skeletonContainer: {
    paddingVertical: 4,
  },
  skeletonRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    gap: 14,
  },
  skeletonTextCol: {
    flex: 1,
  },
  centered: {
    flex: 1,
    justifyContent: "center",
    padding: 24,
  },
  conversationRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    gap: 14,
  },
  avatarWrap: {
    width: 48,
    height: 48,
  },
  avatarImg: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  avatarFallback: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  detailsCol: {
    flex: 1,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 3,
  },
  titleText: {
    flex: 1,
    marginRight: 8,
  },
  timeText: {
    fontSize: 11,
  },
  previewText: {
    marginBottom: 6,
  },
  badgeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  unreadBadge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: palette.blushedBrick,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 6,
  },
  unreadCountText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "700",
    lineHeight: 14,
  },
})
