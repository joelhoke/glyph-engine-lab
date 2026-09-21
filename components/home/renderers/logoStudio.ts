import { COMPUTER_SURFACE_FINISH } from './blueFinish'

/** Logo Studio's PNG-derived silhouette in the Work computer's finish.
 *  Contours are exported by scripts/dev/export-logo-studio-shapes.js. */
export async function createLogoStudioMark(
  THREE: typeof import('three'),
) {
  const response = await fetch('/assets/home/logo-studio-shapes.json')
  if (!response.ok) throw new Error('Logo Studio contours could not load')
  const contours = await response.json() as Array<{ points: [number, number][]; holes: [number, number][][] }>
  const material = new THREE.MeshStandardMaterial({
    roughness: COMPUTER_SURFACE_FINISH.roughness,
    metalness: COMPUTER_SURFACE_FINISH.metalness,
  })
  const object = new THREE.Group()
  object.scale.setScalar(1.6)
  const geometries: import('three').BufferGeometry[] = []
  const points = (values: [number, number][]) => values.map(([x, y]) => new THREE.Vector2(x, y))
  for (const contour of contours) {
    const shape = new THREE.Shape(points(contour.points))
    shape.holes = contour.holes.map(hole => new THREE.Path(points(hole)))
    const geometry = new THREE.ExtrudeGeometry(shape, {
      depth: 0.05, bevelEnabled: true, bevelThickness: 0.035,
      bevelSize: 0.02, bevelSegments: 8,
    })
    geometry.translate(0, 0, -0.025)
    geometries.push(geometry)
    object.add(new THREE.Mesh(geometry, material))
  }
  return {
    object,
    setColor: (color: string) => material.color.set(color),
    dispose: () => {
      geometries.forEach(geometry => geometry.dispose())
      material.dispose()
    },
  }
}
