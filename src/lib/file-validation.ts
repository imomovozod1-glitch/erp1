/**
 * Shared upload guards for the AI image-analysis routes (/api/ocr,
 * /api/inventory/scan) — both forward the file to a paid third-party vision
 * API, so an unbounded/unvalidated upload is both a cost and an abuse
 * surface even from an authenticated caller.
 */
const ALLOWED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'])
const MAX_IMAGE_BYTES = 10 * 1024 * 1024 // 10MB

export function validateImageUpload(file: File): string | null {
  if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
    return 'Unsupported file type'
  }
  if (file.size > MAX_IMAGE_BYTES) {
    return 'File is too large (max 10MB)'
  }
  return null
}
