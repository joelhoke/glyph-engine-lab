#!/usr/bin/env node
// Public sources only. Supply a capture folder with <demo>/frame-000.png, etc.
// Example: node scripts/build-gallery-previews.mjs /private/tmp/gallery-capture
import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const out = path.join(root, 'public/assets/gallery/previews')
const captures = process.argv[2]
fs.mkdirSync(out, { recursive: true })
const run = args => execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', ...args], { stdio: 'inherit' })
const encoding = ['-an', '-c:v', 'libx264', '-preset', 'slow', '-crf', '24', '-pix_fmt', 'yuv420p', '-movflags', '+faststart']
const fit = 'scale=960:720:force_original_aspect_ratio=increase,crop=960:720,setsar=1'
const absolute = file => path.join(root, file)
const poster = async name => {
  const png = execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-i', path.join(out, `${name}.mp4`), '-frames:v', '1', '-f', 'image2pipe', '-c:v', 'png', '-'], { maxBuffer: 8 * 1024 * 1024 })
  await sharp(png).webp({ quality: 85 }).toFile(path.join(out, `${name}.webp`))
}

for (const name of ['orbit-toy', 'glass-playground', 'logo-studio', 'three-gradient', 'droplet', 'cars', 'cars-dark']) {
  if (captures && fs.existsSync(path.join(captures, name, 'frame-000.png'))) {
    // 48 captured frames play forward then backward for a continuous eight-second loop.
    const codec = fs.readFileSync(path.join(captures, name, 'frame-000.png'))[0] === 0xff ? 'mjpeg' : 'png'
    const cropFile = path.join(captures, name, 'crop.json')
    const bounds = fs.existsSync(cropFile) ? JSON.parse(fs.readFileSync(cropFile, 'utf8')) : null
    const crop = bounds ? `crop=${bounds.width}:${bounds.height}:${bounds.x}:${bounds.y},` : ''
    run(['-framerate', '12', '-c:v', codec, '-i', path.join(captures, name, 'frame-%03d.png'), '-filter_complex',
      `[0:v]${crop}${fit},split[a][b];[b]reverse[r];[a][r]concat=n=2:v=1:a=0,fps=24[v]`, '-map', '[v]', ...encoding, path.join(out, `${name}.mp4`)])
    await poster(name)
  } else if (!fs.existsSync(path.join(out, `${name}.mp4`))) throw new Error(`Missing public demo capture: ${name}`)
}

const teasers = [
  ['global-operations-demo', ['public/assets/work/global-operations-thumbnail.webp']],
  ['global-operations-demo-dark', ['public/assets/work/global-operations-thumbnail-dark.webp']],
  ['golden-age-mild', ['prototypes/golden-age-collectables/mild/thumb.jpg']],
  ['golden-age-medium', ['prototypes/golden-age-collectables/medium/thumb.jpg']],
  ['global-operations-story', ['public/assets/work/global-operations/live-campus/portfolio.png', 'public/assets/work/global-operations/live-campus/building.png', 'public/assets/work/global-operations/live-campus/room.png']],
  ['employee-experience', ['public/assets/work/EmployeeExperience-MyHub+Viva.webp', 'public/assets/work/EmployeeExperience-VivaConnections-Dashboard.webp', 'public/assets/work/EmployeeExperience-VivaConnections.jpg']],
  ['global-compensation', ['public/assets/work/GlobalCompensation-TotalRewards.webp', 'public/assets/work/GlobalCompensation-TotalRewards-Employee.webp', 'public/assets/work/GlobalCompensation-TotalRewards-Manager.webp']],
]
for (const [name, files] of teasers) {
  const inputs = files.flatMap(file => ['-loop', '1', '-framerate', '24', '-t', '8', '-i', absolute(file)])
  const filters = files.map((_, i) => `[${i}:v]${fit},zoompan=z='1.025+0.025*sin(on/144*2*PI)':x='iw/2-iw/zoom/2':y='ih/2-ih/zoom/2':d=1:s=960x720:fps=24,format=yuv420p[v${i}]`)
  const result = files.length === 1 ? '[v0]' : '[mix2]'
  if (files.length === 3) filters.push('[v0][v1]xfade=transition=fade:duration=0.6:offset=1.8[mix1]', '[mix1][v2]xfade=transition=fade:duration=0.6:offset=3.6[mix2]')
  run([...inputs, '-filter_complex', filters.join(';'), '-map', result, '-t', '6', ...encoding, path.join(out, `${name}.mp4`)])
  await poster(name); console.log(`Prepared ${name}`)
}
run(['-ss', '8', '-i', absolute('public/assets/home/highlights/october-2026-landscape.mp4'), '-t', '6', '-vf', `${fit},fps=24`, ...encoding, path.join(out, 'october-2026.mp4')])
await poster('october-2026')
console.log('Project previews and matching light/dark posters are ready.')
