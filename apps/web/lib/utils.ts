import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function initials(name?: string | null) {
  if (!name) return "?"
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("")
}

/** Supabase/PostgREST errors → a message a person can act on. */
export function errorMessage(err: unknown, fallback = "Something went wrong") {
  if (!err) return fallback
  if (typeof err === "string") return err
  if (typeof err === "object" && "message" in err && typeof err.message === "string") return err.message
  return fallback
}
