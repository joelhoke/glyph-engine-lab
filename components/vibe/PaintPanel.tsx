'use client'

import { useId } from 'react'
import {
  PAINT_BRUSH_DIAMETER_MAX,
  PAINT_BRUSH_DIAMETER_MIN,
  PaintChannelColor,
  PaintTool,
  PaintToolConfig,
} from '../../engine/paint'
import NumericControl from '../tuning/NumericControl'

export type PaintPanelProps = {
  config: PaintToolConfig
  onChange: (patch: Partial<PaintToolConfig>, historyKey?: string) => void
  /** Popout action: clear the whole paint overlay (one history transaction). */
  onClearPaint: () => void
  /** Disabled when nothing is painted. */
  clearDisabled: boolean
}

/** Default channel colors applied when a target toggles on — also forced by
 *  PortfolioExperience when painting is enabled (off→on selects both). */
export const PAINT_DEFAULT_GLYPH_COLOR = '#8abaff'
export const PAINT_DEFAULT_BACKGROUND_COLOR = '#1a1026'

export default function PaintPanel({
  config,
  onChange,
  onClearPaint,
  clearDisabled,
}: PaintPanelProps) {
  const stableId = useId().replace(/:/g, '-')
  const enableId = `paint-enable-${stableId}`
  const glyphColorId = `paint-glyph-color-${stableId}`
  const bgColorId = `paint-bg-color-${stableId}`
  const brushId = `paint-brush-${stableId}`

  const glyphEnabled = config.glyphColor !== 'none'
  const bgEnabled = config.backgroundColor !== 'none'

  const setTool = (tool: PaintTool) => onChange({ tool }, 'tool')
  const toggleGlyph = (checked: boolean) =>
    onChange({ glyphColor: checked ? PAINT_DEFAULT_GLYPH_COLOR : 'none' }, 'glyphColor')
  const toggleBackground = (checked: boolean) =>
    onChange({ backgroundColor: checked ? PAINT_DEFAULT_BACKGROUND_COLOR : 'none' }, 'backgroundColor')

  return (
    <div className="vibe-paint-panel">
      <div className="vibe-paint-enable-row">
        <input
          id={enableId}
          type="checkbox"
          checked={config.enabled}
          onChange={(e) => onChange({ enabled: e.target.checked }, 'enabled')}
        />
        <label htmlFor={enableId}>Enable painting</label>
      </div>

      <div className="vibe-paint-tools">
        <button
          type="button"
          className={['vibe-paint-tool', config.tool === 'paint' && 'vibe-paint-tool-active']
            .filter(Boolean)
            .join(' ')}
          onClick={() => setTool('paint')}
          aria-pressed={config.tool === 'paint'}
        >
          Paint
        </button>
        <button
          type="button"
          className={['vibe-paint-tool', config.tool === 'erase' && 'vibe-paint-tool-active']
            .filter(Boolean)
            .join(' ')}
          onClick={() => setTool('erase')}
          aria-pressed={config.tool === 'erase'}
        >
          Erase
        </button>
      </div>

      <div className="vibe-paint-channels">
        <div className="vibe-paint-channel">
          <input
            id={`${glyphColorId}-enable`}
            type="checkbox"
            checked={glyphEnabled}
            onChange={(e) => toggleGlyph(e.target.checked)}
          />
          <label htmlFor={`${glyphColorId}-enable`}>Glyph color</label>
          <input
            id={glyphColorId}
            type="color"
            value={(glyphEnabled ? config.glyphColor : PAINT_DEFAULT_GLYPH_COLOR) as string}
            onChange={(e) => onChange({ glyphColor: e.target.value as PaintChannelColor }, 'glyphColor')}
            disabled={!glyphEnabled}
            className="vibe-color-input"
          />
        </div>

        <div className="vibe-paint-channel">
          <input
            id={`${bgColorId}-enable`}
            type="checkbox"
            checked={bgEnabled}
            onChange={(e) => toggleBackground(e.target.checked)}
          />
          <label htmlFor={`${bgColorId}-enable`}>Background color</label>
          <input
            id={bgColorId}
            type="color"
            value={(bgEnabled ? config.backgroundColor : PAINT_DEFAULT_BACKGROUND_COLOR) as string}
            onChange={(e) => onChange({ backgroundColor: e.target.value as PaintChannelColor }, 'backgroundColor')}
            disabled={!bgEnabled}
            className="vibe-color-input"
          />
        </div>
      </div>

      <NumericControl
        id={brushId}
        label="Brush size"
        value={config.brushDiameter}
        min={PAINT_BRUSH_DIAMETER_MIN}
        max={PAINT_BRUSH_DIAMETER_MAX}
        step={1}
        unit="px"
        showSlider
        onChange={(value) => onChange({ brushDiameter: value }, 'brushDiameter')}
      />

      <button
        type="button"
        className="vibe-paint-clear"
        onClick={onClearPaint}
        disabled={clearDisabled}
        aria-label={clearDisabled ? 'Clear paint (nothing to clear)' : 'Clear paint'}
        title={clearDisabled ? 'Clear paint (nothing to clear)' : 'Clear paint'}
      >
        Clear paint
      </button>
    </div>
  )
}
