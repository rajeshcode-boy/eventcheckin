// Image upload validation: checks the file's actual bytes (not its extension),
// its size and its pixel dimensions.

export type ImageMime = 'image/png' | 'image/jpeg' | 'image/webp'

export const IMAGE_EXTENSIONS: Record<ImageMime, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
}

// Identifies PNG, JPEG and WebP from their file signatures
export function detectImageType(bytes: Uint8Array): ImageMime | null {
  const at = (i: number) => bytes[i] ?? -1
  if (at(0) === 0x89 && at(1) === 0x50 && at(2) === 0x4e && at(3) === 0x47 && at(4) === 0x0d && at(5) === 0x0a && at(6) === 0x1a && at(7) === 0x0a) {
    return 'image/png'
  }
  if (at(0) === 0xff && at(1) === 0xd8 && at(2) === 0xff) return 'image/jpeg'
  // "RIFF" .... "WEBP"
  if (at(0) === 0x52 && at(1) === 0x49 && at(2) === 0x46 && at(3) === 0x46 && at(8) === 0x57 && at(9) === 0x45 && at(10) === 0x42 && at(11) === 0x50) {
    return 'image/webp'
  }
  return null
}

export interface ImageRules {
  maxBytes: number
  minWidth?: number
  minHeight?: number
  maxWidth?: number
  maxHeight?: number
}

export type ImageCheck =
  | { ok: true; type: ImageMime; width: number; height: number }
  | { ok: false; error: string }

const mb = (bytes: number) => `${Math.round((bytes / 1048576) * 10) / 10} MB`

export function checkImageRules(size: number, width: number, height: number, rules: ImageRules): string | null {
  if (size > rules.maxBytes) return `The image is ${mb(size)}. The limit is ${mb(rules.maxBytes)}.`
  if (rules.minWidth && width < rules.minWidth) return `The image is ${width}px wide. Use at least ${rules.minWidth}px.`
  if (rules.minHeight && height < rules.minHeight) return `The image is ${height}px tall. Use at least ${rules.minHeight}px.`
  if (rules.maxWidth && width > rules.maxWidth) return `The image is ${width}px wide. The limit is ${rules.maxWidth}px.`
  if (rules.maxHeight && height > rules.maxHeight) return `The image is ${height}px tall. The limit is ${rules.maxHeight}px.`
  return null
}

// Browser only: reads the signature, then decodes the image to get real dimensions
export async function validateImageFile(file: File, rules: ImageRules): Promise<ImageCheck> {
  if (file.size > rules.maxBytes) return { ok: false, error: `The image is ${mb(file.size)}. The limit is ${mb(rules.maxBytes)}.` }
  const type = detectImageType(new Uint8Array(await file.slice(0, 16).arrayBuffer()))
  if (!type) return { ok: false, error: 'Use a PNG, JPG or WebP image.' }
  let width: number
  let height: number
  try {
    const bitmap = await createImageBitmap(file)
    width = bitmap.width
    height = bitmap.height
    bitmap.close()
  } catch {
    return { ok: false, error: 'This image could not be read. It may be damaged.' }
  }
  const problem = checkImageRules(file.size, width, height, rules)
  return problem ? { ok: false, error: problem } : { ok: true, type, width, height }
}

export const LOGO_RULES: ImageRules = { maxBytes: 2 * 1048576, minWidth: 64, minHeight: 64, maxWidth: 4000, maxHeight: 4000 }
export const BANNER_RULES: ImageRules = { maxBytes: 5 * 1048576, minWidth: 1000, minHeight: 250, maxWidth: 6000, maxHeight: 4000 }
export const AVATAR_RULES: ImageRules = { maxBytes: 2 * 1048576, minWidth: 96, minHeight: 96, maxWidth: 4000, maxHeight: 4000 }
export const BADGE_BACKGROUND_RULES: ImageRules = { maxBytes: 5 * 1048576, minWidth: 300, minHeight: 300, maxWidth: 6000, maxHeight: 6000 }

// Public URL for an object in a public Storage bucket ('branding' or 'avatars').
// Database columns store object paths; this builds the URL without a Supabase client.
export function publicImageUrl(bucket: 'branding' | 'avatars', path: string | null | undefined): string | null {
  if (!path) return null
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${bucket}/${path.split('/').map(encodeURIComponent).join('/')}`
}
