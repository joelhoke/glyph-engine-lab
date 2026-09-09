'use client'

import { RefObject, useEffect, useRef, useState } from 'react'
import { getWorkMedia, WorkMedia, WorkMediaImage, WorkStory } from '../../content/work'
import { AnalyticsEvent, outboundHost } from '../../engine/analytics'
import WorkMediaLightbox, { CaptionActionLink } from './WorkMediaLightbox'

type WorkStoryProps = {
  story: WorkStory
  headingRef?: RefObject<HTMLHeadingElement | null>
  /** Provided by WorkExperience for public slides that overflow the compact
   *  fold — the button eases the card straight to full expansion. */
  onReadCaseStudy?: () => void
  /** Consented public analytics events; no-op before opt-in. */
  onTrackEvent?: (event: AnalyticsEvent) => void
}

const PREVIEW_THUMB_COUNT = 3

/** Counts a metric's leading numeral up from zero when the stat block
 *  scrolls into view; suffixes ("+", "s/hr", " → 12") trail the count.
 *  Reduced-motion sessions get the final value immediately. */
function MetricValue({ value }: { value: string }) {
  const ref = useRef<HTMLSpanElement>(null)
  const [display, setDisplay] = useState(value)

  useEffect(() => {
    const node = ref.current
    if (!node) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const match = value.match(/^([\d,]+)([\s\S]*)$/)
    if (!match) return
    const target = parseInt(match[1].replace(/,/g, ''), 10)
    if (!Number.isFinite(target) || target <= 0) return
    const suffix = match[2]
    const grouped = match[1].includes(',')
    const format = (n: number) =>
      (grouped ? Math.round(n).toLocaleString('en-US') : String(Math.round(n))) + suffix

    setDisplay(format(0))
    let frame = 0
    const duration = 1400
    let startTime = 0
    const step = (now: number) => {
      if (!startTime) startTime = now
      const t = Math.min((now - startTime) / duration, 1)
      const eased = 1 - Math.pow(1 - t, 3)
      setDisplay(format(target * eased))
      if (t < 1) frame = requestAnimationFrame(step)
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          observer.disconnect()
          frame = requestAnimationFrame(step)
        }
      },
      { threshold: 0.6 },
    )
    observer.observe(node)
    return () => {
      observer.disconnect()
      cancelAnimationFrame(frame)
    }
  }, [value])

  return (
    <span ref={ref} className="work-story-metric-value">
      {display}
    </span>
  )
}

/**
 * Presentational view of a single case study. The structured narrative is
 * always rendered (no disclosure) — the card's expanded reading panel is
 * what reveals it, via scroll scrub or the "Read the case study" button. Media referenced from narrative sections via mediaIds renders
 * inline (images open the lightbox); the gallery is reserved for media NOT
 * placed in the narrative, so nothing appears twice. Related links always
 * come last. Pure semantic HTML — the story is fully readable with the
 * canvas disabled. Protected stories render only their approved teaser plus
 * the confidential-viewer route.
 */
export default function WorkStoryView({
  story,
  headingRef,
  onReadCaseStudy,
  onTrackEvent,
}: WorkStoryProps) {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null)
  const lightboxTriggerRef = useRef<HTMLElement | null>(null)

  const media = story.access === 'public' ? (story.media ?? []) : []
  const details = story.access === 'public' ? (story.details ?? []) : []
  // Media placed inline in the narrative never repeats as a gallery thumb.
  const inlineIds = new Set([
    ...(story.outcomeMediaIds ?? []),
    ...details.flatMap((section) => section.mediaIds ?? []),
  ])
  const galleryMedia = media.filter((entry) => !inlineIds.has(entry.id))
  const previewMedia = galleryMedia.slice(0, PREVIEW_THUMB_COUNT)

  const openLightbox = (index: number, trigger: HTMLElement) => {
    lightboxTriggerRef.current = trigger
    setLightboxIndex(index)
    const entry = media[index]
    if (entry) {
      onTrackEvent?.({ name: 'media_open', params: { story_id: story.id, media_kind: entry.kind } })
    }
  }

  const openInlineLightbox = (mediaId: string, trigger: HTMLElement) => {
    const index = media.findIndex((entry) => entry.id === mediaId)
    if (index >= 0) openLightbox(index, trigger)
  }

  const trackOutbound = (url: string) => {
    const host = outboundHost(url)
    if (host) onTrackEvent?.({ name: 'outbound_link', params: { host } })
  }

  return (
    <article className="work-story" aria-labelledby={`work-story-title-${story.id}`}>
      <h3
        id={`work-story-title-${story.id}`}
        ref={headingRef as RefObject<HTMLHeadingElement>}
        tabIndex={-1}
        className="work-story-title"
      >
        {story.title}
      </h3>
      <p className="work-story-thesis">{story.thesis}</p>
      <dl className="work-story-meta">
        <div className="work-story-meta-row">
          <dt>Role</dt>
          <dd>{story.role}</dd>
        </div>
        <div className="work-story-meta-row">
          <dt>Context</dt>
          <dd>{story.context}</dd>
        </div>
      </dl>

      {/* Discoverability affordance for the scroll-scrubbed expansion: the
          compact fold hides the narrative below this point, so the button
          opens the card straight to the full reading panel. */}
      {story.access === 'public' && onReadCaseStudy && (
        <button type="button" className="work-story-read" onClick={onReadCaseStudy}>
          Read the case study
          <span aria-hidden="true"> ↓</span>
        </button>
      )}

      {story.access === 'protected' ? (
        /* Access action, not a related resource — it keeps its position
           directly under the teaser. */
        <a className="work-story-link" href={`/protected-work?story=${story.protectedId}`}>
          View this confidential case study
          <span aria-hidden="true"> →</span>
        </a>
      ) : (
        <>
          {details.length > 0 && (
            <div className="work-story-sections">
              <section className="work-story-section">
                <h4 className="work-story-section-heading">Outcome</h4>
                <p className="work-story-outcome">{story.outcome}</p>
                {story.metrics && story.metrics.length > 0 && (
                  <ul className="work-story-metrics">
                    {story.metrics.map((metric) => (
                      <li key={metric.label} className="work-story-metric">
                        <MetricValue value={metric.value} />
                        <span className="work-story-metric-label">{metric.label}</span>
                      </li>
                    ))}
                  </ul>
                )}
                {story.outcomeParagraphs?.map((paragraph, i) => (
                  <p key={i} className="work-story-section-copy">
                    {paragraph}
                  </p>
                ))}
                {story.outcomeMediaIds?.map((mediaId) => {
                  const entry = getWorkMedia(story, mediaId)
                  return entry ? (
                    <InlineMedia
                      key={mediaId}
                      item={entry}
                      onOpenImage={(trigger) => openInlineLightbox(mediaId, trigger)}
                    />
                  ) : null
                })}
              </section>
              {details.map((section) => (
                <section key={section.heading} className="work-story-section">
                  <h4 className="work-story-section-heading">{section.heading}</h4>
                  {section.paragraphs?.map((paragraph, i) => (
                    <p key={i} className="work-story-section-copy">
                      {paragraph}
                    </p>
                  ))}
                  {section.items && (
                    <ul className="work-story-section-list">
                      {section.items.map((item, i) => (
                        <li key={i}>{item}</li>
                      ))}
                    </ul>
                  )}
                  {section.callout && (
                    <p className="work-story-section-callout">{section.callout}</p>
                  )}
                  {section.mediaPresentation === 'carousel' && section.mediaIds ? (
                    <MediaCarousel
                      heading={section.heading}
                      media={section.mediaIds
                        .map((mediaId) => getWorkMedia(story, mediaId))
                        .filter((entry): entry is WorkMediaImage => entry?.kind === 'image')}
                      onOpenImage={(mediaId, trigger) => openInlineLightbox(mediaId, trigger)}
                    />
                  ) : (
                    section.mediaIds?.map((mediaId) => {
                      const entry = getWorkMedia(story, mediaId)
                      return entry ? (
                        <InlineMedia
                          key={mediaId}
                          item={entry}
                          onOpenImage={(trigger) => openInlineLightbox(mediaId, trigger)}
                        />
                      ) : null
                    })
                  )}
                  {section.attachments?.map((attachment) => (
                    <a
                      key={attachment.url}
                      className="work-story-link"
                      href={attachment.url}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {attachment.label}
                      <span aria-hidden="true"> ↗</span>
                    </a>
                  ))}
                </section>
              ))}
            </div>
          )}
          {/* Stories without details sections keep the outcome here so it
              never disappears. */}
          {details.length === 0 && <p className="work-story-outcome">{story.outcome}</p>}

          {galleryMedia.length > 0 && (
            <div className="work-gallery">
              <ul className="work-gallery-thumbs">
                {previewMedia.map((entry) => (
                  <li key={entry.id}>
                    <GalleryThumb
                      item={entry}
                      onOpen={(trigger) =>
                        openLightbox(
                          media.findIndex((candidate) => candidate.id === entry.id),
                          trigger,
                        )
                      }
                    />
                  </li>
                ))}
              </ul>
              {galleryMedia.length > PREVIEW_THUMB_COUNT && (
                <button
                  type="button"
                  className="work-gallery-view-all"
                  onClick={(event) =>
                    openLightbox(
                      media.findIndex((entry) => entry.id === galleryMedia[0].id),
                      event.currentTarget,
                    )
                  }
                >
                  View all media ({galleryMedia.length})
                </button>
              )}
            </div>
          )}

          {/* Related links are always the final story content — after all
              narrative, inline media, and remaining gallery media. */}
          {story.links.length > 0 && (
            <section className="work-story-related" aria-label="Related links">
              <h4 className="work-story-section-heading">Related links</h4>
              <ul className="work-story-related-list">
                {story.links.map((link) => (
                  <li key={link.url}>
                    <a
                      className="work-story-link"
                      href={link.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() => trackOutbound(link.url)}
                    >
                      {link.label}
                      <span aria-hidden="true"> ↗</span>
                    </a>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}

      {lightboxIndex !== null && media.length > 0 && (
        <WorkMediaLightbox
          media={media}
          startIndex={lightboxIndex}
          storyTitle={story.title}
          onClose={() => setLightboxIndex(null)}
          triggerRef={lightboxTriggerRef}
        />
      )}
    </article>
  )
}

/** Full-width, manually navigated screen carousel for a narrative section. */
function MediaCarousel({
  heading,
  media,
  onOpenImage,
}: {
  heading: string
  media: WorkMediaImage[]
  onOpenImage: (mediaId: string, trigger: HTMLElement) => void
}) {
  const [index, setIndex] = useState(0)
  const viewportRef = useRef<HTMLDivElement | null>(null)
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([])
  const indexRef = useRef(0)
  const programmaticIndexRef = useRef<number | null>(null)
  const settleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const item = media[index]

  useEffect(
    () => () => {
      if (settleTimerRef.current) clearTimeout(settleTimerRef.current)
    },
    [],
  )

  if (!item) return null

  const setActiveIndex = (next: number) => {
    indexRef.current = next
    setIndex(next)
  }

  const goTo = (direction: number) => {
    const target = ((indexRef.current + direction) % media.length + media.length) % media.length
    const targetElement = itemRefs.current[target]
    if (!targetElement) return

    programmaticIndexRef.current = target
    if (settleTimerRef.current) clearTimeout(settleTimerRef.current)
    setActiveIndex(target)
    requestAnimationFrame(() => {
      targetElement.scrollIntoView({
        behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
        block: 'nearest',
        inline: 'center',
      })
    })
    settleTimerRef.current = setTimeout(() => {
      programmaticIndexRef.current = null
    }, 500)
  }

  const handleScroll = () => {
    if (programmaticIndexRef.current !== null) return
    const viewport = viewportRef.current
    if (!viewport) return
    const midpoint = viewport.scrollLeft + viewport.clientWidth / 2
    let closestIndex = 0
    let closestDistance = Infinity
    itemRefs.current.forEach((element, candidateIndex) => {
      if (!element) return
      const distance = Math.abs(element.offsetLeft + element.offsetWidth / 2 - midpoint)
      if (distance < closestDistance) {
        closestDistance = distance
        closestIndex = candidateIndex
      }
    })
    if (closestIndex !== indexRef.current) setActiveIndex(closestIndex)
  }

  const itemCount = media.length

  return (
    <figure className="work-media-carousel">
      <div
        ref={viewportRef}
        className="work-media-carousel-viewport"
        role="region"
        aria-roledescription="carousel"
        aria-label={`${heading} screens`}
        data-edge={index === 0 ? 'start' : index === itemCount - 1 ? 'end' : undefined}
        onScroll={handleScroll}
      >
        <div className="work-media-carousel-track">
          {media.map((entry, entryIndex) => (
            <button
              key={entry.id}
              ref={(element) => {
                itemRefs.current[entryIndex] = element
              }}
              type="button"
              className="work-media-carousel-image"
              onClick={(event) => onOpenImage(entry.id, event.currentTarget)}
              aria-label={`View ${entry.caption ?? entry.alt}`}
              aria-current={entryIndex === index ? 'true' : undefined}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={entry.src}
                width={entry.width}
                height={entry.height}
                alt=""
                loading={entryIndex === 0 ? 'eager' : 'lazy'}
              />
            </button>
          ))}
          {/* Trailing inset at the scroll end. A real element (not a
             track ::after or end padding): end-side padding and zero-height
             pseudo-elements don't extend the scrollable overflow area, so
             the last image ended up flush against the container edge. */}
          <span className="work-media-carousel-end-spacer" aria-hidden="true" />
        </div>
      </div>
      <figcaption className="work-media-carousel-caption">
        {item.caption}
        {itemCount > 1 && (
          <span className="work-media-carousel-controls">
            <button
              type="button"
              className="work-media-carousel-control"
              onClick={() => goTo(-1)}
              aria-label={`Previous ${heading} screen`}
            >
              <span aria-hidden="true">←</span>
            </button>
            <span className="work-media-carousel-progress" aria-live="polite">
              {index + 1} / {itemCount}
            </span>
            <button
              type="button"
              className="work-media-carousel-control"
              onClick={() => goTo(1)}
              aria-label={`Next ${heading} screen`}
            >
              <span aria-hidden="true">→</span>
            </button>
          </span>
        )}
      </figcaption>
    </figure>
  )
}

/** Preview tile: image thumbnail, video poster, viewer poster, or embed play tile. */
function GalleryThumb({
  item,
  onOpen,
}: {
  item: WorkMedia
  onOpen: (trigger: HTMLElement) => void
}) {
  const label =
    item.kind === 'embed'
      ? `Play ${item.title}`
      : item.kind === 'viewer'
        ? `View interactive 3D model: ${item.caption ?? item.alt}`
        : `View ${item.caption ?? item.alt}`
  return (
    <button
      type="button"
      className="work-gallery-thumb"
      onClick={(event) => onOpen(event.currentTarget)}
      aria-label={label}
    >
      {item.kind === 'image' && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={item.thumbnail ?? item.src}
          width={item.width}
          height={item.height}
          alt=""
          loading="lazy"
        />
      )}
      {item.kind === 'video' && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={item.poster} width={item.width} height={item.height} alt="" loading="lazy" />
      )}
      {item.kind === 'viewer' && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={item.poster.src}
          width={item.poster.width}
          height={item.poster.height}
          alt=""
          loading="lazy"
        />
      )}
      {item.kind === 'embed' && <span aria-hidden="true">▶</span>}
    </button>
  )
}

/** Media rendered inside a narrative section. */
function InlineMedia({
  item,
  onOpenImage,
}: {
  item: WorkMedia
  onOpenImage: (trigger: HTMLElement) => void
}) {
  if (item.kind === 'image') {
    return (
      <figure
        className="work-inline-media work-inline-media--image"
        style={
          item.inlineWidth
            ? ({ '--inline-width': `${item.inlineWidth}%` } as React.CSSProperties)
            : undefined
        }
      >
        <button
          type="button"
          className="work-inline-media-button"
          onClick={(event) => onOpenImage(event.currentTarget)}
          aria-label={`View ${item.caption ?? item.alt}`}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={item.src}
            width={item.width}
            height={item.height}
            alt={item.alt}
            loading="lazy"
          />
        </button>
        {(item.caption || item.captionAction) && (
          <figcaption>
            {item.caption}
            {item.captionAction && (
              <>
                {' '}
                <CaptionActionLink action={item.captionAction} />
              </>
            )}
          </figcaption>
        )}
      </figure>
    )
  }
  if (item.kind === 'viewer') {
    if (item.inlinePlayback === 'live') {
      return <LiveInlineViewer item={item} />
    }
    // Interactive 3D viewer: poster figure like an image; the iframe loads
    // only inside the lightbox. The pill marks the poster as orbitable.
    return (
      <figure className="work-inline-media work-inline-media--image">
        <button
          type="button"
          className="work-inline-media-button"
          onClick={(event) => onOpenImage(event.currentTarget)}
          aria-label={`View interactive 3D model: ${item.caption ?? item.alt} (opens a viewer you can drag to orbit)`}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={item.poster.src}
            width={item.poster.width}
            height={item.poster.height}
            alt={item.alt}
            loading="lazy"
          />
          <span className="work-inline-media-hint" aria-hidden="true">
            3D — drag to orbit
          </span>
        </button>
        {(item.caption || item.captionAction) && (
          <figcaption>
            {item.caption}
            {item.captionAction && (
              <>
                {' '}
                <CaptionActionLink action={item.captionAction} />
              </>
            )}
          </figcaption>
        )}
      </figure>
    )
  }
  if (item.kind === 'video') {
    return (
      <figure className="work-inline-media">
        <video
          poster={item.poster}
          width={item.width}
          height={item.height}
          controls
          preload="none"
          aria-label={item.alt}
        >
          {/* Source children, not a src attribute: with a fallback the browser
              picks the first playable encoding (HEVC primary, H.264 fallback)
              without downloading both. */}
          <source src={item.src} type={item.fallbackSrc ? 'video/mp4; codecs="hvc1"' : undefined} />
          {item.fallbackSrc && <source src={item.fallbackSrc} type="video/mp4" />}
          {item.captionsSrc && (
            <track kind="captions" src={item.captionsSrc} label="English captions" default />
          )}
        </video>
        {(item.caption || item.transcript || item.captionAction) && (
          <figcaption>
            {item.caption}
            {item.transcript && (
              <span className="work-inline-transcript"> Transcript: {item.transcript}</span>
            )}
            {item.captionAction && (
              <>
                {' '}
                <CaptionActionLink action={item.captionAction} />
              </>
            )}
          </figcaption>
        )}
      </figure>
    )
  }
  return <InlineEmbed item={item} />
}

function LiveInlineViewer({
  item,
}: {
  item: Extract<WorkMedia, { kind: 'viewer' }>
}) {
  const iframeRef = useRef<HTMLIFrameElement | null>(null)

  useEffect(() => {
    const iframe = iframeRef.current
    if (!iframe) return
    // Reduced motion: swap to the static single-frame mode. Done post-mount
    // (not at render) so the static export's prerendered markup hydrates
    // without a mismatch.
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      iframe.src = `${item.src}?static=1&inline=1`
    }
  }, [item.src])

  return (
    <figure className="work-inline-media work-inline-media--live-viewer">
      <iframe
        ref={iframeRef}
        className="work-inline-live-viewer"
        src={`${item.src}?inline=1`}
        title={item.alt}
        width={item.width}
        height={item.height}
        tabIndex={-1}
      />
      {/* Whole-figure click-through to the full-screen route; the pill is the
          visible affordance. The iframe is pointer-events:none so it never
          traps the click or the page scroll. */}
      <a
        className="work-inline-media-open"
        href="/work/digie-award"
        aria-label={`Open ${item.caption ?? item.alt} in the full-screen 3D viewer`}
      >
        <span className="work-inline-media-fullscreen" aria-hidden="true">
          Open full screen ↗
        </span>
      </a>
    </figure>
  )
}

function InlineEmbed({ item }: { item: Extract<WorkMedia, { kind: 'embed' }> }) {
  const [active, setActive] = useState(false)
  const src =
    item.provider === 'youtube'
      ? `https://www.youtube-nocookie.com/embed/${item.videoId}`
      : `https://player.vimeo.com/video/${item.videoId}`
  if (!active) {
    return (
      <button
        type="button"
        className="work-embed-facade"
        onClick={() => setActive(true)}
        aria-label={`Play ${item.title} on ${item.provider === 'youtube' ? 'YouTube' : 'Vimeo'}`}
      >
        <span aria-hidden="true">▶</span> Load {item.title}
      </button>
    )
  }
  return (
    <iframe
      className="work-inline-embed"
      src={src}
      title={item.title}
      loading="lazy"
      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
      allowFullScreen
    />
  )
}
