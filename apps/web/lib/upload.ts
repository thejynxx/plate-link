import imageCompression from "browser-image-compression"
import { STORAGE_BUCKETS } from "@platelink/shared"
import type { BrowserSupabase } from "@/lib/supabase/client"

/**
 * Compress on-device, then upload to `food-photos/<userId>/<uuid>.jpg`.
 * The first folder MUST be the user's id or the storage RLS policy rejects it.
 */
export async function uploadFoodPhoto(supabase: BrowserSupabase, userId: string, file: File) {
  const compressed = await imageCompression(file, {
    maxSizeMB: 0.4,
    maxWidthOrHeight: 1600,
    useWebWorker: true,
    fileType: "image/jpeg",
  })
  const path = `${userId}/${crypto.randomUUID()}.jpg`
  const { error } = await supabase.storage
    .from(STORAGE_BUCKETS.foodPhotos)
    .upload(path, compressed, { contentType: "image/jpeg", cacheControl: "31536000", upsert: false })
  if (error) throw error
  return supabase.storage.from(STORAGE_BUCKETS.foodPhotos).getPublicUrl(path).data.publicUrl
}
