import { Skeleton } from "@/components/ui/skeleton"

export type Stat = { label: string; value: number; hint?: string }

/** One dark "pass board" strip instead of four identical cards. */
export function StatBoard({ stats }: { stats: Stat[] }) {
  return (
    <dl className="grid grid-cols-2 overflow-hidden rounded-2xl bg-chrome text-chrome-foreground lg:grid-cols-4">
      {stats.map((s, i) => (
        <div
          key={s.label}
          className={[
            "p-5 sm:p-6",
            i % 2 === 1 ? "border-l border-white/10" : "",
            i >= 2 ? "border-t border-white/10 lg:border-t-0" : "",
            i >= 1 ? "lg:border-l lg:border-white/10" : "",
          ].join(" ")}
        >
          <dt className="text-sm text-chrome-muted">{s.label}</dt>
          <dd className="mt-2 font-display text-[2.6rem] leading-none font-bold tabular-nums">
            {s.value.toLocaleString("en-IN")}
          </dd>
          {s.hint && <p className="mt-2 text-xs text-chrome-muted">{s.hint}</p>}
        </div>
      ))}
    </dl>
  )
}

export function StatBoardSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl bg-chrome lg:grid-cols-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="p-5 sm:p-6">
          <Skeleton className="h-4 w-24 bg-white/10" />
          <Skeleton className="mt-3 h-10 w-16 bg-white/10" />
        </div>
      ))}
    </div>
  )
}

// Back-compat exports
export const StatCardSkeleton = StatBoardSkeleton
