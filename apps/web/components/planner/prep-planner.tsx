"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { Info, Plus } from "lucide-react"
import { PREP_CATEGORY_LABEL, findDish } from "@platelink/shared"
import {
  PREP_CATEGORIES,
  PREP_CUISINES,
  PREP_MODEL_INFO,
  planPrep,
  type PrepCategory,
  type PrepCuisine,
} from "@platelink/shared/prep-model"
import { DishAutocomplete } from "@/components/dishes/dish-autocomplete"
import { PageHeader } from "@/components/layout/page-header"
import { DemandChart } from "@/components/planner/demand-chart"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Field } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { cn } from "@/lib/utils"

const money = (v: number) => `₹${Math.round(v).toLocaleString("en-IN")}`
const n = (v: number) => Math.round(v).toLocaleString("en-IN")

export function PrepPlanner() {
  const [dish, setDish] = useState("Veg biryani")
  const [category, setCategory] = useState<PrepCategory>("Biryani")
  const [cuisine, setCuisine] = useState<PrepCuisine>("Indian")
  const [period, setPeriod] = useState<"day" | "week">("day")
  const [history, setHistory] = useState<[string, string, string, string]>(["120", "105", "130", "112"])
  const [price, setPrice] = useState("80")
  const [cost, setCost] = useState("32")
  const [discount, setDiscount] = useState(0)
  const [announced, setAnnounced] = useState(false)
  const [featured, setFeatured] = useState(false)

  const nums = history.map((h) => Number(h))
  const valid = nums.every((v) => Number.isFinite(v) && v >= 0) && nums.some((v) => v > 0) && Number(price) > 0 && Number(cost) >= 0 && Number(cost) < Number(price)

  const plan = useMemo(() => {
    if (!valid) return null
    return planPrep(
      { category, cuisine, history: nums as [number, number, number, number], discount: discount / 100, announced, featured },
      { price: Number(price), cost: Number(cost) }
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [valid, category, cuisine, history, price, cost, discount, announced, featured])

  function applyDish(name: string) {
    const match = findDish(name)
    if (match) {
      setCategory(match.category as PrepCategory)
      setCuisine(match.cuisine as PrepCuisine)
    }
  }

  const histLabels =
    period === "day" ? ["Same day last week", "2 weeks ago", "3 weeks ago", "4 weeks ago"] : ["Last week", "2 weeks ago", "3 weeks ago", "4 weeks ago"]
  const m = PREP_MODEL_INFO.metrics

  return (
    <>
      <PageHeader
        title="Prep planner"
        description="How many portions to cook so you sell the most and throw away the least. Change any number and the plan updates."
      />

      <div className="grid gap-8 lg:grid-cols-[1fr_420px] lg:items-start">
        <Card className="grid gap-7 p-5 sm:p-7">
          <Field label="Dish" htmlFor="dish" hint={`Counted as ${PREP_CATEGORY_LABEL[category]}, ${PREP_CUISINES.find((c) => c.value === cuisine)?.label}. Change it below if that's wrong.`}>
            <DishAutocomplete
              id="dish"
              value={dish}
              onChange={(v) => {
                setDish(v)
                applyDish(v)
              }}
              onPick={(s) => s.dish && (setCategory(s.dish.category as PrepCategory), setCuisine(s.dish.cuisine as PrepCuisine))}
            />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Type of dish" htmlFor="category">
              <select id="category" value={category} onChange={(e) => setCategory(e.target.value as PrepCategory)} className="input-well h-11 rounded-xl px-3 text-[15px]">
                {PREP_CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Cuisine" htmlFor="cuisine">
              <select id="cuisine" value={cuisine} onChange={(e) => setCuisine(e.target.value as PrepCuisine)} className="input-well h-11 rounded-xl px-3 text-[15px]">
                {PREP_CUISINES.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <fieldset className="grid gap-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <legend className="text-[13px] font-semibold">Portions sold before</legend>
              <div role="radiogroup" aria-label="Planning for" className="flex gap-2">
                {(["day", "week"] as const).map((p) => (
                  <button key={p} type="button" role="radio" aria-checked={period === p} onClick={() => setPeriod(p)} className="chip h-8 rounded-lg px-3 text-xs font-semibold">
                    Planning a {p}
                  </button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {histLabels.map((label, i) => (
                <label key={label} className="grid gap-1.5">
                  <span className="text-xs text-muted-foreground">{label}</span>
                  <Input
                    type="number"
                    inputMode="numeric"
                    min={0}
                    value={history[i]}
                    onChange={(e) => {
                      const next = [...history] as typeof history
                      next[i] = e.target.value
                      setHistory(next)
                    }}
                    className="font-display text-lg font-semibold tabular-nums"
                  />
                </label>
              ))}
            </div>
          </fieldset>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Selling price per portion" htmlFor="price">
              <div className="relative">
                <span className="absolute top-1/2 left-3.5 -translate-y-1/2 text-muted-foreground">₹</span>
                <Input id="price" type="number" inputMode="decimal" min={1} value={price} onChange={(e) => setPrice(e.target.value)} className="pl-8" />
              </div>
            </Field>
            <Field label="Cost to make one portion" htmlFor="cost" hint="Ingredients, gas and labour" error={Number(cost) >= Number(price) ? "Cost should be below the price" : undefined}>
              <div className="relative">
                <span className="absolute top-1/2 left-3.5 -translate-y-1/2 text-muted-foreground">₹</span>
                <Input id="cost" type="number" inputMode="decimal" min={0} value={cost} onChange={(e) => setCost(e.target.value)} className="pl-8" />
              </div>
            </Field>
          </div>

          <Field label={`Discount this time: ${discount}%`} htmlFor="discount">
            <input
              id="discount"
              type="range"
              min={0}
              max={50}
              step={5}
              value={discount}
              onChange={(e) => setDiscount(Number(e.target.value))}
              className="h-2 w-full cursor-pointer appearance-none rounded-full bg-border accent-[var(--primary)]"
            />
          </Field>

          <div className="grid gap-3 sm:grid-cols-2">
            <Switch id="announced" checked={announced} onCheckedChange={setAnnounced} label="Announced in advance" description="WhatsApp group, notice board or email" />
            <Switch id="featured" checked={featured} onCheckedChange={setFeatured} label="Today's special" description="Featured at the counter or menu board" />
          </div>
        </Card>

        {/* Result: the one bold element on this page */}
        <div className="lg:sticky lg:top-24">
          <div className="overflow-hidden rounded-2xl bg-chrome text-chrome-foreground">
            {plan ? (
              <>
                <div className="p-6 sm:p-7">
                  <p className="text-sm text-chrome-muted">Cook for {dish || "this dish"}</p>
                  <p className="mt-1 font-display text-[5.5rem] leading-[0.9] font-extrabold tracking-[-0.04em] tabular-nums text-honey">
                    {n(plan.recommended)}
                  </p>
                  <p className="mt-1 text-sm">portions {period === "day" ? "for the day" : "for the week"}</p>
                  <p className="mt-5 text-sm leading-relaxed text-chrome-muted">
                    Most likely you&apos;ll sell about <span className="font-semibold text-chrome-foreground">{n(plan.median)}</span>, and almost
                    certainly between {n(plan.p10)} and {n(plan.p90)}. Cooking a little over the middle pays off because a missed sale
                    loses you {money(Number(price) - Number(cost))} while a leftover plate costs {money(Number(cost))}.
                  </p>
                </div>
                <div className="bg-card px-4 pt-4 pb-2 text-card-foreground">
                  <DemandChart quantiles={plan.quantiles} recommended={plan.recommended} median={plan.median} />
                  <p className="flex items-center gap-2 pb-2 text-xs text-muted-foreground">
                    <span className="inline-block h-3 w-1 rounded bg-primary" /> your quantity, on top of how likely each demand level is
                  </p>
                </div>
                <dl className="grid grid-cols-2 border-t border-white/10 text-sm">
                  {[
                    { k: "Expected leftovers", v: `${n(plan.expectedLeftover)}`, base: `${n(plan.baseline.expectedLeftover)} if you cook ${n(plan.baseline.quantity)}` },
                    { k: "Expected missed sales", v: `${n(plan.expectedShort)}`, base: `${n(plan.baseline.expectedShort)} if you cook ${n(plan.baseline.quantity)}` },
                    { k: "Expected profit", v: money(plan.expectedProfit), base: `${money(plan.baseline.expectedProfit)} cooking last time's number` },
                    { k: "Chance you run out", v: `${Math.round((1 - plan.serviceLevel) * 100)}%`, base: "set by your price and cost" },
                  ].map((row, i) => (
                    <div key={row.k} className={cn("p-4 sm:p-5", i % 2 && "border-l border-white/10", i > 1 && "border-t border-white/10")}>
                      <dt className="text-xs text-chrome-muted">{row.k}</dt>
                      <dd className="mt-1 font-display text-2xl font-bold tabular-nums">{row.v}</dd>
                      <dd className="mt-1 text-[11px] text-chrome-muted">{row.base}</dd>
                    </div>
                  ))}
                </dl>
                {plan.expectedLeftover >= 1 && (
                  <div className="border-t border-white/10 p-4 sm:p-5">
                    <Button variant="accent" asChild className="w-full">
                      <Link href="/canteen/listings/new">
                        <Plus /> Post leftovers on Plate-Link after service
                      </Link>
                    </Button>
                  </div>
                )}
              </>
            ) : (
              <div className="p-7 text-sm text-chrome-muted">Enter past sales, a price and a cost below the price to see a plan.</div>
            )}
          </div>

          <details className="group mt-4 rounded-xl border p-4 text-sm">
            <summary className="flex cursor-pointer list-none items-center gap-2 font-semibold">
              <Info className="size-4 text-muted-foreground" /> How this works
            </summary>
            <div className="mt-3 grid gap-2 text-muted-foreground">
              <p>
                A gradient-boosted model ({PREP_MODEL_INFO.trees} trees) trained on {PREP_MODEL_INFO.dataset}. It forecasts a range of likely
                demand from your last four periods, the type of dish, discounts and promotions.
              </p>
              <p>
                On {m.test_rows.toLocaleString("en-IN")} held-out weeks it cut leftovers by {m.leftover_reduction_pct}%, raised demand served
                from {m.fill_rate_naive_pct}% to {m.fill_rate_model_pct}% and profit by {m.profit_uplift_pct}% versus cooking last week&apos;s
                number.
              </p>
              <p>The data comes from a meal-delivery company, so treat the plan as a starting point and adjust with your own judgement.</p>
            </div>
          </details>
        </div>
      </div>
    </>
  )
}
