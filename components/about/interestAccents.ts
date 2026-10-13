import * as THREE from 'three'

/** Small authored accents share material registration and teardown with their model group. */
function accent() {
  const object = new THREE.Group()
  const geometries = new Set<THREE.BufferGeometry>(), materials = new Set<THREE.Material>()
  const material = (color: string, options: THREE.MeshStandardMaterialParameters = {}) => {
    const result = new THREE.MeshStandardMaterial({ color, roughness: 0.65, ...options })
    materials.add(result); return result
  }
  const mesh = (geometry: THREE.BufferGeometry, mat: THREE.Material, parent: THREE.Object3D = object) => {
    geometries.add(geometry); const result = new THREE.Mesh(geometry, mat); parent.add(result); return result
  }
  const box = (w: number, h: number, d: number, mat: THREE.Material, x: number, y: number, z: number, parent = object) => {
    const result = mesh(new THREE.BoxGeometry(w, h, d), mat, parent); result.position.set(x, y, z); return result
  }
  return { object, material, mesh, box, dispose() { geometries.forEach(g => g.dispose()); materials.forEach(m => m.dispose()) } }
}

export function createPodiumCelebration() {
  const kit = accent(), { object, material, mesh } = kit
  object.name = 'podium-celebration'
  const bottle = new THREE.Group(); bottle.name = 'celebration-bottle'; object.add(bottle)
  bottle.position.set(-0.7, -0.75, 0.08)
  const green = material('#347b4f', { roughness: 0.22, metalness: 0.18 })
  const gold = material('#e5b953', { roughness: 0.3, metalness: 0.55 })
  const profile = [[0, 0], [0.14, 0], [0.16, 0.05], [0.16, 0.61], [0.14, 0.7], [0.065, 0.8], [0.055, 0.98], [0.067, 1.01]]
  mesh(new THREE.LatheGeometry(profile.map(([x, y]) => new THREE.Vector2(x, y)), 24), green, bottle)
  const band = mesh(new THREE.CylinderGeometry(0.162, 0.162, 0.28, 24, 1, true), material('#eee2bc'), bottle); band.position.y = 0.35
  const foil = mesh(new THREE.CylinderGeometry(0.068, 0.075, 0.2, 20, 1, true), gold, bottle); foil.position.y = 0.9
  const mouth = mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.008, 20), material('#10271c'), bottle); mouth.position.y = 1.01
  const cork = mesh(new THREE.CylinderGeometry(0.058, 0.05, 0.11, 12), material('#bb9165'), bottle)
  cork.name = 'celebration-cork'; cork.position.y = 1.055
  const colors = [gold, material('#e77da7'), material('#66cee0')]
  const shard = new THREE.PlaneGeometry(0.045, 0.075)
  colors.forEach(mat => { mat.side = THREE.DoubleSide })
  const confetti = Array.from({ length: 24 }, (_, index) => {
    const piece = mesh(shard, colors[index % colors.length]); piece.name = 'celebration-confetti'; piece.visible = false
    return piece
  })
  const popAt = 0.16
  const ease = (value: number) => THREE.MathUtils.smootherstep(value, 0, 1)
  let elapsed = 0, entered = false
  return { object, dispose: kit.dispose,
    animate(delta: number, amount: number, motion: boolean) {
      if (amount < 0.01) { entered = false; elapsed = 0 }
      else if (!entered) { entered = true; elapsed = 0 }
      if (entered && motion) elapsed = Math.min(2.1, elapsed + Math.min(0.05, Math.max(0, delta)))
      const active = amount > 0.01, popped = active && (!motion || elapsed > popAt)
      const flight = Math.max(0, elapsed - popAt)
      // Fast impulse, then a longer smooth recovery; the cork has its own quick flight.
      const recoil = popped && motion ? ease(flight / 0.065) * (1 - ease((flight - 0.065) / 0.48)) * amount : 0
      bottle.rotation.z = -0.08 - ease(amount) * 0.2 + recoil * 0.18
      bottle.position.set(-0.7 - recoil * 0.07, -0.75 - recoil * 0.12, 0.08)
      const launch = 1 - Math.pow(1 - THREE.MathUtils.clamp(flight / 0.32, 0, 1), 3)
      cork.visible = !popped || (motion && flight < 0.42)
      cork.position.set(popped ? launch * 0.09 : 0, 1.055 + (popped ? launch * 0.66 : 0), 0)
      cork.rotation.z = popped ? launch * -1.4 : 0
      cork.scale.setScalar(popped && motion ? 1 - ease((flight - 0.26) / 0.16) : 1)
      confetti.forEach((piece, index) => {
        const t = motion ? flight : 0.55
        piece.visible = popped && (motion ? t < 1.6 : index < 6)
        const spread = (index / 23 - 0.5) * 1.35
        piece.position.set(-0.4 + spread * (1 - Math.pow(1 - Math.min(t / 0.65, 1), 3)),
          0.3 + (0.62 + (index % 5) * 0.06) * t - 0.62 * t * t,
          -0.35 + (index % 3) * 0.07)
        piece.rotation.set(t * (index % 3 + 1), t * 2, index + t * 2)
        piece.scale.setScalar(motion ? (1 - ease((t - 1.1) / 0.5)) : 1)
      })
      return motion && entered && elapsed < 2.1
    },
  }
}

export function createCreativeBackdrop() {
  const kit = accent(), { object, material, mesh } = kit
  object.name = 'creative-media-backdrop'
  const burst = new THREE.Group(); burst.name = 'comic-impact'; object.add(burst)
  burst.position.set(0.03, 0.28, -1.05)
  const shape = new THREE.Shape()
  for (let i = 0; i < 32; i++) {
    const angle = i / 32 * Math.PI * 2, radius = i % 2 ? 0.65 : 0.8
    const x = Math.cos(angle) * radius * 1.28, y = Math.sin(angle) * radius * 0.9
    if (!i) shape.moveTo(x, y); else shape.lineTo(x, y)
  }
  shape.closePath()
  const ink = material('#415878', { side: THREE.DoubleSide, vertexColors: true })
  const shadeInk = (geometry: THREE.BufferGeometry) => {
    const colors = new Float32Array(geometry.getAttribute('position').count * 3).fill(0.3)
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3)); return geometry
  }
  const outline = mesh(shadeInk(new THREE.ShapeGeometry(shape)), ink, burst)
  outline.scale.set(1.045, 1.045, 1); outline.position.z = -0.008
  mesh(new THREE.ShapeGeometry(shape), material('#efc469', { side: THREE.DoubleSide }), burst)
  // One mesh for the whole halftone field; no per-dot draw calls or animation.
  const dots: number[] = []
  for (let row = -5; row <= 5; row++) for (let column = -8; column <= 8; column++) {
    const x = column * 0.095 + (row % 2) * 0.0475, y = row * 0.095
    if ((x / 0.78) ** 2 + (y / 0.5) ** 2 > 1) continue
    const radius = 0.014 + (column + 8) / 16 * 0.012
    for (let side = 0; side < 8; side++) {
      const a = side / 8 * Math.PI * 2, b = (side + 1) / 8 * Math.PI * 2
      dots.push(x, y, 0.006, x + Math.cos(a) * radius, y + Math.sin(a) * radius, 0.006,
        x + Math.cos(b) * radius, y + Math.sin(b) * radius, 0.006)
    }
  }
  const pattern = new THREE.BufferGeometry()
  pattern.setAttribute('position', new THREE.Float32BufferAttribute(dots, 3)); pattern.computeVertexNormals()
  const halftone = mesh(shadeInk(pattern), ink, burst); halftone.name = 'comic-halftone'
  return { object, dispose: kit.dispose, update(amount: number) {
    const t = THREE.MathUtils.smootherstep(amount, 0, 1)
    burst.scale.setScalar(0.86 + t * 0.14)
    burst.rotation.set(0.65 - t * 0.41, -0.12, -0.04 - t * 0.27)
  } }
}
