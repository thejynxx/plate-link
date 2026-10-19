import "react-native-url-polyfill/auto"
import AsyncStorage from "@react-native-async-storage/async-storage"
import { createClient } from "@supabase/supabase-js"
import * as TaskManager from "expo-task-manager"
import type * as Location from "expo-location"
import type { Database } from "@platelink/shared"

export const DRIVER_LOCATION_TASK = "pl-driver-location"

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL ?? ""
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? ""

let lastWriteTimestamp = 0
const THROTTLE_MS = 5000

export function createBackgroundTaskSupabase() {
  return createClient<Database>(supabaseUrl, supabaseAnonKey, {
    auth: {
      storage: AsyncStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  })
}

/**
 * Immediate upsert helper used to publish initial location without waiting for the first GPS tick.
 */
export async function upsertCurrentDriverLocation(
  driverId: string,
  location: Location.LocationObject
) {
  try {
    const bgSupabase = createBackgroundTaskSupabase()
    const { latitude, longitude, heading, speed } = location.coords

    await bgSupabase.from("driver_locations").upsert(
      {
        driver_id: driverId,
        current_lat: latitude,
        current_lng: longitude,
        heading:
          typeof heading === "number" && !isNaN(heading) && heading >= 0
            ? heading
            : null,
        speed_mps:
          typeof speed === "number" && !isNaN(speed) && speed >= 0 ? speed : null,
        last_updated: new Date().toISOString(),
      },
      { onConflict: "driver_id" }
    )
    lastWriteTimestamp = Date.now()
  } catch (err) {
    console.warn("[location-task] Immediate upsert error:", err)
  }
}

/**
 * Module-level background location task definition.
 * Runs in a separate JS context when the app is in the background or device is locked.
 */
TaskManager.defineTask(
  DRIVER_LOCATION_TASK,
  async ({
    data,
    error,
  }: TaskManager.TaskManagerTaskBody<{ locations?: Location.LocationObject[] }>) => {
    if (error) {
      console.warn("[location-task] TaskManager error:", error.message)
      return
    }

    if (!data || !data.locations || data.locations.length === 0) {
      return
    }

    const now = Date.now()
    if (now - lastWriteTimestamp < THROTTLE_MS) {
      return
    }

    try {
      const latestLocation = data.locations[data.locations.length - 1]
      if (!latestLocation || !latestLocation.coords) {
        return
      }

      const bgSupabase = createBackgroundTaskSupabase()
      const {
        data: { session },
        error: sessionError,
      } = await bgSupabase.auth.getSession()

      if (sessionError || !session?.user?.id) {
        return
      }

      const driverId = session.user.id
      const { latitude, longitude, heading, speed } = latestLocation.coords

      const { error: upsertError } = await bgSupabase
        .from("driver_locations")
        .upsert(
          {
            driver_id: driverId,
            current_lat: latitude,
            current_lng: longitude,
            heading:
              typeof heading === "number" && !isNaN(heading) && heading >= 0
                ? heading
                : null,
            speed_mps:
              typeof speed === "number" && !isNaN(speed) && speed >= 0
                ? speed
                : null,
            last_updated: new Date().toISOString(),
          },
          { onConflict: "driver_id" }
        )

      if (upsertError) {
        console.warn("[location-task] Upsert error:", upsertError.message)
        return
      }

      lastWriteTimestamp = now
    } catch (err) {
      console.warn("[location-task] Unexpected error:", err)
      // Never throw in background task
    }
  }
)
