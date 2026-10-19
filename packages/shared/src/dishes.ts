/**
 * Dish catalog + fuzzy matching for "what are you listing?" suggestions.
 * Each dish maps onto the prep model's category/cuisine so the planner and the
 * listing form share one vocabulary. Works in web and React Native (no deps).
 */
import type { FoodType } from "./constants"

export type DishCategory =
  | "Biryani" | "Rice Bowl" | "Starters" | "Other Snacks" | "Sandwich" | "Pasta" | "Pizza"
  | "Salad" | "Soup" | "Fish" | "Seafood" | "Desert" | "Beverages" | "Extras"
export type DishCuisine = "Indian" | "Continental" | "Italian" | "Thai"

export type Dish = {
  name: string
  category: DishCategory
  cuisine: DishCuisine
  foodType: FoodType
  aliases?: string[]
}

const d = (name: string, category: DishCategory, cuisine: DishCuisine, foodType: FoodType, aliases?: string[]): Dish => ({
  name, category, cuisine, foodType, aliases,
})

export const DISHES: Dish[] = [
  // Biryani & pulao
  d("Veg biryani", "Biryani", "Indian", "veg", ["vegetable biryani"]),
  d("Chicken biryani", "Biryani", "Indian", "non_veg", ["chicken briyani", "kozhi biryani"]),
  d("Mutton biryani", "Biryani", "Indian", "non_veg"),
  d("Egg biryani", "Biryani", "Indian", "non_veg", ["mutta biryani"]),
  d("Paneer biryani", "Biryani", "Indian", "veg"),
  d("Mushroom biryani", "Biryani", "Indian", "veg"),
  d("Hyderabadi dum biryani", "Biryani", "Indian", "non_veg", ["dum biryani"]),
  d("Ambur biryani", "Biryani", "Indian", "non_veg"),
  d("Veg pulao", "Biryani", "Indian", "veg", ["pulav", "pilaf"]),
  d("Kuska", "Biryani", "Indian", "veg", ["plain biryani"]),
  // Rice & meals
  d("Veg meals", "Rice Bowl", "Indian", "veg", ["thali", "south indian meals", "full meals"]),
  d("North Indian thali", "Rice Bowl", "Indian", "veg", ["thali"]),
  d("Curd rice", "Rice Bowl", "Indian", "veg", ["thayir sadam", "dahi chawal"]),
  d("Lemon rice", "Rice Bowl", "Indian", "veg", ["chitranna"]),
  d("Tamarind rice", "Rice Bowl", "Indian", "veg", ["puliyodarai", "puliyogare"]),
  d("Sambar rice", "Rice Bowl", "Indian", "veg", ["sambar sadam"]),
  d("Bisi bele bath", "Rice Bowl", "Indian", "veg"),
  d("Tomato rice", "Rice Bowl", "Indian", "veg"),
  d("Coconut rice", "Rice Bowl", "Indian", "veg"),
  d("Jeera rice", "Rice Bowl", "Indian", "veg"),
  d("Steamed rice", "Rice Bowl", "Indian", "veg", ["plain rice", "white rice"]),
  d("Rajma chawal", "Rice Bowl", "Indian", "veg"),
  d("Chole rice", "Rice Bowl", "Indian", "veg", ["chana rice"]),
  d("Dal khichdi", "Rice Bowl", "Indian", "veg", ["khichdi", "pongal"]),
  d("Ven pongal", "Rice Bowl", "Indian", "veg", ["khara pongal"]),
  d("Veg fried rice", "Rice Bowl", "Thai", "veg", ["fried rice"]),
  d("Egg fried rice", "Rice Bowl", "Thai", "non_veg"),
  d("Chicken fried rice", "Rice Bowl", "Thai", "non_veg"),
  d("Schezwan fried rice", "Rice Bowl", "Thai", "veg", ["szechuan rice"]),
  d("Chicken curry with rice", "Rice Bowl", "Indian", "non_veg", ["chicken curry"]),
  d("Fish curry rice", "Fish", "Indian", "non_veg", ["meen kuzhambu", "fish curry"]),
  d("Dal tadka", "Extras", "Indian", "veg", ["dal fry", "dal"]),
  d("Sambar", "Extras", "Indian", "veg"),
  d("Rasam", "Soup", "Indian", "veg"),
  d("Paneer butter masala", "Extras", "Indian", "veg", ["paneer masala"]),
  d("Chana masala", "Extras", "Indian", "veg", ["chole"]),
  d("Aloo gobi", "Extras", "Indian", "veg"),
  d("Mixed veg curry", "Extras", "Indian", "veg", ["veg kurma", "kurma", "korma"]),
  d("Butter chicken", "Extras", "Indian", "non_veg", ["murgh makhani"]),
  d("Egg curry", "Extras", "Indian", "non_veg", ["egg masala"]),
  // Breads & tiffin
  d("Chapati", "Extras", "Indian", "veg", ["roti", "phulka"]),
  d("Parotta", "Extras", "Indian", "veg", ["paratha", "porotta"]),
  d("Poori", "Extras", "Indian", "veg", ["puri", "poori masala"]),
  d("Aloo paratha", "Extras", "Indian", "veg"),
  d("Naan", "Extras", "Indian", "veg", ["butter naan"]),
  d("Idli", "Other Snacks", "Indian", "veg", ["idly", "idli sambar"]),
  d("Dosa", "Other Snacks", "Indian", "veg", ["plain dosa", "dosai"]),
  d("Masala dosa", "Other Snacks", "Indian", "veg"),
  d("Uttapam", "Other Snacks", "Indian", "veg", ["oothappam"]),
  d("Medu vada", "Other Snacks", "Indian", "veg", ["vada", "ulundu vadai"]),
  d("Upma", "Other Snacks", "Indian", "veg", ["rava upma", "uppittu"]),
  d("Poha", "Other Snacks", "Indian", "veg", ["aval"]),
  d("Pav bhaji", "Other Snacks", "Indian", "veg"),
  d("Chole bhature", "Other Snacks", "Indian", "veg"),
  d("Vada pav", "Other Snacks", "Indian", "veg"),
  d("Samosa", "Other Snacks", "Indian", "veg"),
  d("Veg puff", "Other Snacks", "Indian", "veg", ["puff"]),
  d("Egg puff", "Other Snacks", "Indian", "non_veg"),
  d("Bonda", "Other Snacks", "Indian", "veg", ["aloo bonda"]),
  d("Bajji", "Other Snacks", "Indian", "veg", ["bhajji", "pakora", "pakoda"]),
  d("Dhokla", "Other Snacks", "Indian", "veg"),
  d("Kachori", "Other Snacks", "Indian", "veg"),
  d("Pani puri", "Other Snacks", "Indian", "veg", ["golgappa", "puchka"]),
  d("Bhel puri", "Other Snacks", "Indian", "veg"),
  d("Sundal", "Other Snacks", "Indian", "vegan"),
  // Starters / Indo-Chinese
  d("Gobi manchurian", "Starters", "Thai", "veg", ["cauliflower manchurian"]),
  d("Veg manchurian", "Starters", "Thai", "veg"),
  d("Chilli paneer", "Starters", "Thai", "veg"),
  d("Chilli chicken", "Starters", "Thai", "non_veg"),
  d("Chicken 65", "Starters", "Indian", "non_veg"),
  d("Paneer tikka", "Starters", "Indian", "veg"),
  d("Chicken tikka", "Starters", "Indian", "non_veg"),
  d("Tandoori chicken", "Starters", "Indian", "non_veg"),
  d("Spring rolls", "Starters", "Thai", "veg", ["veg spring roll"]),
  d("Veg momos", "Starters", "Thai", "veg", ["momo", "dumplings"]),
  d("Chicken momos", "Starters", "Thai", "non_veg"),
  d("French fries", "Starters", "Continental", "vegan", ["fries", "chips"]),
  // Noodles & pasta
  d("Veg hakka noodles", "Pasta", "Thai", "veg", ["noodles", "chowmein"]),
  d("Chicken noodles", "Pasta", "Thai", "non_veg"),
  d("Schezwan noodles", "Pasta", "Thai", "veg"),
  d("Maggi", "Pasta", "Indian", "veg", ["instant noodles"]),
  d("White sauce pasta", "Pasta", "Italian", "veg", ["alfredo pasta"]),
  d("Red sauce pasta", "Pasta", "Italian", "veg", ["arrabbiata", "penne arrabbiata"]),
  d("Mac and cheese", "Pasta", "Continental", "veg"),
  // Sandwich / wraps / burgers
  d("Veg sandwich", "Sandwich", "Continental", "veg", ["bombay sandwich"]),
  d("Grilled cheese sandwich", "Sandwich", "Continental", "veg"),
  d("Chicken sandwich", "Sandwich", "Continental", "non_veg"),
  d("Paneer wrap", "Sandwich", "Indian", "veg", ["kathi roll", "frankie"]),
  d("Chicken shawarma", "Sandwich", "Continental", "non_veg", ["shawarma"]),
  d("Veg burger", "Sandwich", "Continental", "veg", ["burger"]),
  d("Chicken burger", "Sandwich", "Continental", "non_veg"),
  // Pizza
  d("Margherita pizza", "Pizza", "Italian", "veg", ["cheese pizza", "pizza"]),
  d("Veg pizza", "Pizza", "Italian", "veg"),
  d("Paneer pizza", "Pizza", "Italian", "veg"),
  d("Chicken pizza", "Pizza", "Italian", "non_veg"),
  // Salad & soup
  d("Green salad", "Salad", "Continental", "vegan", ["salad"]),
  d("Fruit salad", "Salad", "Continental", "vegan", ["cut fruits", "fruit bowl"]),
  d("Sprouts salad", "Salad", "Indian", "vegan", ["sprouts"]),
  d("Kosambari", "Salad", "Indian", "vegan"),
  d("Tomato soup", "Soup", "Continental", "veg"),
  d("Sweet corn soup", "Soup", "Thai", "veg", ["corn soup"]),
  d("Hot and sour soup", "Soup", "Thai", "veg"),
  d("Manchow soup", "Soup", "Thai", "veg"),
  d("Chicken soup", "Soup", "Continental", "non_veg"),
  // Fish & seafood
  d("Fish fry", "Fish", "Indian", "non_veg", ["meen varuval"]),
  d("Fish and chips", "Fish", "Continental", "non_veg"),
  d("Prawn masala", "Seafood", "Indian", "non_veg", ["prawn curry", "eral"]),
  d("Prawn fried rice", "Seafood", "Thai", "non_veg"),
  d("Crab curry", "Seafood", "Indian", "non_veg"),
  // Desserts
  d("Gulab jamun", "Desert", "Indian", "veg"),
  d("Rasgulla", "Desert", "Indian", "veg"),
  d("Kesari", "Desert", "Indian", "veg", ["rava kesari", "sheera"]),
  d("Payasam", "Desert", "Indian", "veg", ["kheer", "semiya payasam"]),
  d("Gajar halwa", "Desert", "Indian", "veg", ["carrot halwa", "halwa"]),
  d("Jalebi", "Desert", "Indian", "veg"),
  d("Rice pudding", "Desert", "Continental", "veg"),
  d("Brownie", "Desert", "Continental", "veg"),
  d("Ice cream", "Desert", "Continental", "veg"),
  d("Laddu", "Desert", "Indian", "veg", ["ladoo", "boondi laddu"]),
  // Beverages
  d("Masala chai", "Beverages", "Indian", "veg", ["tea", "chai"]),
  d("Filter coffee", "Beverages", "Indian", "veg", ["coffee", "kaapi"]),
  d("Buttermilk", "Beverages", "Indian", "veg", ["chaas", "mor", "majjige"]),
  d("Sweet lassi", "Beverages", "Indian", "veg", ["lassi"]),
  d("Fresh lime soda", "Beverages", "Continental", "vegan", ["lime juice", "nimbu pani"]),
  d("Badam milk", "Beverages", "Indian", "veg"),
  d("Rose milk", "Beverages", "Indian", "veg"),
  d("Watermelon juice", "Beverages", "Continental", "vegan", ["juice"]),
  d("Cold coffee", "Beverages", "Continental", "veg"),
  d("Mango lassi", "Beverages", "Indian", "veg"),
  // Sides
  d("Papad", "Extras", "Indian", "vegan", ["appalam", "pappadam"]),
  d("Raita", "Extras", "Indian", "veg", ["onion raita"]),
  d("Curd", "Extras", "Indian", "veg", ["dahi", "yogurt"]),
  d("Pickle", "Extras", "Indian", "vegan", ["achaar"]),
  d("Boiled eggs", "Extras", "Indian", "non_veg", ["egg"]),
  d("Omelette", "Extras", "Indian", "non_veg", ["omelet"]),
  d("Bread", "Extras", "Continental", "veg", ["bread slices", "bun"]),
]

// ----------------------------------------------------------------------------- fuzzy search

export type DishSuggestion = {
  name: string
  source: "catalog" | "yours" | "nearby"
  score: number
  dish?: Dish
}

export function normalizeDish(s: string) {
  return s.toLowerCase().normalize("NFKD").replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim()
}

/** Optimal-string-alignment distance, bounded for speed. */
function editDistance(a: string, b: string, max = 2): number {
  if (Math.abs(a.length - b.length) > max) return max + 1
  const prev2: number[] = []
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (let i = 1; i <= a.length; i++) {
    const cur = [i]
    let rowMin = i
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      let v = Math.min(prev[j]! + 1, cur[j - 1]! + 1, prev[j - 1]! + cost)
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) v = Math.min(v, prev2[j - 2]! + 1)
      cur[j] = v
      rowMin = Math.min(rowMin, v)
    }
    if (rowMin > max) return max + 1
    prev2.splice(0, prev2.length, ...prev)
    prev = cur
  }
  return prev[b.length]!
}

/** 0 = no match, higher = better. Typing order: prefix > word-prefix > substring > typo. */
export function matchScore(query: string, candidate: string): number {
  const q = normalizeDish(query)
  const c = normalizeDish(candidate)
  if (!q || !c) return 0
  if (c === q) return 100
  if (c.startsWith(q)) return 90 - Math.min(10, c.length - q.length) / 2
  const words = c.split(" ")
  const qWords = q.split(" ")
  if (qWords.every((qw) => words.some((w) => w.startsWith(qw)))) return 78
  if (q.length >= 4 && c.includes(q)) return 70
  // Typo tolerance: short words must be typed correctly, longer ones may have 1–2 slips.
  const ok = qWords.every((qw) =>
    words.some((w) => {
      if (qw.length < 4) return w.startsWith(qw)
      const tol = qw.length >= 7 ? 2 : 1
      return editDistance(qw, w.slice(0, qw.length + 1), tol) <= tol || editDistance(qw, w, tol) <= tol
    })
  )
  return ok && q.length >= 4 ? 55 : 0
}

export function suggestDishes(
  query: string,
  extra: { yours?: string[]; nearby?: string[] } = {},
  limit = 8
): DishSuggestion[] {
  const q = query.trim()
  if (q.length < 1) return []
  const out = new Map<string, DishSuggestion>()
  const add = (s: DishSuggestion) => {
    const key = normalizeDish(s.name)
    const prev = out.get(key)
    if (!prev || prev.score < s.score) out.set(key, { ...s, dish: s.dish ?? prev?.dish })
  }

  for (const dish of DISHES) {
    const best = Math.max(matchScore(q, dish.name), ...(dish.aliases ?? []).map((a) => matchScore(q, a) - 4))
    if (best > 0) add({ name: dish.name, source: "catalog", score: best, dish })
  }
  // Your own past dishes and what canteens nearby are listing rank slightly higher.
  for (const name of extra.yours ?? []) {
    const s = matchScore(q, name)
    if (s > 0) add({ name, source: "yours", score: s + 6, dish: findDish(name) })
  }
  for (const name of extra.nearby ?? []) {
    const s = matchScore(q, name)
    if (s > 0) add({ name, source: "nearby", score: s + 3, dish: findDish(name) })
  }
  return [...out.values()].sort((a, b) => b.score - a.score || a.name.length - b.name.length).slice(0, limit)
}

/** Best catalog match for free text (used to pre-fill food type / planner category). */
export function findDish(name: string): Dish | undefined {
  const textWords = new Set(normalizeDish(name).split(" "))
  // "Leftover veg biryani (lunch)" contains every word of "Veg biryani" → strong match
  const contained = (cand: string) => {
    const cw = normalizeDish(cand).split(" ")
    return cw.every((w) => textWords.has(w)) ? 80 + cw.length : 0
  }
  let best: { dish: Dish; score: number } | undefined
  for (const dish of DISHES) {
    const names = [dish.name, ...(dish.aliases ?? [])]
    const s = Math.max(...names.map((n) => Math.max(matchScore(name, n), contained(n))))
    if (s >= 55 && (!best || s > best.score)) best = { dish, score: s }
  }
  return best?.dish
}

export const PREP_CATEGORY_LABEL: Record<DishCategory, string> = {
  Biryani: "Biryani / pulao",
  "Rice Bowl": "Rice & meals",
  Starters: "Starters",
  "Other Snacks": "Snacks & tiffin",
  Sandwich: "Sandwich & wraps",
  Pasta: "Pasta & noodles",
  Pizza: "Pizza",
  Salad: "Salad",
  Soup: "Soup",
  Fish: "Fish",
  Seafood: "Seafood",
  Desert: "Dessert",
  Beverages: "Beverages",
  Extras: "Sides & curries",
}
