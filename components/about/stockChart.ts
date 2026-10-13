import * as THREE from 'three'

/** Decorative candlesticks, not live market data. Shares the collection's tint and lighting. */
export function createStockChart() {
  const object = new THREE.Group()
  object.name = 'stocks-candlestick-backdrop'
  const geometry = new THREE.BoxGeometry(1, 1, 1)
  const grid = new THREE.MeshStandardMaterial({ color: '#6e9db9', transparent: true, opacity: 0.3, roughness: 0.7, depthWrite: false })
  const up = new THREE.MeshStandardMaterial({ color: '#51d5ba', roughness: 0.4, metalness: 0.15 })
  const down = new THREE.MeshStandardMaterial({ color: '#e79084', roughness: 0.4, metalness: 0.15 })
  const bar = (x: number, y: number, w: number, h: number, material: THREE.MeshStandardMaterial, z = 0) => {
    const mesh = new THREE.Mesh(geometry, material)
    mesh.position.set(x, y, z); mesh.scale.set(w, h, 0.018); object.add(mesh)
  }
  for (let row = 0; row < 4; row++) bar(0, -0.6 + row * 0.4, 2.3, 0.008, grid)
  for (let column = 0; column < 6; column++) bar(-1.1 + column * 0.44, 0, 0.008, 1.6, grid)
  const candles = [
    [-0.58, -0.3], [-0.28, -0.06], [0.02, -0.16], [-0.14, 0.2],
    [0.18, 0.4], [0.42, 0.27], [0.29, 0.51], [0.48, 0.66],
  ]
  candles.forEach(([open, close], index) => {
    const x = -0.98 + index * 0.28, y = (open + close) / 2
    const height = Math.abs(close - open), material = close > open ? up : down
    bar(x, y, 0.016, height + 0.2, material, 0.025)
    bar(x, y, 0.115, height, material, 0.035)
  })
  object.position.set(-0.05, 0.2, -0.5)
  return { object, dispose() { geometry.dispose(); grid.dispose(); up.dispose(); down.dispose() } }
}
