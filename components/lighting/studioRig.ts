import type * as Three from 'three'
import type { PageIllumination } from '../home/light-study/illumination'

type Rect = { left: number; top: number; width: number; height: number }

/** Shared studio fill plus the page's actual light colors, positions, switches and aim. */
export function createStudioRig(THREE: typeof Three, scene: Three.Scene, { studioFill = true }: { studioFill?: boolean } = {}) {
  const ambient = new THREE.AmbientLight(0xffffff, studioFill ? 0.85 : 0)
  const key = new THREE.DirectionalLight(0xffffff, studioFill ? 1.7 : 0)
  key.position.set(-2.5, 3, 4)
  const rim = new THREE.DirectionalLight('#8abaff', studioFill ? 0.9 : 0)
  rim.position.set(-3, 1, -3)
  if (studioFill) scene.add(ambient, key, rim)
  const lights: Three.PointLight[] = []
  return {
    apply(illumination: PageIllumination, viewport: Rect, slot: Rect) {
      key.intensity = !studioFill ? 0 : illumination.length ? 1.05 : 1.7
      rim.intensity = !studioFill ? 0 : illumination.length ? 0.35 : 0.9
      const centerX = (slot.left - viewport.left + slot.width / 2) / viewport.width
      const centerY = (slot.top - viewport.top + slot.height / 2) / viewport.height
      const horizontal = viewport.width / viewport.height * 6
      while (lights.length < illumination.length) {
        const light = new THREE.PointLight(0xffffff, 0)
        scene.add(light); lights.push(light)
      }
      lights.forEach((light, index) => {
        const source = illumination[index]
        if (!source) { light.intensity = 0; return }
        light.color.set(source.color)
        light.intensity = source.intensity
        light.position.set((source.position.x - centerX) * horizontal, (centerY - source.position.y) * 6, 2.5)
      })
    },
  }
}
