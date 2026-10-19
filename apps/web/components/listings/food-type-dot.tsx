import { FOOD_TYPE_LABEL, type FoodType } from "@platelink/shared"
import { cn } from "@/lib/utils"

/** Indian veg/non-veg marking convention: green square-dot vs red/brown. */
export function FoodTypeMark({ type, withLabel = false }: { type: FoodType; withLabel?: boolean }) {
  const color = type === "non_veg" ? "border-red-600 bg-red-600" : type === "mixed" ? "border-amber-600 bg-amber-600" : "border-emerald-600 bg-emerald-600"
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground" title={FOOD_TYPE_LABEL[type]}>
      <span className={cn("flex size-3.5 items-center justify-center rounded-[3px] border-[1.5px] bg-transparent", color.split(" ")[0])}>
        <span className={cn("size-1.5 rounded-full", color.split(" ")[1])} />
      </span>
      {withLabel && FOOD_TYPE_LABEL[type]}
    </span>
  )
}
