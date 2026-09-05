'use client'

import { RefObject, useRef, useState } from 'react'
import { getWorkMedia, WorkMedia, WorkStory } from '../../content/work'
import { AnalyticsEvent, outboundHost } from '../../engine/analytics'
import WorkMediaLightbox from './WorkMediaLightbox'

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
  const inlineIds = new Set(details.flatMap((section) => section.mediaIds ?? []))
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
                {story.outcomeParagraphs?.map((paragraph, i) => (
                  <p key={i} className="work-story-section-copy">
                    {paragraph}
                  </p>
                ))}
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
                  {section.mediaIds?.map((mediaId) => {
                    const entry = getWorkMedia(story, mediaId)
                    return entry ? (
                      <InlineMedia
                        key={mediaId}
                        item={entry}
                        onOpenImage={(trigger) => openInlineLightbox(mediaId, trigger)}
                      />
                    ) : null
                  })}
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

/** Preview tile: image thumbnail, video poster, or embed play tile. */
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
      <figure className="work-inline-media work-inline-media--image">
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
        {item.caption && <figcaption>{item.caption}</figcaption>}
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
        {(item.caption || item.transcript) && (
          <figcaption>
            {item.caption}
            {item.transcript && (
              <span className="work-inline-transcript"> Transcript: {item.transcript}</span>
            )}
          </figcaption>
        )}
      </figure>
    )
  }
  return <InlineEmbed item={item} />
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
