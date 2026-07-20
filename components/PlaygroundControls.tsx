'use client'

import { forwardRef, useEffect, useId, useRef, useState } from 'react'
import {
  APPROVED_PLAYGROUND_DEFAULTS,
  GLYPH_COLOR_MODE_OPTIONS,
  GLYPH_FONT_OPTIONS,
  MAX_GLYPH_PALETTE_SIZE,
  PlaygroundConfig,
} from '../engine/playgroundConfig'
import { DEFAULT_UPLOADED_SVG_FILENAME } from '../engine/svgUpload'
import { SceneCanvasHandle } from './SceneCanvas'
import { RefreshCcwAlt3Icon, ShareIosExportIcon } from './icons'

type MobileSection = 'shape' | 'type' | 'color' | 'background'

type ShareStatus = {
  type: 'info' | 'error'
  message: string
}

type PlaygroundControlsProps = {
  config: PlaygroundConfig
  uploadedFilename?: string | null
  uploadError?: string | null
  canvasRef?: React.RefObject<SceneCanvasHandle | null>
  onChange: (patch: Partial<PlaygroundConfig>) => void
  onReset: () => void
  onUpload: (file: File) => void
}

const MOBILE_SECTIONS: { key: MobileSection; label: string }[] = [
  { key: 'shape', label: 'Shape' },
  { key: 'type', label: 'Type' },
  { key: 'color', label: 'Color' },
  { key: 'background', label: 'Background' },
]

const PlaygroundControls = forwardRef<HTMLTextAreaElement, PlaygroundControlsProps>(
  function PlaygroundControls(
    { config, uploadedFilename, uploadError, canvasRef, onChange, onReset, onUpload },
    ref,
  ) {
    const stableId = useId().replace(/:/g, '-')
  const uploadInputRef = useRef<HTMLInputElement>(null)
  const uploadErrorId = `upload-error-${stableId}`
  const uploadDescriptionId = `upload-desc-${stableId}`
  const shareStatusId = `share-status-${stableId}`
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
        ? APPROVED_PLAYGROUND_DEFAULTS.glyphText
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

  const uploadControl = (
    <label className="playground-control playground-control-grow">
      <span className="playground-control-label">Upload SVG</span>
      <span className="playground-upload-hint" id={uploadDescriptionId}>
        Your SVG stays in your browser.
      </span>
      <input
        ref={uploadInputRef}
        type="file"
        accept=".svg,image/svg+xml"
        onChange={handleFileChange}
        aria-describedby={uploadDescriptionId}
        aria-errormessage={uploadError ? uploadErrorId : undefined}
        aria-invalid={uploadError ? 'true' : undefined}
        className="playground-file-input"
      />
      <span className="playground-upload-filename" aria-live="polite">
        {displayFilename}
      </span>
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
    <label className="playground-control playground-scale-control">
      <span className="playground-control-label">
        Glyph scale{' '}
        <span className="playground-scale-value" aria-hidden="true">
          {config.glyphScale.toFixed(2)}
        </span>
      </span>
      <input
        type="range"
        min={0.6}
        max={1.6}
        step={0.05}
        value={config.glyphScale}
        onChange={(e) => onChange({ glyphScale: parseFloat(e.target.value) })}
        aria-label="Glyph scale"
        className="playground-scale-slider"
      />
    </label>
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
      <div className="playground-controls-grid" role="none">
        <div className="playground-controls-column playground-column-shape" data-section="shape">
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
        </div>
        <div className="playground-controls-column playground-column-background" data-section="background">
          {backgroundControls}
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
