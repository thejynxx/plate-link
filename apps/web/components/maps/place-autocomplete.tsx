"use client"

import { useEffect, useRef, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { Loader2, MapPin, Search } from "lucide-react"
import type { LatLng } from "@platelink/shared"
import { searchPlaces, type PlaceResult } from "@/lib/photon"
import { useDebounced } from "@/hooks/use-debounced"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

type Props = {
  near?: LatLng
  onSelect: (place: PlaceResult) => void
  placeholder?: string
  id?: string
}

/** Debounced Photon (OSM) search with keyboard navigation. */
export function PlaceAutocomplete({ near, onSelect, placeholder = "Search for your building, street or area", id }: Props) {
  const [query, setQuery] = useState("")
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const debounced = useDebounced(query.trim(), 350)
  const boxRef = useRef<HTMLDivElement>(null)

  const { data = [], isFetching, isError } = useQuery({
    queryKey: ["photon", debounced, near?.lat.toFixed(2), near?.lng.toFixed(2)],
    queryFn: ({ signal }) => searchPlaces(debounced, near, signal),
    enabled: debounced.length >= 3,
    staleTime: 5 * 60_000,
  })

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!boxRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", onDoc)
    return () => document.removeEventListener("mousedown", onDoc)
  }, [])

  function choose(p: PlaceResult) {
    onSelect(p)
    setQuery(p.label)
    setOpen(false)
  }

  const showList = open && debounced.length >= 3

  return (
    <div ref={boxRef} className="relative">
      <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        id={id}
        value={query}
        placeholder={placeholder}
        className="pl-9"
        autoComplete="off"
        role="combobox"
        aria-expanded={showList}
        aria-autocomplete="list"
        onChange={(e) => {
          setQuery(e.target.value)
          setOpen(true)
          setActive(0)
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (!showList || data.length === 0) return
          if (e.key === "ArrowDown") {
            e.preventDefault()
            setActive((a) => Math.min(a + 1, data.length - 1))
          } else if (e.key === "ArrowUp") {
            e.preventDefault()
            setActive((a) => Math.max(a - 1, 0))
          } else if (e.key === "Enter") {
            e.preventDefault()
            choose(data[active]!)
          } else if (e.key === "Escape") {
            setOpen(false)
          }
        }}
      />
      {isFetching && <Loader2 className="absolute top-1/2 right-3 size-4 -translate-y-1/2 animate-spin text-muted-foreground" />}
      {showList && (
        <ul role="listbox" className="absolute z-20 mt-1 max-h-72 w-full overflow-auto rounded-lg border bg-popover p-1 shadow-lg">
          {isError && <li className="px-3 py-2 text-sm text-destructive">Search failed — drop a pin on the map instead.</li>}
          {!isError && !isFetching && data.length === 0 && (
            <li className="px-3 py-2 text-sm text-muted-foreground">No matches — try a landmark, or drop a pin on the map.</li>
          )}
          {data.map((p, i) => (
            <li
              key={p.id + i}
              role="option"
              aria-selected={i === active}
              onMouseEnter={() => setActive(i)}
              onMouseDown={(e) => {
                e.preventDefault()
                choose(p)
              }}
              className={cn("flex cursor-pointer items-start gap-2 rounded-md px-3 py-2 text-sm", i === active && "bg-accent")}
            >
              <MapPin className="mt-0.5 size-4 shrink-0 text-primary" />
              <span className="line-clamp-2">{p.label}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
