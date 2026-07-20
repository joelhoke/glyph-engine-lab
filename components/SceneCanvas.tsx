'use client'

import React, { useEffect, useMemo, useRef, useState } from 'react'
import { prepareWithSegments, layoutNextLine } from '@chenglou/pretext'
import { createPointerListeners, getPointer } from '../engine/Pointer'
import {
  Column,
  MeshBgs,
  ObjBounds,
  ParagraphTarget,
  Particle,
  Slot,
  TextPreset,
  UnassignedGlyphBehavior,
} from '../engine/types'
import {
  DAMP,
  FALL_SPEED_MAX,
  FALL_SPEED_MIN,
  HEAD_GLOW_BOOST,
  LOGO_PATHS,
  LOGO_TARGET_STEP,
  SPRING,
  TYPEWRITER_CPS,
  defaultSceneState,
} from '../engine/constants'
import { loadSvgTargets, SourceLayoutConfig, SvgTarget } from '../engine/svgTargetSource'
import {
  APPROVED_PLAYGROUND_DEFAULTS,
  PlaygroundConfig,
} from '../engine/playgroundConfig'
import {
  buildTargetSpatialData,
  buildWordColorIndices,
  formatRgba,
  GlyphColorMode,
  parseHexColor,
  Rgb,
  sampleImageGradient,
  sampleRowBand,
} from '../engine/colorDistribution'
type SequenceDiagnostics = {
  phase: string
  elapsedMs: number
  phaseProgress: number
  speed: number
  documentHidden: boolean
}

type SceneDiagnostics = {
  sourceStatus: string
  targetCount: number
  glyphCount: number
  visibleCount: number
  assignedCount: number
  unassignedCount: number
  hiddenCount: number
  mode: string
}

type SceneMode = 'svg' | 'paragraph' | 'matrix' | 'weather'

const QUOTE = "Voilà! In View, a humble Vaudevillian Veteran, cast Vicariously as both Victim and Villain by the Vicissitudes of fate. This Visage, no mere Veneer of Vanity, is a Vestige of the Vox populi, now Vacant, Vanished. However, this Valorous Visitation of a bygone Vexation stands Vivified, and has Vowed to Vanquish these Venal and Virulent Vermin Vanguarding Vice and Vouchsafing the Violently Vicious and Voracious Violation of Volition. The only Verdict is Vengeance; a Vendetta held as a Votive, not in Vain, for the Value and Veracity of such shall one day Vindicate the Vigilant and the Virtuous. Verily, this Vichyssoise of Verbiage Veers most Verbose, so let me simply add that it's my very good honor to meet you and you may call me V."
const FULL_TEXT = Array(25).fill(QUOTE).join(' ')

const lerp = (a: number, b: number, t: number) => a + (b - a) * t
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

function buildMeshBg(colorA: string, colorB: string, base: string) {
  const W = window.innerWidth
  const H = window.innerHeight
  const cv = document.createElement('canvas')
  cv.width = W
  cv.height = H
  const c = cv.getContext('2d')!
  c.fillStyle = base
  c.fillRect(0, 0, W, H)
  const blobs = [
    { x: W * 0.15, y: H * 0.2, r: Math.max(W, H) * 0.7, color: colorA },
    { x: W * 0.85, y: H * 0.1, r: Math.max(W, H) * 0.6, color: colorB },
    { x: W * 0.75, y: H * 0.85, r: Math.max(W, H) * 0.8, color: colorB },
    { x: W * 0.1, y: H * 0.95, r: Math.max(W, H) * 0.55, color: colorA },
    { x: W * 0.5, y: H * 0.5, r: Math.max(W, H) * 0.45, color: base },
  ]
  for (const b of blobs) {
    const g = c.createRadialGradient(b.x, b.y, 0, b.x, b.y, b.r)
    g.addColorStop(0, b.color)
    g.addColorStop(1, b.color + '00')
    c.fillStyle = g
    c.fillRect(0, 0, W, H)
  }
  return cv
}


type SceneCanvasProps = {
  className?: string
  tuningMode?: boolean
  sequenceDiagnostics?: SequenceDiagnostics
  mouseR?: number
  particleRepel?: number
  weatherRepelMult?: number
  sourceLayout?: SourceLayoutConfig
  uploadedSvgUrl?: string | null
  playgroundConfig?: PlaygroundConfig
  onDiagnosticsUpdate?: (patch: Partial<SceneDiagnostics>) => void
}

function hexToRgba(hex: string, alpha: number): string {
  const normalized = hex.replace('#', '')
  const r = parseInt(normalized.substring(0, 2), 16)
  const g = parseInt(normalized.substring(2, 4), 16)
  const b = parseInt(normalized.substring(4, 6), 16)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

export default function SceneCanvas({
  className,
  tuningMode,
  sequenceDiagnostics,
  mouseR = defaultSceneState.mouseR,
  particleRepel = 0.48,
  weatherRepelMult = 6,
  sourceLayout,
  uploadedSvgUrl,
  playgroundConfig,
  onDiagnosticsUpdate,
}: SceneCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null)
  const meshBgsRef = useRef<MeshBgs | null>(null)
  const particlesRef = useRef<Particle[]>([])
  const paragraphTargetsRef = useRef<ParagraphTarget[]>([])
  const matrixSlotsRef = useRef<Slot[]>([])
  const columnsRef = useRef<Column[]>([])
  const sourceCharsRef = useRef<string[]>([])
  const logoTargetsRef = useRef<{ tx: number; ty: number }[]>([])
  const preparedTextRef = useRef<any>(null)
  const totalCharsRef = useRef(0)
  const typewriterStartRef = useRef<number>(0)
  const animationRef = useRef<number | null>(null)
  const mouseRRef = useRef(defaultSceneState.mouseR)
  const sceneModeRef = useRef<SceneMode>('svg')
  const svgTargetsRef = useRef<SvgTarget[]>([])
  const svgTargetMapRef = useRef<Int32Array>(new Int32Array(0))
  const sceneStartRef = useRef<number>(0)
  const unassignedBehaviorRef = useRef<UnassignedGlyphBehavior>('hidden')
  const tuningModeRef = useRef<boolean>(false)
  const sourceLayoutRef = useRef<SourceLayoutConfig | undefined>(undefined)
  const rebuildSvgTimeoutRef = useRef<number | null>(null)
  const prevTargetCountRef = useRef<number>(0)
  const playgroundConfigRef = useRef<PlaygroundConfig>(
    playgroundConfig ?? APPROVED_PLAYGROUND_DEFAULTS,
  )
  const colorModeRef = useRef<GlyphColorMode>(
    playgroundConfig?.glyphColorMode ?? APPROVED_PLAYGROUND_DEFAULTS.glyphColorMode,
  )
  const paletteRgbRef = useRef<Rgb[]>([])
  const wordColorRef = useRef<number[]>([])
  const targetGradientRef = useRef<Float32Array>(new Float32Array(0))
  const targetRowRef = useRef<Float32Array>(new Float32Array(0))
  const [diagnostics, setDiagnostics] = useState<SceneDiagnostics>({
    sourceStatus: 'idle',
    targetCount: 0,
    glyphCount: 0,
    visibleCount: 0,
    assignedCount: 0,
    unassignedCount: 0,
    hiddenCount: 0,
    mode: 'svg',
  })

  const particleRepelRef = useRef(particleRepel)
  const weatherRepelRef = useRef(weatherRepelMult)

  const [matrixEnabled, setMatrixEnabled] = useState(false)
  const [weatherEnabled, setWeatherEnabled] = useState(true)
  const [weatherPreset, setWeatherPreset] = useState<TextPreset>('rain')
  const [liveWeatherActive, setLiveWeatherActive] = useState(false)
  const [fontSize, setFontSize] = useState(defaultSceneState.fontSize)
  const [textAmount, setTextAmount] = useState(defaultSceneState.textAmount)
  const [matrixSpread, setMatrixSpread] = useState(defaultSceneState.matrixSpread)
  const [matrixSpeed, setMatrixSpeed] = useState(defaultSceneState.matrixSpeed)
  const [matrixVolume, setMatrixVolume] = useState(defaultSceneState.matrixVolume)
  const [weatherWind, setWeatherWind] = useState(defaultSceneState.weatherWind)
  const [weatherIntensity, setWeatherIntensity] = useState(defaultSceneState.weatherIntensity)
  const [weatherTurbulence, setWeatherTurbulence] = useState(defaultSceneState.weatherTurbulence)
  const [weatherBlur, setWeatherBlur] = useState(defaultSceneState.weatherBlur)

  const lineHeight = useMemo(() => Math.round(fontSize * 1.42), [fontSize])
  const font = useMemo(
    () => `400 ${fontSize}px ${playgroundConfig?.glyphFont ?? APPROVED_PLAYGROUND_DEFAULTS.glyphFont}`,
    [fontSize, playgroundConfig?.glyphFont],
  )

  const fontRef = useRef(font)
  const lineHeightRef = useRef(lineHeight)
  const matrixEnabledRef = useRef(matrixEnabled)
  const weatherEnabledRef = useRef(weatherEnabled)
  const matrixSpeedRef = useRef(matrixSpeed)
  const matrixVolumeRef = useRef(matrixVolume)
  const weatherPresetRef = useRef(weatherPreset)
  const weatherWindRef = useRef(weatherWind)
  const weatherIntensityRef = useRef(weatherIntensity)
  const weatherTurbulenceRef = useRef(weatherTurbulence)
  const weatherBlurRef = useRef(weatherBlur)

  useEffect(() => { fontRef.current = font }, [font])
  useEffect(() => { lineHeightRef.current = lineHeight }, [lineHeight])
  useEffect(() => { matrixEnabledRef.current = matrixEnabled }, [matrixEnabled])
  useEffect(() => { weatherEnabledRef.current = weatherEnabled }, [weatherEnabled])
  useEffect(() => { weatherPresetRef.current = weatherPreset }, [weatherPreset])
  useEffect(() => { matrixSpeedRef.current = matrixSpeed }, [matrixSpeed])
  useEffect(() => { matrixVolumeRef.current = matrixVolume }, [matrixVolume])
  useEffect(() => { weatherWindRef.current = weatherWind }, [weatherWind])
  useEffect(() => { weatherIntensityRef.current = weatherIntensity }, [weatherIntensity])
  useEffect(() => { weatherTurbulenceRef.current = weatherTurbulence }, [weatherTurbulence])
  useEffect(() => { weatherBlurRef.current = weatherBlur }, [weatherBlur])
  useEffect(() => { mouseRRef.current = mouseR }, [mouseR])
  useEffect(() => { particleRepelRef.current = particleRepel }, [particleRepel])
  useEffect(() => { weatherRepelRef.current = weatherRepelMult }, [weatherRepelMult])
  useEffect(() => { tuningModeRef.current = tuningMode ?? false }, [tuningMode])
  const updateColorMetadata = (config: PlaygroundConfig) => {
    const palette =
      config.glyphPalette.length > 0 ? config.glyphPalette : APPROVED_PLAYGROUND_DEFAULTS.glyphPalette
    paletteRgbRef.current = palette.map(parseHexColor)
    colorModeRef.current = config.glyphColorMode ?? APPROVED_PLAYGROUND_DEFAULTS.glyphColorMode
    const { indices } = buildWordColorIndices(
      config.glyphText.trim().length > 0
        ? config.glyphText
        : APPROVED_PLAYGROUND_DEFAULTS.glyphText,
      palette.length,
    )
    wordColorRef.current = indices
  }

  useEffect(() => {
    playgroundConfigRef.current = playgroundConfig ?? APPROVED_PLAYGROUND_DEFAULTS
    sourceCharsRef.current = Array.from(
      playgroundConfigRef.current.glyphText.trim().length > 0
        ? playgroundConfigRef.current.glyphText
        : APPROVED_PLAYGROUND_DEFAULTS.glyphText,
    )
    updateColorMetadata(playgroundConfigRef.current)
  }, [playgroundConfig])
  useEffect(() => {
    if (onDiagnosticsUpdate && diagnostics.targetCount !== prevTargetCountRef.current) {
      prevTargetCountRef.current = diagnostics.targetCount
      onDiagnosticsUpdate({ targetCount: diagnostics.targetCount })
    }
  }, [diagnostics.targetCount, onDiagnosticsUpdate])
  useEffect(() => {
    sourceLayoutRef.current = sourceLayout
    scheduleSvgTargetRebuild()
  }, [sourceLayout])

  useEffect(() => {
    scheduleSvgTargetRebuild()
  }, [uploadedSvgUrl])

  const scheduleSvgTargetRebuild = () => {
    if (rebuildSvgTimeoutRef.current !== null) {
      window.clearTimeout(rebuildSvgTimeoutRef.current)
    }
    rebuildSvgTimeoutRef.current = window.setTimeout(() => {
      rebuildSvgTimeoutRef.current = null
      if (sceneModeRef.current === 'svg') {
        buildSvgTargets()
      } else {
        buildSvgTargets().then(() => {
          // Keep targets warm for the next time the mode switches back.
        })
      }
    }, 150)
  }

  useEffect(() => {
    mouseRRef.current = mouseR
    particleRepelRef.current = particleRepel
    weatherRepelRef.current = weatherRepelMult
    sourceLayoutRef.current = sourceLayout
  }, [])

  const getActiveText = () => {
    const len = Math.max(1, Math.round(FULL_TEXT.length * textAmount))
    return FULL_TEXT.substring(0, len)
  }

  const ensureParticleCount = (count: number) => {
    const particles = particlesRef.current
    const fallback = paragraphTargetsRef.current[0]
    while (particles.length < count) {
      const i = particles.length
      const tx = fallback ? fallback.tx : window.innerWidth * 0.5
      const ty = fallback ? fallback.ty : window.innerHeight * 0.5
      particles.push({
        char: sourceCharsRef.current[i % Math.max(1, sourceCharsRef.current.length)] || ' ',
        tx,
        ty,
        x: tx + (Math.random() - 0.5) * 20,
        y: ty + (Math.random() - 0.5) * 20,
        vx: 0,
        vy: 0,
        hue: 120,
        row: 0,
        head: false,
      })
    }
    if (particles.length > count) particles.length = count
  }

  const buildParagraphTargets = () => {
    const ctx = ctxRef.current
    if (!ctx) return
    const text = getActiveText()
    sourceCharsRef.current = Array.from(text)
    preparedTextRef.current = prepareWithSegments(text, fontRef.current)
    paragraphTargetsRef.current = []
    ctx.font = fontRef.current
    const W = window.innerWidth
    const baseWidth = W * 0.78
    const marginLeft = W * 0.11
    const startY = 40
    let cursor = { segmentIndex: 0, graphemeIndex: 0 }
    let lineIndex = 0
    while (true) {
      const line = layoutNextLine(preparedTextRef.current, cursor, baseWidth)
      if (!line) break
      const y = startY + lineIndex * lineHeightRef.current
      let xOffset = 0
      for (let ci = 0; ci < line.text.length; ci += 1) {
        const ch = line.text[ci]
        const charW = ctx.measureText(ch).width
        const tx = marginLeft + xOffset + charW * 0.5
        const ty = y + lineHeightRef.current * 0.5
        paragraphTargetsRef.current.push({
          char: ch,
          tx,
          ty,
          row: lineIndex,
          hue: (lineIndex * 18 + ci * 0.75) % 360,
        })
        xOffset += charW
      }
      cursor = line.end
      lineIndex += 1
      if (lineIndex > 600) break
    }
  }

  const buildMatrixStructure = () => {
    const ctx = ctxRef.current
    if (!ctx) return
    const sourceChars = sourceCharsRef.current
    if (sourceChars.length === 0) return
    const W = window.innerWidth
    const H = window.innerHeight
    ctx.font = fontRef.current
    const glyphW = Math.max(1, ctx.measureText('M').width)
    const spreadFactor = matrixSpread / 100
    const colStep = Math.max(glyphW * 1.05 * spreadFactor, glyphW * 0.7)
    const columnCount = Math.max(6, Math.floor((W * 0.9) / colStep))
    const startX = (W - (columnCount - 1) * colStep) / 2
    const rowsPerColumn = Math.max(14, Math.ceil(H / lineHeightRef.current) + 8)
    columnsRef.current = []
    matrixSlotsRef.current = []
    for (let c = 0; c < columnCount; c += 1) {
      columnsRef.current.push({
        x: startX + c * colStep,
        speed: FALL_SPEED_MIN + Math.random() * (FALL_SPEED_MAX - FALL_SPEED_MIN),
        phase: Math.random() * rowsPerColumn,
        sway: (Math.random() - 0.5) * 0.12,
        headRow: 0,
        rowsPerColumn,
      })
    }
    for (let c = 0; c < columnCount; c += 1) {
      for (let r = 0; r < rowsPerColumn; r += 1) {
        matrixSlotsRef.current.push({ stream: c, row: r })
      }
    }
    const desired = Math.max(paragraphTargetsRef.current.length, matrixSlotsRef.current.length, logoTargetsRef.current.length)
    ensureParticleCount(desired)
  }

  const buildWeatherParticles = () => {
    const W = window.innerWidth
    const H = window.innerHeight
    const sourceChars = sourceCharsRef.current
    const intFactor = weatherIntensity / 100
    const windMul = weatherWind / 50
    const turbMul = weatherTurbulence / 60
    const preset = weatherPreset
    const desired = Math.max(paragraphTargetsRef.current.length, matrixSlotsRef.current.length, logoTargetsRef.current.length)
    ensureParticleCount(desired)
    const count = preset === 'rain' ? Math.floor(120 * turbMul * intFactor) : Math.floor(120 * intFactor)
    const particles = particlesRef.current
    for (let i = 0; i < count; i += 1) {
      const p = particles[i]
      p.char = sourceChars[Math.floor(Math.random() * sourceChars.length)] || (preset === 'rain' ? '|' : '.')
      p.alpha = preset === 'rain' ? 0.2 + Math.random() * 0.55 : 0.15 + Math.random() * 0.3
      p.hue = preset === 'rain' ? 200 : 180
      p.speed = preset === 'rain' ? 1.5 + Math.random() * 2.5 * intFactor : 0.1 + Math.random() * 0.3
      p.drift = preset === 'rain' ? (Math.random() - 0.45) * 0.4 : 0
      p.phase = Math.random() * Math.PI * 2
      p.homeX = Math.random() * W
      p.homeY = Math.random() * H
      p.tx = p.x
      p.ty = p.y
      p.row = 0
      p.head = false
    }
  }

  const buildAllMeshBgs = () => {
    meshBgsRef.current = {
      clear: buildMeshBg('#DDEBEE', '#F2E6D8', '#EAE2DC'),
      rain: buildMeshBg('#012840', '#364F59', '#1A3A4A'),
      storm: buildMeshBg('#070926', '#281259', '#170E40'),
      wind: buildMeshBg('#6D808C', '#BDAC89', '#94968C'),
      fog: buildMeshBg('#6E6E6E', '#222222', '#454545'),
      snow: buildMeshBg('#0D0D0D', '#1C2B3E', '#141C2A'),
    }
  }

  const buildLogoTargets = () => {
    const W = window.innerWidth
    const H = window.innerHeight
    const cv = document.createElement('canvas')
    cv.width = W
    cv.height = H
    const ctx = cv.getContext('2d')
    if (!ctx) return
    ctx.clearRect(0, 0, W, H)
    ctx.save()
    const scale = Math.min(W, H) / 320
    ctx.translate(W * 0.5, H * 0.42)
    ctx.scale(scale, scale)
    ctx.fillStyle = '#fff'
    const path = new Path2D(LOGO_PATHS.join(' '))
    ctx.fill(path)
    ctx.restore()

    const imageData = ctx.getImageData(0, 0, W, H)
    const targets: { tx: number; ty: number }[] = []
    for (let y = 0; y < H; y += LOGO_TARGET_STEP) {
      for (let x = 0; x < W; x += LOGO_TARGET_STEP) {
        const alpha = imageData.data[(y * W + x) * 4 + 3]
        if (alpha > 64) targets.push({ tx: x, ty: y })
      }
    }
    if (targets.length === 0) {
      targets.push({ tx: W * 0.5, ty: H * 0.5 })
    }
    logoTargetsRef.current = targets
  }

  const buildSvgTargetAssignment = () => {
    const targets = svgTargetsRef.current
    const particles = particlesRef.current
    const count = particles.length
    const targetCount = targets.length
    const map = new Int32Array(count)
    if (targetCount === 0) {
      map.fill(-1)
      svgTargetMapRef.current = map
      return
    }
    for (let i = 0; i < count; i += 1) {
      if (count >= targetCount) {
        // Every target receives one glyph; remaining glyphs become ambient.
        map[i] = i < targetCount ? i : -1
      } else {
        // Fewer glyphs than targets: spread glyphs evenly across the silhouette.
        map[i] = Math.floor((i * targetCount) / count)
      }
    }
    svgTargetMapRef.current = map
  }

  const countAssignedTargets = () => {
    const map = svgTargetMapRef.current
    let count = 0
    for (let i = 0; i < map.length; i += 1) {
      if (map[i] >= 0) count += 1
    }
    return count
  }

  const buildSvgTargets = async () => {
    const W = window.innerWidth
    const H = window.innerHeight
    setDiagnostics((prev) => ({ ...prev, sourceStatus: 'loading' }))
    const result = await loadSvgTargets({
      url: uploadedSvgUrl ?? '/assets/test-source.svg',
      bounds: { width: W, height: H },
      samplingStep: sourceLayout?.samplingStep ?? LOGO_TARGET_STEP,
      alphaThreshold: sourceLayout?.alphaThreshold,
      margin: sourceLayout?.margin,
      fit: sourceLayout?.fit,
      scale: sourceLayout?.scale,
      offsetX: sourceLayout?.offsetX,
      offsetY: sourceLayout?.offsetY,
    })
    if (result.ok) {
      svgTargetsRef.current = result.targets
      const { gradientT, rowT } = buildTargetSpatialData(result.targets)
      targetGradientRef.current = gradientT
      targetRowRef.current = rowT
      setDiagnostics((prev) => ({
        ...prev,
        sourceStatus: 'loaded',
        targetCount: result.targets.length,
      }))
    } else {
      svgTargetsRef.current = []
      setDiagnostics((prev) => ({
        ...prev,
        sourceStatus: `error: ${result.error}`,
        targetCount: 0,
      }))
    }
    buildSvgTargetAssignment()
    const assignedCount = countAssignedTargets()
    setDiagnostics((prev) => ({
      ...prev,
      glyphCount: particlesRef.current.length,
      assignedCount,
      unassignedCount: particlesRef.current.length - assignedCount,
      hiddenCount: unassignedBehaviorRef.current === 'hidden' ? particlesRef.current.length - assignedCount : 0,
    }))
  }

  const activateSceneMode = (mode: SceneMode) => {
    sceneModeRef.current = mode
    if (mode === 'matrix') {
      setMatrixEnabled(true)
      setWeatherEnabled(false)
      buildMatrixStructure()
    } else if (mode === 'weather') {
      setMatrixEnabled(false)
      setWeatherEnabled(true)
      buildWeatherParticles()
    } else if (mode === 'paragraph') {
      setMatrixEnabled(false)
      setWeatherEnabled(false)
    } else if (mode === 'svg') {
      setMatrixEnabled(false)
      setWeatherEnabled(false)
      sceneStartRef.current = performance.now()
    }
    setDiagnostics((prev) => ({
      ...prev,
      mode,
      glyphCount: particlesRef.current.length,
      assignedCount: countAssignedTargets(),
    }))
    if (typeof document !== 'undefined') {
      document.body.style.overflowY = mode === 'matrix' || mode === 'weather' ? 'hidden' : 'auto'
    }
  }

  const getLogoTarget = (index: number) => {
    const targets = logoTargetsRef.current
    if (targets.length === 0) return { tx: window.innerWidth * 0.5, ty: window.innerHeight * 0.5 }
    return targets[index % targets.length]
  }

  const getAmbientTarget = (p: Particle, index: number, now: number) => {
    if (matrixEnabledRef.current && matrixSlotsRef.current[index]) {
      const slot = matrixSlotsRef.current[index]
      const col = columnsRef.current[slot.stream]
      if (col) {
        const elapsed = now - typewriterStartRef.current
        const rainOffset = ((elapsed / 16.666) * col.speed * (matrixSpeedRef.current / 100) * lineHeightRef.current) % ((col.rowsPerColumn + 4) * lineHeightRef.current)
        const baseY = (slot.row - 4) * lineHeightRef.current
        return {
          tx: col.x + Math.sin(elapsed * 0.0015 + slot.row * 0.35) * (fontSize * 0.08) + col.sway * elapsed * 0.01,
          ty: ((baseY + rainOffset) % ((col.rowsPerColumn + 4) * lineHeightRef.current)) - lineHeightRef.current * 2,
        }
      }
    }
    if (!weatherEnabledRef.current && paragraphTargetsRef.current[index]) {
      return {
        tx: paragraphTargetsRef.current[index].tx,
        ty: paragraphTargetsRef.current[index].ty,
      }
    }
    const jitter = Math.sin(now * 0.001 + index) * 18
    const drift = Math.cos(now * 0.0013 + index) * 18
    return {
      tx: p.x + jitter,
      ty: p.y + drift,
    }
  }

  const resizeScene = () => {
    const canvas = canvasRef.current
    const ctx = ctxRef.current
    if (!canvas || !ctx) return
    const W = window.innerWidth
    const H = window.innerHeight
    let contentH = H
    if (sceneModeRef.current === 'paragraph' && paragraphTargetsRef.current.length > 0) {
      const lastTarget = paragraphTargetsRef.current[paragraphTargetsRef.current.length - 1]
      contentH = Math.max(H, lastTarget.ty + lineHeightRef.current * 2)
    }
    canvas.width = W * devicePixelRatio
    canvas.height = contentH * devicePixelRatio
    canvas.style.width = `${W}px`
    canvas.style.height = `${contentH}px`
    ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0)
    buildAllMeshBgs()
    buildParagraphTargets()
    buildSvgTargets()
    ensureParticleCount(Math.max(paragraphTargetsRef.current.length, svgTargetsRef.current.length, matrixSlotsRef.current.length, 120))
    if (weatherEnabledRef.current) buildWeatherParticles()
    if (matrixEnabledRef.current) buildMatrixStructure()
    if (sceneModeRef.current === 'svg') {
      buildSvgTargetAssignment()
      setDiagnostics((prev) => ({
        ...prev,
        glyphCount: particlesRef.current.length,
        assignedCount: countAssignedTargets(),
      }))
    }
    if (typeof document !== 'undefined') {
      document.body.style.overflowY = sceneModeRef.current === 'matrix' || sceneModeRef.current === 'weather' ? 'hidden' : 'auto'
    }
  }


  const simulateParticle = (p: Particle) => {
    // Apply mouse repel force if pointer is nearby
    const pointer = getPointer()
    const dx = p.x - pointer.x
    const dy = p.y - pointer.y
    const distSq = dx * dx + dy * dy
    const radius = mouseRRef.current || 0
    if (distSq > 0 && distSq < radius * radius) {
      const dist = Math.sqrt(distSq)
      const repelStrength = (1 - dist / radius) * (particleRepelRef.current || 0.48)
      p.vx += (dx / dist) * repelStrength
      p.vy += (dy / dist) * repelStrength
    }

    p.vx += (p.tx - p.x) * SPRING
    p.vy += (p.ty - p.y) * SPRING
    p.vx *= DAMP
    p.vy *= DAMP
    p.x += p.vx
    p.y += p.vy
  }

  const resolveGlyphColor = (
    particleIndex: number,
    targetIndex: number,
    targetCount: number,
  ): Rgb => {
    const palette = paletteRgbRef.current
    if (palette.length === 0) return parseHexColor('#ffffff')
    const mode = colorModeRef.current
    const assigned = targetIndex >= 0 && targetIndex < targetCount

    if (mode === 'image-gradient' && assigned && targetIndex < targetGradientRef.current.length) {
      return sampleImageGradient(palette, targetGradientRef.current[targetIndex])
    }

    if (mode === 'rows' && assigned && targetIndex < targetRowRef.current.length) {
      const band = sampleRowBand(palette.length, targetRowRef.current[targetIndex])
      return palette[band]
    }

    if (mode === 'word-cycle' && wordColorRef.current.length > 0) {
      const colorIndex = wordColorRef.current[particleIndex % wordColorRef.current.length]
      return palette[colorIndex >= 0 ? colorIndex : 0]
    }

    return palette[particleIndex % palette.length]
  }

  const drawSvgGlyphScene = (now: number) => {
    const canvas = canvasRef.current
    const ctx = ctxRef.current
    if (!canvas || !ctx) return
    const W = canvas.width / devicePixelRatio
    const H = canvas.height / devicePixelRatio

    const config = playgroundConfigRef.current ?? APPROVED_PLAYGROUND_DEFAULTS

    const bgGradient = ctx.createRadialGradient(
      W * 0.5,
      H * 0.5,
      0,
      W * 0.5,
      H * 0.5,
      Math.max(W, H) * 0.8,
    )
    bgGradient.addColorStop(0, config.backgroundColor1)
    bgGradient.addColorStop(1, config.backgroundColor2)
    ctx.fillStyle = bgGradient
    ctx.fillRect(0, 0, W, H)

    const targets = svgTargetsRef.current
    const particles = particlesRef.current
    const map = svgTargetMapRef.current
    if (targets.length === 0 || particles.length === 0) return

    const behavior = unassignedBehaviorRef.current
    let visibleCount = 0
    let hiddenCount = 0

    for (let i = 0; i < particles.length; i += 1) {
      const p = particles[i]
      const targetIndex = map[i]
      const assigned = targetIndex >= 0 && targetIndex < targets.length
      if (!assigned) {
        if (behavior === 'hidden') {
          hiddenCount += 1
          continue
        }
        const ambient = getAmbientTarget(p, i, now)
        p.tx = ambient.tx
        p.ty = ambient.ty
      } else {
        p.tx = targets[targetIndex].tx
        p.ty = targets[targetIndex].ty
      }
      p.char = sourceCharsRef.current[i % Math.max(1, sourceCharsRef.current.length)] || p.char
      p.row = 0
      p.head = false
      simulateParticle(p)
      const homeDist = Math.sqrt((p.x - p.tx) ** 2 + (p.y - p.ty) ** 2)
      const alpha = Math.max(0.35, 1 - homeDist / 280)
      const color = resolveGlyphColor(i, targetIndex, targets.length)
      ctx.fillStyle = formatRgba(color, alpha)
      ctx.fillText(p.char, p.x, p.y)
      visibleCount += 1
    }

    if (tuningModeRef.current && now % 250 < 20) {
      setDiagnostics((prev) => ({
        ...prev,
        visibleCount,
        hiddenCount,
        unassignedCount: particles.length - countAssignedTargets(),
      }))
    }
  }

  const drawParagraph = (now: number, revealedChars: number) => {
    const canvas = canvasRef.current
    if (!canvas || !ctxRef.current) return
    const ctx = ctxRef.current
    const cW = canvas.width / devicePixelRatio
    const cH = canvas.height / devicePixelRatio
    ctx.fillStyle = 'rgba(10, 10, 10, 1)'
    ctx.fillRect(0, 0, cW, cH)
    const visible = Math.min(revealedChars, paragraphTargetsRef.current.length, particlesRef.current.length)
    for (let i = 0; i < visible; i += 1) {
      const t = paragraphTargetsRef.current[i]
      const p = particlesRef.current[i]
      p.char = t.char
      p.tx = t.tx
      p.ty = t.ty
      p.row = t.row
      p.hue = t.hue
      p.head = false
      simulateParticle(p)
      const homeDist = Math.sqrt((p.x - p.tx) ** 2 + (p.y - p.ty) ** 2)
      const alpha = Math.max(0.35, 1 - homeDist / 280)
      const hue = (p.hue + now * 0.015) % 360
      ctx.fillStyle = `hsla(${hue}, 70%, 75%, ${alpha})`
      ctx.fillText(p.char, p.x, p.y)
    }
    if (Math.floor((now - typewriterStartRef.current) / 500) % 2 === 0 && revealedChars < paragraphTargetsRef.current.length) {
      const last = paragraphTargetsRef.current[revealedChars - 1]
      ctx.fillStyle = 'hsla(0, 0%, 85%, 0.85)'
      ctx.fillRect(last.tx + fontSize * 0.25, last.ty - lineHeight * 0.5 + 2, 2, lineHeight - 4)
    }
  }

  const drawMatrix = (now: number, revealedChars: number) => {
    const canvas = canvasRef.current
    const ctx = ctxRef.current
    if (!canvas || !ctx || matrixSlotsRef.current.length === 0) return
    ctx.fillStyle = 'rgba(5, 12, 8, 0.22)'
    ctx.fillRect(0, 0, canvas.width / devicePixelRatio, canvas.height / devicePixelRatio)
    const elapsed = now - typewriterStartRef.current
    const rowsPerColumn = columnsRef.current[0]?.rowsPerColumn || 1
    const speedFactor = matrixSpeedRef.current / 100
    columnsRef.current.forEach((col) => {
      col.headRow = ((elapsed / 16.666) * col.speed * speedFactor + col.phase) % rowsPerColumn
    })
    const desired = Math.min(matrixSlotsRef.current.length, Math.floor(Math.max(1, revealedChars) * (matrixVolumeRef.current / 100)))
    const visible = Math.min(desired, particlesRef.current.length)
    for (let i = 0; i < visible; i += 1) {
      const slot = matrixSlotsRef.current[i]
      const col = columnsRef.current[slot.stream]
      const p = particlesRef.current[i]
      const rainOffset = ((elapsed / 16.666) * col.speed * speedFactor * lineHeightRef.current) % ((col.rowsPerColumn + 4) * lineHeightRef.current)
      const baseY = (slot.row - 4) * lineHeightRef.current
      p.tx = col.x + Math.sin(elapsed * 0.0015 + slot.row * 0.35) * (fontSize * 0.08) + col.sway * elapsed * 0.01
      p.ty = ((baseY + rainOffset) % ((col.rowsPerColumn + 4) * lineHeightRef.current)) - lineHeightRef.current * 2
      p.row = slot.row
      p.head = Math.abs(slot.row - col.headRow) < 0.9
      if (Math.random() < 0.02) {
        p.char = sourceCharsRef.current[(i + Math.floor(elapsed / 70)) % sourceCharsRef.current.length] || p.char
      }
      simulateParticle(p)
      const homeDist = Math.sqrt((p.x - p.tx) ** 2 + (p.y - p.ty) ** 2)
      const alpha = Math.max(0.18, 0.9 - homeDist / 260)
      const hue = 115 + (i % 24)
      const lightness = p.head ? 86 : 54 + Math.sin(now * 0.002 + p.row * 0.4) * 8
      ctx.shadowBlur = p.head ? fontSize * 0.9 : 0
      ctx.shadowColor = `hsla(${hue}, 90%, 70%, ${0.55 + (p.head ? HEAD_GLOW_BOOST : 0)})`
      ctx.fillStyle = `hsla(${hue}, 88%, ${lightness}%, ${alpha})`
      ctx.fillText(p.char, p.x, p.y)
    }
    ctx.shadowBlur = 0
  }

  const drawWeather = (now: number) => {
    const canvas = canvasRef.current
    const ctx = ctxRef.current
    if (!canvas || !ctx) return
    const preset = weatherPresetRef.current
    const W = window.innerWidth
    const H = window.innerHeight
    const intMul = weatherIntensityRef.current / 100
    const windMul = weatherWindRef.current / 50
    const turbMul = weatherTurbulenceRef.current / 60
    const particles = particlesRef.current
    if (preset === 'rain') {
      const mesh = meshBgsRef.current?.rain
      if (mesh) ctx.drawImage(mesh, 0, 0, W, H)
      ctx.fillStyle = 'rgba(5, 8, 18, 0.3)'
      ctx.fillRect(0, 0, W, H)
      const count = Math.min(particles.length, Math.floor(120 * turbMul * intMul))
      const pointer = getPointer()
      for (let i = 0; i < count; i += 1) {
        const p = particles[i]
        p.y += (p.speed ?? 1) * intMul
        p.x += (p.drift ?? 0) * windMul
        const dxw = p.x - pointer.x
        const dyw = p.y - pointer.y
        const distSqW = dxw * dxw + dyw * dyw
        const radiusW = mouseRRef.current || 0
        if (distSqW > 0 && distSqW < radiusW * radiusW) {
          const distW = Math.sqrt(distSqW)
          const repelStrengthW = (1 - distW / radiusW) * (weatherRepelRef.current || 6)
          p.x += (dxw / distW) * repelStrengthW
          p.y += (dyw / distW) * repelStrengthW
        }
        if (p.y > H + lineHeightRef.current) {
          p.y = -lineHeightRef.current
          p.x = Math.random() * W
        }
        if (p.x < -40) p.x = W + 20
        if (p.x > W + 40) p.x = -20
        const streakLen = (p.speed ?? 1) * intMul * 2.5
        const streakDriftX = (p.drift ?? 0) * windMul * 1.5
        ctx.strokeStyle = `hsla(200, 60%, 70%, ${(p.alpha ?? 0.5) * 0.3})`
        ctx.lineWidth = 1
        ctx.beginPath()
        ctx.moveTo(p.x, p.y)
        ctx.lineTo(p.x - streakDriftX, p.y - streakLen)
        ctx.stroke()
        ctx.fillStyle = `hsla(200, 55%, 72%, ${p.alpha ?? 0.5})`
        ctx.fillText(p.char, p.x, p.y)
      }
    } else {
      const mesh = meshBgsRef.current?.clear
      if (mesh) ctx.drawImage(mesh, 0, 0, W, H)
      const t = now * 0.0005
      const count = Math.min(particles.length, Math.floor(120 * intMul))
      const pointer = getPointer()
      for (let i = 0; i < count; i += 1) {
        const p = particles[i]
        p.x = (p.homeX ?? 0) + Math.sin(t + (p.phase ?? 0)) * 35
        p.y = (p.homeY ?? 0) + Math.cos(t * 0.7 + (p.phase ?? 0)) * 25
        p.y -= Math.sin(now * 0.002 + (p.phase ?? 0) * 3) * 0.3
        const dxw = p.x - pointer.x
        const dyw = p.y - pointer.y
        const distSqW = dxw * dxw + dyw * dyw
        const radiusW = mouseRRef.current || 0
        if (distSqW > 0 && distSqW < radiusW * radiusW) {
          const distW = Math.sqrt(distSqW)
          const repelStrengthW = (1 - distW / radiusW) * (weatherRepelRef.current ? (weatherRepelRef.current / 2) : 3)
          p.x += (dxw / distW) * repelStrengthW
          p.y += (dyw / distW) * repelStrengthW
        }
        ctx.fillStyle = `hsla(210, 20%, 92%, ${p.alpha ?? 0.4})`
        ctx.fillText(p.char, p.x, p.y)
      }
    }
  }

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctxRef.current = ctx

    const resizeSceneListener = () => resizeScene()
    resizeScene()
    window.addEventListener('resize', resizeSceneListener)

    setWeatherPreset('rain')
    setWeatherIntensity(125)
    setWeatherTurbulence(125)
    setFontSize(12)
    activateSceneMode('svg')

    const { addListeners, removeListeners } = createPointerListeners()
    addListeners()

    return () => {
      window.removeEventListener('resize', resizeSceneListener)
      removeListeners()
    }
  }, [])

  useEffect(() => {
    if (weatherEnabled) {
      buildWeatherParticles()
    }
  }, [weatherEnabled, weatherPreset, weatherIntensity, weatherWind, weatherTurbulence])

  useEffect(() => {
    if (matrixEnabled) {
      buildMatrixStructure()
    }
  }, [matrixEnabled, matrixSpread, matrixSpeed, matrixVolume])

  useEffect(() => {
    const frame = (now: number) => {
      const ctx = ctxRef.current
      if (!ctx) return
      const revealedChars = Math.min(totalCharsRef.current, Math.floor((now - typewriterStartRef.current) / 1000 * TYPEWRITER_CPS))
      ctx.font = fontRef.current
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      const mode = sceneModeRef.current
      if (mode === 'svg') drawSvgGlyphScene(now)
      else if (mode === 'matrix') drawMatrix(now, revealedChars)
      else if (mode === 'weather') drawWeather(now)
      else drawParagraph(now, revealedChars)
      animationRef.current = requestAnimationFrame(frame)
    }

    animationRef.current = requestAnimationFrame(frame)
    return () => {
      if (animationRef.current !== null) cancelAnimationFrame(animationRef.current)
    }
  }, [])

  const toggleMatrix = () => {
    activateSceneMode(matrixEnabled ? 'paragraph' : 'matrix')
  }

  const toggleWeather = () => {
    activateSceneMode(weatherEnabled ? 'paragraph' : 'weather')
  }

  const onShuffle = () => {
    typewriterStartRef.current = performance.now()
    if (matrixEnabledRef.current) buildMatrixStructure()
  }

  const showTuningUi = tuningMode

  return (
    <div className={['scene-root', className].filter(Boolean).join(' ')}>
      <canvas ref={canvasRef} />
      {showTuningUi && (
        <div className="dev-diagnostics" aria-hidden="true">
          <div>mode: {diagnostics.mode}</div>
          <div>phase: {sequenceDiagnostics?.phase ?? '—'}</div>
          <div>elapsed: {Math.round(sequenceDiagnostics?.elapsedMs ?? 0)}ms</div>
          <div>progress: {(sequenceDiagnostics?.phaseProgress ?? 0).toFixed(2)}</div>
          <div>speed: {(sequenceDiagnostics?.speed ?? 1).toFixed(2)}x</div>
          <div>hidden: {sequenceDiagnostics?.documentHidden ? 'yes' : 'no'}</div>
          <div>source: {diagnostics.sourceStatus}</div>
          <div>targets: {diagnostics.targetCount}</div>
          <div>glyphs: {diagnostics.glyphCount}</div>
          <div>visible: {diagnostics.visibleCount}</div>
          <div>assigned: {diagnostics.assignedCount}</div>
          <div>unassigned: {diagnostics.unassignedCount}</div>
          <div>hidden: {diagnostics.hiddenCount}</div>
        </div>
      )}
    </div>
  )
}
