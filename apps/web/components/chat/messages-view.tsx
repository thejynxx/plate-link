"use client"

import Link from "next/link"
import { formatDistanceToNowStrict } from "date-fns"
import { MessagesSquare } from "lucide-react"
import { ORDER_STATUS_LABEL, type OrderStatus } from "@platelink/shared"
import { ROLE_NAME, type Conversation } from "@/lib/queries/chat"
import { useInbox } from "@/hooks/use-unread"
import { useSession } from "@/components/layout/session-context"
import { ChatThread } from "@/components/chat/chat-thread"
import { EmptyState } from "@/components/ui/empty-state"
import { ErrorState } from "@/components/ui/error-state"
import { Skeleton } from "@/components/ui/skeleton"
import { cn, initials } from "@/lib/utils"

function who(c: Conversation) {
  if (c.participants.length === 0) return "Just you so far"
  return c.participants.map((p) => `${p.name} (${ROLE_NAME[p.role]})`).join(", ")
}

export function MessagesView({ base, selectedId }: { base: string; selectedId?: string }) {
  const { profile } = useSession()
  const inbox = useInbox(profile.id)
  const selected = inbox.data?.find((c) => c.id === selectedId)

  return (
    <div className="-mx-4 -my-6 grid h-[calc(100dvh-4rem)] sm:-mx-6 sm:-my-9 md:grid-cols-[340px_1fr]">
      {/* Inbox */}
      <aside className={cn("flex min-h-0 flex-col border-r bg-card", selectedId && "hidden md:flex")}>
        <div className="border-b px-5 py-5">
          <h1 className="text-2xl font-bold tracking-tight">Messages</h1>
          <p className="mt-1 text-xs text-muted-foreground">One thread per pickup, with the canteen, NGO and driver.</p>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">
          {inbox.isPending ? (
            <div className="grid gap-1 p-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex gap-3 p-3">
                  <Skeleton className="size-11 rounded-xl" />
                  <div className="grid flex-1 gap-2">
                    <Skeleton className="h-3.5 w-2/3" />
                    <Skeleton className="h-3 w-full" />
                  </div>
                </div>
              ))}
            </div>
          ) : inbox.isError ? (
            <div className="p-4">
              <ErrorState error={inbox.error} onRetry={() => inbox.refetch()} />
            </div>
          ) : inbox.data.length === 0 ? (
            <div className="p-4">
              <EmptyState
                icon={MessagesSquare}
                title="No conversations yet"
                description="A thread opens automatically when food is claimed, so the canteen, NGO and driver can talk."
              />
            </div>
          ) : (
            <ul className="grid gap-0.5 p-2">
              {inbox.data.map((c) => {
                const active = c.id === selectedId
                return (
                  <li key={c.id}>
                    <Link
                      href={`${base}/${c.id}`}
                      className={cn(
                        "flex gap-3 rounded-xl p-3 transition-colors",
                        active ? "bg-accent text-accent-foreground" : "hover:bg-muted"
                      )}
                    >
                      <div className="relative size-11 shrink-0 overflow-hidden rounded-xl bg-secondary">
                        {c.photo_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={c.photo_url} alt="" className="size-full object-cover" />
                        ) : (
                          <span className="flex size-full items-center justify-center text-xs font-bold text-secondary-foreground">
                            {initials(c.title)}
                          </span>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline justify-between gap-2">
                          <p className="truncate text-sm font-bold">{c.title}</p>
                          {c.last_message_at && (
                            <span className={cn("shrink-0 text-[11px]", active ? "text-gunmetal/70" : "text-muted-foreground")}>
                              {formatDistanceToNowStrict(new Date(c.last_message_at))}
                            </span>
                          )}
                        </div>
                        <p className={cn("truncate text-xs", active ? "text-gunmetal/75" : "text-muted-foreground")}>{who(c)}</p>
                        <div className="mt-1 flex items-center gap-2">
                          <p className={cn("min-w-0 flex-1 truncate text-[13px]", c.unread ? "font-semibold" : active ? "text-gunmetal/80" : "text-muted-foreground")}>
                            {c.last_message_preview ?? (c.kind === "listing" ? "Question about this listing" : c.order_status ? ORDER_STATUS_LABEL[c.order_status as OrderStatus] : "")}
                          </p>
                          {c.unread > 0 && (
                            <span className="rounded-full bg-primary px-1.5 py-0.5 text-[11px] font-bold text-white tabular-nums">{c.unread}</span>
                          )}
                        </div>
                      </div>
                    </Link>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </aside>

      {/* Thread */}
      <section className={cn("min-h-0", !selectedId && "hidden md:block")}>
        {selectedId ? (
          <ChatThread key={selectedId} conversationId={selectedId} conversation={selected} backHref={base} />
        ) : (
          <div className="flex h-full items-center justify-center p-8">
            <p className="max-w-xs text-center text-sm text-muted-foreground">Pick a conversation on the left to read and reply.</p>
          </div>
        )}
      </section>
    </div>
  )
}
