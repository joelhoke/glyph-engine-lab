import * as THREE from 'three'

/** Simplified vector trace of the user's 40′ × 30′ floor-plan reference (2026-10-06).
 * Coordinates use feet from the top-left. No raster copy or additional renderer. */
export function createSmartHomeFloorPlan() {
  const object = new THREE.Group(); object.name = 'smart-home-floor-plan'
  const textures: THREE.Texture[] = [], materials: THREE.MeshStandardMaterial[] = []
  const geometries: THREE.BufferGeometry[] = []
  const ink = (rgb: [number, number, number]) => {
    const texture = new THREE.DataTexture(new Uint8Array([...rgb, 255]), 1, 1)
    texture.colorSpace = THREE.SRGBColorSpace; texture.needsUpdate = true; textures.push(texture)
    const material = new THREE.MeshStandardMaterial({ map: texture, roughness: 0.9, side: THREE.DoubleSide, transparent: true })
    materials.push(material); return material
  }
  const walls = ink([43, 67, 87]), details = ink([93, 119, 140]), windows = ink([72, 145, 175])
  const paper = new THREE.MeshStandardMaterial({ color: '#e7edf3', roughness: 0.85, transparent: true })
  materials.push(paper)
  const board = new THREE.BoxGeometry(2.12, 1.62, 0.025); geometries.push(board)
  const sheet = new THREE.Mesh(board, paper); sheet.name = 'floor-plan-sheet'; object.add(sheet)
  const vertices = [[], [], []] as number[][]
  const point = (x: number, y: number, z: number) => [(x - 20) * 0.05, (15 - y) * 0.05, z]
  function line(x1: number, y1: number, x2: number, y2: number, width = 0.14, layer = 1) {
    const distance = Math.hypot(x2 - x1, y2 - y1)
    if (!distance) return
    const nx = -(y2 - y1) / distance * width / 2, ny = (x2 - x1) / distance * width / 2
    const z = 0.022 + layer * 0.004
    const corners = [point(x1 - nx, y1 - ny, z), point(x2 - nx, y2 - ny, z),
      point(x2 + nx, y2 + ny, z), point(x1 + nx, y1 + ny, z)]
    for (const index of [0, 1, 2, 0, 2, 3]) vertices[layer].push(...corners[index])
  }
  function rect(x: number, y: number, w: number, h: number, width = 0.14, layer = 1) {
    line(x, y, x + w, y, width, layer); line(x + w, y, x + w, y + h, width, layer)
    line(x + w, y + h, x, y + h, width, layer); line(x, y + h, x, y, width, layer)
  }
  function arc(x: number, y: number, radius: number, start: number, end: number) {
    for (let i = 0; i < 16; i++) {
      const a = start + (end - start) * i / 16, b = start + (end - start) * (i + 1) / 16
      line(x + Math.cos(a) * radius, y + Math.sin(a) * radius,
        x + Math.cos(b) * radius, y + Math.sin(b) * radius, 0.1)
    }
  }
  // Perimeter, bedroom walls, bathroom, closet and laundry, with actual doorway gaps.
  const segments = [
    [0, 0, 40, 0], [0, 0, 0, 30], [0, 30, 13, 30], [16, 30, 40, 30],
    [40, 0, 40, 23.5], [40, 26.5, 40, 30],
    [0, 12.8, 6.4, 12.8], [9.1, 12.8, 18.1, 12.8], [20.7, 12.8, 24, 12.8],
    [26.7, 12.8, 27.4, 12.8], [30.1, 12.8, 35.3, 12.8], [37.3, 12.8, 40, 12.8],
    [9.7, 0, 9.7, 1.5], [9.7, 5.3, 9.7, 12.8], [9.7, 6.3, 12.3, 6.3],
    [12.3, 0, 12.3, 7.7], [12.3, 11.6, 12.3, 12.8],
    [21.6, 0, 21.6, 12.8], [26.9, 0, 26.9, 12.8],
    [33.7, 12.8, 33.7, 24], [33.7, 27, 33.7, 30], [33.7, 20.1, 40, 20.1],
    [33.7, 27.6, 35, 27.6], [39, 27.6, 40, 27.6],
  ]
  segments.forEach(([a, b, c, d]) => line(a, b, c, d, 0.45, 0))
  // Windows and their mullions.
  for (const [x1, y1, x2, y2] of [[14.5, 0, 19.3, 0], [30.2, 0, 36.5, 0], [0, 1.5, 0, 10.8],
    [40, 1.5, 40, 10.8], [0, 17, 0, 26.5], [5.5, 30, 9.2, 30], [18, 30, 21.8, 30], [28, 30, 31.2, 30]]) {
    line(x1, y1, x2, y2, 0.3, 2)
    line((x1 + x2) / 2 - (y1 === y2 ? 0 : 0.25), (y1 + y2) / 2 - (y1 === y2 ? 0.25 : 0),
      (x1 + x2) / 2 + (y1 === y2 ? 0 : 0.25), (y1 + y2) / 2 + (y1 === y2 ? 0.25 : 0), 0.12, 2)
  }
  // Swing doors and folding closet doors.
  for (const [x, y, r] of [[9.1, 12.8, 2.7], [20.7, 12.8, 2.6], [30.1, 12.8, 2.7], [16, 30, 3]]) {
    line(x, y, x, y - r); arc(x, y, r, Math.PI, Math.PI * 1.5)
  }
  line(40, 26.5, 42.5, 26.5); arc(40, 26.5, 2.5, -Math.PI / 2, 0)
  for (const [x, y] of [[9.7, 1.5], [9.7, 4], [12.3, 7.7], [12.3, 10.2]]) {
    line(x, y, x - 0.9, y + 0.65); line(x - 0.9, y + 0.65, x, y + 1.3)
  }
  // Beds and bedside tables establish the three bedrooms from the reference.
  for (const [x, width] of [[2.2, 5], [14.5, 5], [30.2, 6.4]]) {
    rect(x, 0.9, width, 5.2); rect(x + 0.2, 1.1, width / 2 - 0.3, 0.85)
    rect(x + width / 2 + 0.1, 1.1, width / 2 - 0.3, 0.85); line(x, 2.4, x + width, 2.4)
    rect(x - 1.7, 0.8, 1.35, 1.4)
  }
  rect(22, 0.7, 4.4, 2); rect(22.1, 7.7, 1.4, 3.2)
  arc(23.8, 4.9, 0.7, 0, Math.PI * 2); rect(21.9, 4, 1, 1.8)
  // Open family/dining area and the kitchen/laundry down the right-hand side.
  rect(1.2, 17, 3.1, 8.2); rect(1.8, 17.6, 1, 7); line(2.8, 20.6, 4.3, 20.6)
  rect(7, 19, 2.1, 4.1); rect(5.3, 25.6, 2.6, 2.5); rect(8.4, 25.6, 2.6, 2.5)
  rect(25, 17, 2.8, 5.9); rect(31.1, 13.2, 2.3, 9.8); rect(25, 27.6, 8.4, 2.1)
  for (const x of [31.7, 32.6]) for (const y of [19.2, 20.4]) arc(x, y, 0.29, 0, Math.PI * 2)
  rect(28.1, 28, 1.6, 1.3); rect(30, 28, 1.6, 1.3)
  rect(35, 13.3, 3.7, 5.1)
  for (const x of [34.4, 37.1]) { rect(x, 20.6, 2.3, 2.2); arc(x + 1.15, 21.7, 0.7, 0, Math.PI * 2) }
  for (let i = 0; i < vertices.length; i++) {
    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices[i], 3)); geometry.computeVertexNormals()
    geometries.push(geometry); object.add(new THREE.Mesh(geometry, [walls, details, windows][i]))
  }
  const update = (amount: number) => {
    const t = THREE.MathUtils.smootherstep(amount, 0, 1)
    object.position.set(0.03, 0.22, -1.05)
    object.rotation.set(1.05 - t * 0.81, -0.12, -0.04 - t * 0.27)
    object.scale.setScalar(0.87 + t * 0.13)
    materials.forEach(material => { material.opacity = 0.5 + t * 0.5 })
  }
  update(0)
  return { object, update, dispose() {
    geometries.forEach(geometry => geometry.dispose()); materials.forEach(material => material.dispose()); textures.forEach(texture => texture.dispose())
  } }
}
