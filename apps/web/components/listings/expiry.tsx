"use client"

import { differenceInMinutes } from "date-fns"
import { Clock } from "lucide-react"
import { useNow } from "@/hooks/use-now"
import { cn } from "@/lib/utils"

export function formatTimeLeft(minutes: number) {
  if (minutes <= 0) return "Expired"
  if (minutes < 60) return `${minutes} min left`
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return h < 24 ? `${h}h ${m.toString().padStart(2, "0")}m left` : `${Math.floor(h / 24)}d ${h % 24}h left`
}

/** Live countdown; turns amber under an hour and red under 20 minutes. */
export function ExpiryCountdown({ expiresAt, className }: { expiresAt: string; className?: string }) {
  const now = useNow(30_000)
  const mins = differenceInMinutes(new Date(expiresAt), now)
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 text-xs font-semibold tabular-nums",
        mins <= 0 ? "text-muted-foreground" : mins < 20 ? "text-destructive" : mins < 60 ? "text-link" : "text-muted-foreground",
        className
      )}
    >
      <Clock className="size-3.5" />
      {formatTimeLeft(mins)}
    </span>
  )
}
