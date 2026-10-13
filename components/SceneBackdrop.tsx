'use client'

import { forwardRef, useMemo, type ComponentPropsWithoutRef, type Ref } from 'react'
import SceneCanvas, { type SceneCanvasHandle } from './SceneCanvas'
import CanvasFallback from './CanvasFallback'
import { APPROVED_PLAYGROUND_DEFAULTS } from '../engine/playgroundConfig'
import { buildSceneAmbientConfig } from '../engine/ambientScenes'
import { LANDING_CANVAS_GRADIENT } from '../engine/theme'
import type { SceneSourceSelection } from '../engine/animatedSource'
import { APPROVED_SCENE_DEFAULTS, APPROVED_SOURCE_LAYOUT_DEFAULTS } from '../engine/sceneDefaults'

const HERO_SOURCE: SceneSourceSelection = { kind: 'responsive-landing' }
const HERO_AMBIENT = { ...buildSceneAmbientConfig('clear'), interactionStrength: 0.6, backdropOpacity: 0 }
type Props = ComponentPropsWithoutRef<typeof SceneCanvas> & {
  viewportRef?: Ref<HTMLDivElement>
  viewportClassName?: string
}

/** Shared scene surface. Landing composition and display policy belong here;
 * callers own their content, visibility, and optional tuning state. Keep the
 * same SceneCanvas mounted when the homepage changes experience modes. */
const SceneBackdrop = forwardRef<SceneCanvasHandle, Props>(function SceneBackdrop({
  viewportRef, viewportClassName = '', theme = 'dark', experience = 'intro',
  playgroundConfig = APPROVED_PLAYGROUND_DEFAULTS, source, sourceLayout = APPROVED_SOURCE_LAYOUT_DEFAULTS,
  interactionMode = 'page', ...canvasProps
}, ref) {
  const landing = experience === 'intro'
  const config = useMemo(() => landing ? {
    ...playgroundConfig,
    backgroundColor1: LANDING_CANVAS_GRADIENT[theme].color1,
    backgroundColor2: LANDING_CANVAS_GRADIENT[theme].color2,
    glyphText: 'joelhoke.me.',
    glyphColorMode: 'source-colors' as const,
    ambient: HERO_AMBIENT,
  } : playgroundConfig, [landing, playgroundConfig, theme])

  return <div ref={viewportRef} className={`scene-viewport${landing ? ' scene-viewport--landing' : ''} ${viewportClassName}`}>
    <CanvasFallback />
    <SceneCanvas {...APPROVED_SCENE_DEFAULTS} {...canvasProps} ref={ref}
      theme={theme} experience={experience} playgroundConfig={config}
      source={source ?? (landing ? HERO_SOURCE : undefined)} sourceLayout={sourceLayout}
      interactionMode={interactionMode} />
  </div>
})
export default SceneBackdrop
