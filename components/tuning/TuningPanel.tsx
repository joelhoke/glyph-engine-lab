'use client'

import {
  APPROVED_SCENE_DEFAULTS,
  APPROVED_SOURCE_LAYOUT_DEFAULTS,
  INTERACTION_CONTROL_DEFINITIONS,
  SceneConfig,
  SceneConfigKey,
  SourceLayoutConfigKey,
  SOURCE_LAYOUT_CONTROL_DEFINITIONS,
} from './tuningConfig'
import { SourceLayoutConfig } from '../../engine/svgTargetSource'
import { SceneDiagnosticsSnapshot } from '../../engine/diagnostics'
import { QualityTier } from '../../engine/qualityTiers'
import NumericControl from './NumericControl'

type TuningPanelProps = {
  speed: number
  onSpeedChange: (value: number) => void
  sceneConfig: SceneConfig
  onSceneConfigChange: (key: SceneConfigKey, value: number) => void
  onResetSceneConfig: () => void
  sourceLayout: SourceLayoutConfig
  onSourceLayoutChange: (key: SourceLayoutConfigKey, value: number | string) => void
  onResetSourceLayout: () => void
  targetCount: number
  sceneDiagnostics: SceneDiagnosticsSnapshot
  /** Debug override for the adaptive quality tier; null = Auto. */
  qualityTierOverride: QualityTier | null
  onQualityTierOverrideChange: (tier: QualityTier | null) => void
  onCopyConfiguration: () => void
  onPlay: () => void
  onPause: () => void
  onReplay: () => void
  onPrevPhase: () => void
  onNextPhase: () => void
  totalDurationMs: number
  effectiveOptionStaggerMs: number
  effectiveOptionItemDurationMs: number
  timingFallbackActive: boolean
}

export default function TuningPanel({
  speed,
  onSpeedChange,
  sceneConfig,
  onSceneConfigChange,
  onResetSceneConfig,
  sourceLayout,
  onSourceLayoutChange,
  onResetSourceLayout,
  targetCount,
  sceneDiagnostics,
  qualityTierOverride,
  onQualityTierOverrideChange,
  onCopyConfiguration,
  onPlay,
  onPause,
  onReplay,
  onPrevPhase,
  onNextPhase,
  totalDurationMs,
  effectiveOptionStaggerMs,
  effectiveOptionItemDurationMs,
  timingFallbackActive,
}: TuningPanelProps) {
  const sceneDirty = (Object.keys(APPROVED_SCENE_DEFAULTS) as SceneConfigKey[]).some(
    (key) => sceneConfig[key] !== APPROVED_SCENE_DEFAULTS[key],
  )
  const sourceLayoutDirty = (Object.keys(APPROVED_SOURCE_LAYOUT_DEFAULTS) as SourceLayoutConfigKey[]).some(
    (key) => sourceLayout[key] !== APPROVED_SOURCE_LAYOUT_DEFAULTS[key],
  )

  return (
    <div className="tuning-panel" aria-label="Tuning panel">
      <div className="tuning-panel-header">
        <span>Tuning</span>
      </div>

      <section className="tuning-section" aria-labelledby="tuning-playback-heading">
        <h3 id="tuning-playback-heading" className="tuning-section-title">Playback</h3>
        <div className="tuning-button-row">
          <button type="button" onClick={onPlay}>Play</button>
          <button type="button" onClick={onPause}>Pause</button>
          <button type="button" onClick={onReplay}>Replay</button>
          <button type="button" onClick={onPrevPhase}>Prev phase</button>
          <button type="button" onClick={onNextPhase}>Next phase</button>
        </div>
        <NumericControl
          id="playback-rate"
          label="Playback rate"
          value={speed}
          min={0.01}
          max={10}
          step={0.1}
          showSlider
          onChange={onSpeedChange}
        />
      </section>

      <section className="tuning-section" aria-labelledby="tuning-interaction-heading">
        <h3 id="tuning-interaction-heading" className="tuning-section-title">Interaction</h3>
        <div className="tuning-controls-grid">
          {(Object.keys(INTERACTION_CONTROL_DEFINITIONS) as SceneConfigKey[]).map((key) => (
            <NumericControl
              key={key}
              id={`scene-${key}`}
              label={INTERACTION_CONTROL_DEFINITIONS[key].label}
              value={sceneConfig[key]}
              min={INTERACTION_CONTROL_DEFINITIONS[key].min}
              max={INTERACTION_CONTROL_DEFINITIONS[key].max}
              step={INTERACTION_CONTROL_DEFINITIONS[key].step}
              unit={INTERACTION_CONTROL_DEFINITIONS[key].unit}
              showSlider={INTERACTION_CONTROL_DEFINITIONS[key].showSlider}
              onChange={(value) => onSceneConfigChange(key, value)}
            />
          ))}
        </div>
        <button type="button" className="tuning-reset-button" onClick={onResetSceneConfig}>
          Reset interaction values
        </button>
      </section>

      <section className="tuning-section" aria-labelledby="tuning-source-heading">
        <h3 id="tuning-source-heading" className="tuning-section-title">Source and layout</h3>
        <div className="tuning-controls-grid">
          {(Object.keys(SOURCE_LAYOUT_CONTROL_DEFINITIONS) as SourceLayoutConfigKey[]).map((key) => {
            const def = SOURCE_LAYOUT_CONTROL_DEFINITIONS[key]
            if (def.kind === 'select') {
              return (
                <div key={key} className="numeric-control">
                  <label htmlFor={`source-${key}`} className="numeric-control-label">
                    {def.label}
                  </label>
                  <select
                    id={`source-${key}`}
                    value={sourceLayout[key]}
                    onChange={(e) => onSourceLayoutChange(key, e.target.value)}
                    className="tuning-select"
                  >
                    {def.options?.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
              )
            }
            return (
              <NumericControl
                key={key}
                id={`source-${key}`}
                label={def.label}
                value={sourceLayout[key] as number}
                min={def.min}
                max={def.max}
                step={def.step}
                unit={def.unit}
                showSlider={def.showSlider}
                onChange={(value) => onSourceLayoutChange(key, value)}
              />
            )
          })}
        </div>
        <button type="button" className="tuning-reset-button" onClick={onResetSourceLayout}>
          Reset source and layout
        </button>
      </section>

      <section className="tuning-section" aria-labelledby="tuning-quality-heading">
        <h3 id="tuning-quality-heading" className="tuning-section-title">Adaptive quality</h3>
        <div className="tuning-controls-grid">
          <div className="numeric-control">
            <label htmlFor="quality-tier-override" className="numeric-control-label">
              Tier override
            </label>
            <select
              id="quality-tier-override"
              value={qualityTierOverride === null ? 'auto' : String(qualityTierOverride)}
              onChange={(e) =>
                onQualityTierOverrideChange(
                  e.target.value === 'auto' ? null : (Number(e.target.value) as QualityTier),
                )
              }
              className="tuning-select"
            >
              <option value="auto">Auto</option>
              <option value="0">T0</option>
              <option value="1">T1</option>
              <option value="2">T2</option>
              <option value="3">T3</option>
            </select>
          </div>
        </div>
        <div className="tuning-status-grid">
          <div>
            Tier: T{sceneDiagnostics.qualityTier}
            {sceneDiagnostics.qualityTierOverride ? ' (override)' : ''}
          </div>
          <div>Last transition: {sceneDiagnostics.qualityLastTransition}</div>
          <div>Glyph cap: {sceneDiagnostics.qualityGlyphCap || 'device budget'}</div>
          <div>
            Creature: ≤{sceneDiagnostics.qualityCreatureCap} @{' '}
            {sceneDiagnostics.qualityCreatureRate} Hz
          </div>
          <div>
            Ambient: {sceneDiagnostics.ambientMode} — {sceneDiagnostics.ambientAgentCount}{' '}
            live of ≤{sceneDiagnostics.qualityAmbientCap} @{' '}
            {sceneDiagnostics.qualityAmbientTickHz} Hz
          </div>
          <div>Collision cost: {sceneDiagnostics.ambientCollisionMs.toFixed(2)} ms/tick</div>
        </div>
      </section>

      <section className="tuning-section" aria-labelledby="tuning-diagnostics-heading">
        <h3 id="tuning-diagnostics-heading" className="tuning-section-title">Scene diagnostics</h3>
        <div className="tuning-status-grid">
          <div>Experience: {sceneDiagnostics.experience}</div>
          <div>Scene: {sceneDiagnostics.sceneId}</div>
          <div>Mode: {sceneDiagnostics.mode}</div>
          <div>
            Source: {sceneDiagnostics.sourceId} ({sceneDiagnostics.sourceKind},{' '}
            {sceneDiagnostics.sourceStatus})
          </div>
          {sceneDiagnostics.sourceError && <div>Source error: {sceneDiagnostics.sourceError}</div>}
          <div>
            Decode/sample:{' '}
            {sceneDiagnostics.sourceDecodeMs === null
              ? '—'
              : `${sceneDiagnostics.sourceDecodeMs.toFixed(1)} ms`}
          </div>
          <div>Target rebuilds: {sceneDiagnostics.targetRebuildCount}</div>
          <div>Targets: {sceneDiagnostics.targetCount}</div>
          <div>Glyphs: {sceneDiagnostics.glyphCount}</div>
          <div>Assigned: {sceneDiagnostics.assignedCount}</div>
          <div>Unassigned: {sceneDiagnostics.unassignedCount}</div>
          <div>Visible: {sceneDiagnostics.visibleCount}</div>
          <div>Hidden: {sceneDiagnostics.hiddenCount}</div>
          <div>FPS: {sceneDiagnostics.fps.toFixed(1)}</div>
          <div>Avg frame: {sceneDiagnostics.avgFrameMs.toFixed(2)} ms</div>
          <div>Worst frame: {sceneDiagnostics.worstFrameMs.toFixed(2)} ms</div>
          <div>Frames in window: {sceneDiagnostics.framesInWindow}</div>
          <div>
            Viewport: {sceneDiagnostics.viewportWidth}×{sceneDiagnostics.viewportHeight} @{' '}
            {sceneDiagnostics.devicePixelRatio}x
          </div>
          <div>Reduced motion: {sceneDiagnostics.reducedMotion ? 'yes' : 'no'}</div>
          <div>
            Pointer: {sceneDiagnostics.pointerType}
            {sceneDiagnostics.pointerActive ? ' (active)' : ''} @ {Math.round(sceneDiagnostics.pointerX)},
            {Math.round(sceneDiagnostics.pointerY)}
          </div>
          <div>
            Impulses: {sceneDiagnostics.impulseCount} (last affected{' '}
            {sceneDiagnostics.lastImpulseAffected})
          </div>
          <div>
            Motion: {sceneDiagnostics.motionMode}
            {sceneDiagnostics.motionMode === 'parametric-creature'
              ? ` (${sceneDiagnostics.motionVariant})`
              : ''}
          </div>
          <div>
            Motion density: {sceneDiagnostics.motionRequestedDensity} →{' '}
            {sceneDiagnostics.motionEffectiveDensity} effective
          </div>
          <div>
            Motion update rate: {sceneDiagnostics.motionRequestedUpdateRate} →{' '}
            {sceneDiagnostics.motionEffectiveUpdateRate} Hz effective
          </div>
          <div>Painted targets: {sceneDiagnostics.paintedTargetCount}</div>
          <div>Seed: {sceneDiagnostics.seed}</div>
          <div>
            Sim: spring {sceneDiagnostics.simParams.spring}, damp {sceneDiagnostics.simParams.damp},
            mouseR {sceneDiagnostics.simParams.mouseR}, repel {sceneDiagnostics.simParams.particleRepel},
            weatherRepel {sceneDiagnostics.simParams.weatherRepelMult}
          </div>
        </div>
      </section>

      <section className="tuning-section" aria-labelledby="tuning-status-heading">
        <h3 id="tuning-status-heading" className="tuning-section-title">Configuration status</h3>
        <div className="tuning-status-grid">
          <div>Interaction values: {sceneDirty ? 'edited' : 'preset'}</div>
          <div>Source/layout: {sourceLayoutDirty ? 'edited' : 'preset'}</div>
          <div>Target count: {targetCount}</div>
          <div>Total duration: {Math.round(totalDurationMs)} ms</div>
          <div>Effective option stagger: {Math.round(effectiveOptionStaggerMs)} ms</div>
          <div>Effective option item duration: {Math.round(effectiveOptionItemDurationMs)} ms</div>
          <div>Timing fallback: {timingFallbackActive ? 'active' : 'none'}</div>
        </div>
        <div className="tuning-button-row" style={{ marginTop: '0.5rem' }}>
          <button type="button" className="tuning-reset-button" onClick={onCopyConfiguration}>
            Copy configuration
          </button>
        </div>
        {(sceneDirty || sourceLayoutDirty) && (
          <button
            type="button"
            className="tuning-reset-button"
            onClick={() => {
              onResetSceneConfig()
              onResetSourceLayout()
            }}
          >
            Reset all tuning values
          </button>
        )}
      </section>
    </div>
  )
}
