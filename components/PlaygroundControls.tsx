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

type PlaygroundControlsProps = {
  config: PlaygroundConfig
  uploadedFilename?: string | null
  uploadError?: string | null
  onChange: (patch: Partial<PlaygroundConfig>) => void
  onReset: () => void
  onUpload: (file: File) => void
}

const PlaygroundControls = forwardRef<HTMLTextAreaElement, PlaygroundControlsProps>(
  function PlaygroundControls(
    { config, uploadedFilename, uploadError, onChange, onReset, onUpload },
    ref,
  ) {
    const stableId = useId().replace(/:/g, '-')
  const uploadInputRef = useRef<HTMLInputElement>(null)
  const uploadErrorId = `upload-error-${stableId}`
  const uploadDescriptionId = `upload-desc-${stableId}`
  const [draftText, setDraftText] = useState(config.glyphText)

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

  const displayFilename = uploadedFilename ?? DEFAULT_UPLOADED_SVG_FILENAME

  return (
    <div className="playground-controls" role="region" aria-label="Playground controls">
      <div className="playground-controls-row">
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
      </div>

      <div className="playground-controls-row">
        <label className="playground-control playground-control-grow">
          <span className="playground-control-label">Glyph text</span>
          <textarea
            ref={ref}
            id={`glyph-text-${stableId}`}
            className="playground-textarea"
            value={draftText}
            onChange={(e) => setDraftText(e.target.value)}
            onBlur={commitGlyphText}
            rows={2}
            aria-label="Glyph text"
          />
        </label>
      </div>

      <div className="playground-controls-row">
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
      </div>

      <div className="playground-controls-row">
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
        <label className="playground-control">          <span className="playground-control-label">Color distribution</span>
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
        <label className="playground-control">          <span className="playground-control-label">Glyph font</span>
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
      </div>

      <div className="playground-controls-row">
        <button type="button" onClick={onReset} className="playground-reset-button">
          Reset playground
        </button>
      </div>
    </div>
  )
})

export default PlaygroundControls
