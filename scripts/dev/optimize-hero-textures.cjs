/** Losslessly repack model data maps, preserving original source assets.
 * No resizing or quantization: assert decoded pixels match before changing URIs.
 */
const fs = require('node:fs/promises')
const path = require('node:path')
const sharp = require('sharp')
async function main() {
  let saved = 0
  for (const name of ['crt', 'phone', 'notebook', 'frame']) {
    const base = path.resolve('public/assets/home/models', name)
    const filename = path.join(base, 'scene.gltf')
    const original = await fs.readFile(filename, 'utf8')
    const model = JSON.parse(original)
    let output = original
    for (const image of model.images || []) {
      if (!image.uri.endsWith('.png')) continue
      const source = path.join(base, image.uri)
      const targetUri = image.uri.replace(/\.png$/, '.lossless.webp')
      const target = path.join(base, targetUri)
      const encoded = await sharp(source).webp({ lossless: true, effort: 6 }).toBuffer()
      const sourcePixels = await sharp(source).ensureAlpha().raw().toBuffer()
      const encodedPixels = await sharp(encoded).ensureAlpha().raw().toBuffer()
      if (!sourcePixels.equals(encodedPixels)) throw new Error(`Pixel mismatch: ${source}`)
      const before = (await fs.stat(source)).size
      if (encoded.length >= before) continue
      await fs.writeFile(target, encoded)
      output = output.replaceAll(JSON.stringify(image.uri), JSON.stringify(targetUri))
      saved += before - encoded.length
      console.log(`${name}/${image.uri}: ${(before / 1024).toFixed(0)} → ${(encoded.length / 1024).toFixed(0)} KiB (identical pixels)`)
    }
    if (output !== original) await fs.writeFile(filename, output)
  }
  console.log(`Saved ${(saved / 1024 / 1024).toFixed(2)} MiB of referenced model data; original PNGs retained.`)
}
main().catch(error => { console.error(error); process.exitCode = 1 })
