'use client'

import { useId } from 'react'
import {
  APPROVED_PLAYGROUND_DEFAULTS,
  GLYPH_COLOR_MODE_OPTIONS,
  MAX_GLYPH_PALETTE_SIZE,
  PlaygroundConfig,
} from '../../engine/playgroundConfig'

export type ColorStylesPanelProps = {
  config: PlaygroundConfig
  onChange: (patch: Partial<PlaygroundConfig>, historyKey?: string) => void
}

export default function ColorStylesPanel({ config, onChange }: ColorStylesPanelProps) {
  const stableId = useId().replace(/:/g, '-')
  const color1Id = `bg-color-1-${stableId}`
  const color2Id = `bg-color-2-${stableId}`
  const colorModeId = `color-mode-${stableId}`

  const updatePaletteColor = (index: number, color: string) => {
    const next = [...config.glyphPalette]
    next[index] = color
    onChange({ glyphPalette: next }, `glyphPalette.${index}`)
  }

  const addPaletteColor = () => {
    if (config.glyphPalette.length >= MAX_GLYPH_PALETTE_SIZE) return
    const next = [...config.glyphPalette]
    const last = next[next.length - 1] ?? APPROVED_PLAYGROUND_DEFAULTS.glyphPalette[0]
    next.push(last)
    onChange({ glyphPalette: next }, 'glyphPalette')
  }

  const removePaletteColor = (index: number) => {
    if (config.glyphPalette.length <= 1) return
    const next = config.glyphPalette.filter((_, i) => i !== index)
    onChange({ glyphPalette: next }, 'glyphPalette')
  }

  return (
    <div className="vibe-color-styles-panel">
      <div className="vibe-palette-control">
        <span className="vibe-panel-section-label">Glyph palette</span>
        <div className="vibe-palette" role="group" aria-label="Glyph palette">
          {config.glyphPalette.map((color, index) => (
            <div key={index} className="vibe-palette-item">
              <input
                type="color"
                value={color}
                onChange={(e) => updatePaletteColor(index, e.target.value)}
                aria-label={`Glyph color ${index + 1}`}
                className="vibe-color-input"
              />
              <button
                type="button"
                onClick={() => removePaletteColor(index)}
                disabled={config.glyphPalette.length <= 1}
                aria-label={`Remove glyph color ${index + 1}`}
                className="vibe-palette-remove"
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
            className="vibe-palette-add"
            title="Add glyph color"
          >
            +
          </button>
        </div>
      </div>
      <div className="vibe-select-control">
        <label htmlFor={colorModeId} className="vibe-panel-section-label">
          Color distribution
        </label>
        <select
          id={colorModeId}
          value={config.glyphColorMode}
          onChange={(e) =>
            onChange(
              { glyphColorMode: e.target.value as PlaygroundConfig['glyphColorMode'] },
              'glyphColorMode',
            )
          }
          className="vibe-select"
        >
          {GLYPH_COLOR_MODE_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>
      <div className="vibe-color-control">
        <label htmlFor={color1Id} className="vibe-panel-section-label">
          Background color 1
        </label>
        <input
          id={color1Id}
          type="color"
          value={config.backgroundColor1}
          onChange={(e) => onChange({ backgroundColor1: e.target.value }, 'backgroundColor1')}
          className="vibe-color-input"
        />
      </div>
      <div className="vibe-color-control">
        <label htmlFor={color2Id} className="vibe-panel-section-label">
          Background color 2
        </label>
        <input
          id={color2Id}
          type="color"
          value={config.backgroundColor2}
          onChange={(e) => onChange({ backgroundColor2: e.target.value }, 'backgroundColor2')}
          className="vibe-color-input"
        />
      </div>
    </div>
  )
}
