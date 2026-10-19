import React, { createContext, useContext, useEffect, useMemo, useState } from "react"
import { useColorScheme } from "react-native"
import { StatusBar } from "expo-status-bar"
import AsyncStorage from "@react-native-async-storage/async-storage"
import { darkTheme, lightTheme, type ColorSchemeMode, type Theme } from "./tokens"

const THEME_STORAGE_KEY = "platelink_theme_mode"

interface ThemeContextValue {
  theme: Theme
  isDark: boolean
  mode: ColorSchemeMode
  preference: ColorSchemeMode | "system"
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
  const [preference, setPreference] = useState<ColorSchemeMode | "system">(defaultMode)

  // Load persisted theme preference from AsyncStorage
  useEffect(() => {
    AsyncStorage.getItem(THEME_STORAGE_KEY)
      .then((saved) => {
        if (saved === "system" || saved === "light" || saved === "dark") {
          setPreference(saved)
        }
      })
      .catch((err) => {
        console.warn("[theme] Failed to load persisted theme preference:", err)
      })
  }, [])

  const activeMode: ColorSchemeMode = useMemo(() => {
    if (preference === "system") {
      return systemScheme === "dark" ? "dark" : "light"
    }
    return preference
  }, [preference, systemScheme])

  const isDark = activeMode === "dark"
  const theme = isDark ? darkTheme : lightTheme

  const setMode = (mode: ColorSchemeMode | "system") => {
    setPreference(mode)
    AsyncStorage.setItem(THEME_STORAGE_KEY, mode).catch((err) => {
      console.warn("[theme] Failed to persist theme preference:", err)
    })
  }

  const toggleMode = () => {
    const nextMode: ColorSchemeMode = activeMode === "dark" ? "light" : "dark"
    setMode(nextMode)
  }

  const value = useMemo<ThemeContextValue>(
    () => ({
      theme,
      isDark,
      mode: activeMode,
      preference,
      toggleMode,
      setMode,
    }),
    [theme, isDark, activeMode, preference]
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
      preference: "system",
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
