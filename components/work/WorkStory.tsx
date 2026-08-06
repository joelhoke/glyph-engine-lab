'use client'

import { RefObject, useId, useRef, useState } from 'react'
import { getWorkMedia, WorkMedia, WorkStory } from '../../content/work'
import { AnalyticsEvent, outboundHost } from '../../engine/analytics'
import WorkMediaLightbox from './WorkMediaLightbox'

type WorkStoryProps = {
  story: WorkStory
  headingRef?: RefObject<HTMLHeadingElement | null>
  /** Consented public analytics events; no-op before opt-in. */
  onTrackEvent?: (event: AnalyticsEvent) => void
}

const PREVIEW_THUMB_COUNT = 3

/**
 * Presentational view of a single case study. The compact summary is always
 * visible; "Read the case study" expands the structured narrative inline, and
 * gallery thumbnails open the accessible lightbox. Pure semantic HTML — the
 * story is fully readable with the canvas disabled. Protected stories render
 * only their approved teaser plus the confidential-viewer route.
 */
export default function WorkStoryView({ story, headingRef, onTrackEvent }: WorkStoryProps) {
  const detailsId = useId().replace(/:/g, '-')
  const [expanded, setExpanded] = useState(false)
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null)
  const lightboxTriggerRef = useRef<HTMLElement | null>(null)

  const media = story.access === 'public' ? (story.media ?? []) : []
  const details = story.access === 'public' ? (story.details ?? []) : []
  const previewMedia = media.slice(0, PREVIEW_THUMB_COUNT)

  const openLightbox = (index: number, trigger: HTMLElement) => {
    lightboxTriggerRef.current = trigger
    setLightboxIndex(index)
    const entry = media[index]
    if (entry) {
      onTrackEvent?.({ name: 'media_open', params: { story_id: story.id, media_kind: entry.kind } })
    }
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
      <p className="work-story-outcome">{story.outcome}</p>

      {story.access === 'protected' ? (
        <a className="work-story-link" href={`/protected-work?story=${story.protectedId}`}>
          View this confidential case study
          <span aria-hidden="true"> →</span>
        </a>
      ) : (
        <>
          {story.links.map((link) => (
            <a
              key={link.url}
              className="work-story-link"
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => trackOutbound(link.url)}
            >
              {link.iconSrc && (
                <img
                  src={link.iconSrc}
                  alt=""
                  className="work-story-link-icon"
                  aria-hidden="true"
                />
              )}
              {link.label}
              <span aria-hidden="true"> ↗</span>
            </a>
          ))}

          {details.length > 0 && (
            <div className="work-story-details">
              <button
                type="button"
                className="work-story-disclosure"
                aria-expanded={expanded}
                aria-controls={detailsId}
                onClick={() => setExpanded((value) => !value)}
              >
                {expanded ? 'Close the case study' : 'Read the case study'}
                <span aria-hidden="true">{expanded ? ' ↑' : ' ↓'}</span>
              </button>
              {expanded && (
                <div id={detailsId} className="work-story-sections">
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
                          <InlineMedia key={mediaId} item={entry} />
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
            </div>
          )}

          {media.length > 0 && (
            <div className="work-gallery">
              <ul className="work-gallery-thumbs">
                {previewMedia.map((entry, i) => (
                  <li key={entry.id}>
                    <GalleryThumb
                      item={entry}
                      onOpen={(trigger) => openLightbox(i, trigger)}
                    />
                  </li>
                ))}
              </ul>
              {media.length > PREVIEW_THUMB_COUNT && (
                <button
                  type="button"
                  className="work-gallery-view-all"
                  onClick={(event) => openLightbox(0, event.currentTarget)}
                >
                  View all media ({media.length})
                </button>
              )}
            </div>
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

/** Media rendered inside an expanded narrative section. */
function InlineMedia({ item }: { item: WorkMedia }) {
  if (item.kind === 'image') {
    return (
      <figure className="work-inline-media">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={item.src} width={item.width} height={item.height} alt={item.alt} loading="lazy" />
        {item.caption && <figcaption>{item.caption}</figcaption>}
      </figure>
    )
  }
  if (item.kind === 'video') {
    return (
      <figure className="work-inline-media">
        <video
          src={item.src}
          poster={item.poster}
          width={item.width}
          height={item.height}
          controls
          preload="none"
          aria-label={item.alt}
        >
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
