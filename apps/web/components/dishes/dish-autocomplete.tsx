"use client"

import { useId, useMemo, useRef, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { BookOpen, History, MapPin } from "lucide-react"
import { FOOD_TYPE_LABEL, PREP_CATEGORY_LABEL, suggestDishes, type DishSuggestion } from "@platelink/shared"
import { createClient } from "@/lib/supabase/client"
import { dishKeys, fetchNearbyDishes, fetchYourDishes } from "@/lib/queries/dishes"
import { useSession } from "@/components/layout/session-context"
import { FoodTypeMark } from "@/components/listings/food-type-dot"
import { cn } from "@/lib/utils"

const SOURCE = {
  yours: { icon: History, label: "You listed this before" },
  nearby: { icon: MapPin, label: "Listed nearby today" },
  catalog: { icon: BookOpen, label: "" },
} as const

type Props = Omit<React.ComponentProps<"input">, "onChange" | "value" | "onSelect"> & {
  value: string
  onChange: (value: string) => void
  onPick?: (s: DishSuggestion) => void
}

/**
 * Dish name input that suggests as you type: your past listings, what canteens
 * nearby are posting, and a catalog of ~150 common canteen dishes. Typos are OK.
 */
export function DishAutocomplete({ value, onChange, onPick, className, ...props }: Props) {
  const { profile, canteen } = useSession()
  const supabase = createClient()
  const listId = useId()
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const boxRef = useRef<HTMLDivElement>(null)

  const yours = useQuery({ queryKey: dishKeys.yours(profile.id), queryFn: () => fetchYourDishes(supabase, profile.id), staleTime: 5 * 60_000 })
  const lat = canteen?.location_lat ?? 0
  const lng = canteen?.location_lng ?? 0
  const nearby = useQuery({
    queryKey: dishKeys.nearby(lat, lng),
    queryFn: () => fetchNearbyDishes(supabase, lat, lng, profile.id),
    enabled: Boolean(canteen),
    staleTime: 5 * 60_000,
  })

  const suggestions = useMemo(
    () => suggestDishes(value, { yours: yours.data, nearby: nearby.data }, 7),
    [value, yours.data, nearby.data]
  )
  const show = open && suggestions.length > 0 && !(suggestions.length === 1 && suggestions[0]!.name.toLowerCase() === value.trim().toLowerCase())

  function pick(s: DishSuggestion) {
    onChange(s.name)
    onPick?.(s)
    setOpen(false)
  }

  return (
    <div
      ref={boxRef}
      className="relative"
      onBlur={(e) => {
        if (!boxRef.current?.contains(e.relatedTarget as Node)) setOpen(false)
      }}
    >
      <input
        {...props}
        value={value}
        autoComplete="off"
        role="combobox"
        aria-expanded={show}
        aria-controls={listId}
        aria-autocomplete="list"
        className={cn("input-well flex h-11 w-full rounded-xl px-3.5 text-[15px] placeholder:text-muted-foreground/70", className)}
        onChange={(e) => {
          onChange(e.target.value)
          setOpen(true)
          setActive(0)
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (!show) return
          if (e.key === "ArrowDown") {
            e.preventDefault()
            setActive((a) => (a + 1) % suggestions.length)
          } else if (e.key === "ArrowUp") {
            e.preventDefault()
            setActive((a) => (a - 1 + suggestions.length) % suggestions.length)
          } else if (e.key === "Enter") {
            e.preventDefault()
            pick(suggestions[active]!)
          } else if (e.key === "Escape") {
            setOpen(false)
          }
        }}
      />
      {show && (
        <ul
          id={listId}
          role="listbox"
          className="absolute z-30 mt-2 max-h-80 w-full overflow-auto rounded-xl border-2 border-border-strong bg-popover p-1.5 shadow-[0_18px_40px_-18px_rgb(50_55_59/0.5)]"
        >
          {suggestions.map((s, i) => {
            const meta = SOURCE[s.source]
            const Icon = meta.icon
            return (
              <li
                key={s.source + s.name}
                role="option"
                aria-selected={i === active}
                onMouseEnter={() => setActive(i)}
                onMouseDown={(e) => {
                  e.preventDefault()
                  pick(s)
                }}
                className={cn(
                  "flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5",
                  i === active ? "bg-accent text-accent-foreground" : "text-foreground"
                )}
              >
                <Icon className="size-4 shrink-0 opacity-60" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold">{s.name}</span>
                  <span className={cn("block text-xs", i === active ? "text-gunmetal/75" : "text-muted-foreground")}>
                    {[meta.label, s.dish && PREP_CATEGORY_LABEL[s.dish.category], s.dish && FOOD_TYPE_LABEL[s.dish.foodType]]
                      .filter(Boolean)
                      .join(", ")}
                  </span>
                </span>
                {s.dish && <FoodTypeMark type={s.dish.foodType} />}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
