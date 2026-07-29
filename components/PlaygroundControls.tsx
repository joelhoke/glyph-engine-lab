'use client'

import { forwardRef, useEffect, useId, useRef, useState } from 'react'
import {
  APPROVED_PLAYGROUND_DEFAULTS,
  GLYPH_COLOR_MODE_OPTIONS,
  GLYPH_FONT_OPTIONS,
  MAX_GLYPH_PALETTE_SIZE,
  PlaygroundConfig,
  VIBE_DEFAULT_PLAYGROUND,
} from '../engine/playgroundConfig'
import {
  AMBIENT_INTERACTION_MAX,
  AMBIENT_INTERACTION_MIN,
  AMBIENT_MODE_OPTIONS,
  AmbientConfig,
  MATRIX_SPREAD_MAX,
  MATRIX_SPREAD_MIN,
  MATRIX_SPEED_MAX,
  MATRIX_SPEED_MIN,
  MATRIX_TRAIL_MAX,
  MATRIX_TRAIL_MIN,
  MATRIX_VOLUME_MAX,
  MATRIX_VOLUME_MIN,
  WEATHER_BLUR_MAX,
  WEATHER_BLUR_MIN,
  WEATHER_INTENSITY_MAX,
  WEATHER_INTENSITY_MIN,
  WEATHER_PRESET_OPTIONS,
  WEATHER_TURBULENCE_MAX,
  WEATHER_TURBULENCE_MIN,
  WEATHER_WIND_MAX,
  WEATHER_WIND_MIN,
} from '../engine/ambientConfig'
import {
  CUSTOM_FORM_OPTIONS,
  CUSTOM_PULSE_MAX,
  CUSTOM_PULSE_MIN,
  CUSTOM_SYMMETRY_MAX,
  CUSTOM_SYMMETRY_MIN,
  CUSTOM_TRAVEL_MAX,
  CUSTOM_TRAVEL_MIN,
  CUSTOM_WAVES_MAX,
  CUSTOM_WAVES_MIN,
  CustomCreatureParams,
  GLYPH_MOTION_MODE_OPTIONS,
  MOTION_AMOUNT_MAX,
  MOTION_AMOUNT_MIN,
  MOTION_COMPLEXITY_MAX,
  MOTION_COMPLEXITY_MIN,
  MOTION_DENSITY_MAX,
  MOTION_DENSITY_MIN,
  MOTION_SPEED_MAX,
  MOTION_SPEED_MIN,
  MOTION_UPDATE_RATE_MAX,
  MOTION_UPDATE_RATE_MIN,
  MOTION_WAVE_SCALE_MAX,
  MOTION_WAVE_SCALE_MIN,
  MotionConfig,
  PARAMETRIC_VARIANT_OPTIONS,
} from '../engine/motionConfig'
import {
  PAINT_BRUSH_DIAMETER_MAX,
  PAINT_BRUSH_DIAMETER_MIN,
  PaintStatus,
  PaintToolConfig,
} from '../engine/paint'
import { DEFAULT_UPLOADED_SVG_FILENAME } from '../engine/svgUpload'
import { SceneCanvasHandle } from './SceneCanvas'
import NumericControl from './tuning/NumericControl'
import { RefreshCcwAlt3Icon, ShareIosExportIcon } from './icons'

type MobileSection = 'shape' | 'type' | 'color' | 'background' | 'motion' | 'ambient'

type ShareStatus = {
  type: 'info' | 'error'
  message: string
}

export type PlaygroundPresetOption = {
  id: string
  label: string
}

type PlaygroundControlsProps = {
  config: PlaygroundConfig
  uploadedFilename?: string | null
  uploadError?: string | null
  canvasRef?: React.RefObject<SceneCanvasHandle | null>
  onChange: (patch: Partial<PlaygroundConfig>) => void
  onReset: () => void
  onUpload: (file: File) => void
  /** Authored presets shown above the control grid (Vibe, M5). */
  presets?: PlaygroundPresetOption[]
  onSelectPreset?: (id: string) => void
  /** Shape source: the image field (default mark or upload) or the animated
   *  Black hole. Switching is paint-destructive — the parent confirms. */
  sourceShape?: 'image' | 'black-hole'
  onSelectSourceShape?: (shape: 'image' | 'black-hole') => void
  /** Privacy note shown next to the upload control; must match the
   *  sanitizer's actual local-only behavior (content/vibe.ts). */
  privacyNote?: string
  /** True while an uploaded source image is being read/validated locally. */
  uploadPending?: boolean
  /** Status copy announced while uploadPending is true. */
  uploadPendingLabel?: string
  /** Vibe-only paint tool state and live overlay status. */
  paintTool?: PaintToolConfig
  paintStatus?: PaintStatus | null
  onPaintToolChange?: (patch: Partial<PaintToolConfig>) => void
}

const MOBILE_SECTIONS: { key: MobileSection; label: string }[] = [
  { key: 'shape', label: 'Shape' },
  { key: 'type', label: 'Type' },
  { key: 'color', label: 'Color' },
  { key: 'background', label: 'Background' },
  { key: 'motion', label: 'Motion' },
  { key: 'ambient', label: 'Ambient' },
]

/** Help text for the Original creature variant (required attribution). */
const ORIGINAL_VARIANT_HELP =
  "Original — a readable, normalized adaptation of yuruyurau's fish-inspired 10,000-point Processing sketch."

/** Colors restored when a paint channel is toggled back from 'none'. */
const PAINT_CHANNEL_FALLBACKS = { glyph: '#8abaff', background: '#ffb38a' }

type MotionSliderProps = {
  label: string
  value: number
  min: number
  max: number
  step: number
  onChange: (value: number) => void
}

/** Playground slider+number pair: the shared, keyboard-verified NumericControl. */
function MotionSlider({ label, value, min, max, step, onChange }: MotionSliderProps) {
  return (
    <NumericControl
      label={label}
      value={value}
      min={min}
      max={max}
      step={step}
      showSlider
      onChange={onChange}
    />
  )
}

const PlaygroundControls = forwardRef<HTMLTextAreaElement, PlaygroundControlsProps>(
  function PlaygroundControls(
    {
      config,
      uploadedFilename,
      uploadError,
      canvasRef,
      onChange,
      onReset,
      onUpload,
      presets,
      onSelectPreset,
      sourceShape,
      onSelectSourceShape,
      privacyNote,
      uploadPending,
      uploadPendingLabel,
      paintTool,
      paintStatus,
      onPaintToolChange,
    },
    ref,
  ) {
    const stableId = useId().replace(/:/g, '-')
  const uploadInputRef = useRef<HTMLInputElement>(null)
  const uploadErrorId = `upload-error-${stableId}`
  const uploadDescriptionId = `upload-desc-${stableId}`
  const shareStatusId = `share-status-${stableId}`
  const paintNoneHintId = `paint-none-hint-${stableId}`
  const [draftText, setDraftText] = useState(config.glyphText)
  const [mobileSection, setMobileSection] = useState<MobileSection>('shape')
  const [shareStatus, setShareStatus] = useState<ShareStatus | null>(null)
  const [isSharing, setIsSharing] = useState(false)

  useEffect(() => {
    setDraftText(config.glyphText)
  }, [config.glyphText])

  const commitGlyphText = () => {
    const normalized =
      draftText.trim().length === 0
        ? VIBE_DEFAULT_PLAYGROUND.glyphText
        : draftText
    onChange({ glyphText: normalized })
    setDraftText(normalized)
  }

  const updatePaletteColor = (index: number, color: string) => {
    const next = [...config.glyphPalette]
    next[index] = color
    onChange({ glyphPalette: next })
  }

  const addPaletteColor = () => {
    if (config.glyphPalette.length >= MAX_GLYPH_PALETTE_SIZE) return
    const next = [...config.glyphPalette]
    const last = next[next.length - 1] ?? APPROVED_PLAYGROUND_DEFAULTS.glyphPalette[0]
    next.push(last)
    onChange({ glyphPalette: next })
  }

  const removePaletteColor = (index: number) => {
    if (config.glyphPalette.length <= 1) return
    const next = config.glyphPalette.filter((_, i) => i !== index)
    onChange({ glyphPalette: next })
  }

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    onUpload(file)
    if (uploadInputRef.current) {
      uploadInputRef.current.value = ''
    }
  }

  const clearShareStatus = () => {
    setShareStatus(null)
  }

  const handleShareCreation = async () => {
    if (isSharing) return
    const handle = canvasRef?.current
    const canvas = handle?.getCanvas()
    if (!canvas) {
      setShareStatus({ type: 'error', message: 'Canvas is not ready. Try again in a moment.' })
      return
    }

    setIsSharing(true)
    setShareStatus({ type: 'info', message: 'Preparing…' })

    try {
      const blob = await new Promise<Blob | null>((resolve, reject) => {
        try {
          canvas.toBlob((b) => resolve(b), 'image/png')
        } catch (err) {
          reject(err)
        }
      })

      if (!blob) {
        throw new Error('Canvas export returned an empty image.')
      }

      const file = new File([blob], 'joel-hoke-playground.png', { type: 'image/png' })
      const shareData = { files: [file] }

      if (navigator.canShare?.(shareData)) {
        await navigator.share(shareData)
        setShareStatus(null)
      } else {
        const url = URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = url
        link.download = 'joel-hoke-playground.png'
        link.click()
        URL.revokeObjectURL(url)
        setShareStatus({
          type: 'info',
          message: 'Image downloaded — share it wherever you like.',
        })
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      // Canceling the native share sheet throws an AbortError; keep it silent.
      if ((err as Error)?.name === 'AbortError') {
        setShareStatus(null)
      } else {
        setShareStatus({
          type: 'error',
          message: `Could not share: ${message}`,
        })
      }
    } finally {
      setIsSharing(false)
    }
  }

  const displayFilename = uploadedFilename ?? DEFAULT_UPLOADED_SVG_FILENAME

  const sourceShapeControl = sourceShape && onSelectSourceShape ? (
    <label className="playground-control">
      <span className="playground-control-label">Shape source</span>
      <select
        value={sourceShape}
        onChange={(e) => onSelectSourceShape(e.target.value as 'image' | 'black-hole')}
        aria-label="Shape source"
        className="playground-select"
      >
        <option value="image">Image — default or uploaded</option>
        <option value="black-hole">Black hole — animated</option>
      </select>
    </label>
  ) : null

  const uploadControl = (
    <label className="playground-control playground-control-grow">
      <span className="playground-control-label">Upload image</span>
      <span className="playground-upload-hint" id={uploadDescriptionId}>
        {privacyNote ?? 'SVG, PNG, or WebP — it stays in your browser.'}
      </span>
      <input
        ref={uploadInputRef}
        type="file"
        accept=".svg,image/svg+xml,image/png,image/webp,.png,.webp"
        onChange={handleFileChange}
        disabled={uploadPending}
        aria-describedby={uploadDescriptionId}
        aria-errormessage={uploadError ? uploadErrorId : undefined}
        aria-invalid={uploadError ? 'true' : undefined}
        className="playground-file-input"
      />
      <span className="playground-upload-filename" aria-live="polite">
        {displayFilename}
      </span>
      {uploadPending && uploadPendingLabel && (
        <span role="status" aria-live="polite" className="playground-upload-status">
          {uploadPendingLabel}
        </span>
      )}
      {uploadError && (
        <span
          id={uploadErrorId}
          role="alert"
          aria-live="polite"
          className="playground-upload-error"
        >
          {uploadError}
        </span>
      )}
    </label>
  )

  const glyphTextControl = (
    <label className="playground-control playground-text-control">
      <span className="playground-control-label">Glyph text</span>
      <textarea
        ref={ref}
        id={`glyph-text-${stableId}`}
        className="playground-textarea"
        value={draftText}
        onChange={(e) => setDraftText(e.target.value)}
        onBlur={commitGlyphText}
        aria-label="Glyph text"
      />
    </label>
  )

  const fontControl = (
    <label className="playground-control">
      <span className="playground-control-label">Glyph font</span>
      <select
        value={config.glyphFont}
        onChange={(e) => onChange({ glyphFont: e.target.value })}
        aria-label="Glyph font"
        className="playground-select"
      >
        {GLYPH_FONT_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  )

  const scaleControl = (
    <NumericControl
      label="Glyph scale"
      value={config.glyphScale}
      min={0.6}
      max={1.6}
      step={0.05}
      showSlider
      onChange={(value) => onChange({ glyphScale: value })}
    />
  )

  const paletteControl = (
    <div className="playground-control">
      <span className="playground-control-label">Glyph palette</span>
      <div className="playground-palette" role="group" aria-label="Glyph palette">
        {config.glyphPalette.map((color, index) => (
          <div key={index} className="playground-palette-item">
            <input
              type="color"
              value={color}
              onChange={(e) => updatePaletteColor(index, e.target.value)}
              aria-label={`Glyph color ${index + 1}`}
              className="playground-color-input"
            />
            <button
              type="button"
              onClick={() => removePaletteColor(index)}
              disabled={config.glyphPalette.length <= 1}
              aria-label={`Remove glyph color ${index + 1}`}
              className="playground-icon-button"
              title={`Remove glyph color ${index + 1}`}
            >
              −
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={addPaletteColor}
          disabled={config.glyphPalette.length >= MAX_GLYPH_PALETTE_SIZE}
          aria-label="Add glyph color"
          className="playground-add-button"
          title="Add glyph color"
        >
          +
        </button>
      </div>
    </div>
  )

  const colorModeControl = (
    <label className="playground-control">
      <span className="playground-control-label">Color distribution</span>
      <select
        value={config.glyphColorMode}
        onChange={(e) => onChange({ glyphColorMode: e.target.value as PlaygroundConfig['glyphColorMode'] })}
        aria-label="Color distribution"
        className="playground-select"
      >
        {GLYPH_COLOR_MODE_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  )

  const paintControls = paintTool && onPaintToolChange ? (
    <div className="playground-control playground-paint-controls">
      <span className="playground-control-label">Paint</span>
      <div className="playground-paint-row" role="group" aria-label="Paint mode and tool">
        <button
          type="button"
          aria-pressed={paintTool.enabled}
          onClick={() => onPaintToolChange({ enabled: !paintTool.enabled })}
          aria-describedby={
            paintTool.glyphColor === 'none' && paintTool.backgroundColor === 'none'
              ? paintNoneHintId
              : undefined
          }
          className={[
            'playground-paint-toggle',
            paintTool.enabled && 'playground-paint-toggle-active',
          ].filter(Boolean).join(' ')}
        >
          {paintTool.enabled ? 'Painting on' : 'Painting off'}
        </button>
        <select
          value={paintTool.tool}
          onChange={(e) => onPaintToolChange({ tool: e.target.value as PaintToolConfig['tool'] })}
          disabled={!paintTool.enabled}
          aria-label="Paint tool"
          className="playground-select"
        >
          <option value="paint">Paint</option>
          <option value="erase">Erase</option>
        </select>
      </div>
      <div className="playground-paint-row" role="group" aria-label="Paint channel colors">
        <span className="playground-paint-channel">
          <span className="playground-control-label">Glyph</span>
          <input
            type="color"
            value={
              paintTool.glyphColor === 'none'
                ? PAINT_CHANNEL_FALLBACKS.glyph
                : paintTool.glyphColor
            }
            onChange={(e) => onPaintToolChange({ glyphColor: e.target.value })}
            disabled={
              !paintTool.enabled || paintTool.tool === 'erase' || paintTool.glyphColor === 'none'
            }
            aria-label="Glyph paint color"
            className="playground-color-input"
          />
          <label className="playground-paint-none">
            <input
              type="checkbox"
              checked={paintTool.glyphColor === 'none'}
              onChange={(e) =>
                onPaintToolChange({
                  glyphColor: e.target.checked ? 'none' : PAINT_CHANNEL_FALLBACKS.glyph,
                })
              }
              disabled={!paintTool.enabled || paintTool.tool === 'erase'}
            />
            None
          </label>
        </span>
        <span className="playground-paint-channel">
          <span className="playground-control-label">Background</span>
          <input
            type="color"
            value={
              paintTool.backgroundColor === 'none'
                ? PAINT_CHANNEL_FALLBACKS.background
                : paintTool.backgroundColor
            }
            onChange={(e) => onPaintToolChange({ backgroundColor: e.target.value })}
            disabled={
              !paintTool.enabled ||
              paintTool.tool === 'erase' ||
              paintTool.backgroundColor === 'none'
            }
            aria-label="Background paint color"
            className="playground-color-input"
          />
          <label className="playground-paint-none">
            <input
              type="checkbox"
              checked={paintTool.backgroundColor === 'none'}
              onChange={(e) =>
                onPaintToolChange({
                  backgroundColor: e.target.checked ? 'none' : PAINT_CHANNEL_FALLBACKS.background,
                })
              }
              disabled={!paintTool.enabled || paintTool.tool === 'erase'}
            />
            None
          </label>
        </span>
      </div>
      {paintTool.glyphColor === 'none' && paintTool.backgroundColor === 'none' && (
        <p className="playground-upload-hint" id={paintNoneHintId}>
          Both channels are off — pick a glyph or background color to paint.
        </p>
      )}
      <NumericControl
        label="Brush diameter"
        value={paintTool.brushDiameter}
        min={PAINT_BRUSH_DIAMETER_MIN}
        max={PAINT_BRUSH_DIAMETER_MAX}
        step={1}
        showSlider
        disabled={!paintTool.enabled}
        onChange={(value) => onPaintToolChange({ brushDiameter: value })}
      />
      <div className="playground-paint-row" role="group" aria-label="Paint history">
        <button
          type="button"
          onClick={() => canvasRef?.current?.undoPaint()}
          disabled={!paintStatus?.canUndo}
          className="playground-icon-button playground-paint-action"
          aria-label="Undo paint stroke"
          title="Undo paint stroke"
        >
          ↩
        </button>
        <button
          type="button"
          onClick={() => canvasRef?.current?.redoPaint()}
          disabled={!paintStatus?.canRedo}
          className="playground-icon-button playground-paint-action"
          aria-label="Redo paint stroke"
          title="Redo paint stroke"
        >
          ↪
        </button>
        <button
          type="button"
          onClick={() => canvasRef?.current?.clearPaint()}
          disabled={
            !paintStatus ||
            (paintStatus.strokeCount === 0 && paintStatus.paintedTargetCount === 0)
          }
          className="playground-icon-button playground-paint-action"
          aria-label="Clear all paint"
          title="Clear all paint"
        >
          ×
        </button>
      </div>
    </div>
  ) : null

  const motion = config.motion

  const updateMotion = (patch: Partial<MotionConfig>) => {
    onChange({ motion: { ...config.motion, ...patch } })
  }

  const updateCustom = (patch: Partial<CustomCreatureParams>) => {
    updateMotion({ custom: { ...config.motion.custom, ...patch } })
  }

  const motionControls = (
    <>
      <label className="playground-control">
        <span className="playground-control-label">Motion</span>
        <select
          value={motion.mode}
          onChange={(e) => updateMotion({ mode: e.target.value as MotionConfig['mode'] })}
          aria-label="Motion mode"
          className="playground-select"
        >
          {GLYPH_MOTION_MODE_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
      {motion.mode === 'parametric-creature' && (
        <>
          <label className="playground-control">
            <span className="playground-control-label">Creature variant</span>
            <select
              value={motion.variant}
              onChange={(e) =>
                updateMotion({ variant: e.target.value as MotionConfig['variant'] })
              }
              aria-label="Creature variant"
              className="playground-select"
            >
              {PARAMETRIC_VARIANT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          {motion.variant === 'original' && (
            <p className="playground-upload-hint">{ORIGINAL_VARIANT_HELP}</p>
          )}
          {motion.variant === 'custom' && (
            <>
              <label className="playground-control">
                <span className="playground-control-label">Custom form</span>
                <select
                  value={motion.custom.form}
                  onChange={(e) =>
                    updateCustom({ form: e.target.value as CustomCreatureParams['form'] })
                  }
                  aria-label="Custom form"
                  className="playground-select"
                >
                  {CUSTOM_FORM_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <MotionSlider
                label="Symmetry"
                value={motion.custom.symmetry}
                min={CUSTOM_SYMMETRY_MIN}
                max={CUSTOM_SYMMETRY_MAX}
                step={1}
                onChange={(value) => updateCustom({ symmetry: value })}
              />
              <MotionSlider
                label="Waves"
                value={motion.custom.waves}
                min={CUSTOM_WAVES_MIN}
                max={CUSTOM_WAVES_MAX}
                step={1}
                onChange={(value) => updateCustom({ waves: value })}
              />
              <MotionSlider
                label="Travel"
                value={motion.custom.travel}
                min={CUSTOM_TRAVEL_MIN}
                max={CUSTOM_TRAVEL_MAX}
                step={0.05}
                onChange={(value) => updateCustom({ travel: value })}
              />
              <MotionSlider
                label="Pulse"
                value={motion.custom.pulse}
                min={CUSTOM_PULSE_MIN}
                max={CUSTOM_PULSE_MAX}
                step={0.05}
                onChange={(value) => updateCustom({ pulse: value })}
              />
            </>
          )}
        </>
      )}
      {motion.mode !== 'off' && (
        <>
          <MotionSlider
            label="Amount"
            value={motion.amount}
            min={MOTION_AMOUNT_MIN}
            max={MOTION_AMOUNT_MAX}
            step={1}
            onChange={(value) => updateMotion({ amount: value })}
          />
          <MotionSlider
            label="Speed"
            value={motion.speed}
            min={MOTION_SPEED_MIN}
            max={MOTION_SPEED_MAX}
            step={0.05}
            onChange={(value) => updateMotion({ speed: value })}
          />
          <MotionSlider
            label="Wave scale"
            value={motion.waveScale}
            min={MOTION_WAVE_SCALE_MIN}
            max={MOTION_WAVE_SCALE_MAX}
            step={0.05}
            onChange={(value) => updateMotion({ waveScale: value })}
          />
          <MotionSlider
            label="Complexity"
            value={motion.complexity}
            min={MOTION_COMPLEXITY_MIN}
            max={MOTION_COMPLEXITY_MAX}
            step={1}
            onChange={(value) => updateMotion({ complexity: value })}
          />
          {motion.mode === 'parametric-creature' && (
            <MotionSlider
              label="Creature density"
              value={motion.density}
              min={MOTION_DENSITY_MIN}
              max={MOTION_DENSITY_MAX}
              step={50}
              onChange={(value) => updateMotion({ density: value })}
            />
          )}
          <MotionSlider
            label="Update rate"
            value={motion.updateRate}
            min={MOTION_UPDATE_RATE_MIN}
            max={MOTION_UPDATE_RATE_MAX}
            step={5}
            onChange={(value) => updateMotion({ updateRate: value })}
          />
        </>
      )}
    </>
  )

  const ambient = config.ambient

  const updateAmbient = (patch: Partial<AmbientConfig>) => {
    onChange({ ambient: { ...config.ambient, ...patch } })
  }

  const updateAmbientWeather = (patch: Partial<AmbientConfig['weather']>) => {
    updateAmbient({ weather: { ...config.ambient.weather, ...patch } })
  }

  const updateAmbientMatrix = (patch: Partial<AmbientConfig['matrix']>) => {
    updateAmbient({ matrix: { ...config.ambient.matrix, ...patch } })
  }

  const ambientControls = (
    <>
      <label className="playground-control">
        <span className="playground-control-label">Ambient effect</span>
        <select
          value={ambient.mode}
          onChange={(e) => updateAmbient({ mode: e.target.value as AmbientConfig['mode'] })}
          aria-label="Ambient effect"
          className="playground-select"
        >
          {AMBIENT_MODE_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
      {ambient.mode !== 'off' && (
        <>
          <MotionSlider
            label="Pointer influence"
            value={ambient.interactionStrength}
            min={AMBIENT_INTERACTION_MIN}
            max={AMBIENT_INTERACTION_MAX}
            step={0.05}
            onChange={(value) => updateAmbient({ interactionStrength: value })}
          />
          {ambient.mode === 'weather' && (
            <>
              <label className="playground-control">
                <span className="playground-control-label">Weather preset</span>
                <select
                  value={ambient.weather.preset}
                  onChange={(e) =>
                    updateAmbientWeather({
                      preset: e.target.value as AmbientConfig['weather']['preset'],
                    })
                  }
                  aria-label="Weather preset"
                  className="playground-select"
                >
                  {WEATHER_PRESET_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <MotionSlider
                label="Intensity"
                value={ambient.weather.intensity}
                min={WEATHER_INTENSITY_MIN}
                max={WEATHER_INTENSITY_MAX}
                step={5}
                onChange={(value) => updateAmbientWeather({ intensity: value })}
              />
              <MotionSlider
                label="Wind"
                value={ambient.weather.wind}
                min={WEATHER_WIND_MIN}
                max={WEATHER_WIND_MAX}
                step={5}
                onChange={(value) => updateAmbientWeather({ wind: value })}
              />
              <MotionSlider
                label="Turbulence"
                value={ambient.weather.turbulence}
                min={WEATHER_TURBULENCE_MIN}
                max={WEATHER_TURBULENCE_MAX}
                step={5}
                onChange={(value) => updateAmbientWeather({ turbulence: value })}
              />
              <MotionSlider
                label="Blur"
                value={ambient.weather.blur}
                min={WEATHER_BLUR_MIN}
                max={WEATHER_BLUR_MAX}
                step={5}
                onChange={(value) => updateAmbientWeather({ blur: value })}
              />
            </>
          )}
          {ambient.mode === 'matrix' && (
            <>
              <MotionSlider
                label="Spread"
                value={ambient.matrix.spread}
                min={MATRIX_SPREAD_MIN}
                max={MATRIX_SPREAD_MAX}
                step={5}
                onChange={(value) => updateAmbientMatrix({ spread: value })}
              />
              <MotionSlider
                label="Speed"
                value={ambient.matrix.speed}
                min={MATRIX_SPEED_MIN}
                max={MATRIX_SPEED_MAX}
                step={5}
                onChange={(value) => updateAmbientMatrix({ speed: value })}
              />
              <MotionSlider
                label="Volume"
                value={ambient.matrix.volume}
                min={MATRIX_VOLUME_MIN}
                max={MATRIX_VOLUME_MAX}
                step={5}
                onChange={(value) => updateAmbientMatrix({ volume: value })}
              />
              <MotionSlider
                label="Trail strength"
                value={ambient.matrix.trailStrength}
                min={MATRIX_TRAIL_MIN}
                max={MATRIX_TRAIL_MAX}
                step={5}
                onChange={(value) => updateAmbientMatrix({ trailStrength: value })}
              />
            </>
          )}
        </>
      )}
    </>
  )

  const backgroundControls = (
    <>
      <label className="playground-control">
        <span className="playground-control-label">Background color 1</span>
        <input
          type="color"
          value={config.backgroundColor1}
          onChange={(e) => onChange({ backgroundColor1: e.target.value })}
          aria-label="Background color 1"
          className="playground-color-input"
        />
      </label>
      <label className="playground-control">
        <span className="playground-control-label">Background color 2</span>
        <input
          type="color"
          value={config.backgroundColor2}
          onChange={(e) => onChange({ backgroundColor2: e.target.value })}
          aria-label="Background color 2"
          className="playground-color-input"
        />
      </label>
    </>
  )

  return (
    <div
      className="playground-controls"
      role="region"
      aria-label="Playground controls"
      data-mobile-section={mobileSection}
    >
      {presets && presets.length > 0 && onSelectPreset && (
        <div className="playground-presets" role="group" aria-label="Presets">
          <span className="playground-control-label">Presets</span>
          <div className="playground-presets-row">
            {presets.map((preset) => (
              <button
                key={preset.id}
                type="button"
                className="playground-preset-button"
                onClick={() => onSelectPreset(preset.id)}
              >
                {preset.label}
              </button>
            ))}
          </div>
        </div>
      )}
      <div className="playground-controls-grid" role="none">
        <div className="playground-controls-column playground-column-shape" data-section="shape">
          {sourceShapeControl}
          {uploadControl}
        </div>
        <div className="playground-controls-column playground-column-type" data-section="type">
          {glyphTextControl}
          {fontControl}
          {scaleControl}
        </div>
        <div className="playground-controls-column playground-column-color" data-section="color">
          {paletteControl}
          {colorModeControl}
          {paintControls}
        </div>
        <div className="playground-controls-column playground-column-background" data-section="background">
          {backgroundControls}
        </div>
        <div className="playground-controls-column playground-column-motion" data-section="motion">
          {motionControls}
        </div>
        <div className="playground-controls-column playground-column-ambient" data-section="ambient">
          {ambientControls}
        </div>
      </div>

      <div className="playground-mobile-tabs" role="tablist" aria-label="Control sections">
        {MOBILE_SECTIONS.map(({ key, label }) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={mobileSection === key}
            aria-controls={`playground-section-${key}-${stableId}`}
            id={`playground-tab-${key}-${stableId}`}
            className={[
              'playground-mobile-tab',
              mobileSection === key && 'playground-mobile-tab-active',
            ].filter(Boolean).join(' ')}
            onClick={() => setMobileSection(key)}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="playground-controls-footer">
        <button
          type="button"
          onClick={handleShareCreation}
          disabled={isSharing}
          className="playground-share-button"
          aria-label="Share creation"
          aria-busy={isSharing}
          aria-describedby={shareStatus ? shareStatusId : undefined}
        >
          <ShareIosExportIcon className="playground-share-icon" />
          Share creation
        </button>
        <button
          type="button"
          onClick={onReset}
          className="playground-reset-button"
          aria-label="Reset playground"
        >
          <RefreshCcwAlt3Icon className="playground-reset-icon" />
          Reset playground
        </button>
        {shareStatus && (
          <span
            id={shareStatusId}
            role="status"
            aria-live="polite"
            className={[
              'playground-share-status',
              shareStatus.type === 'error' && 'playground-share-status-error',
            ].filter(Boolean).join(' ')}
          >
            {shareStatus.message}
          </span>
        )}
      </div>
    </div>
  )
})

export default PlaygroundControls
