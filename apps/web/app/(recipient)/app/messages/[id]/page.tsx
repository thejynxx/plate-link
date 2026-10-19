import type { Metadata } from "next"
import { MessagesView } from "@/components/chat/messages-view"

export const metadata: Metadata = { title: "Messages" }

export default async function Page({ params }: PageProps<"/app/messages/[id]">) {
  const { id } = await params
  return <MessagesView base="/app/messages" selectedId={id} />
}
