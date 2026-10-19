"use client"

import { useEffect, useId, useLayoutEffect, useRef, useState } from "react"
import Link from "next/link"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { format, isSameDay } from "date-fns"
import { ArrowLeft, Phone, SendHorizontal } from "lucide-react"
import { toast } from "sonner"
import { createClient } from "@/lib/supabase/client"
import { ROLE_NAME, chatKeys, fetchMessages, markRead, sendMessage, type Conversation, type Message } from "@/lib/queries/chat"
import { useSession } from "@/components/layout/session-context"
import { Button } from "@/components/ui/button"
import { ErrorState } from "@/components/ui/error-state"
import { Skeleton } from "@/components/ui/skeleton"
import { cn, errorMessage } from "@/lib/utils"

export function ChatThread({
  conversationId,
  conversation,
  backHref,
}: {
  conversationId: string
  conversation?: Conversation
  backHref: string
}) {
  const { profile } = useSession()
  const supabase = createClient()
  const queryClient = useQueryClient()
  const key = chatKeys.thread(conversationId)
  const scrollRef = useRef<HTMLDivElement>(null)
  const [draft, setDraft] = useState("")
  const instance = useId()

  const q = useQuery({ queryKey: key, queryFn: () => fetchMessages(supabase, conversationId) })

  // Live: append new messages straight into the cache (no refetch per message)
  useEffect(() => {
    const channel = supabase
      .channel(`thread-${conversationId}:${instance}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `conversation_id=eq.${conversationId}` },
        (payload) => {
          const msg = payload.new as Message
          queryClient.setQueryData<Message[]>(key, (old = []) => (old.some((m) => m.id === msg.id) ? old : [...old, msg]))
          if (msg.sender_id !== profile.id) markRead(supabase, conversationId).then(() => queryClient.invalidateQueries({ queryKey: chatKeys.inbox() }))
        }
      )
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId])

  useEffect(() => {
    markRead(supabase, conversationId).then(() => queryClient.invalidateQueries({ queryKey: chatKeys.inbox() }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId])

  useLayoutEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight })
  }, [q.data?.length])

  const send = useMutation({
    mutationFn: (body: string) => sendMessage(supabase, conversationId, profile.id, body),
    onMutate: () => setDraft(""),
    onSuccess: (msg) => {
      queryClient.setQueryData<Message[]>(key, (old = []) => (old.some((m) => m.id === msg.id) ? old : [...old, msg]))
      queryClient.invalidateQueries({ queryKey: chatKeys.inbox() })
    },
    onError: (e, body) => {
      setDraft(body)
      toast.error(errorMessage(e, "Message not sent"))
    },
  })

  function submit() {
    const body = draft.trim()
    if (!body || send.isPending) return
    send.mutate(body.slice(0, 2000))
  }

  const people = conversation?.participants ?? []
  const nameOf = (id: string | null) => {
    const p = people.find((x) => x.id === id)
    return p ? `${p.name}, ${ROLE_NAME[p.role]}` : "Former participant"
  }
  const callable = people.filter((p) => p.phone)

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="flex items-center gap-3 border-b bg-background/90 px-4 py-3 backdrop-blur sm:px-6">
        <Button variant="ghost" size="icon-sm" asChild className="md:hidden">
          <Link href={backHref} aria-label="Back to messages">
            <ArrowLeft />
          </Link>
        </Button>
        <div className="min-w-0 flex-1">
          <p className="truncate font-display text-lg font-bold">{conversation?.title ?? "Conversation"}</p>
          <p className="truncate text-xs text-muted-foreground">
            {people.length ? people.map((p) => `${p.name} (${ROLE_NAME[p.role]})`).join(", ") : "Loading people…"}
          </p>
        </div>
        {callable.slice(0, 2).map((p) => (
          <Button key={p.id} variant="outline" size="sm" asChild>
            <a href={`tel:${p.phone!.replace(/\s/g, "")}`} aria-label={`Call ${p.name}`}>
              <Phone /> <span className="hidden sm:inline">{ROLE_NAME[p.role]}</span>
            </a>
          </Button>
        ))}
      </header>

      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto bg-muted/50 px-4 py-6 sm:px-6">
        {q.isPending ? (
          <div className="grid gap-3">
            <Skeleton className="h-12 w-2/3 rounded-2xl" />
            <Skeleton className="ml-auto h-12 w-1/2 rounded-2xl" />
            <Skeleton className="h-16 w-3/5 rounded-2xl" />
          </div>
        ) : q.isError ? (
          <ErrorState error={q.error} onRetry={() => q.refetch()} />
        ) : q.data.length === 0 ? (
          <p className="mx-auto mt-10 max-w-xs text-center text-sm text-muted-foreground">
            No messages yet. Say when the food will be ready, or ask about the pickup gate.
          </p>
        ) : (
          <ol className="mx-auto grid max-w-2xl gap-1.5">
            {q.data.map((m, i) => {
              const mine = m.sender_id === profile.id
              const prev = q.data[i - 1]
              const newDay = !prev || !isSameDay(new Date(prev.created_at), new Date(m.created_at))
              const grouped = prev && !newDay && prev.sender_id === m.sender_id
              return (
                <li key={m.id} className="grid">
                  {newDay && (
                    <p className="my-3 text-center text-[11px] font-semibold text-muted-foreground">{format(new Date(m.created_at), "EEEE, d MMM")}</p>
                  )}
                  {!mine && !grouped && <p className="mt-2 mb-1 ml-1 text-[11px] font-semibold text-muted-foreground">{nameOf(m.sender_id)}</p>}
                  <div
                    className={cn(
                      "max-w-[80%] rounded-2xl px-3.5 py-2 text-[15px] leading-snug whitespace-pre-wrap break-words",
                      mine
                        ? "justify-self-end rounded-br-md bg-primary text-primary-foreground"
                        : "justify-self-start rounded-bl-md border bg-card text-card-foreground"
                    )}
                  >
                    {m.body}
                    <span className={cn("ml-2 inline-block translate-y-0.5 text-[10px] tabular-nums", mine ? "text-white/70" : "text-muted-foreground")}>
                      {format(new Date(m.created_at), "h:mm a")}
                    </span>
                  </div>
                </li>
              )
            })}
          </ol>
        )}
      </div>

      <form
        className="flex items-end gap-2 border-t bg-card px-3 py-3 sm:px-6"
        onSubmit={(e) => {
          e.preventDefault()
          submit()
        }}
      >
        <label htmlFor="chat-input" className="sr-only">
          Message
        </label>
        <textarea
          id="chat-input"
          rows={1}
          value={draft}
          maxLength={2000}
          placeholder="Write a message"
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault()
              submit()
            }
          }}
          className="input-well max-h-36 min-h-11 flex-1 resize-none rounded-2xl px-4 py-2.5 text-[15px] [field-sizing:content]"
        />
        <Button type="submit" size="icon" aria-label="Send" disabled={!draft.trim()} loading={send.isPending}>
          {!send.isPending && <SendHorizontal />}
        </Button>
      </form>
    </div>
  )
}
