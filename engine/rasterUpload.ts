/**
 * Client-side raster (PNG/WebP) upload validation.
 *
 * Mirrors the discipline of engine/svgUpload.ts: a size cap before anything is
 * read, magic-byte sniffing that must agree with the file's declared MIME
 * type, and a dimension cap enforced by an actual decode. On success the file
 * is handed to the renderer as an object URL — ownership passes to the caller,
 * which must revoke it when the source is replaced or unmounted.
 *
 * Error messages are literal strings; content/vibe.ts maps them to friendly
 * copy and scripts/verify-vibe-content.js fails if the two drift apart.
 */

export const MAX_RASTER_UPLOAD_BYTES = 4 * 1024 * 1024
export const MAX_RASTER_DIMENSION = 4096
export const RASTER_MIME_TYPES = ['image/png', 'image/webp'] as const

export type RasterMimeType = (typeof RASTER_MIME_TYPES)[number]

export type RasterUploadSuccessResult = {
  ok: true
  kind: 'raster'
  url: string
  filename: string
  width: number
  height: number
}

export type RasterUploadErrorResult = {
  ok: false
  error: string
}

export type RasterUploadResult = RasterUploadSuccessResult | RasterUploadErrorResult

export function isRasterUploadTooLarge(sizeInBytes: number): boolean {
  return sizeInBytes > MAX_RASTER_UPLOAD_BYTES
}

/** Identify the real format from magic bytes; null for anything unsupported. */
export function sniffRasterType(bytes: Uint8Array): RasterMimeType | null {
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return 'image/png'
  }

  // WebP: 'RIFF' at 0-3 and 'WEBP' at 8-11
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return 'image/webp'
  }

  return null
}

/**
 * Read and validate a user-selected raster File. The returned object URL is
 * only created after the cheap checks pass, and is revoked on every failure
 * path after its creation.
 */
export async function readUploadedRaster(file: File): Promise<RasterUploadResult> {
  if (isRasterUploadTooLarge(file.size)) {
    return { ok: false, error: 'The image file must be smaller than 4 MB.' }
  }

  let bytes: Uint8Array
  try {
    bytes = new Uint8Array(await file.arrayBuffer())
  } catch {
    return { ok: false, error: 'Could not read the selected file.' }
  }

  const sniffed = sniffRasterType(bytes)
  if (!sniffed) {
    return { ok: false, error: 'The image must be a PNG or WebP file.' }
  }

  if (file.type !== sniffed) {
    return { ok: false, error: 'The image file type does not match its contents.' }
  }

  const objectUrl = URL.createObjectURL(file)

  let dimensions: { width: number; height: number }
  try {
    dimensions = await decodeImageDimensions(objectUrl)
  } catch {
    URL.revokeObjectURL(objectUrl)
    return { ok: false, error: 'The image could not be decoded.' }
  }

  if (dimensions.width > MAX_RASTER_DIMENSION || dimensions.height > MAX_RASTER_DIMENSION) {
    URL.revokeObjectURL(objectUrl)
    return { ok: false, error: 'The image is too large — dimensions must be 4096px or less.' }
  }

  return {
    ok: true,
    kind: 'raster',
    url: objectUrl,
    filename: file.name,
    width: dimensions.width,
    height: dimensions.height,
  }
}

function decodeImageDimensions(url: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => {
      if (image.naturalWidth > 0 && image.naturalHeight > 0) {
        resolve({ width: image.naturalWidth, height: image.naturalHeight })
      } else {
        reject(new Error('Image has no intrinsic dimensions'))
      }
    }
    image.onerror = () => reject(new Error('Image failed to decode'))
    image.src = url
  })
}
