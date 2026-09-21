'use client'

import { ReactNode, RefObject, useEffect, useRef } from 'react'
import { createFrameLoop, FrameLoop } from '../../../engine/frameLoop'
import { HERO_PARALLAX_MIN_VIEWPORT_PX, normalizePointer, stepParallaxValue } from '../useHeroParallax'
import { loadGltfModel, normalizeModel } from './gltfModel'
import { createScreenPainter, ScreenContent, ScreenPainter, ScreenPlaybackControls, ScreenPlaybackState } from './screenContent'
import { screenProjection } from './screenProjection'
import { PHONE_SCREEN_RECT, phoneScreenCorners } from './phoneScreenGeometry'
import { applyScreenSurface, ScreenSurface } from './screenSurface'
import { COMPUTER_SURFACE_FINISH, createBlueFinish } from './blueFinish'
import { softenBrushGeometry } from './brushGeometry'
import { createBrushFinish } from './brushFinish'
import { createSplatBackdrop } from './splatBackdrop'
import { createPhoneHinge } from './phoneHinge'
import { phoneModelRegionAtUv, type PhoneModelKey, type PhoneModelKeyRegion } from './phoneModelKeys'
import { createPhoneKeyFeedback, type PhoneKeyFeedback } from './phoneKeyFeedback'
import { crtPower } from './crtPower'
import { HOME_NOTEBOOK_PAGE } from '../../../content/home'

/**
 * Hero slot objects (homepage-redesign): one builder per section — a future
 * model swap replaces exactly that builder, nothing else:
 *
 *   work        → the CRT Computer Monitor GLTF with the four-color
 *                 Microsoft logo on its screen, artifacted BBC/MODE-2 style
 *                 (chunky nearest-neighbor pixels, scanlines, phosphor bleed)
 *   vibe        → the smoothed paintbrush with site-blue pigment on its tip
 *   collaborate → the Flip Phone GLTF
 *   gallery     → the Fancy Picture Frame GLTF
 *   notebook    → the Notebook GLTF (the intro slot's notebook cover)
 *
 * Model credits (CC-BY; license.txt alongside each model):
 *   "Dandys World Brusha's PaintBrush" by NotThatGuy™ — CC-BY-4.0
 *   "CRT Computer Monitor" by Dan (fizyman) — CC-BY-4.0
 *   "Fancy Picture Frame" by Jamie McFarlane — CC-BY-4.0
 *   "Flip Phone" by Daniel_litt — CC-BY-4.0
 *   "Notebook_Material" by tinderboxh — CC-BY-4.0
 *   https://sketchfab.com — see public/assets/home/models/<name>/license.txt
 *
 * - Lazy: `three` (and its addons) are dynamic imports inside the mount
 *   effect, so they split into their own chunk and nothing touches `window`
 *   during SSR.
 * - Theme-aware: object finishes read the site's blue palette tokens;
 *   imported surface detail is preserved, and CRT glow lifts in dark mode.
 * - Cursor-reactive: gentle tilt toward the hero-bounded normalized pointer
 *   (the read-only window-level approach from useHeroParallax), in ADDITION
 *   to the CSS parallax on the slot wrapper (untouched). Tilt follows the
 *   same coarse-pointer / small-viewport / reduced-motion rules; outside
 *   those it renders a static frame.
 * - Scheduling discipline per engine/frameLoop.ts: render on demand only,
 *   park when `active` is false (hero offscreen / menu-covered), reduced
 *   motion renders one static frame then parks — never a busy rAF loop.
 * - Fallback contract: a WebGL/setup/model failure calls `onUnavailable`,
 *   and the dispatcher swaps in the slot's fallback media (or the branded
 *   placeholder).
 */

export type HeroThreeVariant = 'work' | 'vibe' | 'gallery' | 'collaborate' | 'notebook' | 'iphone'

export type HeroThreeRendererProps = {
  active: boolean
  reducedMotion: boolean
  /** Report a terminal setup failure (no WebGL, failed chunk/model load) so
   *  the dispatcher can swap in the fallback media. */
  onUnavailable?: () => void
  /** Notebook only: the introduction text baked onto the page texture. */
  blurb?: string
  /** Notebook only: hinged-cover open state (hover/focus/tap from
   *  HomeNotebook). Other variants ignore it. */
  open?: boolean
  /** Hover/focus powers the CRT and opens the phone with its invitation. */
  highlighted?: boolean
  /** Tuning panel live override of the object's rest orientation, in
   *  DEGREES (converted to radians here; builders' baseRotation is the
   *  default). Never rebuilds the object — the tilt channel eases around
   *  the new base. */
  rotationOverride?: { x: number; y: number }
  presentation?: 'hero' | 'section'
  screenContent?: ScreenContent
  /** Accessible HTML registered to the section phone's screen. */
  screenOverlay?: ReactNode
  /** Optional Easter egg: clicks on the original mesh keys. */
  onPhoneKey?: (key: PhoneModelKey) => void
  playbackPaused?: boolean
  playbackControls?: RefObject<ScreenPlaybackControls | null>
  onPlaybackState?: (state: ScreenPlaybackState) => void
  /** Section-only size adjustment, independent of the saved hero tuning. */
  modelScale?: number
}

/** Max pointer-driven tilt, radians per axis. */
const TILT_MAX_RAD = 0.38

/** Each object's rest orientation (radians) — the shipped defaults the
 *  tuning panel's Hero rotation sliders start from (tuningConfig.ts derives
 *  its degree defaults from this map; a baked tune edits THESE values). */
export const HERO_THREE_BASE_ROTATIONS: Record<HeroThreeVariant, { x: number; y: number }> = {
  work: { x: 0.262, y: -0.262 },
  vibe: { x: 0.349, y: (220 * Math.PI) / 180 },
  collaborate: { x: 0.471, y: 0.035 },
  gallery: { x: -0.017, y: -1.047 },
  notebook: { x: 0.227, y: 0.052 },
  iphone: { x: 0.07, y: -0.18 },
}

type ReadToken = (name: string) => string

type ThreeModules = {
  THREE: typeof import('three')
  RoundedBoxGeometry: typeof import('three/examples/jsm/geometries/RoundedBoxGeometry.js').RoundedBoxGeometry
  GLTFLoader: typeof import('three/examples/jsm/loaders/GLTFLoader.js').GLTFLoader
}

type BuiltObject = {
  object: import('three').Object3D
  /** Resting pose (pointer tilt eases back to this off-hero). */
  baseRotation: { x: number; y: number }
  /** Notebook only: eased 0–1 open amount → hinge rotation. */
  setOpen?: (amount: number) => void
  /** Eased 0–1 highlight amount → screen power / phone hinge. */
  setHighlight?: (amount: number) => void
  /** A screen compositor painter when the object has one (CRT/…) — the
   *  component parks it with the object and reads needsFrames() into
   *  keepRunning. */
  painter?: ScreenPainter
  screenCorners?: () => import('three').Vector3[]
  keypadMesh?: import('three').Mesh
  keypadFeedback?: PhoneKeyFeedback
  /** Re-read theme tokens into the object's materials. */
  applyTheme: (readToken: ReadToken) => void
  dispose: () => void
}

async function loadThree(): Promise<ThreeModules> {
  const [THREE, rounded, gltf] = await Promise.all([
    import('three'),
    import('three/examples/jsm/geometries/RoundedBoxGeometry.js'),
    import('three/examples/jsm/loaders/GLTFLoader.js'),
  ])
  return {
    THREE,
    RoundedBoxGeometry: rounded.RoundedBoxGeometry,
    GLTFLoader: gltf.GLTFLoader,
  }
}

const MODELS_BASE = '/assets/home/models'

/** Shared GLTF slot pipeline: load, dispose-track, normalize (center +
 *  uniform scale), decorate, and hand back the BuiltObject contract. A
 *  failed load rejects — the caller's fail() swaps in the fallback media. */
async function buildGltfSlot(
  mods: ThreeModules,
  url: string,
  options: {
    targetSize: number
    baseRotation: { x: number; y: number }
    finish?: { colorToken: string; roughness: number; metalness: number; textureLift?: number }
    /** Model-axis correction applied before normalization judgment. */
    orient?: (object: import('three').Object3D) => void
    /** Per-model decoration (screen textures, insets). Re-runs on theme
     *  change via the returned applyTheme. */
    decorate?: (model: import('three').Object3D, readToken: ReadToken) => void
  },
): Promise<BuiltObject> {
  const model = await loadGltfModel(mods, url)
  const wrapper = normalizeModel(mods.THREE, model.object, options.targetSize)
  options.orient?.(wrapper)
  const tint = options.finish ? createBlueFinish(mods.THREE, model.object, options.finish) : null
  return {
    object: wrapper,
    baseRotation: options.baseRotation,
    applyTheme: (readToken) => {
      if (options.finish) tint?.(readToken(options.finish.colorToken))
      options.decorate?.(model.object, readToken)
    },
    dispose: model.dispose,
  }
}

/** Options handed to every builder: the notebook's blurb text, and a
 *  requestFrame so compositor repaints (slides/video) re-render the scene. */
type BuilderOptions = {
  blurb?: string
  requestFrame?: () => void
  screenContent?: ScreenContent
  onPlaybackState?: (state: ScreenPlaybackState) => void
  embeddedScreen?: boolean
}

/** The artifacted Microsoft-logo screen texture lives in the shared
 *  compositor (renderers/screenContent.ts → paintArtifactLogo). */

/** Work: the CRT GLTF with the artifacted Microsoft logo rendered ON the
 *  screen — the glass mesh's geometry cloned with planar-projected UVs and
 *  recessed a hair behind the glass (which keeps its tint/glare as a
 *  transparent layer on top, the baked terminal fill gone). Same parent,
 *  same transforms: the content stays registered to the bezel at any tilt.
 *  Content comes from the shared compositor (renderers/screenContent.ts);
 *  the CRT keeps 'artifact-logo'. */
async function buildCrtWork(
  mods: ThreeModules,
  options?: BuilderOptions,
): Promise<BuiltObject> {
  const { THREE } = mods
  const base = await buildGltfSlot(mods, `${MODELS_BASE}/crt/scene.gltf`, {
    targetSize: 2.0,
    baseRotation: HERO_THREE_BASE_ROTATIONS.work,
    finish: COMPUTER_SURFACE_FINISH,
  })
  let surface: ScreenSurface | null = null
  const canvas = document.createElement('canvas')
  canvas.width = options?.screenContent ? 512 : 256
  canvas.height = options?.screenContent ? 384 : 192
  const ctx = canvas.getContext('2d')
  const texture = new THREE.CanvasTexture(canvas)
  let source: HTMLCanvasElement | null = null
  let highlight = 0, rising = true, glow = 0.6
  const compose = () => {
    const power = crtPower(highlight, rising)
    if (ctx) {
      ctx.globalAlpha = 1
      ctx.fillStyle = '#03080d'
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      if (source && power.picture > 0) {
        ctx.globalAlpha = power.picture
        ctx.drawImage(source, 0, 0)
      }
      if (power.pulse > 0) {
        ctx.globalAlpha = power.pulse
        ctx.fillStyle = '#8abaff'
        ctx.fillRect(canvas.width * 0.05, canvas.height * 0.49, canvas.width * 0.9, canvas.height * 0.02)
      }
      ctx.globalAlpha = 1
    }
    if (surface) surface.material.emissiveIntensity = glow * Math.max(power.picture, power.pulse)
    texture.needsUpdate = true
  }
  const painter = createScreenPainter(options?.screenContent ?? { kind: 'artifact-logo' }, {
    onPlaybackState: options?.onPlaybackState,
    width: canvas.width,
    height: canvas.height,
    requestFrame: () => {
      compose()
      options?.requestFrame?.()
    },
  })
  source = painter.canvas
  painter.paintNow()
  surface = applyScreenSurface(THREE, base.object, {
    matchMesh: (mesh) => {
      const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
      return materials.some((m) => m && m.name === 'monitor_glass')
    },
    texture,
    recess: 0.012, // a hair INTO the monitor — content sits behind the glass
    original: 'glare',
    emissiveIntensity: 0,
  })
  compose()
  const previousDispose = base.dispose
  return {
    ...base,
    painter,
    setHighlight: (amount) => {
      if (amount === highlight) return
      rising = amount > highlight
      highlight = amount
      compose()
    },
    applyTheme: (readToken) => {
      base.applyTheme(readToken)
      // The screen glow lifts in the dark theme (page luminance tells).
      const page = readToken('--color-page')
      const light = parseInt(page.slice(1, 3), 16) > 128
      glow = light ? 0.35 : 0.65
      compose()
    },
    dispose: () => {
      surface?.dispose()
      texture.dispose()
      painter.dispose()
      previousDispose()
    },
  }
}

/** Phone screen content (custom, not a compositor kind): dim standby at
 *  idle — dark glass with faint accent glyph rows — and a warm "Let’s chat"
 *  message bubble on highlight (hover/focus of the Collaborate slot link).
 *  Painted within the screen rect (fractions of the flip face); the canvas
 *  stays transparent elsewhere so the baked plastic shows through. */
// The source atlas's glass rectangle maps to this region of the lid's
// projected X/Y face. Leave the speaker, bezel and hinge uncovered.

function createPhoneScreen(THREE: ThreeModules['THREE'], readToken: ReadToken) {
  void THREE
  const canvas = document.createElement('canvas')
  // Match the lid's physical aspect ratio so lettering isn't stretched.
  // Paint at 2x resolution for sharp text while keeping texture cost small.
  const width = 128, height = 250
  canvas.width = width * 2
  canvas.height = height * 2
  const ctx = canvas.getContext('2d')
  ctx?.scale(2, 2)
  const x0 = PHONE_SCREEN_RECT.left * width
  const x1 = (1 - PHONE_SCREEN_RECT.right) * width
  const y0 = PHONE_SCREEN_RECT.top * height
  const y1 = (1 - PHONE_SCREEN_RECT.bottom) * height
  const w = x1 - x0
  const h = y1 - y0
  const paint = (highlight: number) => {
    if (!ctx) return
    ctx.clearRect(0, 0, width, height)
    ctx.save()
    ctx.beginPath()
    ctx.rect(x0, y0, w, h)
    ctx.clip()
    // Idle standby: dark glass, faint glyph rows.
    ctx.globalAlpha = 1
    ctx.fillStyle = '#071626'
    ctx.fillRect(x0, y0, w, h)
    ctx.fillStyle = readToken('--color-hero-blue-light')
    ctx.font = '9px "Departure Mono", ui-monospace, monospace'
    ctx.textBaseline = 'top'
    ctx.globalAlpha = 0.16
    for (let y = y0 + 4; y < y1; y += 12) {
      ctx.fillText('say hi '.repeat(10), x0 + 4, y)
    }
    if (highlight > 0) {
      // Collaborate's warm palette, with a pale peach message surface so
      // the requested dark lettering stays readable in both page themes.
      ctx.globalAlpha = highlight * 0.55
      const glow = ctx.createRadialGradient(x0 + w / 2, y0 + h / 2, 2, x0 + w / 2, y0 + h / 2, w * 0.7)
      glow.addColorStop(0, readToken('--color-warm'))
      glow.addColorStop(1, readToken('--color-surface-warm-panel'))
      ctx.fillStyle = glow
      ctx.fillRect(x0, y0, w, h)
      ctx.globalAlpha = highlight
      const bx = x0 + 2
      const by = y0 + 2
      const bw = w - 4
      const bh = h - 4
      const r = 4
      ctx.beginPath()
      ctx.moveTo(bx + r, by)
      ctx.arcTo(bx + bw, by, bx + bw, by + bh, r)
      ctx.arcTo(bx + bw, by + bh, bx, by + bh, r)
      ctx.arcTo(bx, by + bh, bx, by, r)
      ctx.arcTo(bx, by, bx + bw, by, r)
      ctx.closePath()
      ctx.fillStyle = '#ffd9c4'
      ctx.fill()
      ctx.strokeStyle = readToken('--color-warm')
      ctx.lineWidth = 2
      ctx.stroke()
      ctx.fillStyle = '#1c120c'
      ctx.font = '600 13px "Departure Mono", ui-monospace, monospace'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText('Let’s chat', bx + bw / 2, by + bh / 2 - 9)
      ctx.font = '600 10px "Departure Mono", ui-monospace, monospace'
      ctx.fillStyle = '#1c120c'
      ctx.fillText('say hello', bx + bw / 2, by + bh / 2 + 11)
    }
    ctx.restore()
    ctx.globalAlpha = 1
  }
  paint(0)
  return { canvas, paint }
}

/** Collaborate: a hinged Flip Phone GLTF, plus a real screen surface
 *  (the flip half's geometry cloned with planar-projected UVs, a hair proud
 *  of the baked screen graphic). Idle = closed; hover/focus opens the lid
 *  and lights the "Let’s chat" invitation. The screen layer is
 *  decorative — pointer-transparent via the slot contract, and the link's
 *  own hover/click behavior is untouched. */
async function buildPhoneCollaborate(
  mods: ThreeModules,
  options?: BuilderOptions,
): Promise<BuiltObject> {
  const { THREE } = mods
  const base = await buildGltfSlot(mods, `${MODELS_BASE}/phone/scene.gltf`, {
    targetSize: 1.9,
    baseRotation: HERO_THREE_BASE_ROTATIONS.collaborate,
    finish: { ...COMPUTER_SURFACE_FINISH, textureLift: 0.3 },
  })
  const rig = createPhoneHinge(THREE, base.object)
  const screen = createPhoneScreen(THREE, (name) =>
    getComputedStyle(document.documentElement).getPropertyValue(name).trim() || '#8abaff',
  )
  const texture = new THREE.CanvasTexture(screen.canvas)
  // The flip half is the mesh thin in z (a standing slab); the base lies
  // flat (thin in y).
  const surface = applyScreenSurface(THREE, base.object, {
    matchMesh: (mesh) => mesh === rig.lid,
    texture,
    uvAxes: ['x', 'y'], // flip width/height — the default span sort reads rotated
    recess: 0.004, // a hair toward the viewer, over the baked graphic
    original: 'keep',
    transparent: true,
    emissiveIntensity: 0.5,
  })
  rig.setOpen(0)
  if (surface) surface.material.opacity = 0
  let highlight = 0
  const previousDispose = base.dispose
  const keypadFeedback = options?.embeddedScreen ? createPhoneKeyFeedback(THREE, rig.base) : undefined
  return {
    ...base,
    keypadFeedback,
    screenCorners: options?.embeddedScreen ? () => phoneScreenCorners(THREE, rig.lid) : undefined,
    keypadMesh: options?.embeddedScreen ? rig.base : undefined,
    setHighlight: (amount) => {
      if (amount === highlight) return
      highlight = amount
      rig.setOpen(highlight)
      if (surface) surface.material.opacity = Math.max(0, (highlight - 0.5) * 2)
      screen.paint(highlight)
      texture.needsUpdate = true
    },
    applyTheme: (readToken) => {
      base.applyTheme(readToken)
      screen.paint(highlight)
      texture.needsUpdate = true
    },
    dispose: () => {
      keypadFeedback?.dispose()
      surface?.dispose()
      texture.dispose()
      previousDispose()
    },
  }
}

/** Gallery: blue enamel over the frame's original carved surface detail. */
async function buildFrameGallery(mods: ThreeModules): Promise<BuiltObject> {
  return buildGltfSlot(mods, `${MODELS_BASE}/frame/scene.gltf`, {
    targetSize: 1.95,
    baseRotation: HERO_THREE_BASE_ROTATIONS.gallery,
    finish: { colorToken: '--color-hero-blue-mid', roughness: 0.4, metalness: 0.25 },
  })
}

/** Notebook cover texture: blue with an inset double border — the
 *  composed procedural cover that hinges open over the GLTF base. */
function createNotebookCoverTexture(THREE: ThreeModules['THREE']) {
  const canvas = document.createElement('canvas')
  canvas.width = 512
  canvas.height = 700
  const ctx = canvas.getContext('2d')
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  const paint = (readToken: ReadToken) => {
    if (!ctx) return
    ctx.fillStyle = readToken('--color-hero-blue-mid')
    ctx.fillRect(0, 0, 512, 700)
    ctx.strokeStyle = readToken('--color-hero-blue-light')
    ctx.lineWidth = 6
    ctx.strokeRect(22, 22, 468, 656)
    ctx.lineWidth = 2
    ctx.strokeRect(38, 38, 436, 624)
    // A small monogram mark on the cover — quiet, like a stamped notebook.
    ctx.fillStyle = readToken('--color-hero-blue-light')
    ctx.font = '700 64px "Cabin", system-ui, sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText('JH', 256, 380)
    texture.needsUpdate = true
  }
  return { texture, paint, dispose: () => texture.dispose() }
}

/** Authored watercolor page, cropped to the actual paper proportions.
 *  Await loading so the first parked/reduced-motion frame includes the art.
 *  Keep the introduction text as a fallback if the image cannot load. */
async function createNotebookPageTexture(THREE: ThreeModules['THREE'], text: string, aspect: number) {
  const canvas = document.createElement('canvas')
  canvas.width = 512
  canvas.height = 700
  const ctx = canvas.getContext('2d')
  if (ctx) {
    ctx.fillStyle = '#f4efe2'
    ctx.fillRect(0, 0, 512, 700)
    ctx.fillStyle = '#3a3428'
    ctx.font = '23px "Departure Mono", ui-monospace, monospace'
    ctx.textBaseline = 'top'
    const words = text.split(/\s+/)
    let line = ''
    let y = 56
    for (const word of words) {
      const test = line ? `${line} ${word}` : word
      if (line && ctx.measureText(test).width > 420) {
        ctx.fillText(line, 46, y)
        y += 40
        line = word
      } else {
        line = test
      }
    }
    if (line) ctx.fillText(line, 46, y)
  }
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image()
      image.onload = () => resolve(image)
      image.onerror = reject
      image.src = HOME_NOTEBOOK_PAGE.src
    })
    if (ctx) {
      canvas.width = 1024
      canvas.height = Math.round(canvas.width / aspect)
      const scale = Math.max(canvas.width / image.naturalWidth, canvas.height / image.naturalHeight)
      const width = image.naturalWidth * scale
      const height = image.naturalHeight * scale
      ctx.drawImage(image, (canvas.width - width) / 2, (canvas.height - height) / 2, width, height)
    }
  } catch {
    // The authored blurb above still makes a useful page when offline.
  }
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  return { texture, dispose: () => texture.dispose() }
}

/** Hinge travel for the composed notebook cover (≈150°). */
const NOTEBOOK_OPEN_RAD = 2.6

/** Intro slot: the Notebook GLTF is a single merged mesh (no separable
 *  cover), so the opening is COMPOSED: the GLTF stays the base, a
 *  procedural blue cover hinges around the spiral edge (the left long
 *  edge, +y axis at min x), and the watercolor introduction fills a page
 *  plane just proud of the model's top face — revealed when the cover
 *  swings open. */
async function buildNotebookIntro(
  mods: ThreeModules,
  options?: { blurb?: string },
): Promise<BuiltObject> {
  const { THREE, RoundedBoxGeometry } = mods
  const model = await loadGltfModel(mods, `${MODELS_BASE}/notebook/scene.gltf`)
  const wrapper = normalizeModel(THREE, model.object, 1.55)
  const notebook = new THREE.Group()
  notebook.add(wrapper)
  const tint = createBlueFinish(THREE, model.object, { roughness: 0.65, metalness: 0.08 })
  // Keep decorations in normalized parent space. The imported scene has
  // nested transforms; attaching world-space geometry inside it applies
  // them twice, letting the original cover poke through the new one.
  const bbox = new THREE.Box3().setFromObject(wrapper)
  const size = bbox.getSize(new THREE.Vector3())
  const center = bbox.getCenter(new THREE.Vector3())
  const disposables: Array<{ dispose: () => void }> = []

  const coverW = size.x * 0.96
  const coverH = size.y * 0.97
  const pageTexture = await createNotebookPageTexture(THREE, options?.blurb ?? '', coverW / coverH)
  const coverTexture = createNotebookCoverTexture(THREE)
  disposables.push(pageTexture, coverTexture)
  const pageGeometry = new THREE.PlaneGeometry(coverW * 0.98, coverH * 0.98)
  const pageMaterial = new THREE.MeshBasicMaterial({ map: pageTexture.texture, toneMapped: false })
  const page = new THREE.Mesh(pageGeometry, pageMaterial)
  page.position.set(center.x, center.y, bbox.max.z + size.z * 0.04)
  disposables.push(pageGeometry, pageMaterial)
  const hinge = new THREE.Group()
  hinge.position.set(center.x - coverW / 2, center.y, bbox.max.z + size.z * 0.16)
  const coverGeometry = new RoundedBoxGeometry(coverW, coverH, size.z * 0.12, 2, size.z * 0.05)
  const coverMaterial = new THREE.MeshStandardMaterial({
    map: coverTexture.texture,
    roughness: 0.7,
    metalness: 0.02,
  })
  const cover = new THREE.Mesh(coverGeometry, coverMaterial)
  cover.position.set(coverW / 2, 0, 0)
  hinge.add(cover)
  disposables.push(coverGeometry, coverMaterial)
  notebook.add(page, hinge)

  return {
    object: notebook,
    baseRotation: HERO_THREE_BASE_ROTATIONS.notebook,
    setOpen: (amount) => {
      hinge.rotation.y = -amount * NOTEBOOK_OPEN_RAD
      page.visible = amount > 0.01
    },
    applyTheme: (readToken) => {
      tint(readToken('--color-hero-blue-light'))
      coverTexture.paint(readToken)
    },
    dispose: () => {
      disposables.forEach((d) => d.dispose())
      model.dispose()
    },
  }
}

/** Work's secondary object; use the actual rounded screen mesh for the art. */
async function buildWorkIphone(mods: ThreeModules): Promise<BuiltObject> {
  const { THREE } = mods
  const model = await loadGltfModel(mods, `${MODELS_BASE}/iphone/scene.gltf`)
  let texture: import('three').Texture
  try {
    texture = await new THREE.TextureLoader().loadAsync('/assets/work/employee-experience-dashboard.webp')
  } catch (error) {
    model.dispose()
    throw error
  }
  texture.colorSpace = THREE.SRGBColorSpace
  const frameMaterials = new Set<import('three').MeshStandardMaterial>()
  model.object.traverse(node => {
    if (!(node instanceof THREE.Mesh)) return
    const materials = Array.isArray(node.material) ? node.material : [node.material]
    for (const material of materials) {
      if (material instanceof THREE.MeshStandardMaterial && /^COLOUR_Black_(Side_Panel|Side_Button)/.test(material.name)) frameMaterials.add(material)
    }
    if (!materials.some(material => material.name === 'COLOUR_Black_Screen')) return
    const geometry = node.geometry
    geometry.computeBoundingBox()
    const box = geometry.boundingBox!
    const positions = geometry.attributes.position
    const uv = geometry.attributes.uv
    for (let i = 0; i < positions.count; i++) {
      uv.setXY(i, (positions.getX(i) - box.min.x) / (box.max.x - box.min.x),
        (positions.getY(i) - box.min.y) / (box.max.y - box.min.y))
    }
    uv.needsUpdate = true
    materials.forEach(material => {
      for (const value of Object.values(material)) if (value instanceof THREE.Texture) value.dispose()
      material.dispose()
    })
    node.material = new THREE.MeshBasicMaterial({ map: texture, toneMapped: false,
      polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 })
  })
  return {
    object: normalizeModel(THREE, model.object, 2.15),
    baseRotation: HERO_THREE_BASE_ROTATIONS.iphone,
    applyTheme: readToken => frameMaterials.forEach(material => {
      material.color.set(readToken('--color-hero-blue-mid'))
      material.roughness = 0.42
      material.metalness = 0.35
    }),
    dispose: model.dispose,
  }
}

/** Vibe: the downloaded paintbrush, with a gently rounded silhouette and
 *  smooth shading. Preserve the handle; repaint the tip in the site blue. */
async function buildBrushVibe(mods: ThreeModules): Promise<BuiltObject> {
  const { THREE } = mods
  const { toCreasedNormals } = await import('three/examples/jsm/utils/BufferGeometryUtils.js')
  const model = await loadGltfModel(mods, `${MODELS_BASE}/brush/scene.gltf`)
  model.object.traverse(node => {
    if (!(node instanceof THREE.Mesh)) return
    const original = node.geometry
    const softened = softenBrushGeometry(THREE, original)
    node.geometry = toCreasedNormals(softened, Math.PI / 2)
    if (node.geometry !== softened) softened.dispose()
    original.dispose()
  })
  const tint = createBrushFinish(THREE, model.object)
  const splat = await createSplatBackdrop(THREE)
  const object = new THREE.Group()
  object.add(normalizeModel(THREE, model.object, 2.0), splat.object)
  return {
    object,
    baseRotation: HERO_THREE_BASE_ROTATIONS.vibe,
    setHighlight: amount => {
      // Keep the splat behind the brush even at its 220° turn and tilt extremes.
      splat.object.quaternion.copy(object.quaternion).invert()
      splat.object.position.set(0, -0.05, -0.7).applyQuaternion(splat.object.quaternion)
      splat.setHighlight(amount)
    },
    applyTheme: readToken => { tint(readToken('--color-hero-blue-light')); splat.applyTheme(readToken) },
    dispose: () => { splat.dispose(); model.dispose() },
  }
}

const BUILDERS: Record<
  HeroThreeVariant,
  (mods: ThreeModules, options?: BuilderOptions) => Promise<BuiltObject>
> = {
  work: buildCrtWork,
  vibe: buildBrushVibe,
  collaborate: buildPhoneCollaborate,
  gallery: buildFrameGallery,
  notebook: buildNotebookIntro,
  iphone: buildWorkIphone,
}

export function HeroThreeObject({
  variant,
  active,
  reducedMotion,
  onUnavailable,
  blurb,
  open = false,
  highlighted = false,
  rotationOverride,
  presentation = 'hero',
  screenContent,
  screenOverlay,
  onPhoneKey,
  playbackPaused = false,
  playbackControls,
  onPlaybackState,
  modelScale = 1,
}: HeroThreeRendererProps & { variant: HeroThreeVariant }) {
  const hostRef = useRef<HTMLDivElement | null>(null)
  const overlayRef = useRef<HTMLDivElement | null>(null)
  const onPhoneKeyRef = useRef(onPhoneKey)
  useEffect(() => { onPhoneKeyRef.current = onPhoneKey }, [onPhoneKey])
  const pausedRef = useRef(playbackPaused)
  const activeRef = useRef(active)
  const reducedMotionRef = useRef(reducedMotion)
  const onUnavailableRef = useRef(onUnavailable)
  const onPlaybackStateRef = useRef(onPlaybackState)
  useEffect(() => { onPlaybackStateRef.current = onPlaybackState }, [onPlaybackState])
  const loopRef = useRef<FrameLoop | null>(null)
  const renderOnceRef = useRef<() => void>(() => {})
  // Live rest-orientation override (tuning panel): radians, converted from
  // the panel's degrees; read per frame so the tilt channel eases around
  // the new base without rebuilding the object.
  const rotationOverrideRef = useRef<{ x: number; y: number } | null>(null)
  // The notebook's eased hinge channel (0 = closed, 1 = open); other
  // variants carry no setOpen and pay nothing for it.
  const openRef = useRef({ current: open ? 1 : 0, target: open ? 1 : 0 })
  // The screen/phone eased highlight channel (0 = off/closed, 1 = on/open) — same
  // discipline, driven by the slot link's hover/focus.
  const highlightRef = useRef({ current: presentation === 'section' && highlighted ? 1 : 0, target: highlighted ? 1 : 0 })
  // The screen compositor painter, when the object has one (CRT/…) —
  // parked with the object, its needsFrames feeds keepRunning.
  const painterRef = useRef<ScreenPainter | null>(null)

  useEffect(() => {
    if (!playbackControls) return
    playbackControls.current = {
      play: () => {
        // Stay in the originating click event; an effect loses Safari's
        // user-activation permission when autoplay has been blocked.
        pausedRef.current = false
        painterRef.current?.setActive(activeRef.current)
        painterRef.current?.play?.()
      },
      pause: () => {
        pausedRef.current = true
        painterRef.current?.pause?.()
        painterRef.current?.setActive(false)
      },
    }
    return () => { playbackControls.current = null }
  }, [playbackControls])

  useEffect(() => {
    activeRef.current = active
    painterRef.current?.setActive(active && !pausedRef.current)
    if (!active) {
      loopRef.current?.park()
    } else {
      renderOnceRef.current()
    }
  }, [active])
  useEffect(() => {
    pausedRef.current = playbackPaused
    painterRef.current?.setActive(activeRef.current && !playbackPaused)
  }, [playbackPaused])
  useEffect(() => {
    reducedMotionRef.current = reducedMotion
    painterRef.current?.setReducedMotion(reducedMotion)
    renderOnceRef.current()
  }, [reducedMotion])
  useEffect(() => {
    onUnavailableRef.current = onUnavailable
  }, [onUnavailable])
  useEffect(() => {
    openRef.current.target = open ? 1 : 0
    renderOnceRef.current()
  }, [open])
  useEffect(() => {
    highlightRef.current.target = highlighted ? 1 : 0
    renderOnceRef.current()
  }, [highlighted])
  useEffect(() => {
    // Degrees in the panel → radians here; a new base re-renders in place.
    rotationOverrideRef.current = rotationOverride
      ? { x: (rotationOverride.x * Math.PI) / 180, y: (rotationOverride.y * Math.PI) / 180 }
      : null
    renderOnceRef.current()
  }, [rotationOverride])

  useEffect(() => {
    const host = hostRef.current
    if (!host) return
    let disposed = false
    let failed = false
    let cleanup: (() => void) | null = null
    const fail = () => {
      if (failed || disposed) return
      failed = true
      onUnavailableRef.current?.()
    }

    void (async () => {
      let mods: ThreeModules
      try {
        mods = await loadThree()
      } catch {
        fail()
        return
      }
      if (disposed) return
      const { THREE } = mods

      let renderer: import('three').WebGLRenderer
      try {
        // preserveDrawingBuffer: these tiny on-demand canvases stay readable
        // after the frame (screenshots of the hero, pixel-level checks) at
        // negligible cost — every draw renders the full frame anyway.
        renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, preserveDrawingBuffer: true })
        if (!renderer.getContext()) throw new Error('no WebGL context')
      } catch {
        fail()
        return
      }

      const readToken: ReadToken = (name) =>
        getComputedStyle(document.documentElement).getPropertyValue(name).trim() || '#8abaff'

      const scene = new THREE.Scene()
      const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 50)
      camera.position.set(0, 0, 4.6)

      let built: BuiltObject
      try {
        built = await BUILDERS[variant](mods, {
          blurb,
          requestFrame: () => renderOnceRef.current(),
          screenContent,
          onPlaybackState: state => onPlaybackStateRef.current?.(state),
          embeddedScreen: presentation === 'section' && variant === 'collaborate',
        })
      } catch {
        renderer.dispose()
        fail()
        return
      }
      if (disposed) {
        built.dispose()
        renderer.dispose()
        return
      }
      built.object.scale.multiplyScalar(modelScale)
      built.applyTheme(readToken)
      scene.add(built.object)
      painterRef.current = built.painter ?? null
      built.painter?.setActive(false)
      built.painter?.setReducedMotion(reducedMotionRef.current)
      built.painter?.setActive(activeRef.current && !pausedRef.current)
      scene.add(new THREE.AmbientLight(0xffffff, 0.85))
      const key = new THREE.DirectionalLight(0xffffff, 1.7)
      key.position.set(2.5, 3, 4)
      scene.add(key)

      const canvas = renderer.domElement
      canvas.setAttribute('aria-hidden', 'true')
      host.appendChild(canvas)

      // Interaction environment: the same coarse-pointer / small-viewport /
      // reduced-motion rules as the CSS parallax (mobile tiles render static).
      const fineHoverQuery = window.matchMedia('(pointer: fine) and (hover: hover)')
      const pointerRegion = host.closest(presentation === 'section' ? '.home-section' : '.home-hero')
      let regionBounds = pointerRegion?.getBoundingClientRect() ?? null
      const interactive = () =>
        activeRef.current &&
        !reducedMotionRef.current &&
        fineHoverQuery.matches &&
        window.innerWidth >= HERO_PARALLAX_MIN_VIEWPORT_PX

      const tilt = {
        current: { x: 0, y: 0 },
        target: { x: 0, y: 0 },
      }
      let lastNow = 0
      let hostWidth = 1, hostHeight = 1

      const draw = (deltaMs = 16) => {
        const base = rotationOverrideRef.current ?? built.baseRotation
        built.object.rotation.set(
          base.x + tilt.current.x,
          base.y + tilt.current.y,
          0,
        )
        built.setOpen?.(openRef.current.current)
        built.setHighlight?.(highlightRef.current.current)
        built.keypadFeedback?.step(deltaMs, !interactive())
        renderer.render(scene, camera)
        const overlay = overlayRef.current
        if (overlay && built.screenCorners) {
          const points = built.screenCorners().map(point => {
            point.project(camera)
            return { x: (point.x + 1) * hostWidth / 2, y: (1 - point.y) * hostHeight / 2 }
          })
          const matrix = screenProjection(points, 240, 320)
          overlay.style.visibility = matrix ? 'visible' : 'hidden'
          if (matrix) overlay.style.transform = `matrix3d(${matrix.join(',')})`
        }
      }

      const loop = createFrameLoop({
        frame: (now) => {
          const deltaMs = lastNow > 0 ? now - lastNow : 16
          lastNow = now
          tilt.current.x = stepParallaxValue(tilt.current.x, tilt.target.x, deltaMs)
          tilt.current.y = stepParallaxValue(tilt.current.y, tilt.target.y, deltaMs)
          const openChannel = openRef.current
          openChannel.current = stepParallaxValue(openChannel.current, openChannel.target, deltaMs)
          const highlightChannel = highlightRef.current
          highlightChannel.current = stepParallaxValue(
            highlightChannel.current,
            highlightChannel.target,
            deltaMs,
          )
          draw(deltaMs)
        },
        // Settled (== after the epsilon snap) → the loop parks itself,
        // unless the screen compositor needs frames (slides crossfade /
        // video playing).
        keepRunning: () =>
          tilt.current.x !== tilt.target.x ||
          tilt.current.y !== tilt.target.y ||
          openRef.current.current !== openRef.current.target ||
          highlightRef.current.current !== highlightRef.current.target ||
          built.painter?.needsFrames() === true ||
          built.keypadFeedback?.needsFrames() === true,
        isParked: () => !activeRef.current,
      })
      loopRef.current = loop
      renderOnceRef.current = () => {
        // Touch selection still animates the hinge and screen power. Only
        // cursor tilt requires a fine pointer and the desktop breakpoint.
        if (!interactive()) {
          tilt.current.x = tilt.target.x = 0
          tilt.current.y = tilt.target.y = 0
        }
        if (!activeRef.current || reducedMotionRef.current) {
          openRef.current.current = openRef.current.target
          highlightRef.current.current = highlightRef.current.target
          draw()
          return
        }
        // A hover after a parked interval starts a fresh animation; idle
        // wall time must not skip the hinge movement or CRT startup pulse.
        if (!loop.isPending()) lastNow = 0
        loop.renderOnce()
      }

      // --- Sizing -------------------------------------------------------------
      const resize = () => {
        const rect = host.getBoundingClientRect()
        const width = Math.max(1, Math.round(rect.width))
        const height = Math.max(1, Math.round(rect.height))
        hostWidth = width
        hostHeight = height
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
        // Expand the drawing area around the original viewport. The camera
        // and pixel scale stay unchanged, while the CRT can tilt past its
        // former canvas edges without being cut off.
        const bleed = presentation === 'section' && variant === 'work' ? 0.2 : 0
        renderer.setSize(width * (1 + bleed * 2), height * (1 + bleed * 2), false)
        camera.aspect = width / height
        if (bleed) camera.setViewOffset(width, height, -width * bleed, -height * bleed, width * (1 + bleed * 2), height * (1 + bleed * 2))
        camera.updateProjectionMatrix()
        renderOnceRef.current()
      }
      const resizeObserver =
        typeof ResizeObserver !== 'undefined' ? new ResizeObserver(resize) : null
      resizeObserver?.observe(host)
      resize()

      // --- Theme follow ---------------------------------------------------------
      // Same source as engine/useSystemTheme: the light media query.
      const lightQuery = window.matchMedia('(prefers-color-scheme: light)')
      const handleThemeChange = () => {
        built.applyTheme(readToken)
        renderOnceRef.current()
      }
      lightQuery.addEventListener('change', handleThemeChange)

      // Section objects follow their own section's pointer area. The phone
      // freezes at its current pose while its native controls are in use.
      const measureRegion = () => {
        regionBounds = pointerRegion?.getBoundingClientRect() ?? null
      }
      const holdScreenSteady = () => {
        tilt.target.x = tilt.current.x
        tilt.target.y = tilt.current.y
      }
      // Raycast the original visible mesh, including its button geometry and
      // atlas UVs. No HTML hit areas, replacement keys, or pose adjustment.
      const raycaster = new THREE.Raycaster()
      const keyPointer = new THREE.Vector2()
      let hoveredKey: PhoneModelKeyRegion | null = null
      let pressedKey: { key: PhoneModelKeyRegion; x: number; y: number; pointerId: number } | null = null
      const pickPhoneKey = (event: PointerEvent): PhoneModelKeyRegion | null => {
        if (!activeRef.current || !onPhoneKeyRef.current || !built.keypadMesh || event.target !== canvas) return null
        const bounds = canvas.getBoundingClientRect()
        if (!bounds.width || !bounds.height) return null
        keyPointer.set((event.clientX - bounds.left) / bounds.width * 2 - 1,
          1 - (event.clientY - bounds.top) / bounds.height * 2)
        raycaster.setFromCamera(keyPointer, camera)
        const hit = raycaster.intersectObject(built.object, true)[0]
        // A lid, bezel, back, or another foreground surface must occlude keys.
        return hit?.object === built.keypadMesh && hit.uv ? phoneModelRegionAtUv(hit.uv) : null
      }
      const onKeyMove = (event: PointerEvent) => {
        hoveredKey = pickPhoneKey(event)
        canvas.style.cursor = hoveredKey ? 'pointer' : ''
        built.keypadFeedback?.setHover(hoveredKey)
        if (hoveredKey) holdScreenSteady()
        renderOnceRef.current()
      }
      const onKeyDown = (event: PointerEvent) => {
        if (event.button !== 0 || event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) return
        const key = pickPhoneKey(event)
        if (key) {
          pressedKey = { key, x: event.clientX, y: event.clientY, pointerId: event.pointerId }
          built.keypadFeedback?.setPressed(key)
          holdScreenSteady()
          renderOnceRef.current()
        }
      }
      const onKeyUp = (event: PointerEvent) => {
        const pressed = pressedKey
        pressedKey = null
        built.keypadFeedback?.setPressed(null)
        renderOnceRef.current()
        if (!pressed || event.pointerId !== pressed.pointerId || event.button !== 0) return
        if (Math.hypot(event.clientX - pressed.x, event.clientY - pressed.y) > 8) return
        if (pickPhoneKey(event) === pressed.key) onPhoneKeyRef.current?.(pressed.key.key)
      }
      const clearKeyHover = () => {
        hoveredKey = null; pressedKey = null; canvas.style.cursor = ''
        built.keypadFeedback?.setHover(null)
        built.keypadFeedback?.setPressed(null)
        renderOnceRef.current()
      }
      if (built.keypadMesh) {
        canvas.style.pointerEvents = 'auto'
        canvas.addEventListener('pointermove', onKeyMove)
        canvas.addEventListener('pointerdown', onKeyDown)
        canvas.addEventListener('pointerup', onKeyUp)
        canvas.addEventListener('pointerleave', clearKeyHover)
        canvas.addEventListener('pointercancel', clearKeyHover)
        window.addEventListener('blur', clearKeyHover)
      }
      const onPointerMove = (event: PointerEvent) => {
        if (event.pointerType !== 'mouse' && event.pointerType !== 'pen') return
        if (!interactive() || !regionBounds) return
        const controls = [overlayRef.current]
        if (hoveredKey || controls.some(overlay => overlay && (overlay.matches(':hover') || overlay.contains(document.activeElement)))) {
          holdScreenSteady()
          return
        }
        const inside =
          event.clientX >= regionBounds.left &&
          event.clientX <= regionBounds.right &&
          event.clientY >= regionBounds.top &&
          event.clientY <= regionBounds.bottom
        if (inside) {
          const next = normalizePointer(event.clientX, event.clientY, regionBounds)
          const strength = presentation === 'section' ? 0.18 : TILT_MAX_RAD
          tilt.target.x = next.y * strength
          tilt.target.y = next.x * strength
        } else {
          tilt.target.x = 0
          tilt.target.y = 0
        }
        renderOnceRef.current()
      }
      const onEnvChange = () => {
        measureRegion()
        renderOnceRef.current()
      }
      const overlays = [overlayRef.current]
      overlays.forEach(overlay => {
        overlay?.addEventListener('pointerenter', holdScreenSteady)
        overlay?.addEventListener('focusin', holdScreenSteady)
      })
      window.addEventListener('pointermove', onPointerMove, { passive: true })
      window.addEventListener('scroll', measureRegion, { passive: true })
      window.addEventListener('resize', onEnvChange)
      fineHoverQuery.addEventListener('change', onEnvChange)

      // First frame: static environments render once and stay parked.
      renderOnceRef.current()

      cleanup = () => {
        painterRef.current = null
        loop.dispose()
        loopRef.current = null
        renderOnceRef.current = () => {}
        resizeObserver?.disconnect()
        lightQuery.removeEventListener('change', handleThemeChange)
        window.removeEventListener('pointermove', onPointerMove)
        window.removeEventListener('scroll', measureRegion)
        window.removeEventListener('resize', onEnvChange)
        fineHoverQuery.removeEventListener('change', onEnvChange)
        overlays.forEach(overlay => {
          overlay?.removeEventListener('pointerenter', holdScreenSteady)
          overlay?.removeEventListener('focusin', holdScreenSteady)
        })
        canvas.removeEventListener('pointermove', onKeyMove)
        canvas.removeEventListener('pointerdown', onKeyDown)
        canvas.removeEventListener('pointerup', onKeyUp)
        canvas.removeEventListener('pointerleave', clearKeyHover)
        canvas.removeEventListener('pointercancel', clearKeyHover)
        window.removeEventListener('blur', clearKeyHover)
        built.dispose()
        renderer.dispose()
        canvas.remove()
      }
    })()

    return () => {
      disposed = true
      cleanup?.()
    }
  }, [variant, presentation, screenContent, modelScale])

  return (
    <div
      className={`home-hero-three home-hero-three--${variant}${presentation === 'section' ? ' home-section-three' : ''}`}
      ref={hostRef}
      aria-hidden={screenOverlay ? undefined : true}
    >
      {screenOverlay && <div className="home-phone-screen" ref={overlayRef}>{screenOverlay}</div>}
    </div>
  )
}

/** The four destination-section renderers, keyed for the HeroRenderers
 *  registry — the object variant comes from this mapping, never from
 *  content fields. */
export const HERO_THREE_RENDERERS: Record<
  string,
  React.ComponentType<HeroThreeRendererProps>
> = {
  'three:work': (props) => <HeroThreeObject {...props} variant="work" />,
  'three:vibe': (props) => <HeroThreeObject {...props} variant="vibe" />,
  'three:gallery': (props) => <HeroThreeObject {...props} variant="gallery" />,
  'three:collaborate': (props) => <HeroThreeObject {...props} variant="collaborate" />,
}

/** The intro slot's notebook (components/home/HomeNotebook.tsx) — the GLTF
 *  base plus a composed hinged cover and text page; `open` and `blurb` come
 *  from the notebook wrapper. */
export function HeroNotebookModel(props: HeroThreeRendererProps) {
  return <HeroThreeObject {...props} variant="notebook" />
}
