import * as THREE from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { loadGltfModel, normalizeModel } from '../home/renderers/gltfModel'
import { homeModelLoads, type ModelLoadTicket } from '../home/modelLoadQueue'
import { createBulbHousing, loadEdisonBulb } from '../home/light-study/edison'
import { setFilamentEmission } from '../home/light-study/filament'
import type { InterestModel } from './interestModels'
import type { InterestId } from '../../content/about'
import type { ThemeName } from '../../engine/theme'
import { createSmartHomeFloorPlan } from './smartHomeFloorPlan'
import { createStockChart } from './stockChart'
import { createPodiumCelebration, createCreativeBackdrop } from './interestAccents'
import assetUrls from '../../public/assets/about/models/asset-urls.json'
import { SCENE_LIGHT_PALETTE } from '../home/light-study/palette'

type Prop = { asset: string; size: number; at: [number, number, number]; rotation: [number, number, number] }
const HALF_PI = Math.PI / 2
const compositions: Record<Exclude<InterestId, 'family'>, Prop[]> = {
  // Like the homepage Work stage: a main object behind, smaller props overlapping in front.
  automotive: [
    { asset: 'toyota', size: 1.45, at: [0.2, 0.04, -0.05], rotation: [HALF_PI, 0, -HALF_PI] },
    { asset: 'formula-1', size: 1.35, at: [0.35, -0.48, 0.3], rotation: [HALF_PI, 0, -0.06] },
  ],
  comics: [
    { asset: 'snes-controller', size: 0.95, at: [-0.42, -0.55, 0.25], rotation: [1.15, 0.05, HALF_PI - 0.2] },
    { asset: 'xbox-controller', size: 0.9, at: [0.46, -0.36, 0.4], rotation: [0.5, -0.15, 0.15] },
  ],
  options: [
    { asset: 'cash', size: 1.5, at: [-0.23, -0.25, -0.02], rotation: [1.1, 0.05, Math.PI + HALF_PI - 0.15] },
    { asset: 'bitcoin', size: 1.05, at: [0.5, -0.38, 0.38], rotation: [0.1, -HALF_PI + 0.12, -0.12] },
  ],
  'smart-home': [
    { asset: 'homepod', size: 1.35, at: [-0.35, -0.24, 0.12], rotation: [0.22, -0.2, 0] },
    { asset: 'edison', size: 1.05, at: [0.6, -0.48, 0.38], rotation: [0, 0, Math.PI - 0.46] },
  ],
}

/** Assets load through the shared queue; the homepage's queue bounds concurrent decoding. */
export function createInterestCollection(id: Exclude<InterestId, 'family'>, books: InterestModel | null, invalidate: () => void): InterestModel {
  const object = new THREE.Group()
  const disposers: Array<() => void> = []
  const tickets: ModelLoadTicket[] = []
  let started = false, disposed = false, highlight = 0
  let theme: ThemeName = 'dark'
  const homepods: Partial<Record<ThemeName, THREE.Object3D>> = {}
  const syncHomepod = () => {
    for (const [variant, model] of Object.entries(homepods)) model.visible = variant === theme
  }
  const bulbColor = new THREE.Color(SCENE_LIGHT_PALETTE[0])
  let illuminateBulb: ((amount: number) => void) | undefined
  const celebration = id === 'automotive' ? createPodiumCelebration() : null
  const creative = id === 'comics' ? createCreativeBackdrop() : null
  const plan = id === 'smart-home' ? createSmartHomeFloorPlan() : null
  for (const accent of [celebration, creative, plan]) {
    if (accent) { object.add(accent.object); disposers.push(accent.dispose) }
  }
  const controllers: Array<{ wrapper: THREE.Group; direction: number }> = []
  if (id === 'options') {
    const chart = createStockChart(); object.add(chart.object); disposers.push(chart.dispose)
  }
  if (books) {
    books.object.scale.setScalar(0.75); books.object.position.set(-0.12, 0, -0.1)
    books.object.rotation.set(...books.pose); object.add(books.object); disposers.push(books.dispose)
  }
  async function load(prop: Prop) {
    let loaded: { object: THREE.Object3D; dispose: () => void }
    if (prop.asset === 'edison') {
      const bulb = await loadEdisonBulb()
      const housing = createBulbHousing()
      const group = new THREE.Group(); group.add(housing.object, bulb.object)
      const source = new THREE.PointLight(bulbColor, 0, 0, 2)
      source.name = 'interest-bulb-light'; source.position.copy(bulb.lightPosition); group.add(source)
      illuminateBulb = amount => {
        bulb.filamentMaterials.forEach(material => setFilamentEmission(material, bulbColor, amount))
        source.color.copy(bulbColor)
        // This light lives in the normalized interest scene (roughly two units
        // across), not the metre-scale pendant scene. Give the actual point
        // light enough reach to wash the blueprint behind it as well as the props.
        source.intensity = 2.4 * amount
      }
      illuminateBulb(highlight)
      loaded = { object: group, dispose: () => {
        bulb.dispose(); housing.object.traverse(node => { if (node instanceof THREE.Mesh) node.geometry.dispose() }); housing.material.dispose()
      } }
    } else loaded = await loadGltfModel({ THREE, GLTFLoader }, assetUrls[prop.asset as keyof typeof assetUrls])
    if (disposed) { loaded.dispose(); return }
    disposers.push(loaded.dispose)
    if (prop.asset === 'bitcoin') {
      loaded.object.traverse(node => {
        if (!(node instanceof THREE.Mesh)) return
        for (const material of Array.isArray(node.material) ? node.material : [node.material]) {
          if (!(material instanceof THREE.MeshStandardMaterial)) continue
          material.color.set(material.map ? '#ffe5a6' : '#ffc34b')
          material.metalness = 0.72; material.roughness = 0.23
          // A little warm fill keeps the baked coin engraving readable under colored lights.
          material.emissive.set('#ffd16a'); material.emissiveMap = material.map
          material.emissiveIntensity = 0.22
        }
      })
    }
    if (prop.asset === 'homepod') {
      loaded.object.updateMatrixWorld(true)
      for (const [variant, name] of [['dark', 'Black_0'], ['light', 'White_1']] as const) {
        const source = loaded.object.getObjectByName(name)
        if (!source) throw new Error(`Missing ${name} in the HomePod asset`)
        // Preserve the authored world orientation before centering each variant
        // into the same slot. Both remain owned by the one loaded asset for disposal.
        const detached = new THREE.Group(); detached.attach(source)
        const wrapper = compose(detached, prop)
        homepods[variant] = wrapper; loaded.object.add(wrapper)
      }
      object.add(loaded.object); syncHomepod()
    } else {
      const wrapper = compose(loaded.object, prop); object.add(wrapper)
      if (prop.asset.endsWith('controller')) {
        const direction = prop.asset === 'snes-controller' ? -1 : 1
        controllers.push({ wrapper, direction }); wrapper.rotation.z = direction * highlight * 0.12
      }
    }
    invalidate()
  }
  function compose(source: THREE.Object3D, prop: Prop) {
    // Apply authored orientation before normalizing, so tall/flat source models
    // share a consistent visual footprint regardless of their original units.
    const oriented = new THREE.Group(); oriented.add(source); oriented.rotation.set(...prop.rotation, 'ZYX')
    const wrapper = normalizeModel(THREE, oriented, prop.size)
    wrapper.position.set(...prop.at)
    return wrapper
  }
  return { object, pose: [-0.04, -0.08, 0],
    animate: celebration?.animate,
    setLightColor(color) { bulbColor.set(color); illuminateBulb?.(highlight) },
    setTheme(_blue, nextTheme) { theme = nextTheme; syncHomepod() },
    update(amount) {
      highlight = amount
      illuminateBulb?.(amount)
      books?.update(amount)
      creative?.update(amount)
      plan?.update(amount)
      controllers.forEach(({ wrapper, direction }) => { wrapper.rotation.z = direction * amount * 0.12 })
      if (started || disposed) return
      started = true
      for (const prop of compositions[id]) {
        const ticket = homeModelLoads.enqueue(40, () => {
          void load(prop).catch(error => console.error(`Unable to load ${prop.asset} interest model`, error)).finally(() => ticket.finish())
        })
        tickets.push(ticket)
      }
    },
    dispose() { disposed = true; tickets.forEach(ticket => ticket.finish()); disposers.forEach(dispose => dispose()) },
  }
}
