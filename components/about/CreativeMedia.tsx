'use client'

import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { GAMING_PICKS, LISTENING_PICKS, MEDIA_PROFILES, MEDIA_VIEWS, WATCHING_PICKS, type MediaPick, type MediaView } from '../../content/creativeMedia'
import { comicCoverUrl } from '../../lib/comics.mjs'
import MediaPile from './MediaPile'
import MediaCase from './MediaCase'
import ComicPullListStatus from './ComicPullListStatus'
import type { ComicPullListData } from './useComicPullList'
import styles from '../../app/about/about.module.css'
import { captureMediaPile, unfoldMediaCases, type MediaPileSnapshot } from './mediaMotion'

export default function CreativeMedia({ comics, active = true, reducedMotion = false }: { comics: ComicPullListData; active?: boolean; reducedMotion?: boolean }) {
  const [view, setView] = useState<MediaView | null>(null)
  const baseId = useId()
  const host = useRef<HTMLDivElement>(null), track = useRef<HTMLUListElement>(null)
  const restoreFocus = useRef<MediaView | null>(null)
  const origin = useRef<MediaPileSnapshot | null>(null)
  const opened = useRef(false)
  const openPile = (kind: MediaView, button: HTMLButtonElement) => {
    origin.current = reducedMotion ? null : captureMediaPile(button)
    opened.current = true
    setView(kind)
  }
  useLayoutEffect(() => {
    const snapshot = origin.current
    origin.current = null
    if (!view || !active || reducedMotion || !snapshot || !track.current) return
    return unfoldMediaCases(track.current, snapshot)
  }, [view, active, reducedMotion])
  useEffect(() => {
    if (!active) return
    if (view && track.current) {
      track.current.scrollLeft = 0
      track.current.focus({ preventScroll: true })
    } else if (!view && restoreFocus.current) {
      host.current?.querySelector<HTMLButtonElement>(`[data-media-pile="${restoreFocus.current}"]`)?.focus({ preventScroll: true })
      restoreFocus.current = null
    }
  }, [view, active])
  const close = () => { restoreFocus.current = view; setView(null) }
  const comicPicks: MediaPick[] = comics.snapshot.comics.map(comic => {
    const cover = comicCoverUrl(comic.cover)
    return { id: comic.url, title: comic.name, source: comic.publisher, url: comic.url,
      image: cover ? { src: cover, alt: `${comic.name} cover`, width: 300, height: 460 } : undefined }
  })
  const collections = { comics: comicPicks, watching: WATCHING_PICKS, gaming: GAMING_PICKS, listening: LISTENING_PICKS }
  const label = MEDIA_VIEWS.find(item => item.id === view)?.label
  return <div ref={host} className={styles.mediaHub} data-expanded={Boolean(view)} data-fibre-space={view ? 'collection' : undefined} onKeyDown={event => {
    if (event.key === 'Escape' && view) { event.stopPropagation(); close() }
  }}>
    {!view ? <div className={styles.mediaPiles} data-intro={!opened.current && !reducedMotion} aria-label="Creative Media collections">
      {MEDIA_VIEWS.map((item, index) => <MediaPile key={item.id} index={index} kind={item.id} label={item.label}
        items={collections[item.id]} expanded={false} controls={`${baseId}-collection`}
        onOpen={button => openPile(item.id, button)} />)}
    </div> : <section id={`${baseId}-collection`} aria-label={`${label} collection`} className={styles.mediaExpanded}>
      <div className={styles.mediaCollectionBar}>
        <button type="button" className={styles.mediaBack} onClick={close}>← All collections</button>
        <div className={styles.mediaChoices} aria-label="Choose a collection">
          {MEDIA_VIEWS.map(item => <button key={item.id} type="button" aria-pressed={view === item.id}
            onClick={() => setView(item.id)}>{item.label}</button>)}
        </div>
      </div>
      {view === 'comics' ? <ComicPullListStatus data={comics} /> :
        <p className={styles.mediaCollectionNote}>{view === 'watching' ? 'Recently added to my movie collection.' : view === 'listening' ? 'Recently added to my Apple Music library.' : 'Recently played on Xbox.'}</p>}
      <ul key={view} ref={track} className={styles.mediaTrack} tabIndex={0} aria-label={`${label} — scroll horizontally`}
        onKeyDown={event => {
          // Native scrolling handles touch/trackpad/scrollbar. Keys work anywhere in the row.
          const row = track.current
          if (!row || !['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return
          event.preventDefault()
          if (event.key === 'Home') row.scrollLeft = 0
          else if (event.key === 'End') row.scrollLeft = row.scrollWidth
          else row.scrollLeft += row.clientWidth * (event.key === 'ArrowLeft' ? -.7 : .7)
        }}>
        {collections[view].map((item, index) => <li key={item.id} className={styles.mediaTrackItem}>
          <article>
            <div className={styles.mediaCaseStand}><MediaCase item={item} kind={view} index={Math.min(index, 5)} /></div>
            <p className={styles.mediaKicker}>{item.source}{item.note ? ` · ${item.note}` : ''}</p>
            <h3>{item.url ? <a href={item.url} target="_blank" rel="noopener noreferrer">{item.title}<span aria-hidden="true"> ↗</span></a> : item.title}</h3>
          </article>
        </li>)}
        {!collections[view].length && <li className={styles.mediaEmpty}>{view === 'comics' ? 'A quiet week on the pull list. More stories soon.' : view === 'gaming' ? 'Recent games are coming soon.' : view === 'listening' ? 'My recently added albums will appear here once Apple Music is connected.' : 'Movie picks are coming soon.'}</li>}
      </ul>
      <div className={styles.mediaCollectionFooter}>
        <span>Scroll to explore <span aria-hidden="true">↔</span></span>
        {view !== 'comics' && view !== 'listening' && <a href={MEDIA_PROFILES[view === 'gaming' ? 'xbox' : 'youtube'].url} target="_blank" rel="noopener noreferrer">
          {MEDIA_PROFILES[view === 'gaming' ? 'xbox' : 'youtube'].handle} ↗
        </a>}
      </div>
    </section>}
  </div>
}
