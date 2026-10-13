/** Shared movie/game cover ingestion. Original artwork stays intact; no landscape crops. */
import sharp from 'sharp'
import { createHash } from 'node:crypto'
import { mkdir, writeFile } from 'node:fs/promises'
export const coverRevision = bytes => createHash('sha256').update(bytes).digest('hex').slice(0, 12)
export const COVER = Object.freeze({ width: 420, height: 630 })
export function isPortraitCover({ width, height }) {
  const ratio = width / height
  return Number.isFinite(ratio) && ratio >= .55 && ratio <= .8 && width >= 250 && height >= 350
}
export async function downloadArtwork(url, allowed, fetcher = fetch) {
  const parsed = new URL(url)
  if (parsed.protocol !== 'https:' || parsed.username || parsed.password || parsed.port || !allowed(parsed.hostname)) throw new Error('Unapproved artwork source')
  const response = await fetcher(parsed, { signal: AbortSignal.timeout(20000), redirect: 'error' })
  if (!response.ok || !response.headers.get('content-type')?.startsWith('image/')) throw new Error('Artwork unavailable')
  const chunks = []; let size = 0
  for await (const chunk of response.body) {
    size += chunk.length
    if (size > 8_000_000) throw new Error('Artwork exceeds size limit')
    chunks.push(chunk)
  }
  return Buffer.concat(chunks)
}
export async function preparePhysicalCover(bytes) {
  const oriented = await sharp(bytes, { limitInputPixels: 24000000 }).rotate().toBuffer()
  if (!isPortraitCover(await sharp(oriented).metadata())) throw new Error('Portrait box art required')
  return sharp(oriented).resize({ ...COVER, fit: 'contain', background: '#111820' }).webp({ quality: 86 }).toBuffer()
}
export async function savePhysicalCover({ bytes, id, title, root }) {
  if (!/^[a-z0-9-]+$/.test(id)) throw new Error('Invalid media asset ID')
  const data = await preparePhysicalCover(bytes)
  const folder = new URL('public/assets/about/media/', root)
  await mkdir(folder, { recursive: true })
  await writeFile(new URL(`${id}.webp`, folder), data)
  return { src: `/assets/about/media/${id}.webp?v=${coverRevision(data)}`, alt: `${title} cover`, ...COVER }
}
