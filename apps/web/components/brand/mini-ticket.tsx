import Link from "next/link"
import { cn } from "@/lib/utils"

export type MiniTicketProps = {
  title: string
  portions: number
  status: string
  statusClass: string
  line: string
  headerLeft?: string
  headerRight?: string
  href?: string
  muted?: boolean
  className?: string
  style?: React.CSSProperties
}

/** Small kitchen-order-ticket used on the landing and role home pages. */
export function MiniTicket({
  title,
  portions,
  status,
  statusClass,
  line,
  headerLeft = "Food Court A",
  headerRight = "VIT Chennai",
  href,
  muted,
  className,
  style,
}: MiniTicketProps) {
  const body = (
    <div
      style={style}
      className={cn(
        "ticket w-[min(320px,78vw)] [--notch-y:calc(100%-38px)] [filter:drop-shadow(0_18px_28px_rgb(50_55_59/0.22))]",
        muted && "[filter:grayscale(0.7)_drop-shadow(0_18px_28px_rgb(50_55_59/0.18))]",
        className
      )}
    >
      <div className="flex items-center justify-between gap-3 rounded-t-[14px] bg-gunmetal px-4 py-2.5 text-[11px] text-silk dark:bg-chrome">
        <span className="truncate font-semibold">{headerLeft}</span>
        <span className="shrink-0 opacity-70">{headerRight}</span>
      </div>
      <div className="flex items-end justify-between gap-3 px-4 pt-4 pb-3.5">
        <div className="min-w-0">
          <span className={cn("inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold", statusClass)}>{status}</span>
          <p className="mt-2 truncate font-display text-xl font-semibold text-foreground">{title}</p>
        </div>
        <p className="text-right font-display text-4xl leading-none font-bold text-foreground tabular-nums">
          {portions}
          <span className="block text-[11px] font-normal text-muted-foreground">portions</span>
        </p>
      </div>
      <div className="ticket-perf mx-4 truncate py-2.5 text-xs text-muted-foreground">{line}</div>
    </div>
  )
  return href ? (
    <Link href={href} className="block rounded-[14px] outline-offset-4 transition-transform hover:-translate-y-1">
      {body}
    </Link>
  ) : (
    body
  )
}

export const TICKET_STATUS_CLASS = {
  available: "bg-honey text-gunmetal",
  claimed: "bg-silk text-[#8f2a36]",
  picked_up: "bg-iron text-white",
  delivered: "bg-gunmetal text-silk dark:bg-silk dark:text-gunmetal",
  expired: "bg-muted text-muted-foreground ring-1 ring-border ring-inset",
  cancelled: "bg-muted text-destructive ring-1 ring-destructive/40 ring-inset",
} as const

/** Fan of up to three tickets; positions match the landing page. */
export function TicketStack({ tickets }: { tickets: MiniTicketProps[] }) {
  const pos = [
    "top-0 left-0 rotate-[-6deg]",
    "top-[128px] right-0 rotate-[3deg]",
    "top-[262px] left-6 rotate-[-2deg]",
  ]
  return (
    <div className="relative mx-auto h-[440px] w-full max-w-[440px] sm:h-[450px]">
      {tickets.slice(0, 3).map((t, i) => (
        <div key={i} className={cn("land-ticket absolute", pos[i])} style={{ animationDelay: `${i * 140}ms` }}>
          <MiniTicket {...t} />
        </div>
      ))}
    </div>
  )
}
