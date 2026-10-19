/**
 * Plate-Link design tokens — the single source for web (apps/web/app/globals.css
 * mirrors these as CSS variables) and mobile (NativeWind theme + StyleSheet).
 *
 * Palette: Gunmetal · Iron Grey · Almond Silk · Honey Bronze · Blushed Brick
 */
export const palette = {
  gunmetal: "#32373B",
  ironGrey: "#4A5859",
  almondSilk: "#F4D6CC",
  honeyBronze: "#F4B860",
  blushedBrick: "#C83E4D",
} as const

export const colors = {
  light: {
    canvas: "#FBF7F5",
    surface: "#FFFFFF",
    surfaceSunken: "#F6EEEA",
    ink: palette.gunmetal,
    inkMuted: palette.ironGrey,
    border: "#EADBD4",
    borderStrong: "#D9C3BA",
    primary: palette.blushedBrick,
    primaryHover: "#B33645",
    primaryEdge: "#8F2A36",
    primaryInk: "#FFFFFF",
    accent: palette.honeyBronze,
    accentEdge: "#C98F3A",
    accentInk: palette.gunmetal,
    almond: palette.almondSilk,
    almondInk: "#8F2A36",
    chrome: palette.gunmetal, // sidebar / ticket header
    chromeInk: "#F6E6DF",
    chromeMuted: "#A9B4B5",
    danger: "#B3261E",
    focus: "#F4B860",
  },
  dark: {
    canvas: "#1E2225",
    surface: "#272C30",
    surfaceSunken: "#22272A",
    ink: "#F6EEEA",
    inkMuted: "#B7C2C2",
    border: "#3A4246",
    borderStrong: "#4A5859",
    primary: palette.blushedBrick,
    primaryHover: "#D24A59",
    primaryEdge: "#7C2330",
    primaryInk: "#FFFFFF",
    accent: palette.honeyBronze,
    accentEdge: "#B97F2E",
    accentInk: "#1E2225",
    almond: "#4A3A37",
    almondInk: "#F4D6CC",
    chrome: "#16191B",
    chromeInk: "#F6E6DF",
    chromeMuted: "#9AA6A7",
    danger: "#F2766B",
    focus: "#F4B860",
  },
} as const

/** Listing status → [background, text] per theme. */
export const statusColors = {
  light: {
    available: [palette.honeyBronze, palette.gunmetal],
    claimed: [palette.almondSilk, "#8F2A36"],
    picked_up: [palette.ironGrey, "#FFFFFF"],
    delivered: [palette.gunmetal, palette.almondSilk],
    expired: ["#EFE6E2", palette.ironGrey],
    cancelled: ["#EFE6E2", "#8F2A36"],
  },
  dark: {
    available: [palette.honeyBronze, "#1E2225"],
    claimed: ["#4A3A37", palette.almondSilk],
    picked_up: [palette.ironGrey, "#FFFFFF"],
    delivered: [palette.almondSilk, palette.gunmetal],
    expired: ["#32373B", "#B7C2C2"],
    cancelled: ["#32373B", "#F2766B"],
  },
} as const

export const radii = { sm: 8, md: 12, lg: 16, xl: 22, ticket: 14, pill: 999 } as const

/** Modular scale 1.25 on a 16px base. */
export const typeScale = { xs: 12, sm: 14, base: 16, lg: 20, xl: 25, "2xl": 31, "3xl": 39, "4xl": 49, "5xl": 61 } as const

export const fonts = {
  display: "Bricolage Grotesque", // headings, numbers, ticket portions — mobile: @expo-google-fonts/bricolage-grotesque
  body: "Geist", // UI + body text — mobile: @expo-google-fonts/geist (or system font)
} as const

/** Tactile "press" depth used by buttons (px). */
export const pressDepth = 4
