"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { Camera, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

const MAX_BYTES = 15 * 1024 * 1024

export function PhotoInput({
  value,
  onChange,
  existingUrl,
}: {
  value: File | null
  onChange: (file: File | null) => void
  existingUrl?: string | null
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [error, setError] = useState<string | null>(null)
  const preview = useMemo(() => (value ? URL.createObjectURL(value) : null), [value])
  useEffect(() => () => void (preview && URL.revokeObjectURL(preview)), [preview])

  const shown = preview ?? existingUrl ?? null

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="sr-only"
        onChange={(e) => {
          const f = e.target.files?.[0] ?? null
          e.target.value = ""
          if (f && f.size > MAX_BYTES) return setError("Photo is over 15 MB")
          if (f && !f.type.startsWith("image/")) return setError("That isn't an image")
          setError(null)
          onChange(f)
        }}
      />
      <div
        className={cn(
          "relative flex aspect-[16/9] w-full items-center justify-center overflow-hidden rounded-xl border-2 border-dashed border-border-strong bg-muted/60 transition-colors sm:aspect-[21/9]",
          !shown && "hover:border-primary hover:bg-secondary/60"
        )}
      >
        {shown ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={shown} alt="Food preview" className="size-full object-cover" />
            <div className="absolute right-2 bottom-2 flex gap-2">
              <Button type="button" size="sm" variant="secondary" onClick={() => inputRef.current?.click()}>
                <Camera /> Change
              </Button>
              {value && (
                <Button type="button" size="icon-sm" variant="secondary" aria-label="Remove photo" onClick={() => onChange(null)}>
                  <X />
                </Button>
              )}
            </div>
          </>
        ) : (
          <button type="button" onClick={() => inputRef.current?.click()} className="flex size-full flex-col items-center justify-center gap-2 text-muted-foreground">
            <Camera className="size-7" />
            <span className="text-sm font-medium">Add a photo</span>
            <span className="text-xs">Helps NGOs judge the food. Compressed before upload.</span>
          </button>
        )}
      </div>
      {error && <p className="mt-2 text-xs font-medium text-destructive">{error}</p>}
    </div>
  )
}
