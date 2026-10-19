import React, { useState } from "react"
import { ScrollView, StyleSheet, View } from "react-native"
import { useRouter } from "expo-router"
import {
  ArrowLeft,
  Moon,
  Sparkles,
  Sun,
  UtensilsCrossed,
} from "lucide-react-native"
import {
  Badge,
  Card,
  Chip,
  ChipGroup,
  ChromeHeader,
  EmptyState,
  ErrorState,
  FloatingLabelInput,
  PressButton,
  Skeleton,
  Switch,
  Text,
  TicketCard,
  WellInput,
} from "@/components/ui"
import { useTheme } from "@/theme"

export default function DesignSystemScreen() {
  const router = useRouter()
  const { theme, isDark, toggleMode } = useTheme()

  // State for interactive showcase controls
  const [switchVal, setSwitchVal] = useState(true)
  const [selectedDiet, setSelectedDiet] = useState("veg")
  const [inputText, setInputText] = useState("")
  const [floatingText, setFloatingText] = useState("+91 98765 43210")
  const [errorInput, setErrorInput] = useState("")

  const dietOptions = [
    { label: "Veg", value: "veg" },
    { label: "Non-veg", value: "non_veg" },
    { label: "Vegan", value: "vegan" },
    { label: "Mixed", value: "mixed" },
  ]

  return (
    <View style={[styles.root, { backgroundColor: theme.colors.canvas }]}>
      {/* Dark Gunmetal Chrome Header */}
      <ChromeHeader
        title="Design system"
        subtitle="Plate-Link mobile component gallery"
        leftAction={
          <PressButton
            variant="ghost"
            size="sm"
            onPress={() => router.back()}
            leftIcon={<ArrowLeft size={18} color={theme.colors.chromeInk} />}
            accessibilityLabel="Go back"
          >
            Back
          </PressButton>
        }
        rightAction={
          <PressButton
            variant="dark"
            size="sm"
            onPress={toggleMode}
            leftIcon={
              isDark ? (
                <Sun size={15} color={theme.colors.chromeInk} />
              ) : (
                <Moon size={15} color={theme.colors.chromeInk} />
              )
            }
            accessibilityLabel={`Switch to ${isDark ? "light" : "dark"} mode`}
          >
            {isDark ? "Light" : "Dark"}
          </PressButton>
        }
      />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Section: Typography */}
        <Section title="Typography">
          <View style={styles.typeStack}>
            <View style={styles.typeRow}>
              <Text variant="caption" muted style={styles.typeLabel}>
                Display (39px Bricolage)
              </Text>
              <Text variant="display">Plate-Link food surplus</Text>
            </View>

            <View style={styles.typeRow}>
              <Text variant="caption" muted style={styles.typeLabel}>
                Heading 1 (31px Bricolage)
              </Text>
              <Text variant="h1">Redistribute fresh meals</Text>
            </View>

            <View style={styles.typeRow}>
              <Text variant="caption" muted style={styles.typeLabel}>
                Heading 2 (25px Bricolage)
              </Text>
              <Text variant="h2">Driver pickup routes</Text>
            </View>

            <View style={styles.typeRow}>
              <Text variant="caption" muted style={styles.typeLabel}>
                Heading 3 (20px Bricolage)
              </Text>
              <Text variant="h3">Verified NGO shelters</Text>
            </View>

            <View style={styles.typeRow}>
              <Text variant="caption" muted style={styles.typeLabel}>
                Body (16px Geist)
              </Text>
              <Text variant="body">
                Connecting campus canteens, drivers, and local communities to
                eliminate food waste in real time.
              </Text>
            </View>

            <View style={styles.typeRow}>
              <Text variant="caption" muted style={styles.typeLabel}>
                Small (14px Geist)
              </Text>
              <Text variant="small" muted>
                Estimated travel duration is 12 minutes under normal traffic.
              </Text>
            </View>

            <View style={styles.typeRow}>
              <Text variant="caption" muted style={styles.typeLabel}>
                Caption (12px Geist)
              </Text>
              <Text variant="caption" muted>
                Posted at 6:45 PM by North cafeteria
              </Text>
            </View>
          </View>
        </Section>

        {/* Section: Tactile Buttons */}
        <Section title="Buttons">
          <Text variant="small" muted style={styles.sectionSubtitle}>
            Tactile 3D press buttons with Reanimated spring physics and haptics.
          </Text>

          <View style={styles.buttonGrid}>
            <PressButton variant="default" fullWidth>
              Primary action (Blushed Brick)
            </PressButton>

            <PressButton variant="accent" fullWidth>
              Accent action (Honey Bronze)
            </PressButton>

            <PressButton variant="dark" fullWidth>
              Dark chrome button
            </PressButton>

            <PressButton variant="outline" fullWidth>
              Outline button
            </PressButton>

            <PressButton variant="ghost" fullWidth>
              Ghost button
            </PressButton>
          </View>

          <Text variant="caption" muted style={styles.subHeading}>
            Button sizes
          </Text>
          <View style={styles.inlineRow}>
            <PressButton variant="default" size="sm">
              Small (44px)
            </PressButton>
            <PressButton variant="default" size="md">
              Medium (48px)
            </PressButton>
            <PressButton variant="default" size="lg">
              Large (54px)
            </PressButton>
          </View>

          <Text variant="caption" muted style={styles.subHeading}>
            States
          </Text>
          <View style={styles.inlineRow}>
            <PressButton variant="default" loading size="sm">
              Loading
            </PressButton>
            <PressButton variant="default" disabled size="sm">
              Disabled
            </PressButton>
          </View>
        </Section>

        {/* Section: Text Inputs */}
        <Section title="Inputs">
          <Text variant="small" muted style={styles.sectionSubtitle}>
            Inset well styling with honey focus glow, 1px lift, and floating
            labels.
          </Text>

          <View style={styles.inputStack}>
            <WellInput
              label="Canteen name"
              placeholder="e.g. Science block cafeteria"
              value={inputText}
              onChangeText={setInputText}
              hint="Enter your campus dining hall name"
            />

            <FloatingLabelInput
              label="Driver phone number"
              value={floatingText}
              onChangeText={setFloatingText}
              hint="Floating label animates to top on focus"
            />

            <WellInput
              label="Pickup location"
              value={errorInput}
              onChangeText={setErrorInput}
              placeholder="Building or gate number"
              error="Pickup location is required for driver navigation"
            />
          </View>
        </Section>

        {/* Section: Choice Chips */}
        <Section title="Choice chips">
          <Text variant="small" muted style={styles.sectionSubtitle}>
            Radio choice chips with 3px key bottom edge and honey selection
            state.
          </Text>

          <View style={styles.chipStack}>
            <View style={styles.inlineRow}>
              <Chip label="Unselected key" selected={false} />
              <Chip label="Selected key" selected={true} />
            </View>

            <Text variant="caption" muted style={styles.subHeading}>
              Dietary preference group
            </Text>
            <ChipGroup
              options={dietOptions}
              value={selectedDiet}
              onChange={setSelectedDiet}
            />
          </View>
        </Section>

        {/* Section: Switches */}
        <Section title="Switches">
          <Text variant="small" muted style={styles.sectionSubtitle}>
            Reanimated pill track with sliding knob and honey active fill.
          </Text>

          <View style={styles.switchRow}>
            <View style={styles.switchInfo}>
              <Text variant="body" weight="medium">
                Live delivery alerts
              </Text>
              <Text variant="caption" muted>
                Notify when new surplus meals are posted nearby
              </Text>
            </View>
            <Switch
              value={switchVal}
              onValueChange={setSwitchVal}
              accessibilityLabel="Toggle live delivery alerts"
            />
          </View>

          <View style={[styles.switchRow, { marginTop: 12 }]}>
            <View style={styles.switchInfo}>
              <Text variant="body" weight="medium">
                Disabled switch
              </Text>
              <Text variant="caption" muted>
                System setting managed by administrator
              </Text>
            </View>
            <Switch
              value={false}
              disabled
              onValueChange={() => {}}
              accessibilityLabel="Disabled toggle switch"
            />
          </View>
        </Section>

        {/* Section: Badges */}
        <Section title="Badges">
          <Text variant="small" muted style={styles.sectionSubtitle}>
            Status badges mapped to design tokens for food listings and delivery
            orders.
          </Text>

          <Text variant="caption" muted style={styles.subHeading}>
            Listing statuses
          </Text>
          <View style={styles.badgeWrap}>
            <Badge status="available" />
            <Badge status="claimed" />
            <Badge status="picked_up" />
            <Badge status="delivered" />
            <Badge status="expired" />
            <Badge status="cancelled" />
          </View>

          <Text variant="caption" muted style={styles.subHeading}>
            Order statuses
          </Text>
          <View style={styles.badgeWrap}>
            <Badge status="pending_driver" />
            <Badge status="driver_assigned" />
            <Badge status="on_the_way" />
            <Badge status="completed" />
          </View>

          <Text variant="caption" muted style={styles.subHeading}>
            Color variants
          </Text>
          <View style={styles.badgeWrap}>
            <Badge variant="default" label="Default brick" />
            <Badge variant="honey" label="Honey bronze" />
            <Badge variant="silk" label="Almond silk" />
            <Badge variant="iron" label="Iron grey" />
            <Badge variant="gunmetal" label="Gunmetal" />
            <Badge variant="outline" label="Outline" />
            <Badge variant="destructive" label="Destructive" />
          </View>
        </Section>

        {/* Section: Ticket Cards */}
        <Section title="Kitchen order tickets">
          <Text variant="small" muted style={styles.sectionSubtitle}>
            Listing tickets with half-circle perforation notches, dashed cut
            lines, and portion counters.
          </Text>

          <View style={styles.ticketStack}>
            {/* Example Ticket 1: Available Veg biryani 40 portions */}
            <TicketCard
              title="Veg biryani"
              portions={40}
              status="available"
              meta="Veg, prepared 20 mins ago at Main cafeteria"
              expiryText="Good until 8:30 PM today"
              actionText="Claim portions"
              photoUrl="https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?w=800&auto=format&fit=crop&q=80"
              onPress={() => {}}
            />

            {/* Example Ticket 2: Claimed Chapati & dal 65 portions */}
            <TicketCard
              title="Chapati & dal"
              portions={65}
              status="claimed"
              meta="Veg, South campus dining hall"
              expiryText="Claimed by City Shelter Foundation"
              actionText="Track delivery"
              onPress={() => {}}
            />
          </View>
        </Section>

        {/* Section: Base Card */}
        <Section title="Card container">
          <Card>
            <View style={styles.cardContent}>
              <View style={styles.cardHeader}>
                <Sparkles size={20} color={theme.colors.accent} />
                <Text variant="h3" style={{ marginLeft: 8 }}>
                  Shared prep intelligence
                </Text>
              </View>
              <Text variant="body" muted style={{ marginTop: 6 }}>
                The mobile driver and recipient apps sync with the web prep
                planner to predict surplus volumes before dining services end.
              </Text>
            </View>
          </Card>
        </Section>

        {/* Section: Skeletons & Feedback States */}
        <Section title="Feedback & states">
          <Text variant="caption" muted style={styles.subHeading}>
            Pulsing skeleton loader (respects reduced motion)
          </Text>
          <View style={styles.skeletonCard}>
            <Skeleton height={20} width="65%" borderRadius={6} />
            <Skeleton height={14} width="90%" borderRadius={4} />
            <Skeleton height={14} width="40%" borderRadius={4} />
          </View>

          <Text variant="caption" muted style={styles.subHeading}>
            Empty state
          </Text>
          <EmptyState
            icon={
              <UtensilsCrossed size={26} color={theme.palette.blushedBrick} />
            }
            title="No surplus meals right now"
            description="Nearby canteens will post extra portions when cooking batches finish."
            action={
              <PressButton variant="outline" size="sm">
                Refresh listings
              </PressButton>
            }
          />

          <Text variant="caption" muted style={styles.subHeading}>
            Error state
          </Text>
          <ErrorState
            message="Could not reach the Plate-Link server"
            onRetry={() => {}}
          />
        </Section>
      </ScrollView>
    </View>
  )
}

function Section({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  const { theme } = useTheme()

  return (
    <View style={styles.section}>
      <Text
        variant="h2"
        weight="bold"
        style={[styles.sectionTitle, { color: theme.colors.ink }]}
      >
        {title}
      </Text>
      {children}
    </View>
  )
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 48,
  },
  section: {
    marginBottom: 36,
  },
  sectionTitle: {
    marginBottom: 4,
  },
  sectionSubtitle: {
    marginBottom: 16,
  },
  subHeading: {
    marginTop: 18,
    marginBottom: 10,
  },
  typeStack: {
    gap: 16,
  },
  typeRow: {
    gap: 2,
  },
  typeLabel: {
    opacity: 0.8,
  },
  buttonGrid: {
    gap: 12,
  },
  inlineRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    alignItems: "center",
  },
  inputStack: {
    gap: 16,
  },
  chipStack: {
    gap: 12,
  },
  switchRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 8,
  },
  switchInfo: {
    flex: 1,
    marginRight: 16,
  },
  badgeWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  ticketStack: {
    gap: 18,
  },
  cardContent: {
    padding: 4,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
  },
  skeletonCard: {
    gap: 10,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.06)",
  },
})
