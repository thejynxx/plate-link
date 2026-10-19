"use client"

import { cn } from "@/lib/utils"

/** Pill toggle with a sliding knob (uiverse-style). */
export function Switch({
  checked,
  onCheckedChange,
  label,
  description,
  id,
}: {
  checked: boolean
  onCheckedChange: (v: boolean) => void
  label: string
  description?: string
  id: string
}) {
  return (
    <label htmlFor={id} className="flex cursor-pointer items-start justify-between gap-4 rounded-xl border-2 border-border p-3.5 transition-colors hover:border-border-strong">
      <span className="grid gap-0.5">
        <span className="text-sm font-semibold">{label}</span>
        {description && <span className="text-xs text-muted-foreground">{description}</span>}
      </span>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onCheckedChange(!checked)}
        className={cn(
          "relative mt-0.5 inline-flex h-7 w-12 shrink-0 items-center rounded-full border-2 transition-colors",
          checked ? "border-gunmetal bg-honey dark:border-honey" : "border-border-strong bg-muted"
        )}
      >
        <span
          className={cn(
            "inline-block size-5 rounded-full shadow-[0_2px_0_0_rgb(0_0_0/0.25)] transition-transform duration-200 ease-[cubic-bezier(.3,1.4,.6,1)]",
            checked ? "translate-x-[22px] bg-gunmetal" : "translate-x-[2px] bg-card"
          )}
        />
      </button>
    </label>
  )
}
