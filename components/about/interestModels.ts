import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import { COMPUTER_SURFACE_FINISH, createBlueFinish } from '../home/renderers/blueFinish'
import { comicCoverUrl, type Comic } from '../../lib/comics.mjs'
import type { ThemeName } from '../../engine/theme'
import { FAMILY_STICKERS, type InterestId } from '../../content/about'
import { createInterestCollection } from './interestCollection'

export type ObjectId = InterestId
export type InterestModel = {
  object: THREE.Group
  pose: [number, number, number]
  setLightColor?: (color: string) => void
  setTheme?: (blue: string, theme: ThemeName) => void
  animate?: (deltaSeconds: number, highlight: number, motion: boolean) => boolean
  update: (highlight: number) => void
  dispose: () => void
}

/** Compose downloaded props around the existing family photo and comic previews. */
export function createInterestModel(id: ObjectId, comics: Comic[], invalidate: () => void): InterestModel {
  let color = '#8abaff', amount = 0
  let tint: ReturnType<typeof createBlueFinish> | undefined
  const refresh = () => { tint?.refresh(); tint?.(color, amount); invalidate() }
  const model = id === 'family' ? createStandaloneInterestModel(id, comics, refresh)
    : createInterestCollection(id, id === 'comics' ? createStandaloneInterestModel('comics', comics, refresh) : null, refresh)
  tint = createBlueFinish(THREE, model.object, { ...COMPUTER_SURFACE_FINISH, dimEmission: true,
    preserveMaterials: ['bulb-glass', 'inner-glass', 'glow'] })
  tint(color)
  return { ...model,
    setTheme(blue, theme) { color = blue; model.setTheme?.(blue, theme); tint!(color, amount) },
    update(highlight) { amount = highlight; model.update(highlight); tint!(color, amount) },
  }
}

export function createStandaloneInterestModel(id: 'family' | 'comics', comics: Comic[], invalidate: () => void): InterestModel {
  const object = new THREE.Group()
  const geometries = new Set<THREE.BufferGeometry>()
  const materials = new Set<THREE.Material>()
  const textures = new Set<THREE.Texture>()
  let disposed = false
  const material = (options: THREE.MeshStandardMaterialParameters) => {
    const result = new THREE.MeshStandardMaterial(options); materials.add(result); return result
  }
  const blue = material({ color: '#8abaff', roughness: COMPUTER_SURFACE_FINISH.roughness, metalness: COMPUTER_SURFACE_FINISH.metalness })
  const deep = material({ color: '#0c5e7d', roughness: 0.55, metalness: 0.08 })
  const paper = material({ color: '#e8e5dc', roughness: 0.9 })
  const mesh = (geometry: THREE.BufferGeometry, mat: THREE.Material | THREE.Material[], parent: THREE.Object3D = object) => {
    geometries.add(geometry)
    const result = new THREE.Mesh(geometry, mat); parent.add(result); return result
  }
  const box = (w: number, h: number, d: number, mat: THREE.Material, x = 0, y = 0, z = 0, parent: THREE.Object3D = object) => {
    const result = mesh(new RoundedBoxGeometry(w, h, d, 3, Math.min(0.06, w / 4, h / 4, d / 4)), mat, parent)
    result.position.set(x, y, z); return result
  }
  const image = (url: string, mat: THREE.MeshStandardMaterial) => {
    mat.color.set('#ffffff')
    const texture = new THREE.TextureLoader().setCrossOrigin('anonymous').load(url, loaded => {
      if (disposed) { loaded.dispose(); return }
      loaded.colorSpace = THREE.SRGBColorSpace
      loaded.anisotropy = 4
      mat.map = loaded; mat.needsUpdate = true; invalidate()
    }, undefined, () => { /* The authored material is the missing-image fallback. */ })
    textures.add(texture)
  }
  let pose: [number, number, number] = [-0.1, -0.28, 0.02]
  let update: InterestModel['update'] = () => {}

  if (id === 'family') {
    box(1.78, 1.35, 0.16, deep)
    box(1.68, 1.25, 0.08, paper, 0, 0, 0.1)
    const photoMaterial = material({ color: '#dce7f3', roughness: 0.9, transparent: true })
    mesh(new THREE.PlaneGeometry(1.46, 1.08), photoMaterial).position.z = 0.16
    image(FAMILY_STICKERS[0].src, photoMaterial)
    const prints = [-1, 1].map((side, index) => {
      const print = new THREE.Group(); print.name = 'family-memory-print'; object.add(print)
      box(1.65, 1.28, 0.025, paper, 0, 0, 0, print)
      const photo = mesh(new THREE.PlaneGeometry(1.43, 1.06), photoMaterial, print)
      photo.position.set(0, 0.03, 0.016)
      return { print, side, index }
    })
    update = amount => prints.forEach(({ print, side, index }) => {
      print.position.set(side * (0.04 + amount * 0.16), 0.09 + amount * 0.17, -0.18 - index * 0.08)
      print.rotation.z = side * (0.035 + amount * 0.12)
    })
    box(0.09, 1.4, 0.17, blue, -0.87, 0, 0.11)
    box(0.09, 1.4, 0.17, blue, 0.87, 0, 0.11)
    box(1.83, 0.09, 0.17, blue, 0, 0.67, 0.11)
    box(1.83, 0.09, 0.17, blue, 0, -0.67, 0.11)
    const stand = box(0.6, 1.1, 0.1, deep, 0, -0.2, -0.33); stand.rotation.x = -0.4
    pose = [-0.06, 0.32, -0.07]
  } else if (id === 'comics') {
    const previews = comics.slice(0, 3)
    const books: THREE.Group[] = []
    const count = Math.max(1, previews.length)
    for (let index = 0; index < count; index++) {
      const book = new THREE.Group(); book.name = `comic-book-${index}`; object.add(book); books.push(book)
      box(0.96, 1.46, 0.055, paper, 0, 0, 0, book)
      box(1, 1.5, 0.018, deep, 0, 0, -0.04, book)
      const cover = material({ color: '#528ed1', roughness: 0.54, metalness: 0.02 })
      box(1, 1.5, 0.012, deep, 0, 0, 0.04, book)
      // A flat, full-UV front face preserves the complete cover. The rounded
      // cover board, spine and pages have their own untextured materials.
      const front = mesh(new THREE.PlaneGeometry(1, 1.5), cover, book)
      front.position.z = 0.047
      const coverUrl = comicCoverUrl(previews[index]?.cover ?? null)
      if (coverUrl) image(coverUrl, cover)
      box(0.035, 1.5, 0.095, deep, -0.49, 0, 0, book)
      // Fine page edges make the preview read as a physical book.
      for (let line = 0; line < 3; line++) box(0.93, 0.005, 0.003, paper, 0, -0.72 + line * 0.004, 0.01 + line * 0.012, book)
    }
    update = amount => books.forEach((book, index) => {
      const position = index - (books.length - 1) / 2
      // Fan only in the cover plane. Separate depth layers keep the physical
      // boards from intersecting while every volume retains the same scale.
      book.position.set(position * (0.34 + amount * 0.04), -Math.abs(position) * 0.035, position * 0.12)
      book.rotation.set(0, 0, -position * (0.12 + amount * 0.05))
    })
    pose = [0, 0, 0]
  }
  update(0)
  function dispose() {
    disposed = true
    geometries.forEach(geometry => geometry.dispose())
    materials.forEach(mat => mat.dispose())
    textures.forEach(texture => texture.dispose())
  }
  return { object, pose, update, dispose }
}
