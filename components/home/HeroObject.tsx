'use client'

import { ComponentType, useEffect, useState } from 'react'
import type { HeroContent } from '../../content/home'
import HomeMedia from './HomeMedia'
import { HERO_THREE_RENDERERS } from './renderers/HeroThreeObject'

/**
 * Custom hero preview renderers live OUTSIDE the serializable content
 * (content/home.ts names a renderer by string; this registry maps the name to
 * a component). The built-in registry carries the four three.js section
 * objects (components/home/renderers/HeroThreeObject.tsx); callers may
 * extend or override it via the renderers prop.
 */
export type HeroRendererProps = {
  /** Hero onscreen and not menu-covered (heroVisible && !menuOpen from the
   *  shell): park all animation while false. */
  active: boolean
  reducedMotion: boolean
  /** Report a terminal failure (e.g. no WebGL) so the dispatcher swaps in
   *  the slot's fallback media instead of an empty slot. */
  onUnavailable?: () => void
  /** The slot link's hover/focus state (drives the phone's idle → "Let’s chat"
   *  screen swap); undefined/false for everything else. */
  highlighted?: boolean
  /** Live rest-orientation override in degrees (tuning panel Hero section). */
  rotationOverride?: { x: number; y: number }
}

export type HeroRenderers = Record<string, ComponentType<HeroRendererProps>>

export const DEFAULT_HERO_RENDERERS: HeroRenderers = { ...HERO_THREE_RENDERERS }

export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false)
  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)')
    const update = () => setReduced(query.matches)
    update()
    query.addEventListener('change', update)
    return () => query.removeEventListener('change', update)
  }, [])
  return reduced
}

type HeroCustomContent = Extract<HeroContent, { kind: 'custom' }>

function HeroCustom({
  content,
  label,
  renderers,
  active,
  reducedMotion,
  highlighted,
  rotationOverride,
}: {
  content: HeroCustomContent
  label: string
  renderers: HeroRenderers
  active: boolean
  reducedMotion: boolean
  highlighted: boolean
  rotationOverride?: { x: number; y: number }
}) {
  const [unavailable, setUnavailable] = useState(false)
  useEffect(() => setUnavailable(false), [content.renderer])
  const Renderer = renderers[content.renderer]
  // Missing renderer key or a renderer-reported failure → the fallback path
  // (the slot's fallback image, or the branded placeholder).
  if (!Renderer || unavailable) {
    return <HomeMedia image={content.fallback ?? undefined} label={label} priority />
  }
  return (
    <div className="home-hero-custom">
      <Renderer
        active={active}
        reducedMotion={reducedMotion}
        highlighted={highlighted}
        rotationOverride={rotationOverride}
        onUnavailable={() => setUnavailable(true)}
      />
    </div>
  )
}

type HeroObjectProps = {
  content: HeroContent
  /** Accessible/context label for media placeholders (the slot's label). */
  label: string
  renderers: HeroRenderers
  /** Hero onscreen and not menu-covered — forwarded to custom renderers. */
  active?: boolean
  /** The slot link's hover/focus state — forwarded to custom renderers. */
  highlighted?: boolean
  /** Live rest-orientation override in degrees — forwarded to custom
   *  renderers (tuning panel Hero section). */
  rotationOverride?: { x: number; y: number }
}

/**
 * Hero slot content dispatcher: card / image / custom. Custom previews render
 * inside destination anchors, so they must stay free of nested interactive
 * controls — the anchor owns the hit area.
 */
export default function HeroObject({
  content,
  label,
  renderers,
  active = true,
  highlighted = false,
  rotationOverride,
}: HeroObjectProps) {
  const reducedMotion = useReducedMotion()
  switch (content.kind) {
    case 'card':
      return (
        <div className="home-hero-card">
          <span className="home-hero-card-title">{content.title}</span>
          {content.body ? <span className="home-hero-card-body">{content.body}</span> : null}
        </div>
      )
    case 'image':
      return <HomeMedia image={content.image} label={label} priority />
    case 'custom':
      return (
        <HeroCustom
          content={content}
          label={label}
          renderers={renderers}
          active={active}
          reducedMotion={reducedMotion}
          highlighted={highlighted}
          rotationOverride={rotationOverride}
        />
      )
  }
}
