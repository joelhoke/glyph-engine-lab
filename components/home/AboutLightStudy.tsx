'use client'

import { useRef, useState } from 'react'
import copy from '../../content/aboutLightStudy.json'
import LightingSurface from '../lighting/LightingSurface'

type Props = { near: boolean; active: boolean; reducedMotion: boolean }

/** CSS owns the layout; the 3D greeting and artwork follow measured CSS slots. */
export default function AboutLightStudy({ near, active, reducedMotion }: Props) {
  const headingSlot = useRef<HTMLHeadingElement>(null)
  const artworkSlot = useRef<HTMLDivElement>(null)
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')

  return <div className={`home-about-study home-about-study--${status}`}>
    <LightingSurface near={near} active={active} reducedMotion={reducedMotion} className="home-about-study-scene"
      headingSlot={headingSlot} artworkSlot={artworkSlot} onStatusChange={setStatus} />
    <div className="home-about-study-layout">
      <div ref={artworkSlot} className="home-about-study-artwork" role="img" aria-label={status === 'ready' ? 'Joel with his family, beneath an interactive hanging light bulb' : 'Joel with his family'}>
        <div className="home-about-study-preview" aria-hidden="true">
          <img src="/assets/about-light-study/placeholder.webp" alt="" loading="lazy" decoding="async" width={1328} height={1238} />
        </div>
      </div>
      <div className="home-about-study-copy">
        <h2 ref={headingSlot} id="home-about-heading" tabIndex={-1}><span>{copy.heading}</span></h2>
        {copy.paragraphs.map(paragraph => <p key={paragraph}>{paragraph}</p>)}
        <div className="home-about-actions">
          <a className="home-section-action" href="/about">More about me <span aria-hidden="true">↗</span></a>
          <a className="home-section-action" href="/#home/collaborate">Say hello</a>
        </div>
      </div>
    </div>
  </div>
}
