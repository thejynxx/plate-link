import React, { createContext, useContext, useMemo, useState } from "react"
import { useColorScheme } from "react-native"
import { StatusBar } from "expo-status-bar"
import { darkTheme, lightTheme, type ColorSchemeMode, type Theme } from "./tokens"

interface ThemeContextValue {
  theme: Theme
  isDark: boolean
  mode: ColorSchemeMode
  toggleMode: () => void
  setMode: (mode: ColorSchemeMode | "system") => void
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

export interface ThemeProviderProps {
  children: React.ReactNode
  defaultMode?: ColorSchemeMode | "system"
}

export function ThemeProvider({ children, defaultMode = "system" }: ThemeProviderProps) {
  const systemScheme = useColorScheme()
  const [overrideMode, setOverrideMode] = useState<ColorSchemeMode | "system">(defaultMode)

  const activeMode: ColorSchemeMode = useMemo(() => {
    if (overrideMode === "system") {
      return systemScheme === "dark" ? "dark" : "light"
    }
    return overrideMode
  }, [overrideMode, systemScheme])

  const isDark = activeMode === "dark"
  const theme = isDark ? darkTheme : lightTheme

  const toggleMode = () => {
    setOverrideMode((prev) => {
      const current = prev === "system" ? (systemScheme === "dark" ? "dark" : "light") : prev
      return current === "dark" ? "light" : "dark"
    })
  }

  const setMode = (mode: ColorSchemeMode | "system") => {
    setOverrideMode(mode)
  }

  const value = useMemo<ThemeContextValue>(
    () => ({
      theme,
      isDark,
      mode: activeMode,
      toggleMode,
      setMode,
    }),
    [theme, isDark, activeMode]
  )

  return (
    <ThemeContext.Provider value={value}>
      <StatusBar style={isDark ? "light" : "dark"} animated />
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext)
  if (!context) {
    // Graceful fallback for components rendered outside provider
    return {
      theme: lightTheme,
      isDark: false,
      mode: "light",
      toggleMode: () => {},
      setMode: () => {},
    }
  }
  return context
}

export function ThemedStatusBar({ style }: { style?: "light" | "dark" | "auto" }) {
  const { isDark } = useTheme()
  return <StatusBar style={style ?? (isDark ? "light" : "dark")} animated />
}
