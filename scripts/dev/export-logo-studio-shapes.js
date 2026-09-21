// Export the actual Logo Studio contour generator's output for the homepage.
// This keeps its PNG silhouette, smoothing and holes without running the
// prototype's full renderer or repeating the pixel tracing on every visit.
const fs = require('node:fs')
const path = require('node:path')
const zlib = require('node:zlib')
const vm = require('node:vm')

async function main() {
  const THREE = await import('three')
  const root = path.resolve(__dirname, '../..')
  const prototype = path.join(root, 'prototypes/type-lab/logo-studio')
  const png = fs.readFileSync(path.join(prototype, 'logo.png'))
  const width = png.readUInt32BE(16)
  const height = png.readUInt32BE(20)
  if (png[24] !== 8 || png[25] !== 6 || png[28] !== 0) throw new Error('Expected non-interlaced RGBA8 PNG')
  const chunks = []
  for (let offset = 8; offset < png.length;) {
    const length = png.readUInt32BE(offset)
    if (png.toString('ascii', offset + 4, offset + 8) === 'IDAT') chunks.push(png.subarray(offset + 8, offset + 8 + length))
    offset += length + 12
  }
  const raw = zlib.inflateSync(Buffer.concat(chunks))
  const stride = width * 4
  const data = new Uint8ClampedArray(width * height * 4)
  const paeth = (a, b, c) => {
    const p = a + b - c
    const pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c)
    return pa <= pb && pa <= pc ? a : pb <= pc ? b : c
  }
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)]
    if (filter > 4) throw new Error('Unsupported PNG filter')
    for (let x = 0; x < stride; x++) {
      const i = y * stride + x
      const a = x >= 4 ? data[i - 4] : 0
      const b = y > 0 ? data[i - stride] : 0
      const c = y > 0 && x >= 4 ? data[i - stride - 4] : 0
      const prediction = [0, a, b, Math.floor((a + b) / 2), paeth(a, b, c)][filter]
      data[i] = (raw[y * (stride + 1) + x + 1] + prediction) & 255
    }
  }
  const bundle = fs.readFileSync(path.join(prototype, 'assets/index.js'), 'utf8')
  const start = bundle.indexOf('async function s_(')
  const end = bundle.indexOf('const Il=document.querySelector', start)
  if (start < 0 || end < 0) throw new Error('Logo Studio contour generator changed; update extraction boundaries')
  // Only the isolated contour function runs. Its image/canvas inputs are
  // supplied by the decoded PNG; no page, WebGL renderer or animation runs.
  const context = vm.createContext({
    i_: async () => ({ width, height }),
    document: { createElement: () => ({ getContext: () => ({
      drawImage() {}, getImageData: () => ({ data }),
    }) }) },
    Xa: [[1, 0], [0, 1], [-1, 0], [0, -1]],
    e_: i => (i + 3) % 4, n_: i => (i + 1) % 4,
    lt: THREE.Vector2, El: THREE.Shape, lo: THREE.Path,
  })
  const shapes = await vm.runInContext(`${bundle.slice(start, end)}; s_('logo.png', { threshold: 128, smoothIterations: 5 })`, context)
  // The studio's five smoothing passes produce 35k near-collinear points.
  // Keep the same curve within 0.0001 logo heights (<0.02px in this hero).
  function simplify(points) {
    if (points.length <= 2) return points
    const first = points[0], last = points[points.length - 1]
    const dx = last.x - first.x, dy = last.y - first.y
    const lengthSquared = dx * dx + dy * dy
    let farthest = 0, maxDistanceSquared = 0
    for (let i = 1; i < points.length - 1; i++) {
      const p = points[i]
      const t = lengthSquared ? Math.max(0, Math.min(1, ((p.x - first.x) * dx + (p.y - first.y) * dy) / lengthSquared)) : 0
      const distanceSquared = (p.x - first.x - t * dx) ** 2 + (p.y - first.y - t * dy) ** 2
      if (distanceSquared > maxDistanceSquared) { maxDistanceSquared = distanceSquared; farthest = i }
    }
    if (maxDistanceSquared <= 0.0001 ** 2) return [first, last]
    return [...simplify(points.slice(0, farthest + 1)).slice(0, -1), ...simplify(points.slice(farthest))]
  }
  const points = contour => simplify(contour.getPoints()).map(p => [Number(p.x.toFixed(7)), Number(p.y.toFixed(7))])
  const result = shapes.map(shape => ({ points: points(shape), holes: shape.holes.map(points) }))
  fs.writeFileSync(path.join(root, 'public/assets/home/logo-studio-shapes.json'), JSON.stringify(result) + '\n')
  console.log(`Exported ${result.length} Logo Studio shapes (${result.reduce((n, s) => n + s.points.length, 0)} contour points)`)
}
main().catch(error => { console.error(error); process.exitCode = 1 })
