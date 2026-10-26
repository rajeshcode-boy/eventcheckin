// Supabase Storage helpers for branding images and profile photos.
// Database columns store object paths; publicImageUrl (lib/images) builds URLs.
import { supabase } from './supabase'
import { IMAGE_EXTENSIONS, ImageMime } from './images'

export { publicImageUrl } from './images'

export type Bucket = 'branding' | 'avatars'

// Uploads under `<folder>/<kind>-<timestamp>.<ext>` and returns the new path.
// A new name each time means a replaced image is never served from cache.
export async function uploadImage(bucket: Bucket, folder: string, kind: string, file: File, type: ImageMime): Promise<string> {
  const path = `${folder}/${kind}-${Date.now()}.${IMAGE_EXTENSIONS[type]}`
  const { error } = await supabase.storage.from(bucket).upload(path, file, {
    contentType: type,
    cacheControl: '31536000',
    upsert: false,
  })
  if (error) throw new Error(error.message)
  return path
}

export async function removeImage(bucket: Bucket, path: string | null | undefined): Promise<void> {
  if (!path) return
  await supabase.storage.from(bucket).remove([path])
}
