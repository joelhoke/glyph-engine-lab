// Rebuild web derivatives from the original downloaded GLBs; never edit generated assets.
// node scripts/prepare-interest-models.mjs /path/to/downloads
import fs from 'node:fs/promises'
import path from 'node:path'
import { createHash } from 'node:crypto'
import assert from 'node:assert/strict'
import sharp from 'sharp'
import { optimizeGlbGeometry } from './lib/optimize-glb-geometry.mjs'

const source = process.argv[2]
if (!source) throw new Error('Pass the directory containing the original downloaded GLBs.')
const destination = new URL('../public/assets/about/models/', import.meta.url)
await fs.mkdir(destination, { recursive: true })
const assets = [
  ['formula_1_logo', 'formula-1', 'Cars & motorsport'],
  ['toyota_nameplate', 'toyota', 'Cars & motorsport'],
  ['apple_homepod', 'homepod', 'Smart home'],
  ['bitcoin', 'bitcoin', 'Personal finance'],
  ['100_dolllar_cash', 'cash', 'Personal finance'],
  ['xbox_elite_controller', 'xbox-controller', 'Creative media'],
  ['super_nintendo_controller', 'snes-controller', 'Creative media'],
]
const credits = []
const assetUrls = {}
for (const [filename, name, usedFor] of assets) {
  const input = await fs.readFile(path.join(source, `${filename}.glb`))
  const jsonLength = input.readUInt32LE(12)
  const doc = JSON.parse(input.subarray(20, 20 + jsonLength))
  const binary = input.subarray(28 + jsonLength)
  assert.ok(!doc.skins?.length && !doc.animations?.length, 'Only static models are supported')
  // Preserve both authored HomePods; runtime selects the matching theme.
  // The SNES download includes a long cable/plug; retain the controller parts.
  if (name === 'snes-controller') for (const node of doc.nodes) if (node.mesh < 9) delete node.mesh
  const usedMeshes = new Set()
  const visit = index => { const node = doc.nodes[index]; if (node.mesh !== undefined) usedMeshes.add(node.mesh); (node.children ?? []).forEach(visit) }
  doc.scenes.forEach(scene => scene.nodes.forEach(visit))
  const meshMap = new Map([...usedMeshes].sort((a,b) => a-b).map((index,i) => [index,i]))
  doc.nodes.forEach(node => { if (node.mesh !== undefined) { if (meshMap.has(node.mesh)) node.mesh = meshMap.get(node.mesh); else delete node.mesh } })
  doc.meshes = doc.meshes.filter((_,index) => usedMeshes.has(index))
  const { binary: binChunk, trianglesBefore, trianglesAfter } = await optimizeGlbGeometry(doc, binary, {
    ratio: name === 'cash' ? .12 : .35,
    transformImage: async (bytes, image) => {
      const edge = 512
      const resized = sharp(bytes).resize({ width: edge, height: edge, fit: 'inside', withoutEnlargement: true })
      return (image.mimeType === 'image/jpeg' ? resized.jpeg({ quality: 85 }) : resized.png()).toBuffer()
    },
  })
  const json = Buffer.from(JSON.stringify(doc)), jsonPadding = Buffer.alloc((4 - json.length % 4) % 4, 32)
  const jsonChunk = Buffer.concat([json, jsonPadding])
  const header = Buffer.alloc(20), binHeader = Buffer.alloc(8)
  header.writeUInt32LE(0x46546c67); header.writeUInt32LE(2, 4); header.writeUInt32LE(28 + jsonChunk.length + binChunk.length, 8)
  header.writeUInt32LE(jsonChunk.length, 12); header.writeUInt32LE(0x4e4f534a, 16)
  binHeader.writeUInt32LE(binChunk.length); binHeader.writeUInt32LE(0x004e4942, 4)
  const output = Buffer.concat([header, jsonChunk, binHeader, binChunk])
  const hash = createHash('sha256').update(output).digest('hex').slice(0, 12)
  const outputName = `${name}.${hash}.glb`
  await fs.writeFile(new URL(outputName, destination), output)
  assetUrls[name] = `/assets/about/models/${outputName}`
  // Only remove superseded derivatives owned by this generator.
  for (const existing of await fs.readdir(destination)) {
    if (existing !== outputName && (existing === `${name}.glb` ||
      new RegExp(`^${name}\\.[a-f0-9]{12}\\.glb$`).test(existing))) await fs.unlink(new URL(existing, destination))
  }
  const meta = doc.asset.extras, match = meta.author.match(/^(.*) \((https?:.*)\)$/)
  const license = meta.license?.match(/^(.*) \((https?:.*)\)$/)
  assert.ok(match && license, 'Author and license metadata must be retained; never assume CC BY')
  credits.push({ title: meta.title, author: match[1], authorUrl: match[2], sourceUrl: meta.source,
    licenseUrl: license[2], licenseLabel: license[1], usedFor,
    modifications: `Textures resized to 512px; dense meshes simplified with a 0.3% error limit; scaled and arranged for interest previews.` + (name === 'homepod' ? ' Black and white HomePods retained for theme switching.' : name === 'snes-controller' ? ' Cable and plug omitted.' : '') })
  console.log(`${name}: ${(input.length / 1e6).toFixed(2)} → ${(output.length / 1e6).toFixed(2)} MB; ${trianglesBefore} → ${trianglesAfter} triangles`)
}
await fs.writeFile(new URL('ATTRIBUTIONS.txt', destination), credits.map(c => `${c.title} by ${c.author} (${c.authorUrl})\nSource: ${c.sourceUrl}\nLicense: ${c.licenseLabel} (${c.licenseUrl})\nChanges: ${c.modifications}`).join('\n\n')+'\n')
await fs.writeFile(new URL('credits.json', destination), JSON.stringify(credits, null, 2) + '\n')
await fs.writeFile(new URL('asset-urls.json', destination), JSON.stringify(assetUrls, null, 2) + '\n')
