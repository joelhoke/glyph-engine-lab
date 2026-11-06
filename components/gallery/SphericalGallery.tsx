'use client'

import dynamic from 'next/dynamic'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties, MouseEvent } from 'react'
import { fetchListedCreations } from '../../engine/creationClient'
import { GALLERY_PALETTES } from '../../content/galleryArtwork'
import { galleryPattern, projectTile, tileTransform, visibleTiles } from './galleryGeometry'
import { useGalleryMotion } from './useGalleryMotion'
import type { GalleryArtwork, GalleryItem, GalleryLayout } from './galleryTypes'
import type { GallerySelection } from './GalleryDialog'
import GalleryTileMedia from './GalleryTileMedia'
import PixelArtwork from './PixelArtwork'
import styles from './sphere.module.css'

const GalleryDialog = dynamic(() => import('./GalleryDialog'))
const STORAGE_KEY = 'jh-gallery-view-v1'

export default function SphericalGallery({ items: initialItems }: { items: GalleryItem[] }) {
  const [items, setItems] = useState(initialItems)
  const layout: GalleryLayout = 'regular'
  const [view, setView] = useState<'sphere' | 'grid'>('grid')
  const [ready, setReady] = useState(false), [reduced, setReduced] = useState(true)
  const [coarse, setCoarse] = useState(false), [visible, setVisible] = useState(true)
  const [activeKey, setActiveKey] = useState<string | null>(null)
  const [selection, setSelection] = useState<GallerySelection | null>(null)
  const trigger = useRef<HTMLElement | null>(null)
  const { surfaceRef, size, position, moving, restore, animateTo } = useGalleryMotion(view === 'sphere' && !selection, reduced)

  useEffect(() => {
    const motion = matchMedia('(prefers-reduced-motion: reduce)'), pointer = matchMedia('(pointer: coarse)')
    const updateMotion = () => { setReduced(motion.matches); if (motion.matches) setView('grid') }
    const updatePointer = () => setCoarse(pointer.matches)
    const updateVisibility = () => setVisible(!document.hidden)
    updateMotion(); updatePointer(); updateVisibility()
    let storedView: 'sphere' | 'grid' = 'sphere'
    try {
      const saved = JSON.parse(sessionStorage.getItem(STORAGE_KEY) || 'null')
      if (saved) {
        if (saved.view === 'grid') storedView = 'grid'
        if (saved.layout !== 'mixed' && Number.isFinite(saved.x) && Number.isFinite(saved.y)) restore({ x: saved.x, y: saved.y })
      }
    } catch { /* Storage is optional (private browsing, stale data). */ }
    setView(motion.matches ? 'grid' : storedView); setReady(true)
    motion.addEventListener('change', updateMotion); pointer.addEventListener('change', updatePointer)
    document.addEventListener('visibilitychange', updateVisibility)
    return () => {
      motion.removeEventListener('change', updateMotion); pointer.removeEventListener('change', updatePointer)
      document.removeEventListener('visibilitychange', updateVisibility)
    }
  }, [restore])

  useEffect(() => {
    let live = true
    fetchListedCreations().then(creations => {
      if (!live) return
      const entries: GalleryItem[] = creations.map(c => {
        const date = new Date(c.capturedAt * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })
        const common = { id: `creation-${c.id}`, width: 1280, height: 720, alt: `Playground creation from ${date}`,
          caption: `Saved from the vibe playground · ${date}`, captionAction: { href: `/?memento=${encodeURIComponent(c.id)}#vibe`, label: 'Open in playground' } }
        return { id: common.id, title: `Playground / ${date}`, category: 'Community creation', poster: c.thumbUrl ?? '',
          preview: c.kind === 'clip' ? c.mediaUrl ?? undefined : undefined,
          action: { kind: 'media', media: c.kind === 'clip' && c.mediaUrl
            ? { ...common, kind: 'video', src: c.mediaUrl, poster: c.thumbUrl ?? '', transcript: 'Ambient playground capture. No dialogue.' }
            : { ...common, kind: 'image', src: c.thumbUrl ?? '' } } }
      })
      if (entries.length) setItems([...initialItems, ...entries])
    })
    return () => { live = false }
  }, [initialItems])

  useEffect(() => {
    if (!ready || moving) return
    try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ layout, view, ...position })) } catch { /* Optional. */ }
  }, [ready, moving, layout, view, position])

  const pattern = useMemo(() => galleryPattern(items.length, layout), [items.length, layout])
  const tiles = useMemo(() => visibleTiles(pattern, position, size.width, size.height, layout), [pattern, position, size, layout])
  const canonical = useMemo(() => {
    const best = new Map<string, string>(), distances = new Map<string, number>()
    for (const tile of tiles) if (tile.distance < (distances.get(tile.id) ?? Infinity)) {
      best.set(tile.id, tile.key); distances.set(tile.id, tile.distance)
    }
    return best
  }, [tiles])
  const nearest = tiles.reduce<(typeof tiles)[number] | null>((best, t) => !best || t.distance < best.distance ? t : best, null)
  const playing = visible && !moving && !selection && !reduced
  const activated = coarse && view === 'sphere' ? nearest?.key : activeKey
  const open = (element: HTMLElement, value: GallerySelection) => { trigger.current = element; setSelection(value) }
  const openExperience = (event: MouseEvent<HTMLAnchorElement>, item: GalleryItem) => {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
    event.preventDefault()
    open(event.currentTarget, { item })
  }

  function tileContent(item?: GalleryItem, artwork?: GalleryArtwork, active = false) {
    const palette = artwork ? GALLERY_PALETTES[artwork.palette] : null
    return <>
      {item ? <GalleryTileMedia item={item} active={active} /> : artwork && <PixelArtwork artwork={artwork} active={active} />}
      <span className={styles.caption}>
        <span>{item?.category ?? 'Generative study'}{item?.requiresPassword ? ' · Password required' : ''}</span>
        <strong>{item?.title ?? palette?.name}</strong>
        <span className={styles.openArrow} aria-hidden="true">{item?.action.kind === 'link' ? '↗' : '+'}</span>
      </span>
    </>
  }

  return <main id="main-content" className={`${styles.gallery} ${view === 'sphere' ? styles.spherical : styles.flat}`}>
    <div className={styles.dock}>
    <div className={styles.toolbar}>
      <div className={styles.heading}><h1>Gallery<span aria-hidden="true">.</span></h1>
        <p id="gallery-instructions">{view === 'grid' ? 'Scroll to browse · Select a project to open' : coarse ? 'Drag to explore · Tap to open' : 'Drag, swipe or scroll · Arrow keys to explore'}</p>
      </div>
      <div className={styles.controls}>
        {view === 'sphere' && <button type="button" className={styles.resetView} aria-label="Back to start" title="Back to start"
          onClick={() => { animateTo({ x: 0, y: 0 }); surfaceRef.current?.focus({ preventScroll: true }) }}><span className={styles.resetLabel}>Back to start </span><span aria-hidden="true">↺</span></button>}
        {ready && <button type="button" className={styles.viewSwitch} onClick={() => { setActiveKey(null); setView(view === 'sphere' ? 'grid' : 'sphere') }}>
          <span aria-hidden="true">{view === 'sphere' ? '▦' : '◉'}</span> {view === 'sphere' ? 'Grid view' : 'Explore'}</button>}
      </div>
    </div>
    </div>
    {view === 'sphere' ? <>
      <div ref={surfaceRef} className={styles.surface} tabIndex={0} role="region" aria-label="Explore gallery"
        aria-describedby="gallery-instructions" data-layout={layout} data-moving={moving} data-x={position.x.toFixed(2)} data-y={position.y.toFixed(2)}
        onPointerLeave={() => setActiveKey(null)}>
        {tiles.map(tile => {
          const item = tile.itemIndex !== undefined ? items[tile.itemIndex] : undefined
          const projection = projectTile(tile.left, tile.top, size.width, size.height)
          const duplicate = canonical.get(tile.id) !== tile.key
          const inView = Math.abs(projection.x) < size.width / 2 - 30 && Math.abs(projection.y) < size.height / 2 - 25
          const style: CSSProperties = { width: tile.width, height: tile.height,
            transform: tileTransform(tile.left, tile.top, tile.width, tile.height, size.width, size.height) }
          const shared = {
            className: styles.tile, tabIndex: duplicate || !inView ? -1 : 0, 'data-tile-key': tile.key,
            'data-nearest': tile.key === nearest?.key ? 'true' : undefined,
            onPointerEnter: () => { if (!coarse) setActiveKey(tile.key) },
            onPointerMove: () => { if (!coarse && !moving) setActiveKey(tile.key) },
            onFocus: () => setActiveKey(tile.key), onBlur: () => setActiveKey(null),
            'aria-label': item ? `${item.title} — ${item.category}${item.requiresPassword ? ', password required' : ''}` : `${GALLERY_PALETTES[tile.artwork!.palette].name} — generative study`,
          }
          return <div className={styles.placement} key={tile.key} style={style} aria-hidden={duplicate || !inView || undefined}>
            {item?.action.kind === 'link' ? <a {...shared} href={item.action.href} onClick={e => openExperience(e, item)}>{tileContent(item, undefined, playing && inView && activated === tile.key)}</a>
              : <button {...shared} type="button" onClick={e => open(e.currentTarget, item ? { item } : { artwork: tile.artwork! })}>
                {tileContent(item, tile.artwork, playing && inView && activated === tile.key)}</button>}
          </div>
        })}
      </div>
    </> : <ul className={styles.grid} aria-label="All gallery works">
      {items.map(item => {
        const shared = { className: styles.tile, onPointerEnter: () => setActiveKey(item.id), onPointerLeave: () => setActiveKey(null),
          onFocus: () => setActiveKey(item.id), onBlur: () => setActiveKey(null) }
        return <li key={item.id}>{item.action.kind === 'link'
          ? <a {...shared} href={item.action.href} onClick={e => openExperience(e, item)}>{tileContent(item, undefined, playing && activeKey === item.id)}</a>
          : <button {...shared} type="button" onClick={e => open(e.currentTarget, { item })}>{tileContent(item, undefined, playing && activeKey === item.id)}</button>}</li>
      })}
    </ul>}
    {selection && <GalleryDialog selection={selection} onClose={() => setSelection(null)} trigger={trigger.current} reduced={reduced} visible={visible} />}
  </main>
}
