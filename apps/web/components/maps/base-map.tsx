"use client"

import { forwardRef } from "react"
import { useTheme } from "next-themes"
import { setWorkerUrl } from "maplibre-gl"
import Map, { NavigationControl, type MapProps, type MapRef } from "react-map-gl/maplibre"
import { MAP_STYLE_DARK, MAP_STYLE_LIGHT } from "@platelink/shared"
import { cn } from "@/lib/utils"

if (typeof window !== "undefined") {
  setWorkerUrl("/maplibre-gl-worker.mjs")
}


type BaseMapProps = Omit<MapProps, "mapStyle"> & { className?: string; showNav?: boolean }

/** MapLibre + OpenFreeMap tiles (free, no key). Style follows the app theme. */
export const BaseMap = forwardRef<MapRef, BaseMapProps>(function BaseMap(
  { className, showNav = true, children, ...props },
  ref
) {
  const { resolvedTheme } = useTheme()
  return (
    <div className={cn("relative overflow-hidden rounded-xl border bg-muted", className)}>
      <Map
        ref={ref}
        mapStyle={resolvedTheme === "dark" ? MAP_STYLE_DARK : MAP_STYLE_LIGHT}
        style={{ width: "100%", height: "100%" }}
        attributionControl={{ compact: true }}
        {...props}
      >
        {showNav && <NavigationControl position="top-right" showCompass={false} />}
        {children}
      </Map>
    </div>
  )
})
