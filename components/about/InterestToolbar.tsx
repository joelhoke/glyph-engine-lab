'use client'

import { useEffect, useRef, useState } from 'react'
import FibreArc, { fibreArcBaseline } from '../originkit/ui/fibre-arc'
import { fibreArcClearanceBaseline } from '../originkit/ui/fibreArcGeometry'
import { useFibrePalette } from '../originkit/useFibrePalette'
import { ABOUT, type InterestId } from '../../content/about'
import { createFrameLoop } from '../../engine/frameLoop'
import { stepParallaxValue } from '../home/useHeroParallax'
import DockLabel from '../DockLabel'
import { mobileDockAnchor, mobileDockScale, mobileCompositionScale, MOBILE_DOCK_GEOMETRY } from '../home/mobileHero'
import type { ThemeName } from '../../engine/theme'
import styles from '../../app/about/about.module.css'

import { INTEREST_ARC, interestArcRange, interestArcX, isCompactInterestDock } from './interestLayout'
const { apex: APEX, direction: DIRECTION, bundle: BUNDLE } = INTEREST_ARC
type Props = {
  active: boolean; reducedMotion: boolean; theme: ThemeName; selected: InterestId | null
  onHighlight: (id: InterestId | null) => void
  onOpen: (id: InterestId, button: HTMLButtonElement) => void
}

/** Content and destinations stay in ABOUT; only placement belongs to this toolbar. */
export default function InterestToolbar({ active, reducedMotion, theme, selected, onHighlight, onOpen }: Props) {
  const host = useRef<HTMLDivElement>(null)
  const rail = useRef<HTMLDivElement>(null)
  const previousWeights = useRef<number[]>([])
  const clearance = useRef({ amount: 0, floor: .82 })
  const [labeled, setLabeled] = useState<InterestId | null>(null)
  const [tabStop, setTabStop] = useState<InterestId>('family')
  const [compactLayout, setCompactLayout] = useState(false)
  const palette = useFibrePalette(host, theme)
  useEffect(() => {
    const element = host.current
    if (!element || !rail.current) return
    const fibreCanvas = rail.current.querySelector('canvas')
    const buttons = Array.from(element.querySelectorAll<HTMLButtonElement>('[data-interest]'))
    let bounds = element.getBoundingClientRect()
    let railBounds = rail.current.getBoundingClientRect()
    let compact = isCompactInterestDock(railBounds.width, railBounds.height)
    let mobileGap = 0
    let pointer: number | null = null, focused: number | null = null
    let weights = previousWeights.current.length === buttons.length ? previousWeights.current.slice() : buttons.map(() => 0), targets = weights.slice()
    let reported: InterestId | null | undefined, previous = 0
    let spaceTarget = 0
    const content = element.closest('main')?.querySelector('#interest-content')
    const baseSize = () => Math.min(176, bounds.width / 6.25)
    const baselineAt = (x: number) => {
      const screenX = bounds.left + x - railBounds.left
      const baseline = fibreArcBaseline(screenX, railBounds.width, railBounds.height, BUNDLE.curve, APEX, DIRECTION)
      return railBounds.top - bounds.top + fibreArcClearanceBaseline(screenX, railBounds.width, railBounds.height, baseline, clearance.current)
    }
    const write = () => {
      const { width } = bounds
      const base = baseSize(), range = interestArcRange(width, base)
      const anchors = buttons.map((_, index) => {
        const x = compact ? mobileDockAnchor(width, index, buttons.length, mobileGap) : interestArcX(range, index, buttons.length)
        return { x, y: baselineAt(x) }
      })
      const availableAt = ({ x, y }: { x: number; y: number }, labelSpace: number) => {
        const screenX = bounds.left + x, screenY = bounds.top + y
        return 2 * Math.min(screenX - railBounds.left - 12, railBounds.right - screenX - 12, y, railBounds.bottom - screenY - labelSpace)
      }
      const reference = { x: range.left, y: baselineAt(range.left) }
      const expanded = compact ? MOBILE_DOCK_GEOMETRY.object * mobileCompositionScale(width + 24) : Math.max(44, Math.min(base * 1.72,
        availableAt(reference, 48), ...anchors.map(anchor => availableAt(anchor, 12))))
      element.dataset.layout = compact ? 'compact' : 'arc'
      buttons.forEach((button, index) => {
        const { x, y } = anchors[index]
        const size = expanded * (compact ? mobileDockScale(weights[index]) : .5 + weights[index] * .5)
        const hitSize = Math.max(44, size)
        button.style.width = `${hitSize}px`
        button.style.height = `${hitSize}px`
        button.style.left = `${x - hitSize / 2}px`
        button.style.top = `${y - hitSize / 2}px`
        button.style.setProperty('--object-size', `${size}px`)
        button.style.setProperty('--interest-layer', String(4 + Math.round(weights[index] * 20)))
        button.dataset.weight = String(weights[index])
      })
      previousWeights.current = weights.slice()
      // Keep the existing canvas renderer aligned with the growing DOM slots.
      element.dispatchEvent(new CustomEvent('interest-layout', { bubbles: true, detail: { compact, top: Math.min(...anchors.map(anchor => bounds.top + anchor.y - expanded / 2)) } }))
      fibreCanvas?.dispatchEvent(new Event('fibre-layout'))
    }
    const loop = createFrameLoop({
      isParked: () => !active || document.hidden,
      keepRunning: () => clearance.current.amount !== spaceTarget || weights.some((weight, index) => weight !== targets[index]),
      frame: now => {
        const dt = previous ? now - previous : 16; previous = now
        clearance.current.amount = reducedMotion ? spaceTarget : stepParallaxValue(clearance.current.amount, spaceTarget, dt)
        weights = weights.map((weight, index) => reducedMotion ? targets[index] : stepParallaxValue(weight, targets[index], dt))
        write()
      },
    })
    const reserveSpace = () => {
      // Semantic content state, not pointer proximity: scrolling never makes the dock chase content.
      spaceTarget = compact ? 1 : content?.querySelector('[data-fibre-space="collection"]') ? 1
        : content?.querySelector('[data-fibre-space="row"]') ? .82
        : content?.querySelector('[data-fibre-space="hero"]') ? .38 : 0
      // Keep the icon-only mobile row inside its measured band with 16px breathing room.
      clearance.current.floor = compact
        ? (bounds.bottom - 16 - MOBILE_DOCK_GEOMETRY.object * mobileCompositionScale(bounds.width + 24) * mobileDockScale(1) / 2 - railBounds.top) / Math.max(1, railBounds.height)
        : Math.max(.68, Math.min(.84, 1 - 120 / Math.max(1, railBounds.height)))
      if (compact || reducedMotion || !active || document.hidden) { clearance.current.amount = spaceTarget; write() }
      else { previous = 0; loop.renderOnce() }
    }
    const update = () => {
      const position = active && !document.hidden ? focused ?? pointer : null
      // Selection persists independently of a temporary hover on another item.
      targets = buttons.map((button, index) => compact ? Number(button.dataset.interest === selected) : button.dataset.interest === selected || index === position ? 1 : 0)
      const id = compact ? selected : position === null ? selected : ABOUT.interests[Math.round(position)]?.id ?? selected
      if (id !== reported) { reported = id; setLabeled(id); onHighlight(id) }
      // Moving within an already selected point (or empty space) needs no relayout.
      if (weights.every((weight, index) => weight === targets[index])) return
      if (!active || document.hidden || reducedMotion) { weights = targets.slice(); write() }
      else { if (!loop.isPending()) previous = 0; loop.renderOnce() }
    }
    const move = (event: globalThis.PointerEvent) => {
      if (event.pointerType === 'touch') return
      focused = null
      const button = event.target instanceof Element ? event.target.closest<HTMLButtonElement>('[data-interest]') : null
      const overButton = button && element.contains(button)
      // Only the point/object is interactive; the decorative rail never captures input.
      pointer = overButton ? buttons.indexOf(button) : null
      update()
    }
    const leave = () => { pointer = null; update() }
    const focus = () => {
      const button = document.activeElement?.closest<HTMLButtonElement>('[data-interest]')
      focused = button && element.contains(button) ? buttons.indexOf(button) : null
      update()
    }
    const resize = () => {
      bounds = element.getBoundingClientRect(); railBounds = rail.current!.getBoundingClientRect()
      // One em of extra separation, relative to the dock's inherited font size.
      mobileGap = parseFloat(getComputedStyle(element).fontSize) || 16
      compact = isCompactInterestDock(railBounds.width, railBounds.height); setCompactLayout(compact)
      if (compact) {
        element.style.setProperty('--mobile-dock-height', `${32 + MOBILE_DOCK_GEOMETRY.object * mobileCompositionScale(bounds.width + 24) * mobileDockScale(1)}px`)
        bounds = element.getBoundingClientRect()
      }
      reserveSpace(); write(); update()
    }
    const visibility = () => { pointer = null; if (document.hidden) loop.park(); update() }
    const observer = new ResizeObserver(resize); observer.observe(element); observer.observe(rail.current)
    const contentObserver = new MutationObserver(reserveSpace)
    if (content) contentObserver.observe(content, { childList: true, subtree: true, attributes: true, attributeFilter: ['data-fibre-space'] })
    window.addEventListener('pointermove', move, { passive: true })
    document.documentElement.addEventListener('pointerleave', leave)
    element.addEventListener('focusin', focus)
    element.addEventListener('focusout', focus)
    window.addEventListener('blur', leave)
    document.addEventListener('visibilitychange', visibility)
    resize(); focus()
    return () => {
      loop.dispose(); observer.disconnect(); contentObserver.disconnect()
      window.removeEventListener('pointermove', move); document.documentElement.removeEventListener('pointerleave', leave)
      element.removeEventListener('focusin', focus); element.removeEventListener('focusout', focus)
      window.removeEventListener('blur', leave); document.removeEventListener('visibilitychange', visibility)
    }
  }, [active, reducedMotion, selected, onHighlight])

  return <div ref={host} data-mobile-dock={compactLayout} className={styles.interests} role="toolbar" aria-label="Explore my interests"
    onKeyDown={event => {
      if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(event.key)) return
      const buttons = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('[data-interest]'))
      const current = buttons.indexOf(document.activeElement as HTMLButtonElement)
      const next = event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1
        : (Math.max(0, current) + (['ArrowRight', 'ArrowDown'].includes(event.key) ? 1 : -1) + buttons.length) % buttons.length
      event.preventDefault(); buttons[next]?.focus()
    }}>
    <div ref={rail} className={styles.fibreRail} aria-hidden="true">
      <FibreArc transparent active={active} reducedMotion={reducedMotion} globalPointer direction={DIRECTION} clearanceRef={clearance}
        apex={APEX} bundle={BUNDLE} speed={30} density={22} hover={compactLayout ? 0 : 130} reach={24} {...palette}
        style={{ minWidth: 0, minHeight: 0, width: '100%', height: '100%' }} />
    </div>
    {ABOUT.interests.map(interest => (
        <button key={interest.id} type="button" data-interest={interest.id}
          className={styles.interest} tabIndex={tabStop === interest.id ? 0 : -1} onFocus={() => setTabStop(interest.id)} aria-controls="interest-content" aria-pressed={selected === interest.id} aria-label={`Open ${interest.title}`}
          onClick={event => onOpen(interest.id, event.currentTarget)}>
          <span className={styles.objectSlot} data-interest-object={interest.id} aria-hidden="true">
            <img className={styles.dockPreview} data-dock-preview alt="" draggable={false} />
            <span className={styles.fallbackFolder}><span /><span /><span /></span>
          </span>
          <DockLabel visible={!compactLayout && (labeled === interest.id || selected === interest.id)} hoverOnly>{interest.title}</DockLabel>
        </button>
    ))}
  </div>
}
