'use client'

import dynamic from 'next/dynamic'
import { CSSProperties, Ref, useCallback, useId, useRef, useState } from 'react'
import type { HeroSlot, HeroSlotId, HomePortrait, HomeSectionId } from '../../content/home'
import { destinationHref } from '../../engine/homeNavigation'
import DockLabel from '../DockLabel'
import HeroObject, { HeroRenderers } from './HeroObject'
import HomeNotebook from './HomeNotebook'
import HomeSpriteHead from './HomeSpriteHead'
import HomeSpriteHand from './HomeSpriteHand'
import HomeSpriteTone from './HomeSpriteTone'
import { useHeroPresence } from './useHeroPresence'
import { useHeroDock } from './useHeroDock'
import { useMobileHero } from './useMobileHero'
import { MobileDockArrow, MobileDockLabel } from '../MobileDockControls'
import { HeroMotionId, HeroMotionNodes, useHeroParallax } from './useHeroParallax'

const HomeDockFibre = dynamic(() => import('./HomeDockFibre'), { ssr: false })

type HomeHeroProps = {
  slots: HeroSlot[]
  portrait?: HomePortrait
  renderers: HeroRenderers
  /** The homepage introduction text (content/home.ts) — the notebook blurb
   *  inside the intro slot. */
  introduction: string
  /** Intercepted section navigation (unmodified primary clicks only — the
   *  shell decides; modified clicks pass through as ordinary anchors). */
  onSectionLink: (event: React.MouseEvent<HTMLAnchorElement>, section: HomeSectionId) => void
  /** Reports the hero element so the shell can size the canvas viewport to it
   *  and observe its visibility. */
  heroRef?: Ref<HTMLElement>
  /** External parallax gate from the shell (hero onscreen; phase 5 will AND
   *  in menu-covered). The hook additionally gates on viewport width, reduced
   *  motion, and fine/hover pointer. HomeHero only mounts on Home, so the
   *  loop is structurally Home-only. */
  parallaxEnabled?: boolean
  /** Per-slot 3D rest orientations in degrees (tuning panel Hero section),
   *  keyed by slot id ('intro' maps to the notebook variant). */
  slotRotations?: Record<string, { x: number; y: number }>
}

export type { HeroMotionNodes }

/**
 * Homepage hero (homepage-redesign phases 2–4): a centered portrait over the
 * live glyph field with sprite hands supporting the five foreground
 * slots beneath the head. Placement (position element), animated
 * movement (motion element), and content are separate nested elements so the
 * parallax pass (useHeroParallax) only ever sets CSS variables on the motion
 * node.
 *
 * Everything decorative is pointer-transparent so input reaches the glyph
 * canvas; only the destination anchors own hit areas.
 */
export default function HomeHero({
  slots,
  portrait,
  renderers,
  introduction,
  onSectionLink,
  heroRef,
  parallaxEnabled = true,
  slotRotations,
}: HomeHeroProps) {
  const toneFilterId = `home-sprite-tone-${useId().replace(/:/g, "")}`
  const motionNodesRef = useRef<Map<HeroMotionId, HTMLElement>>(new Map())
  const registerMotionNode = (id: HeroMotionId) => (node: HTMLDivElement | null) => {
    if (node) {
      motionNodesRef.current.set(id, node)
    } else {
      motionNodesRef.current.delete(id)
    }
  }

  // Local hero node state: feeds the parallax loop and chains to the shell's
  // heroRef (canvas sizing + visibility observation).
  const [heroNode, setHeroNode] = useState<HTMLElement | null>(null)
  const setHeroRefs = useCallback((node: HTMLElement | null) => {
    setHeroNode(node)
    if (typeof heroRef === 'function') {
      heroRef(node)
    } else if (heroRef && typeof heroRef === 'object') {
      ;(heroRef as React.MutableRefObject<HTMLElement | null>).current = node
    }
  }, [heroRef])

  // Slot link hover/focus — forwarded to the custom renderer (the phone's
  // idle → "Let’s chat" screen swap). The links keep their own behavior; this
  // only decorates.
  const [hoveredSlot, setHoveredSlot] = useState<HeroSlotId | null>(null)
  const [focusedSlot, setFocusedSlot] = useState<HeroSlotId | null>(null)
  const mobileHero = useMobileHero(heroNode, parallaxEnabled)
  const selectedSlot = slots.find(slot => slot.id === mobileHero.selected)
  const insideHero = useHeroPresence(heroNode, parallaxEnabled)
  const spriteInteracting = parallaxEnabled && (insideHero || focusedSlot !== null || (mobileHero.mobile && mobileHero.selected !== null))
  const dockHovered = useHeroDock(heroNode, parallaxEnabled, focusedSlot, mobileHero.selected)
  const labeledSlot = parallaxEnabled ? dockHovered ?? focusedSlot ?? hoveredSlot : null
  const highlighted = (id: HeroSlotId) => mobileHero.mobile
    ? mobileHero.selected === id
    : dockHovered ? dockHovered === id : hoveredSlot === id || focusedSlot === id

  useHeroParallax({
    hero: heroNode,
    motionNodes: motionNodesRef.current,
    enabled: parallaxEnabled,
  })

  return (
    <section className="home-hero" data-portrait={portrait?.spritePath ? 'sprites' : undefined} aria-label="Introduction" ref={setHeroRefs}
      data-sprite-active={spriteInteracting} data-mobile-dock={mobileHero.mobile}
      {...mobileHero.gestureProps}
      style={{ '--home-sprite-filter': portrait?.tone ? `url("#${toneFilterId}")` : 'none' } as CSSProperties}
      onFocusCapture={(event) => {
        const slot = (event.target as HTMLElement).closest<HTMLElement>('[data-slot]')?.dataset.slot
        if (slot) {
          setFocusedSlot(slot as HeroSlotId)
          if (mobileHero.mobile && (event.target as HTMLElement).matches(':focus-visible')) mobileHero.select(slot as HeroSlotId)
        }
      }}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setFocusedSlot(null)
      }}>
      {portrait?.tone && <HomeSpriteTone id={toneFilterId} tone={portrait.tone} />}
      <div className="home-hero-scene" onKeyDown={mobileHero.onKeyDown}>
      <div className="home-hero-composition">
      {portrait ? (
        <div className="home-hero-portrait-position">
          <div className="home-hero-portrait-motion" ref={registerMotionNode('portrait')}>
            {portrait.spritePath ? <HomeSpriteHead portrait={portrait} active={parallaxEnabled} /> : <img
              className="home-hero-portrait"
              src={portrait.src}
              alt={portrait.alt}
              width={portrait.width}
              height={portrait.height}
              fetchPriority="high"
            />}
          </div>
        </div>
      ) : null}
      <div className="home-hero-dock-zone" aria-hidden="true" />
      <ul className="home-hero-slots">
        {portrait?.hands && <HomeDockFibre hero={heroNode}
          active={parallaxEnabled && (dockHovered !== null || focusedSlot !== null || (mobileHero.mobile && mobileHero.selected !== null))} />}
        {/* Independent desktop layers keep both hands behind every object,
            while retaining their objects' fan geometry and parallax. */}
        {portrait?.hands && (['left', 'right'] as const).map(side => (
          <li key={`hand-${side}`} className="home-hero-slot-position home-hero-hand-slot"
            data-slot={side === 'left' ? 'work' : 'gallery'} aria-hidden="true">
            <div className="home-hero-slot-motion" ref={registerMotionNode(`hand-${side}`)}>
              <HomeSpriteHand side={side} hand={portrait.hands![side]} active={parallaxEnabled} />
            </div>
          </li>
        ))}
        {slots.map((slot) => (
          <li key={slot.id} className="home-hero-slot-position" data-slot={slot.id}
            onPointerEnter={(event) => { if (event.pointerType !== 'touch') setHoveredSlot(slot.id) }}
            onPointerLeave={() => setHoveredSlot(current => current === slot.id ? null : current)}
            onPointerCancel={() => setHoveredSlot(current => current === slot.id ? null : current)}>
            <div className="home-hero-slot-motion" ref={registerMotionNode(slot.id)}>
              {slot.destination ? (
                <a
                  className="home-hero-slot-link"
                  href={destinationHref({ kind: 'home', section: slot.destination })}
                  aria-label={slot.label}
                  onClick={(event) => {
                    if (!mobileHero.onSlotClick(event, slot.id)) onSectionLink(event, slot.destination as HomeSectionId)
                  }}
                  onFocus={() => setFocusedSlot(slot.id)}
                  onBlur={() => setFocusedSlot((current) => (current === slot.id ? null : current))}
                >
                  {slot.id === 'intro' && slot.content.kind === 'card' ? (
                    <HomeNotebook coverTitle={slot.content.title} coverBody={slot.content.body}
                      blurb={introduction} active={parallaxEnabled} decorative
                      rotationOverride={slotRotations?.intro} highlighted={highlighted(slot.id)} />
                  ) : (
                    <HeroObject content={slot.content} label={slot.label} renderers={renderers}
                      active={parallaxEnabled} highlighted={highlighted(slot.id)}
                      rotationOverride={slotRotations?.[slot.id]} />
                  )}
                </a>
              ) : (
                <div className="home-hero-slot-static">
                  {/* The intro slot is the notebook: cover labeling from its
                      card content, the introduction blurb inside. */}
                  {slot.id === 'intro' && slot.content.kind === 'card' ? (
                    <HomeNotebook
                      coverTitle={slot.content.title}
                      coverBody={slot.content.body}
                      blurb={introduction}
                      active={parallaxEnabled}
                      rotationOverride={slotRotations?.intro}
                      highlighted={dockHovered === 'intro'}
                    />
                  ) : (
                    <HeroObject
                      content={slot.content}
                      label={slot.label}
                      renderers={renderers}
                      active={parallaxEnabled}
                    />
                  )}
                </div>
              )}
              {/* The controls already have descriptive accessible names.
                  This visual label adds discoverability without repeating
                  that name to screen readers or intercepting a click. */}
              <DockLabel visible={labeledSlot === slot.id}>{slot.label.split(' — ')[0]}</DockLabel>
            </div>
          </li>
        ))}
      </ul>
      </div>
      <MobileDockArrow direction={-1} onStep={mobileHero.step} />
      <MobileDockArrow direction={1} onStep={mobileHero.step} />
      </div>
      <MobileDockLabel id={selectedSlot?.id} label={selectedSlot?.label.split(' — ')[0]}
        index={selectedSlot ? slots.indexOf(selectedSlot) : 0} count={slots.length}
        href={selectedSlot?.destination ? destinationHref({ kind: 'home', section: selectedSlot.destination }) : undefined}
        onActivate={event => { if (selectedSlot?.destination) onSectionLink(event as React.MouseEvent<HTMLAnchorElement>, selectedSlot.destination as HomeSectionId) }}
        onKeyDown={mobileHero.onKeyDown} timerKey={mobileHero.timerKey} autoRunning={mobileHero.autoRunning} />
    </section>
  )
}
