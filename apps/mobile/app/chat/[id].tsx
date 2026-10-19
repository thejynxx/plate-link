import React, { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  View,
} from "react-native"
import { useLocalSearchParams, useRouter } from "expo-router"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { format, isSameDay, isToday, isYesterday } from "date-fns"
import * as Haptics from "expo-haptics"
import { ArrowLeft, RefreshCw, Send } from "lucide-react-native"
import {
  chatKeys,
  fetchConversations,
  fetchMessages,
  markRead,
  palette,
  ROLE_NAME,
  sendMessage,
  type ChatParticipant,
  type Conversation,
  type Message,
} from "@platelink/shared"
import { ChromeHeader, PressButton, Text, WellInput } from "@/components/ui"
import { useSession } from "@/lib/session"
import { supabase } from "@/lib/supabase"
import { useTheme } from "@/theme"

interface ExtendedMessage extends Omit<Message, "id"> {
  id: number | string
  status?: "sending" | "failed"
}

export default function ChatThreadScreen() {
  const router = useRouter()
  const { id } = useLocalSearchParams<{ id: string }>()
  const conversationId = id as string

  const { theme } = useTheme()
  const { user } = useSession()
  const queryClient = useQueryClient()

  const [pendingMessages, setPendingMessages] = useState<ExtendedMessage[]>([])
  const [inputText, setInputText] = useState("")
  const [isSending, setIsSending] = useState(false)
  const flatListRef = useRef<FlatList>(null)

  // 1. Fetch conversations from inbox to get title, order_status, and participants
  const { data: conversations = [] } = useQuery<Conversation[]>({
    queryKey: chatKeys.inbox(),
    queryFn: () => fetchConversations(supabase),
  })

  const conversation = useMemo(() => {
    return conversations.find((c) => c.id === conversationId)
  }, [conversations, conversationId])

  // 2. Fetch initial messages
  const {
    data: initialMessages = [],
    isLoading: isLoadingMessages,
  } = useQuery<Message[]>({
    queryKey: chatKeys.thread(conversationId),
    queryFn: () => fetchMessages(supabase, conversationId, 200),
    enabled: !!conversationId,
  })

  // Combine query messages with any pending/failed optimistic messages
  const messages = useMemo(() => {
    const existingIds = new Set(initialMessages.map((m) => String(m.id)))
    const remainingPending = pendingMessages.filter(
      (m) => !existingIds.has(String(m.id))
    )
    return [...initialMessages, ...remainingPending]
  }, [initialMessages, pendingMessages])

  // 3. Mark conversation as read on open
  useEffect(() => {
    if (!conversationId) return
    void markRead(supabase, conversationId)
    queryClient.invalidateQueries({ queryKey: chatKeys.inbox() })
  }, [conversationId, queryClient])

  // 4. Realtime listener for new messages (Rule 11: unique channel name per mount)
  useEffect(() => {
    if (!conversationId) return

    const channelName = `chat-thread-${conversationId}-${Math.random().toString(36).substring(2, 8)}`
    const channel = supabase
      .channel(channelName)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          const newMsg = payload.new as Message

          // Update query cache directly without cascading effect setState
          queryClient.setQueryData<Message[]>(
            chatKeys.thread(conversationId),
            (old = []) => {
              if (old.some((m) => String(m.id) === String(newMsg.id))) return old
              return [...old, newMsg]
            }
          )

          // Remove matching optimistic message if any
          setPendingMessages((prev) =>
            prev.filter(
              (m) =>
                !(
                  m.sender_id === newMsg.sender_id &&
                  m.body === newMsg.body
                )
            )
          )

          // If incoming from someone else, mark as read and invalidate inbox unread count
          if (newMsg.sender_id !== user?.id) {
            void markRead(supabase, conversationId)
            queryClient.invalidateQueries({ queryKey: chatKeys.inbox() })
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [conversationId, user?.id, queryClient])

  // 5. Participants map & subtitle text
  const participantsMap = useMemo(() => {
    const map = new Map<string, ChatParticipant>()
    conversation?.participants?.forEach((p) => {
      map.set(p.id, p)
    })
    return map
  }, [conversation])

  const subtitleText = useMemo(() => {
    if (!conversation?.participants || conversation.participants.length === 0) {
      return "Direct order chat"
    }
    return conversation.participants
      .map((p) => `${p.name} (${ROLE_NAME[p.role] ?? p.role})`)
      .join(", ")
  }, [conversation])

  // 6. Optimistic Send Handler
  const handleSend = useCallback(
    async (textToSend: string = inputText) => {
      const clean = textToSend.trim()
      if (!clean || !user?.id || !conversationId) return

      try {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {})
      } catch {}

      const tempId = `temp-${Date.now()}`
      const optimisticMessage: ExtendedMessage = {
        id: tempId,
        conversation_id: conversationId,
        sender_id: user.id,
        body: clean,
        created_at: new Date().toISOString(),
        status: "sending",
      }

      setPendingMessages((prev) => [...prev, optimisticMessage])
      setInputText("")
      setIsSending(true)

      try {
        const realMessage = await sendMessage(
          supabase,
          conversationId,
          user.id,
          clean
        )

        setPendingMessages((prev) =>
          prev.filter((m) => String(m.id) !== tempId)
        )
        queryClient.setQueryData<Message[]>(
          chatKeys.thread(conversationId),
          (old = []) => {
            if (old.some((m) => String(m.id) === String(realMessage.id))) return old
            return [...old, realMessage]
          }
        )
        queryClient.invalidateQueries({ queryKey: chatKeys.inbox() })
      } catch (err: any) {
        console.warn("[chat] Send error:", err)
        setPendingMessages((prev) =>
          prev.map((m) =>
            String(m.id) === tempId ? { ...m, status: "failed" } : m
          )
        )
      } finally {
        setIsSending(false)
      }
    },
    [inputText, user, conversationId, queryClient]
  )

  // 7. Retry failed optimistic message
  const handleRetry = (msg: ExtendedMessage) => {
    Alert.alert("Message not sent", "Would you like to try sending this message again?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => {
          setPendingMessages((prev) => prev.filter((m) => String(m.id) !== String(msg.id)))
        },
      },
      {
        text: "Retry",
        onPress: () => {
          setPendingMessages((prev) => prev.filter((m) => String(m.id) !== String(msg.id)))
          void handleSend(msg.body)
        },
      },
    ])
  }

  // Format date separator label
  const formatDayLabel = (date: Date) => {
    if (isToday(date)) return "Today"
    if (isYesterday(date)) return "Yesterday"
    return format(date, "EEEE, MMMM d")
  }

  // Data for inverted FlatList: latest message at index 0
  const invertedMessages = useMemo(() => {
    return [...messages].reverse()
  }, [messages])

  return (
    <View style={[styles.root, { backgroundColor: theme.colors.canvas }]}>
      {/* Structural Header with Back Button */}
      <ChromeHeader
        title={conversation?.title ?? "Order chat"}
        subtitle={subtitleText}
        leftAction={
          <PressButton
            variant="ghost"
            size="sm"
            onPress={() => router.back()}
            leftIcon={<ArrowLeft size={20} color={theme.colors.chromeInk} />}
            accessibilityLabel="Go back to previous screen"
          >
            Back
          </PressButton>
        }
      />

      <KeyboardAvoidingView
        style={styles.keyboardContainer}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={Platform.OS === "ios" ? 10 : 0}
      >
        {isLoadingMessages && messages.length === 0 ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={palette.honeyBronze} />
            <Text variant="caption" muted style={{ marginTop: 8 }}>
              Loading messages...
            </Text>
          </View>
        ) : (
          <FlatList
            ref={flatListRef}
            inverted
            data={invertedMessages}
            keyExtractor={(item) => String(item.id)}
            contentContainerStyle={styles.listContent}
            renderItem={({ item, index }) => {
              const isMine = item.sender_id === user?.id
              const itemDate = new Date(item.created_at)

              // Check if a day separator is needed above this message (in chronological order, i.e., before item)
              // In inverted array, the chronological predecessor is at index + 1
              const prevItem = invertedMessages[index + 1]
              const showDaySeparator =
                !prevItem || !isSameDay(itemDate, new Date(prevItem.created_at))

              const sender = participantsMap.get(item.sender_id)
              const senderRole = sender?.role ? ROLE_NAME[sender.role] : "Participant"
              const senderDisplayName = sender?.name
                ? `${sender.name} (${senderRole})`
                : senderRole

              const formattedTime = format(itemDate, "h:mm a")

              return (
                <View style={styles.messageRowWrapper}>
                  {/* Day Separator Header */}
                  {showDaySeparator && (
                    <View style={styles.daySeparatorRow}>
                      <View
                        style={[
                          styles.daySeparatorPill,
                          {
                            backgroundColor: theme.colors.surfaceSunken,
                            borderColor: theme.colors.border,
                          },
                        ]}
                      >
                        <Text variant="caption" muted style={styles.daySeparatorText}>
                          {formatDayLabel(itemDate)}
                        </Text>
                      </View>
                    </View>
                  )}

                  {/* Message Bubble Item */}
                  <View
                    style={[
                      styles.bubbleRow,
                      isMine ? styles.bubbleRowMine : styles.bubbleRowOthers,
                    ]}
                  >
                    <Pressable
                      onPress={() => {
                        if (item.status === "failed") {
                          handleRetry(item)
                        }
                      }}
                      style={[
                        styles.bubbleCard,
                        isMine
                          ? [
                              styles.bubbleMine,
                              { backgroundColor: palette.blushedBrick },
                            ]
                          : [
                              styles.bubbleOthers,
                              {
                                backgroundColor: theme.colors.surface,
                                borderColor: theme.colors.border,
                              },
                            ],
                        item.status === "failed" && styles.bubbleFailed,
                      ]}
                    >
                      {/* Others: Sender Name & Role Header */}
                      {!isMine && (
                        <Text
                          variant="caption"
                          weight="bold"
                          style={[
                            styles.senderHeader,
                            { color: palette.honeyBronze },
                          ]}
                        >
                          {senderDisplayName}
                        </Text>
                      )}

                      {/* Message Body */}
                      <Text
                        variant="body"
                        style={[
                          styles.messageBodyText,
                          isMine
                            ? { color: "#FFFFFF" }
                            : { color: theme.colors.ink },
                        ]}
                      >
                        {item.body}
                      </Text>

                      {/* Bubble Footer: Time & Status */}
                      <View style={styles.bubbleFooter}>
                        <Text
                          variant="caption"
                          style={[
                            styles.timeText,
                            isMine
                              ? { color: "rgba(255, 255, 255, 0.75)" }
                              : { color: theme.colors.inkMuted },
                          ]}
                        >
                          {formattedTime}
                        </Text>

                        {isMine && item.status === "sending" && (
                          <ActivityIndicator
                            size={10}
                            color="#FFFFFF"
                            style={{ marginLeft: 4 }}
                          />
                        )}

                        {isMine && item.status === "failed" && (
                          <View style={styles.failedStatusCol}>
                            <RefreshCw size={12} color="#FFFFFF" />
                            <Text
                              variant="caption"
                              style={{ color: "#FFFFFF", marginLeft: 4 }}
                            >
                              Tap to retry
                            </Text>
                          </View>
                        )}
                      </View>
                    </Pressable>
                  </View>
                </View>
              )
            }}
          />
        )}

        {/* Message Composer Area */}
        <View
          style={[
            styles.composerArea,
            {
              backgroundColor: theme.colors.surface,
              borderTopColor: theme.colors.border,
            },
          ]}
        >
          <View style={styles.inputWrapper}>
            <WellInput
              value={inputText}
              onChangeText={setInputText}
              placeholder="Type a message..."
              placeholderTextColor={theme.colors.inkMuted}
              multiline
              maxLength={2000}
              containerStyle={styles.wellInputContainer}
              style={styles.textInputStyle}
            />
          </View>

          <PressButton
            variant="default"
            size="md"
            disabled={!inputText.trim() || isSending}
            onPress={() => void handleSend()}
            leftIcon={<Send size={18} color="#FFFFFF" />}
            accessibilityLabel="Send message"
            style={styles.sendButton}
          >
            Send
          </PressButton>
        </View>
      </KeyboardAvoidingView>
    </View>
  )
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  keyboardContainer: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  listContent: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  messageRowWrapper: {
    marginBottom: 6,
  },
  daySeparatorRow: {
    alignItems: "center",
    marginVertical: 14,
  },
  daySeparatorPill: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
  },
  daySeparatorText: {
    fontSize: 11,
    fontWeight: "600",
  },
  bubbleRow: {
    flexDirection: "row",
  },
  bubbleRowMine: {
    justifyContent: "flex-end",
  },
  bubbleRowOthers: {
    justifyContent: "flex-start",
  },
  bubbleCard: {
    maxWidth: "80%",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 18,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 2,
  },
  bubbleMine: {
    borderBottomRightRadius: 4,
  },
  bubbleOthers: {
    borderBottomLeftRadius: 4,
    borderWidth: 1,
  },
  bubbleFailed: {
    opacity: 0.85,
  },
  senderHeader: {
    fontSize: 11,
    marginBottom: 4,
    letterSpacing: -0.1,
  },
  messageBodyText: {
    fontSize: 15,
    lineHeight: 20,
  },
  bubbleFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    marginTop: 4,
  },
  timeText: {
    fontSize: 10,
  },
  failedStatusCol: {
    flexDirection: "row",
    alignItems: "center",
    marginLeft: 6,
  },
  composerArea: {
    flexDirection: "row",
    alignItems: "flex-end",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderTopWidth: 1,
    gap: 10,
  },
  inputWrapper: {
    flex: 1,
  },
  wellInputContainer: {
    marginBottom: 0,
  },
  textInputStyle: {
    minHeight: 42,
    maxHeight: 120,
    paddingTop: 10,
    paddingBottom: 10,
  },
  sendButton: {
    height: 44,
    alignSelf: "flex-end",
    marginBottom: 2,
  },
})
