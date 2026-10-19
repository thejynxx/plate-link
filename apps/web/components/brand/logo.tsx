import Link from "next/link"
import { cn } from "@/lib/utils"

/** A plate seen from above, with a honey "link" coming off the rim. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden className={cn("size-8", className)}>
      <rect width="32" height="32" rx="9" fill="#32373B" />
      <circle cx="14.5" cy="17.5" r="9" fill="#F4D6CC" />
      <circle cx="14.5" cy="17.5" r="5.4" fill="none" stroke="#C83E4D" strokeWidth="2.2" />
      <circle cx="24.5" cy="8" r="3.6" fill="#F4B860" stroke="#32373B" strokeWidth="1.6" />
    </svg>
  )
}

export function Logo({ href = "/", className, tone = "default" }: { href?: string; className?: string; tone?: "default" | "chrome" }) {
  return (
    <Link href={href} className={cn("flex items-center gap-2.5 rounded-lg outline-offset-4", className)}>
      <LogoMark />
      <span className={cn("font-display text-[1.2rem] font-bold tracking-tight", tone === "chrome" && "text-chrome-foreground")}>
        Plate-Link
      </span>
    </Link>
  )
}
