'use client'

/**
 * Visual Sonification experiment (debug-only): React glue between the scene
 * canvas, the pure analysis/mapper engine modules, and the Web Audio engine.
 *
 * The engine's scheduler pulls: ~0.18s before each scan step sounds it calls
 * onScheduleStep, which re-reads the CURRENT strip of the visible canvas
 * (drawImage into a private tier-sized staging canvas, then getImageData on
 * the strip only — the same offscreen-staging precedent as SceneCanvas'
 * animatedStagingRef), updates the canonical 24×12 grid, re-maps the score,
 * and returns that step's notes. The visible scan line is a separate DOM
 * overlay, so it never contaminates the sampled pixels.
 *
 * Session-only: nothing here touches PlaygroundConfig, presets, unified
 * history, URL sharing, analytics, or uploaded-source state.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { AmbientConfig, resolveAmbientMode } from '../../engine/ambientConfig'
import type { QualityTier } from '../../engine/qualityTiers'
import {
  createSonificationGrid,
  copyStripFeatures,
  extractStripFeatures,
  hexToHsl,
  resolveSonificationRasterSize,
  SonificationGrid,
} from '../../engine/sonificationAnalysis'
import {
  clampSonificationConfig,
  isHorizontalSonificationDirection,
  isReversedSonificationDirection,
  SonificationConfig,
  SonificationDirection,
  SONIFICATION_DEFAULTS,
  SONIFICATION_STEPS,
} from '../../engine/sonificationConfig'
import {
  createSonificationEngine,
  SonificationEngine,
  SonificationEngineDiagnostics,
  SonificationPlaybackState,
} from '../../engine/sonificationEngine'
import {
  mapSonification,
  SonificationSceneParams,
  SonificationScore,
  SonificationStepOutput,
} from '../../engine/sonificationMapper'
import type { SceneCanvasHandle } from '../SceneCanvas'

export type UseSonificationOptions = {
  /** Debug-only master switch: analysis and audio run only while this is on.
   *  Turning it off stops playback entirely (leaving Vibe / debug off). */
  enabled: boolean
  sceneCanvasRef: React.RefObject<SceneCanvasHandle | null>
  /** Effective adaptive-quality tier (drives the analysis raster size). */
  qualityTier: QualityTier
  backgroundColor1: string
  backgroundColor2: string
  ambient: AmbientConfig
}

export type SonificationControls = {
  config: SonificationConfig
  playback: SonificationPlaybackState
  error: string | null
  play: () => void
  pause: () => void
  /** Full stop (leave Vibe / reset): the visitor must press Play again. */
  stop: () => void
  updateConfig: (patch: Partial<SonificationConfig>) => void
  /** Audio-clock sweep position 0..1 in playback direction, null when idle. */
  getSweepPosition: () => number | null
  /** Direction of the CURRENT sweep (changes apply on the next sweep). */
  getActiveDirection: () => SonificationDirection
  getDiagnostics: () => SonificationEngineDiagnostics | null
}

export function useSonification({
  enabled,
  sceneCanvasRef,
  qualityTier,
  backgroundColor1,
  backgroundColor2,
  ambient,
}: UseSonificationOptions): SonificationControls {
  const [config, setConfig] = useState<SonificationConfig>({ ...SONIFICATION_DEFAULTS })
  const [playback, setPlayback] = useState<SonificationPlaybackState>('idle')
  const [error, setError] = useState<string | null>(null)

  const configRef = useRef(config)
  // Direction of the sweep in flight — panel edits land on the next sweep.
  const activeDirectionRef = useRef<SonificationDirection>(config.direction)
  const sceneParamsRef = useRef({ qualityTier, backgroundColor1, backgroundColor2, ambient })
  const engineRef = useRef<SonificationEngine | null>(null)
  const gridRef = useRef<SonificationGrid | null>(null)
  const scoreRef = useRef<SonificationScore | null>(null)
  const stagingCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const stagingCtxRef = useRef<CanvasRenderingContext2D | null>(null)
  const stagingSizeRef = useRef({ width: 0, height: 0, reuseSteps: 1 })

  useEffect(() => {
    sceneParamsRef.current = { qualityTier, backgroundColor1, backgroundColor2, ambient }
  }, [qualityTier, backgroundColor1, backgroundColor2, ambient])

  const buildSceneParams = (): SonificationSceneParams => {
    const { backgroundColor1: bg1, backgroundColor2: bg2, ambient: amb } = sceneParamsRef.current
    const hsl1 = hexToHsl(bg1)
    const hsl2 = hexToHsl(bg2)
    const mode = resolveAmbientMode(amb)
    return {
      backgroundHue1: hsl1.h,
      backgroundHue2: hsl2.h,
      backgroundLuminance: (hsl1.l + hsl2.l) / 2,
      weather:
        mode === 'weather'
          ? { intensity: amb.weather.intensity, wind: amb.weather.wind }
          : null,
      matrix:
        mode === 'matrix'
          ? {
              speed: amb.matrix.speed,
              volume: amb.matrix.volume,
              trailStrength: amb.matrix.trailStrength,
            }
          : null,
    }
  }

  // Scheduler callback (audio-clock lookahead): re-read the strip under the
  // scan line, update the grid, re-map, hand back this step's notes.
  const handleScheduleStep = useCallback(
    (playbackStep: number): SonificationStepOutput | null => {
      const started = performance.now()
      try {
        if (playbackStep === 0) {
          activeDirectionRef.current = configRef.current.direction
        }
        const direction = activeDirectionRef.current
        const horizontal = isHorizontalSonificationDirection(direction)
        const reversed = isReversedSonificationDirection(direction)
        const canonicalStep = reversed ? SONIFICATION_STEPS - 1 - playbackStep : playbackStep
        if (!gridRef.current) gridRef.current = createSonificationGrid()
        const grid = gridRef.current

        // Tier-sized staging surface (recreated only when the tier changes).
        const size = resolveSonificationRasterSize(sceneParamsRef.current.qualityTier)
        if (
          stagingSizeRef.current.width !== size.width ||
          stagingSizeRef.current.height !== size.height
        ) {
          const staging = document.createElement('canvas')
          staging.width = size.width
          staging.height = size.height
          stagingCanvasRef.current = staging
          stagingCtxRef.current = staging.getContext('2d', { willReadFrequently: true })
          stagingSizeRef.current = size
        }
        const stagingCtx = stagingCtxRef.current

        if (size.reuseSteps === 2 && playbackStep % 2 === 1) {
          // T3: each read covers two steps — reuse the previous strip.
          const previous = reversed
            ? Math.min(SONIFICATION_STEPS - 1, canonicalStep + 1)
            : Math.max(0, canonicalStep - 1)
          copyStripFeatures(grid, previous, canonicalStep)
        } else {
          const canvas = sceneCanvasRef.current?.getCanvas()
          if (canvas && stagingCtx) {
            const { width: rw, height: rh } = size
            stagingCtx.drawImage(canvas, 0, 0, rw, rh)
            let sx = 0
            let sy = 0
            let sw = rw
            let sh = rh
            if (horizontal) {
              sw = Math.max(1, Math.floor(rw / SONIFICATION_STEPS))
              sx = Math.min(rw - sw, Math.floor((canonicalStep * rw) / SONIFICATION_STEPS))
            } else {
              sh = Math.max(1, Math.floor(rh / SONIFICATION_STEPS))
              sy = Math.min(rh - sh, Math.floor((canonicalStep * rh) / SONIFICATION_STEPS))
            }
            const strip = stagingCtx.getImageData(sx, sy, sw, sh)
            extractStripFeatures(
              strip,
              horizontal ? 'horizontal' : 'vertical',
              canonicalStep,
              grid,
            )
          }
        }

        const score = mapSonification(grid, buildSceneParams(), direction)
        scoreRef.current = score
        return score.steps[playbackStep] ?? null
      } catch {
        return null
      } finally {
        engineRef.current?.reportAnalysisMs(performance.now() - started)
      }
    },
    [sceneCanvasRef],
  )

  const ensureEngine = (): SonificationEngine => {
    if (!engineRef.current) {
      engineRef.current = createSonificationEngine({
        onScheduleStep: (playbackStep) => handleScheduleStep(playbackStep),
        getTextures: () => {
          const score = scoreRef.current
          return score
            ? { drone: score.drone, noise: score.noise, pulses: score.pulses }
            : null
        },
        onPlaybackChange: (state) => {
          setPlayback(state)
          if (state !== 'error') setError(null)
        },
        onError: (message) => setError(message),
      })
    }
    return engineRef.current
  }

  const play = useCallback(() => {
    const engine = ensureEngine()
    engine.setConfig(configRef.current)
    engine.play()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const pause = useCallback(() => {
    engineRef.current?.pause()
  }, [])

  const stop = useCallback(() => {
    engineRef.current?.stop()
  }, [])

  const updateConfig = useCallback((patch: Partial<SonificationConfig>) => {
    setConfig((prev) => {
      const next = clampSonificationConfig({ ...prev, ...patch })
      configRef.current = next
      engineRef.current?.setConfig(next)
      return next
    })
  }, [])

  // Hidden tab suspends the audio context (the audio clock freezes, so the
  // sweep resumes exactly where it paused when the tab returns).
  useEffect(() => {
    const handleVisibility = () => engineRef.current?.setHidden(document.hidden)
    document.addEventListener('visibilitychange', handleVisibility)
    return () => document.removeEventListener('visibilitychange', handleVisibility)
  }, [])

  // Leaving Vibe (or turning debug off) stops playback entirely — the
  // visitor presses Play again after returning.
  useEffect(() => {
    if (!enabled) engineRef.current?.stop()
  }, [enabled])

  // Unmount cleanup: close the context and release the graph.
  useEffect(
    () => () => {
      engineRef.current?.dispose()
      engineRef.current = null
    },
    [],
  )

  const getSweepPosition = useCallback(
    () => engineRef.current?.getSweepPosition() ?? null,
    [],
  )
  const getActiveDirection = useCallback(() => activeDirectionRef.current, [])
  const getDiagnostics = useCallback(() => engineRef.current?.getDiagnostics() ?? null, [])

  return {
    config,
    playback,
    error,
    play,
    pause,
    stop,
    updateConfig,
    getSweepPosition,
    getActiveDirection,
    getDiagnostics,
  }
}
