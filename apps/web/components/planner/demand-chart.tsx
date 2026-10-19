"use client"

/**
 * Demand forecast as a smoothed density curve built from the P1…P99 quantiles,
 * with the median and the recommended quantity marked.
 */
export function DemandChart({ quantiles, recommended, median }: { quantiles: number[]; recommended: number; median: number }) {
  const W = 560
  const H = 150
  const pad = { l: 8, r: 8, t: 16, b: 26 }
  const lo = quantiles[0]!
  const hi = Math.max(quantiles[quantiles.length - 1]!, recommended)
  const min = Math.max(0, lo - (hi - lo) * 0.08)
  const max = hi + (hi - lo) * 0.08 || 1
  const x = (v: number) => pad.l + ((v - min) / (max - min)) * (W - pad.l - pad.r)

  // density ≈ Δp / Δq between neighbouring quantiles, lightly smoothed
  const pts: { v: number; d: number }[] = []
  for (let i = 1; i < quantiles.length; i++) {
    const dq = Math.max(quantiles[i]! - quantiles[i - 1]!, 1e-6)
    pts.push({ v: (quantiles[i]! + quantiles[i - 1]!) / 2, d: 0.01 / dq })
  }
  const smooth = pts.map((p, i) => {
    const win = pts.slice(Math.max(0, i - 3), i + 4)
    return { v: p.v, d: win.reduce((a, b) => a + b.d, 0) / win.length }
  })
  const dMax = Math.max(...smooth.map((p) => p.d))
  const y = (d: number) => H - pad.b - (d / dMax) * (H - pad.t - pad.b)
  const line = smooth.map((p, i) => `${i ? "L" : "M"}${x(p.v).toFixed(1)},${y(p.d).toFixed(1)}`).join(" ")
  const area = `${line} L${x(smooth[smooth.length - 1]!.v).toFixed(1)},${H - pad.b} L${x(smooth[0]!.v).toFixed(1)},${H - pad.b} Z`
  const ticks = [quantiles[9]!, median, quantiles[89]!]

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label={`Likely demand between ${Math.round(quantiles[9]!)} and ${Math.round(quantiles[89]!)} portions`}>
      <path d={area} className="fill-honey/35" />
      <path d={line} fill="none" strokeWidth="2.5" className="stroke-gunmetal dark:stroke-silk" />
      <line x1={x(recommended)} x2={x(recommended)} y1={pad.t - 6} y2={H - pad.b} strokeWidth="3" className="stroke-primary" />
      <circle cx={x(recommended)} cy={pad.t - 6} r="5" className="fill-primary" />
      <line x1={pad.l} x2={W - pad.r} y1={H - pad.b} y2={H - pad.b} strokeWidth="1.5" className="stroke-border-strong" />
      {ticks.map((t, i) => (
        <g key={i}>
          <line x1={x(t)} x2={x(t)} y1={H - pad.b} y2={H - pad.b + 5} strokeWidth="1.5" className="stroke-muted-foreground" />
          <text x={x(t)} y={H - 6} textAnchor="middle" className="fill-muted-foreground text-[12px] tabular-nums">
            {Math.round(t)}
          </text>
        </g>
      ))}
    </svg>
  )
}
