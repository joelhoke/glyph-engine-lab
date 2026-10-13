// Rebuild from the user's original photo; never edit the generated WebP files.
// node scripts/prepare-car-story-photo.mjs /path/to/photo [4runner|f1]
import { execFileSync } from 'node:child_process'
import { mkdtemp, mkdir, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import sharp from 'sharp'

const source = process.argv[2]
const name = process.argv[3] ?? '4runner'
if (!source || !['4runner', 'f1'].includes(name)) throw new Error('Pass the original photo path and 4runner or f1.')
const temporary = await mkdtemp(path.join(tmpdir(), 'car-story-photo-'))
const output = new URL('../public/assets/about/photos/', import.meta.url)
try {
  let input = source
  if (/\.hei[cf]$/i.test(source)) {
    input = path.join(temporary, 'photo.jpg')
    execFileSync('sips', ['-s', 'format', 'jpeg', source, '--out', input], { stdio: 'ignore' })
  }
  await mkdir(output, { recursive: true })
  for (const width of [600, 1200]) {
    const result = await sharp(input).rotate().resize({ width, withoutEnlargement: true })
      .webp({ quality: 85 }).toFile(new URL(`${name}-${width}.webp`, output).pathname)
    console.log(`${result.width}×${result.height}: ${Math.round(result.size / 1024)} KB`)
  }
} finally {
  await rm(temporary, { recursive: true, force: true })
}
