'use client'

import { useEffect, useId, useRef, useState } from 'react'
import {
  APPROVED_PLAYGROUND_DEFAULTS,
  GLYPH_FONT_OPTIONS,
  GLYPH_POINT_SIZE_OPTIONS,
  GlyphPointSize,
  PlaygroundConfig,
} from '../../engine/playgroundConfig'
import { resolveSelectableGlyphSizes } from '../../engine/glyphSize'

export type TextEffectsPanelProps = {
  config: PlaygroundConfig
  onChange: (patch: Partial<PlaygroundConfig>, historyKey?: string) => void
  /** Glyph text commits once per editing session (on blur), so the unified
   *  history records a single 'text' transaction. */
  onCommitText: (text: string) => void
}

export default function TextEffectsPanel({
  config,
  onChange,
  onCommitText,
}: TextEffectsPanelProps) {
  const stableId = useId().replace(/:/g, '-')
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const [draftText, setDraftText] = useState(config.glyphText)
  // 4/6pt sizes are mobile-only: the select shows them below the mobile
  // breakpoint and hides them (the canvas clamps to 8pt) on desktop.
  const [viewportWidth, setViewportWidth] = useState(() =>
    typeof window === 'undefined' ? 0 : window.innerWidth,
  )

  useEffect(() => {
    const handleResize = () => setViewportWidth(window.innerWidth)
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  const selectableSizes = resolveSelectableGlyphSizes(viewportWidth)
  const sizeOptions = GLYPH_POINT_SIZE_OPTIONS.filter((option) =>
    selectableSizes.includes(option.value),
  )

  useEffect(() => {
    setDraftText(config.glyphText)
  }, [config.glyphText])

  useEffect(() => {
    textareaRef.current?.focus()
  }, [])

  const commitGlyphText = () => {
    const normalized =
      draftText.trim().length === 0 ? APPROVED_PLAYGROUND_DEFAULTS.glyphText : draftText
    setDraftText(normalized)
    if (normalized !== config.glyphText) {
      onCommitText(normalized)
    }
  }

  const sizeInputId = `glyph-size-${stableId}`
  const fontSelectId = `glyph-font-${stableId}`

  return (
    <div className="vibe-text-effects-panel">
      <label className="vibe-text-area-control" htmlFor={`glyph-text-${stableId}`}>
        <span className="vibe-panel-section-label">Glyph text</span>
        <textarea
          ref={textareaRef}
          id={`glyph-text-${stableId}`}
          className="vibe-text-effects-textarea"
          value={draftText}
          onChange={(e) => setDraftText(e.target.value)}
          onBlur={commitGlyphText}
          spellCheck={false}
        />
      </label>
      <div className="vibe-text-effects-controls">
        <div className="vibe-select-control">
          <label htmlFor={sizeInputId} className="vibe-panel-section-label">
            Glyph size
          </label>
          <select
            id={sizeInputId}
            value={config.glyphSizePt}
            onChange={(e) =>
              onChange({ glyphSizePt: Number(e.target.value) as GlyphPointSize }, 'glyphSizePt')
            }
            className="vibe-select"
          >
            {!selectableSizes.includes(config.glyphSizePt) && (
              // A mobile-only size stored in the config stays selectable so
              // the control never breaks; the canvas clamps it to 8pt here.
              <option value={config.glyphSizePt}>{config.glyphSizePt} pt</option>
            )}
            {sizeOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
        <div className="vibe-select-control">
          <label htmlFor={fontSelectId} className="vibe-panel-section-label">
            Glyph typeset
          </label>
          <select
            id={fontSelectId}
            value={config.glyphFont}
            onChange={(e) => onChange({ glyphFont: e.target.value }, 'glyphFont')}
            className="vibe-select"
          >
            {GLYPH_FONT_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  )
}
