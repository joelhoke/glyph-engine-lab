'use client'

/**
 * Screen-surface mapping for the hero's object models: content renders ON
 * the screen, not as a floating overlay. The screen-bearing mesh's geometry
 * is CLONED, the clone's UVs are planar-projected over the geometry's
 * dominant face rect (the screen), and the clone joins the original mesh's
 * parent — same transforms, so content stays registered to the bezel at
 * every tilt angle (no parallax gap). A small recess along the face normal
 * sits the content at or a hair behind the glass surface.
 */

export type ScreenSurfaceOptions = {
  /** Find the screen-bearing mesh (e.g. by material name). */
  matchMesh: (mesh: import('three').Mesh) => boolean
  /** The content texture (from the compositor's canvas). */
  texture: import('three').Texture
  /** Which geometry axes carry the content's u/v (default: the two largest
   *  spans — override when the content reads rotated, e.g. a tall flip
   *  phone's screen). */
  uvAxes?: [u: 'x' | 'y' | 'z', v: 'x' | 'y' | 'z']
  /** Flip the projection axes if the content reads mirrored/upside-down. */
  flipU?: boolean
  flipV?: boolean
  /** Recess in model units along the remaining (normal) axis: sign chooses
   *  behind vs proud of the original surface. */
  recess: number
  /** 'glare': replace the original mesh's material with a transparent glass
   *  glare layer over the content (kills baked screen fills). 'keep': the
   *  original renders unchanged beneath. */
  original: 'glare' | 'keep'
  /** Alpha-composited content (transparent canvas, e.g. a screen area within
   *  a larger face) instead of an opaque full-face screen. */
  transparent?: boolean
  emissiveIntensity?: number
}

export type ScreenSurface = {
  /** The content material (adjust emissiveIntensity per theme, etc). */
  material: import('three').MeshStandardMaterial
  dispose: () => void
}

export function applyScreenSurface(
  THREE: typeof import('three'),
  root: import('three').Object3D,
  options: ScreenSurfaceOptions,
): ScreenSurface | null {
  let source: import('three').Mesh | null = null
  root.traverse((node) => {
    if (source || !(node instanceof THREE.Mesh)) return
    if (options.matchMesh(node)) source = node
  })
  if (!source) return null
  const sourceMesh = source as import('three').Mesh

  // Clone the geometry and planar-project UVs over the dominant face rect.
  const geometry = sourceMesh.geometry.clone()
  geometry.computeBoundingBox()
  const bb = geometry.boundingBox
  if (!bb) {
    geometry.dispose()
    return null
  }
  const spans = { x: bb.max.x - bb.min.x, y: bb.max.y - bb.min.y, z: bb.max.z - bb.min.z }
  const axes: ('x' | 'y' | 'z')[] = ['x', 'y', 'z']
  axes.sort((a, b) => spans[b] - spans[a])
  const uAxis = options.uvAxes?.[0] ?? axes[0]
  const vAxis = options.uvAxes?.[1] ?? axes[1]
  const normalAxis = axes.find((axis) => axis !== uAxis && axis !== vAxis) ?? 'z'
  const positions = geometry.attributes.position
  const uv = geometry.attributes.uv
  const readAxis = (i: number, axis: 'x' | 'y' | 'z') =>
    axis === 'x' ? positions.getX(i) : axis === 'y' ? positions.getY(i) : positions.getZ(i)
  for (let i = 0; i < positions.count; i += 1) {
    let u = (readAxis(i, uAxis) - bb.min[uAxis]) / spans[uAxis]
    let v = (readAxis(i, vAxis) - bb.min[vAxis]) / spans[vAxis]
    if (options.flipU) u = 1 - u
    if (options.flipV) v = 1 - v
    uv.setXY(i, u, v)
  }
  uv.needsUpdate = true
  // Recess along the face normal: toward the model's center (negative) pulls
  // the content behind the glass surface.
  const recessOffset: [number, number, number] = [0, 0, 0]
  recessOffset[normalAxis === 'x' ? 0 : normalAxis === 'y' ? 1 : 2] = options.recess
  geometry.translate(recessOffset[0], recessOffset[1], recessOffset[2])

  const material = new THREE.MeshStandardMaterial({
    map: options.texture,
    emissive: new THREE.Color(0xffffff),
    emissiveMap: options.texture,
    emissiveIntensity: options.emissiveIntensity ?? 0.6,
    roughness: 0.35,
    metalness: 0.05,
    transparent: options.transparent ?? false,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
  })
  const clone = new THREE.Mesh(geometry, material)
  clone.position.copy(sourceMesh.position)
  clone.quaternion.copy(sourceMesh.quaternion)
  clone.scale.copy(sourceMesh.scale)
  // Same parent as the original mesh → identical transforms, so the content
  // never drifts off the screen at any tilt.
  sourceMesh.parent?.add(clone)

  let glareMaterial: import('three').MeshStandardMaterial | null = null
  if (options.original === 'glare') {
    // The baked screen fill is replaced by a transparent glass glare layer
    // over our content.
    glareMaterial = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.14,
      roughness: 0.08,
      metalness: 0.2,
      depthWrite: false,
    })
    sourceMesh.material = glareMaterial
  }

  return {
    material,
    dispose: () => {
      clone.removeFromParent()
      geometry.dispose()
      material.dispose()
      glareMaterial?.dispose()
    },
  }
}
