import {
  colors as sharedColors,
  palette as sharedPalette,
  pressDepth as sharedPressDepth,
  radii as sharedRadii,
  statusColors as sharedStatusColors,
  typeScale as sharedTypeScale,
} from "@platelink/shared"

export const palette = sharedPalette
export const radii = sharedRadii
export const typeScale = sharedTypeScale
export const pressDepth = sharedPressDepth

/** Standard mobile spacing scale */
export const spacing = {
  none: 0,
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  "2xl": 24,
  "3xl": 32,
  "4xl": 40,
  "5xl": 48,
} as const

/**
 * Font families mapped directly to the loaded Google Fonts in apps/mobile/app/_layout.tsx:
 * Bricolage Grotesque for headings, display, numbers, portions.
 * Geist for body text and UI labels.
 */
export const fonts = {
  // Display & Headings (Bricolage Grotesque)
  displayRegular: "BricolageGrotesque_400Regular",
  displaySemiBold: "BricolageGrotesque_600SemiBold",
  displayBold: "BricolageGrotesque_700Bold",
  // Body & UI (Geist)
  bodyRegular: "Geist_400Regular",
  bodyMedium: "Geist_500Medium",
  bodySemiBold: "Geist_600SemiBold",
} as const

export const typography = {
  display: {
    fontFamily: fonts.displayBold,
    fontSize: typeScale["3xl"], // 39
    lineHeight: 44,
    letterSpacing: -0.5,
  },
  h1: {
    fontFamily: fonts.displayBold,
    fontSize: typeScale["2xl"], // 31
    lineHeight: 36,
    letterSpacing: -0.4,
  },
  h2: {
    fontFamily: fonts.displayBold,
    fontSize: typeScale.xl, // 25
    lineHeight: 30,
    letterSpacing: -0.3,
  },
  h3: {
    fontFamily: fonts.displaySemiBold,
    fontSize: typeScale.lg, // 20
    lineHeight: 26,
    letterSpacing: -0.2,
  },
  body: {
    fontFamily: fonts.bodyRegular,
    fontSize: typeScale.base, // 16
    lineHeight: 22,
  },
  small: {
    fontFamily: fonts.bodyRegular,
    fontSize: typeScale.sm, // 14
    lineHeight: 18,
  },
  caption: {
    fontFamily: fonts.bodyMedium,
    fontSize: typeScale.xs, // 12
    lineHeight: 16,
  },
} as const

export type ColorSchemeMode = "light" | "dark"

export interface ThemeColors {
  canvas: string
  surface: string
  surfaceSunken: string
  ink: string
  inkMuted: string
  border: string
  borderStrong: string
  primary: string
  primaryHover: string
  primaryEdge: string
  primaryInk: string
  accent: string
  accentEdge: string
  accentInk: string
  almond: string
  almondInk: string
  chrome: string
  chromeInk: string
  chromeMuted: string
  danger: string
  focus: string
}

export interface StatusColorsMap {
  available: readonly [string, string]
  claimed: readonly [string, string]
  picked_up: readonly [string, string]
  delivered: readonly [string, string]
  expired: readonly [string, string]
  cancelled: readonly [string, string]
}

export interface Theme {
  mode: ColorSchemeMode
  isDark: boolean
  colors: ThemeColors
  statusColors: StatusColorsMap
  palette: typeof sharedPalette
  radii: typeof sharedRadii
  spacing: typeof spacing
  typeScale: typeof sharedTypeScale
  fonts: typeof fonts
  typography: typeof typography
  pressDepth: number
}

export const lightTheme: Theme = {
  mode: "light",
  isDark: false,
  colors: sharedColors.light,
  statusColors: sharedStatusColors.light,
  palette: sharedPalette,
  radii: sharedRadii,
  spacing,
  typeScale: sharedTypeScale,
  fonts,
  typography,
  pressDepth: sharedPressDepth,
}

export const darkTheme: Theme = {
  mode: "dark",
  isDark: true,
  colors: sharedColors.dark,
  statusColors: sharedStatusColors.dark,
  palette: sharedPalette,
  radii: sharedRadii,
  spacing,
  typeScale: sharedTypeScale,
  fonts,
  typography,
  pressDepth: sharedPressDepth,
}
