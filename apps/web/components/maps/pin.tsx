import { cn } from "@/lib/utils"

/** Teardrop map pin; anchor the Marker at "bottom". */
export function Pin({ className, tone = "primary" }: { className?: string; tone?: "primary" | "info" | "warning" }) {
  const fill = { primary: "fill-primary", info: "fill-info", warning: "fill-warning" }[tone]
  return (
    <svg viewBox="0 0 24 32" className={cn("h-9 w-7 drop-shadow-md", className)} aria-hidden>
      <path d="M12 0C5.4 0 0 5.3 0 11.9 0 20.8 12 32 12 32s12-11.2 12-20.1C24 5.3 18.6 0 12 0z" className={fill} />
      <circle cx="12" cy="12" r="4.5" className="fill-white" />
    </svg>
  )
}
