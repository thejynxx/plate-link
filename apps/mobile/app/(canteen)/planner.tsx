import React, { useMemo, useState } from "react"
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native"
import { useRouter } from "expo-router"
import * as Haptics from "expo-haptics"
import { Plus, Utensils } from "lucide-react-native"
import {
  findDish,
  palette,
  suggestDishes,
  type DishSuggestion,
} from "@platelink/shared"
import {
  planPrep,
  type PrepCategory,
  type PrepCuisine,
  type PrepPlan,
} from "@platelink/shared/prep-model"
import {
  Badge,
  Card,
  ChromeHeader,
  PressButton,
  Switch,
  Text,
  WellInput,
} from "@/components/ui"
import { useTheme } from "@/theme"

const money = (v: number) => `₹${Math.round(v).toLocaleString("en-IN")}`
const n = (v: number) => Math.round(v).toLocaleString("en-IN")

export default function CanteenPlannerScreen() {
  const router = useRouter()
  const { theme } = useTheme()

  // State
  const [dish, setDish] = useState("Veg biryani")
  const [category, setCategory] = useState<PrepCategory>("Biryani")
  const [cuisine, setCuisine] = useState<PrepCuisine>("Indian")
  const [period, setPeriod] = useState<"day" | "week">("day")
  const [history, setHistory] = useState<[string, string, string, string]>([
    "120",
    "105",
    "130",
    "112",
  ])
  const [price, setPrice] = useState("80")
  const [cost, setCost] = useState("32")
  const [discount, setDiscount] = useState(0)
  const [announced, setAnnounced] = useState(false)
  const [featured, setFeatured] = useState(false)

  // Autocomplete
  const [showSuggestions, setShowSuggestions] = useState(false)
  const suggestions = useMemo(() => {
    if (!dish || dish.trim().length < 2) return []
    return suggestDishes(dish, {}, 5)
  }, [dish])

  const handleSelectDish = (s: DishSuggestion) => {
    Haptics.selectionAsync().catch(() => {})
    setDish(s.name)
    setShowSuggestions(false)
    if (s.dish) {
      setCategory(s.dish.category as PrepCategory)
      setCuisine(s.dish.cuisine as PrepCuisine)
    }
  }

  const handleDishChange = (text: string) => {
    setDish(text)
    setShowSuggestions(true)
    const match = findDish(text)
    if (match) {
      setCategory(match.category as PrepCategory)
      setCuisine(match.cuisine as PrepCuisine)
    }
  }

  const nums = history.map((h) => Number(h))
  const valid =
    nums.every((v) => Number.isFinite(v) && v >= 0) &&
    nums.some((v) => v > 0) &&
    Number(price) > 0 &&
    Number(cost) >= 0 &&
    Number(cost) < Number(price)

  // Client-side LightGBM quantile prediction + Newsvendor model (Rule 14)
  const plan: PrepPlan | null = useMemo(() => {
    if (!valid) return null
    try {
      return planPrep(
        {
          category,
          cuisine,
          history: nums as [number, number, number, number],
          discount: discount / 100,
          announced,
          featured,
        },
        { price: Number(price), cost: Number(cost) }
      )
    } catch {
      return null
    }
  }, [valid, category, cuisine, nums, discount, announced, featured, price, cost])

  const histLabels =
    period === "day"
      ? ["Same day last week", "2 weeks ago", "3 weeks ago", "4 weeks ago"]
      : ["Last week", "2 weeks ago", "3 weeks ago", "4 weeks ago"]

  return (
    <View style={[styles.root, { backgroundColor: theme.colors.canvas }]}>
      <ChromeHeader
        title="ML prep planner"
        subtitle="Forecast demand & minimize leftover waste"
      />

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Main Recommended Result Card in Structural Gunmetal Chrome */}
          <View
            style={[
              styles.resultCard,
              {
                backgroundColor: theme.colors.chrome,
                borderColor: theme.colors.borderStrong,
              },
            ]}
          >
            {plan ? (
              <>
                <View style={styles.resultHeader}>
                  <Text
                    variant="small"
                    style={{ color: theme.colors.chromeMuted }}
                  >
                    Cook for {dish || "this dish"}
                  </Text>
                  <Badge variant="honey">
                    {period === "day" ? "Daily batch" : "Weekly batch"}
                  </Badge>
                </View>

                {/* Big Bricolage Recommended Number */}
                <Text
                  variant="display"
                  style={[styles.bigNumber, { color: theme.colors.accent }]}
                >
                  {n(plan.recommended)}
                </Text>
                <Text
                  variant="body"
                  weight="medium"
                  style={{ color: theme.colors.chromeInk, marginTop: -4 }}
                >
                  portions {period === "day" ? "for the day" : "for the week"}
                </Text>

                <Text
                  variant="small"
                  style={[
                    styles.forecastInsight,
                    { color: theme.colors.chromeMuted },
                  ]}
                >
                  Most likely you&apos;ll sell around{" "}
                  <Text
                    variant="small"
                    weight="bold"
                    style={{ color: theme.colors.chromeInk }}
                  >
                    {n(plan.median)}
                  </Text>
                  , and almost certainly between {n(plan.p10)} and {n(plan.p90)}{" "}
                  portions.
                </Text>

                {/* 2x2 Metric Board */}
                <View
                  style={[
                    styles.metricsGrid,
                    { borderColor: "rgba(255, 255, 255, 0.1)" },
                  ]}
                >
                  <View
                    style={[
                      styles.metricCell,
                      {
                        borderRightWidth: 1,
                        borderBottomWidth: 1,
                        borderColor: "rgba(255, 255, 255, 0.1)",
                      },
                    ]}
                  >
                    <Text
                      variant="caption"
                      style={{ color: theme.colors.chromeMuted }}
                    >
                      Expected leftovers
                    </Text>
                    <Text
                      variant="h3"
                      style={{ color: theme.colors.chromeInk, marginTop: 4 }}
                    >
                      {n(plan.expectedLeftover)}
                    </Text>
                    <Text
                      variant="caption"
                      style={{
                        color: theme.colors.chromeMuted,
                        fontSize: 10,
                        marginTop: 2,
                      }}
                    >
                      {n(plan.baseline.expectedLeftover)} if unoptimized
                    </Text>
                  </View>

                  <View
                    style={[
                      styles.metricCell,
                      {
                        borderBottomWidth: 1,
                        borderColor: "rgba(255, 255, 255, 0.1)",
                      },
                    ]}
                  >
                    <Text
                      variant="caption"
                      style={{ color: theme.colors.chromeMuted }}
                    >
                      Missed sales
                    </Text>
                    <Text
                      variant="h3"
                      style={{ color: theme.colors.chromeInk, marginTop: 4 }}
                    >
                      {n(plan.expectedShort)}
                    </Text>
                    <Text
                      variant="caption"
                      style={{
                        color: theme.colors.chromeMuted,
                        fontSize: 10,
                        marginTop: 2,
                      }}
                    >
                      {n(plan.baseline.expectedShort)} without model
                    </Text>
                  </View>

                  <View
                    style={[
                      styles.metricCell,
                      {
                        borderRightWidth: 1,
                        borderColor: "rgba(255, 255, 255, 0.1)",
                      },
                    ]}
                  >
                    <Text
                      variant="caption"
                      style={{ color: theme.colors.chromeMuted }}
                    >
                      Expected profit
                    </Text>
                    <Text
                      variant="h3"
                      style={{ color: theme.colors.accent, marginTop: 4 }}
                    >
                      {money(plan.expectedProfit)}
                    </Text>
                    <Text
                      variant="caption"
                      style={{
                        color: theme.colors.chromeMuted,
                        fontSize: 10,
                        marginTop: 2,
                      }}
                    >
                      {money(plan.baseline.expectedProfit)} baseline
                    </Text>
                  </View>

                  <View style={styles.metricCell}>
                    <Text
                      variant="caption"
                      style={{ color: theme.colors.chromeMuted }}
                    >
                      Chance run out
                    </Text>
                    <Text
                      variant="h3"
                      style={{ color: theme.colors.chromeInk, marginTop: 4 }}
                    >
                      {Math.round((1 - plan.serviceLevel) * 100)}%
                    </Text>
                    <Text
                      variant="caption"
                      style={{
                        color: theme.colors.chromeMuted,
                        fontSize: 10,
                        marginTop: 2,
                      }}
                    >
                      from margin ratio
                    </Text>
                  </View>
                </View>

                {/* Quick Post Leftovers Action */}
                <PressButton
                  variant="accent"
                  size="md"
                  fullWidth
                  onPress={() => router.push("/(canteen)/post" as any)}
                  leftIcon={<Plus size={16} color={palette.gunmetal} />}
                  style={{ marginTop: 14 }}
                  accessibilityLabel="Post leftovers on Plate-Link"
                >
                  Post leftovers after service
                </PressButton>
              </>
            ) : (
              <View style={{ padding: 16, alignItems: "center" }}>
                <Text
                  variant="body"
                  muted
                  style={{ color: theme.colors.chromeMuted }}
                >
                  Enter sales history, price and cost to see an ML prediction.
                </Text>
              </View>
            )}
          </View>

          {/* Form Controls */}
          <Card style={styles.formCard}>
            {/* Dish Name */}
            <View style={styles.fieldGroup}>
              <Text variant="caption" weight="semibold" style={styles.label}>
                Dish name
              </Text>
              <WellInput
                value={dish}
                onChangeText={handleDishChange}
                placeholder="Dish name..."
                accessibilityLabel="Planner dish name"
              />

              {showSuggestions && suggestions.length > 0 ? (
                <View
                  style={[
                    styles.suggestionsBox,
                    {
                      backgroundColor: theme.colors.surfaceSunken,
                      borderColor: theme.colors.border,
                    },
                  ]}
                >
                  {suggestions.map((s) => (
                    <Pressable
                      key={s.name}
                      onPress={() => handleSelectDish(s)}
                      style={[
                        styles.suggestionRow,
                        { borderBottomColor: theme.colors.border },
                      ]}
                    >
                      <Utensils
                        size={14}
                        color={palette.honeyBronze}
                        style={{ marginRight: 8 }}
                      />
                      <Text variant="small" style={{ flex: 1 }}>
                        {s.name}
                      </Text>
                      <Badge variant="silk">
                        {s.dish?.category || "Dish"}
                      </Badge>
                    </Pressable>
                  ))}
                </View>
              ) : null}
            </View>

            {/* Planning Period Toggle */}
            <View style={styles.fieldGroup}>
              <Text variant="caption" weight="semibold" style={styles.label}>
                Planning horizon
              </Text>
              <View style={styles.periodRow}>
                {(["day", "week"] as const).map((p) => (
                  <Pressable
                    key={p}
                    onPress={() => {
                      Haptics.selectionAsync().catch(() => {})
                      setPeriod(p)
                    }}
                    style={[
                      styles.periodChip,
                      {
                        backgroundColor:
                          period === p
                            ? theme.colors.accent
                            : theme.colors.surfaceSunken,
                        borderColor:
                          period === p
                            ? theme.colors.accent
                            : theme.colors.border,
                      },
                    ]}
                  >
                    <Text
                      variant="caption"
                      weight={period === p ? "bold" : "medium"}
                      style={{
                        color:
                          period === p
                            ? palette.gunmetal
                            : theme.colors.ink,
                      }}
                    >
                      Plan a {p}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>

            {/* Last 4 periods sold */}
            <View style={styles.fieldGroup}>
              <Text variant="caption" weight="semibold" style={styles.label}>
                Portions sold in past 4 {period}s (newest first)
              </Text>
              <View style={styles.historyGrid}>
                {histLabels.map((lbl, i) => (
                  <View key={lbl} style={styles.historyCell}>
                    <Text
                      variant="caption"
                      numberOfLines={1}
                      muted
                      style={styles.cellLabel}
                    >
                      {lbl}
                    </Text>
                    <WellInput
                      value={history[i]}
                      onChangeText={(val) => {
                        const next = [...history] as typeof history
                        next[i] = val
                        setHistory(next)
                      }}
                      keyboardType="numeric"
                      style={styles.numberInput}
                    />
                  </View>
                ))}
              </View>
            </View>

            {/* Price & Cost */}
            <View style={styles.pricesRow}>
              <View style={{ flex: 1, gap: 6 }}>
                <Text variant="caption" weight="semibold" style={styles.label}>
                  Selling price (₹)
                </Text>
                <WellInput
                  value={price}
                  onChangeText={setPrice}
                  keyboardType="numeric"
                  placeholder="80"
                  accessibilityLabel="Selling price per portion"
                />
              </View>
              <View style={{ flex: 1, gap: 6 }}>
                <Text variant="caption" weight="semibold" style={styles.label}>
                  Cost to make (₹)
                </Text>
                <WellInput
                  value={cost}
                  onChangeText={setCost}
                  keyboardType="numeric"
                  placeholder="32"
                  accessibilityLabel="Cost per portion"
                />
              </View>
            </View>
            {Number(cost) >= Number(price) ? (
              <Text variant="caption" style={{ color: palette.blushedBrick }}>
                Cost should be below the selling price.
              </Text>
            ) : null}

            {/* Toggles */}
            <View style={styles.switchRow}>
              <View style={{ flex: 1, marginRight: 12 }}>
                <Text variant="small" weight="semibold">
                  Announced in advance
                </Text>
                <Text variant="caption" muted>
                  WhatsApp, email or notice board notice
                </Text>
              </View>
              <Switch
                value={announced}
                onValueChange={setAnnounced}
                accessibilityLabel="Announced in advance"
              />
            </View>
            <View style={styles.switchRow}>
              <View style={{ flex: 1, marginRight: 12 }}>
                <Text variant="small" weight="semibold">
                  Today&apos;s special / featured
                </Text>
                <Text variant="caption" muted>
                  Featured at front counter or menu board
                </Text>
              </View>
              <Switch
                value={featured}
                onValueChange={setFeatured}
                accessibilityLabel="Today's special / featured"
              />
            </View>
            <View style={styles.switchRow}>
              <View style={{ flex: 1, marginRight: 12 }}>
                <Text variant="small" weight="semibold">
                  Promotional discount
                </Text>
                <Text variant="caption" muted>
                  {discount > 0 ? `${discount}% off regular price` : "No discount applied"}
                </Text>
              </View>
              <View style={{ flexDirection: "row", gap: 6 }}>
                {[0, 10, 20].map((pct) => (
                  <Pressable
                    key={pct}
                    onPress={() => {
                      Haptics.selectionAsync().catch(() => {})
                      setDiscount(pct)
                    }}
                    style={[
                      styles.periodChip,
                      {
                        paddingHorizontal: 10,
                        backgroundColor:
                          discount === pct
                            ? theme.colors.accent
                            : theme.colors.surfaceSunken,
                        borderColor:
                          discount === pct
                            ? theme.colors.accent
                            : theme.colors.border,
                      },
                    ]}
                  >
                    <Text
                      variant="caption"
                      weight="semibold"
                      style={{
                        color:
                          discount === pct
                            ? theme.colors.accentInk
                            : theme.colors.ink,
                      }}
                    >
                      {pct}%
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>
          </Card>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  )
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
    gap: 16,
  },
  resultCard: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 20,
    overflow: "hidden",
  },
  resultHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  bigNumber: {
    fontSize: 72,
    lineHeight: 76,
    fontWeight: "900",
    letterSpacing: -2,
    marginTop: 4,
  },
  forecastInsight: {
    lineHeight: 20,
    marginTop: 10,
    marginBottom: 16,
  },
  metricsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    borderWidth: 1,
    borderRadius: 14,
    overflow: "hidden",
  },
  metricCell: {
    width: "50%",
    padding: 12,
  },
  formCard: {
    padding: 16,
    gap: 16,
  },
  fieldGroup: {
    gap: 6,
  },
  label: {
    letterSpacing: -0.1,
  },
  suggestionsBox: {
    borderWidth: 1,
    borderRadius: 10,
    marginTop: 4,
    overflow: "hidden",
  },
  suggestionRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderBottomWidth: 1,
  },
  periodRow: {
    flexDirection: "row",
    gap: 8,
  },
  periodChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
  },
  historyGrid: {
    flexDirection: "row",
    gap: 8,
  },
  historyCell: {
    flex: 1,
    gap: 4,
  },
  cellLabel: {
    fontSize: 10,
  },
  numberInput: {
    textAlign: "center",
    fontSize: 16,
    fontWeight: "700",
  },
  pricesRow: {
    flexDirection: "row",
    gap: 12,
  },
  switchRow: {
    paddingTop: 4,
  },
})
