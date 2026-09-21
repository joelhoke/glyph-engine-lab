'use client'

import { useEffect, useState } from 'react'
import { fetchListedCreations, ListedCreation } from '../../engine/creationClient'

function CreationPreview({ creation }: { creation: ListedCreation }) {
  const [failed, setFailed] = useState(false)
  const src = creation.thumbUrl ?? (creation.kind === 'image' ? creation.mediaUrl : null)
  return <span className="home-vibe-preview-art">
    <span className="home-vibe-preview-placeholder" aria-hidden="true">Vibe</span>
    {src && !failed && <img src={src} alt="" width={960} height={600} loading="lazy" decoding="async"
      onError={() => setFailed(true)} />}
  </span>
}

/** The two newest public creations, fetched only as this section approaches.
 *  Native memento links use the same restore path as the creations gallery. */
export default function HomeVibePreviews({ near }: { near: boolean }) {
  const [creations, setCreations] = useState<ListedCreation[] | null>(null)
  useEffect(() => {
    if (!near) return
    let cancelled = false
    void fetchListedCreations().then(list => {
      if (!cancelled) setCreations([...list].sort((a, b) => b.capturedAt - a.capturedAt).slice(0, 2))
    })
    return () => { cancelled = true }
  }, [near])
  return <div className="home-vibe-previews" aria-label="Latest playground creations" aria-busy={creations === null}>
    {[0, 1].map(index => {
      const creation = creations?.[index]
      return <div key={creation?.id ?? index}
        className={`home-vibe-preview home-vibe-preview--${index === 0 ? 'left' : 'right'}`}>
        <a className="home-vibe-piece" href={creation ? `/?memento=${encodeURIComponent(creation.id)}#vibe` : '/#vibe'}
          aria-label={creation ? `See ${index === 0 ? 'the latest' : 'the previous'} creation in the playground` : 'Open the playground'}>
          {creation ? <CreationPreview creation={creation} /> :
            <span className="home-vibe-preview-art home-vibe-preview-empty"><span>{creations === null ? 'Loading creations…' : 'See this in the playground'}</span></span>}
          {creation && <span className="home-vibe-piece-label">See this in the playground</span>}
        </a>
        <div className="home-vibe-preview-caption">
          <span>{creation ? (index === 0 ? 'Latest creation' : 'Previous creation') : 'Playground creations'}</span>
          <a href="/gallery/creations">Browse gallery</a>
        </div>
      </div>
    })}
  </div>
}
