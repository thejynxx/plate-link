/**
 * Plate-Link prep planner — "how many portions should we cook?"
 *
 * Runs the LightGBM model trained by ml/train_prep_model.py entirely in
 * TypeScript (no server, works offline in the mobile app too).
 *
 *   1. point forecast (log space, relative to the last-4-period mean)
 *   2. + residual quantiles for the dish's volatility bucket → demand P1…P99
 *   3. newsvendor: cook the tau* quantile, tau* = margin / price
 */
import model from "./model.json"

type Tree = { f: number[]; t: number[]; l: number[]; r: number[]; v: number[] }
type Model = {
  features: string[]
  categories: string[]
  cuisines: string[]
  nLags: number
  probs: number[]
  cvEdges: number[]
  residualQuantiles: number[][]
  trees: Tree[]
  dataset: string
  metrics: PrepModelMetrics
}

export type PrepModelMetrics = {
  test_weeks: string
  test_rows: number
  rmsle_model: number
  rmsle_naive: number
  leftover_pct_naive: number
  leftover_pct_model: number
  leftover_reduction_pct: number
  profit_uplift_pct: number
  fill_rate_model_pct: number
  fill_rate_naive_pct: number
  cost_share_assumed: number
}

const M = model as unknown as Model

/** Dish categories as the model knows them, with display labels. */
export const PREP_CATEGORIES = [
  { value: "Biryani", label: "Biryani" },
  { value: "Rice Bowl", label: "Rice / meals" },
  { value: "Starters", label: "Starters" },
  { value: "Other Snacks", label: "Snacks" },
  { value: "Sandwich", label: "Sandwich" },
  { value: "Pasta", label: "Pasta / noodles" },
  { value: "Pizza", label: "Pizza" },
  { value: "Salad", label: "Salad" },
  { value: "Soup", label: "Soup" },
  { value: "Fish", label: "Fish" },
  { value: "Seafood", label: "Seafood" },
  { value: "Desert", label: "Dessert" },
  { value: "Beverages", label: "Beverages" },
  { value: "Extras", label: "Sides / extras" },
] as const

export const PREP_CUISINES = [
  { value: "Indian", label: "Indian" },
  { value: "Continental", label: "Continental" },
  { value: "Italian", label: "Italian" },
  { value: "Thai", label: "Asian" },
] as const

export type PrepCategory = (typeof PREP_CATEGORIES)[number]["value"]
export type PrepCuisine = (typeof PREP_CUISINES)[number]["value"]

export type PrepInput = {
  category: PrepCategory
  cuisine: PrepCuisine
  /** Portions sold in each of the last 4 periods, most recent first. */
  history: [number, number, number, number]
  /** Discount vs usual price this period, 0–0.8 (e.g. 0.1 = 10% off). */
  discount?: number
  /** Announced in advance (WhatsApp group, notice board, email). */
  announced?: boolean
  /** Featured at the counter / day's special. */
  featured?: boolean
}

export type PrepCosts = {
  /** Selling price per portion. */
  price: number
  /** Ingredient + prep cost per portion. */
  cost: number
}

export type PrepPlan = {
  recommended: number
  /** Critical ratio = probability of NOT running out at the recommended quantity. */
  serviceLevel: number
  median: number
  p10: number
  p90: number
  expectedSold: number
  expectedLeftover: number
  expectedShort: number
  expectedProfit: number
  /** Same expectations if the kitchen simply cooks last period's sales. */
  baseline: { quantity: number; expectedLeftover: number; expectedShort: number; expectedProfit: number }
  /** Demand quantiles P1…P99 for charts. */
  quantiles: number[]
  probs: number[]
}

export const PREP_MODEL_INFO = { dataset: M.dataset, metrics: M.metrics, trees: M.trees.length }

// ----------------------------------------------------------------------------- core

export function buildFeatures(input: PrepInput): Record<string, number> {
  const lags = input.history.map((v) => Math.max(0, Number(v) || 0))
  const mean4 = lags.reduce((a, b) => a + b, 0) / lags.length
  const variance = lags.reduce((a, b) => a + (b - mean4) ** 2, 0) / lags.length // population std, like numpy
  const logScale = Math.log1p(mean4)
  const restMean = (lags[1]! + lags[2]! + lags[3]!) / 3

  const x: Record<string, number> = {
    log_scale: logScale,
    cv4: Math.sqrt(variance) / Math.max(mean4, 1),
    trend: Math.log1p(lags[0]!) - Math.log1p(restMean),
    discount_pct: Math.min(0.8, Math.max(-0.5, input.discount ?? 0)),
    promo_announced: input.announced ? 1 : 0,
    promo_featured: input.featured ? 1 : 0,
  }
  lags.forEach((v, i) => (x[`rel_lag${i + 1}`] = Math.log1p(v) - logScale))
  for (const c of M.categories) x[`cat_${c}`] = c === input.category ? 1 : 0
  for (const c of M.cuisines) x[`cui_${c}`] = c === input.cuisine ? 1 : 0
  return x
}

function treeValue(tree: Tree, row: number[]): number {
  let node = 0
  if (tree.f.length === 0) return tree.v[0]!
  // Internal nodes are >= 0; a negative index ~i points at leaf i.
  for (;;) {
    const next = row[tree.f[node]!]! <= tree.t[node]! ? tree.l[node]! : tree.r[node]!
    if (next < 0) return tree.v[~next]!
    node = next
  }
}

function interp(x: number, xs: number[], ys: number[]) {
  if (x <= xs[0]!) return ys[0]!
  if (x >= xs[xs.length - 1]!) return ys[ys.length - 1]!
  let i = 1
  while (xs[i]! < x) i++
  const t = (x - xs[i - 1]!) / (xs[i]! - xs[i - 1]!)
  return ys[i - 1]! + t * (ys[i]! - ys[i - 1]!)
}

/** Demand quantiles in portions for the given probability levels. */
export function predictQuantiles(features: Record<string, number>, taus: number[]): number[] {
  const row = M.features.map((name) => features[name] ?? 0)
  let raw = 0
  for (const tree of M.trees) raw += treeValue(tree, row)
  const center = raw + features.log_scale!
  const bin = M.cvEdges.filter((e) => e <= features.cv4!).length // == numpy.digitize
  const table = M.residualQuantiles[bin]!
  return taus.map((t) => Math.max(0, Math.expm1(center + interp(t, M.probs, table))))
}

function expectations(q: number, demand: number[], costs: PrepCosts) {
  let sold = 0
  let left = 0
  let short = 0
  for (const d of demand) {
    sold += Math.min(q, d)
    left += Math.max(q - d, 0)
    short += Math.max(d - q, 0)
  }
  const n = demand.length
  return {
    expectedSold: sold / n,
    expectedLeftover: left / n,
    expectedShort: short / n,
    expectedProfit: (costs.price * sold) / n - costs.cost * q,
  }
}

export function planPrep(input: PrepInput, costs: PrepCosts): PrepPlan {
  const price = Math.max(costs.price, 0.01)
  const cost = Math.min(Math.max(costs.cost, 0), price * 0.99)
  const tau = Math.min(0.95, Math.max(0.05, (price - cost) / price))

  const features = buildFeatures(input)
  const probs = M.probs
  const quantiles = predictQuantiles(features, probs)
  const [p10, median, p90, qStar] = predictQuantiles(features, [0.1, 0.5, 0.9, tau])
  const recommended = Math.max(0, Math.round(qStar!))
  const exp = expectations(recommended, quantiles, { price, cost })
  const baseQty = Math.round(Math.max(0, input.history[0]))
  const base = expectations(baseQty, quantiles, { price, cost })

  return {
    recommended,
    serviceLevel: tau,
    median: median!,
    p10: p10!,
    p90: p90!,
    ...exp,
    baseline: {
      quantity: baseQty,
      expectedLeftover: base.expectedLeftover,
      expectedShort: base.expectedShort,
      expectedProfit: base.expectedProfit,
    },
    quantiles,
    probs,
  }
}
