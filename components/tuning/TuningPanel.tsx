'use client'

import { IntroTiming, portfolioIntroPreset } from '../../engine/introSequence'
import {
  APPROVED_SCENE_DEFAULTS,
  APPROVED_SOURCE_LAYOUT_DEFAULTS,
  INTERACTION_CONTROL_DEFINITIONS,
  INTRO_TIMING_CONTROL_DEFINITIONS,
  SceneConfig,
  SceneConfigKey,
  SourceLayoutConfigKey,
  SOURCE_LAYOUT_CONTROL_DEFINITIONS,
} from './tuningConfig'
import { SourceLayoutConfig } from '../../engine/svgTargetSource'
import NumericControl from './NumericControl'

type TuningPanelProps = {
  introTiming: IntroTiming
  onIntroTimingChange: (key: keyof IntroTiming, value: number) => void
  onResetIntroTiming: () => void
  speed: number
  onSpeedChange: (value: number) => void
  sceneConfig: SceneConfig
  onSceneConfigChange: (key: SceneConfigKey, value: number) => void
  onResetSceneConfig: () => void
  sourceLayout: SourceLayoutConfig
  onSourceLayoutChange: (key: SourceLayoutConfigKey, value: number | string) => void
  onResetSourceLayout: () => void
  targetCount: number
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
  introTiming,
  onIntroTimingChange,
  onResetIntroTiming,
  speed,
  onSpeedChange,
  sceneConfig,
  onSceneConfigChange,
  onResetSceneConfig,
  sourceLayout,
  onSourceLayoutChange,
  onResetSourceLayout,
  targetCount,
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
  const timingDirty = (Object.keys(INTRO_TIMING_CONTROL_DEFINITIONS) as (keyof IntroTiming)[]).some(
    (key) => introTiming[key] !== portfolioIntroPreset.timing[key],
  )
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

      <section className="tuning-section" aria-labelledby="tuning-sequence-heading">
        <h3 id="tuning-sequence-heading" className="tuning-section-title">Sequence timing</h3>
        <div className="tuning-controls-grid">
          {(Object.keys(INTRO_TIMING_CONTROL_DEFINITIONS) as (keyof IntroTiming)[]).map((key) => (
            <NumericControl
              key={key}
              id={`timing-${key}`}
              label={INTRO_TIMING_CONTROL_DEFINITIONS[key].label}
              value={introTiming[key]}
              min={INTRO_TIMING_CONTROL_DEFINITIONS[key].min}
              max={INTRO_TIMING_CONTROL_DEFINITIONS[key].max}
              step={INTRO_TIMING_CONTROL_DEFINITIONS[key].step}
              unit={INTRO_TIMING_CONTROL_DEFINITIONS[key].unit}
              showSlider={INTRO_TIMING_CONTROL_DEFINITIONS[key].showSlider}
              onChange={(value) => onIntroTimingChange(key, value)}
            />
          ))}
        </div>
        <button type="button" className="tuning-reset-button" onClick={onResetIntroTiming}>
          Reset sequence timing
        </button>
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

      <section className="tuning-section" aria-labelledby="tuning-status-heading">
        <h3 id="tuning-status-heading" className="tuning-section-title">Configuration status</h3>
        <div className="tuning-status-grid">
          <div>Sequence timing: {timingDirty ? 'edited' : 'preset'}</div>
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
        {(timingDirty || sceneDirty || sourceLayoutDirty) && (
          <button
            type="button"
            className="tuning-reset-button"
            onClick={() => {
              onResetIntroTiming()
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
