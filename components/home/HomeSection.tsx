'use client'

import { GLOBAL_OPERATIONS_REEL_POSTER } from '../../content/workMedia'

import { useEffect, useRef, useState } from 'react'
import type { HomeSectionContent, HomeSectionId } from '../../content/home'
import { COLLABORATE_AI_GUIDE, COLLABORATE_CONTACT, COLLABORATE_SHOW_STARTERS, CONVERSATION_STARTERS } from '../../content/collaborate'
import { isGuideLimitReached } from '../collaborate/guideConversation'
import { HeroThreeObject } from './renderers/HeroThreeObject'
import type { ScreenContent, ScreenPlaybackControls, ScreenPlaybackState } from './renderers/screenContent'
import { useReducedMotion } from './HeroObject'
import { useSectionVisibility } from './useSectionVisibility'
import HomeGalleryCarousel from './HomeGalleryCarousel'
import AboutLightStudy from './AboutLightStudy'
import type { HomeGalleryProject } from './galleryProjects'
import HomeVibePreviews from './HomeVibePreviews'
import HomePhoneChat, { HomeGuideBridge } from './HomePhoneChat'
import { usePhoneKeypad } from './usePhoneKeypad'
import { PHONE_SECTION_POSES } from './renderers/phoneSectionPose'

const WORK_REEL: Extract<ScreenContent, { kind: 'video' }> = {
  kind: 'video', src: '/assets/work/RealComm-Highlights-h264.mp4',
  poster: GLOBAL_OPERATIONS_REEL_POSTER, fit: 'cover',
}
const WORK_ROTATION = { x: 10, y: -12 }
const PORTRAIT_ROTATION = { x: -1, y: -65 }

type HomeSectionProps = {
  id: HomeSectionId
  section: HomeSectionContent
  enabled: boolean
  galleryProjects: HomeGalleryProject[]
  guide: HomeGuideBridge
}

/** Existing hash targets remain intact; each section owns its visibility gate. */
export default function HomeSection({ id, section, enabled, galleryProjects, guide }: HomeSectionProps) {
  const { ref, near, active } = useSectionVisibility(enabled)
  const reducedMotion = useReducedMotion()
  const onPhoneKey = usePhoneKeypad(guide)
  const [unavailable, setUnavailable] = useState(false)
  const [iphoneUnavailable, setIphoneUnavailable] = useState(false)
  const [reelPaused, setReelPaused] = useState(false)
  const [reelState, setReelState] = useState<ScreenPlaybackState>('loading')
  const reelControls = useRef<ScreenPlaybackControls | null>(null)
  const phoneRef = useRef<HTMLDivElement>(null)
  const startersDisabled = !guide.state || guide.state.status === 'pending' || isGuideLimitReached(guide.state)
  const toggleReel = () => {
    const pause = reelState === 'playing'
    if (pause) reelControls.current?.pause()
    else reelControls.current?.play()
    setReelPaused(pause)
  }
  const [mobile, setMobile] = useState(false)
  useEffect(() => {
    if (id !== 'collaborate') return
    const query = window.matchMedia('(max-width: 767px)')
    const update = () => setMobile(query.matches)
    update()
    query.addEventListener('change', update)
    return () => query.removeEventListener('change', update)
  }, [id])
  const heading = <h2 id={`home-${id}-heading`} tabIndex={-1} className="home-section-heading">{section.heading}</h2>
  const action = <a className="home-section-action" href={section.action.href}>{section.action.label}</a>
  const modelProps = { active, reducedMotion, presentation: 'section' as const, highlighted: true,
    onUnavailable: () => setUnavailable(true) }

  return <section ref={ref} aria-labelledby={`home-${id}-heading`} className={`home-section home-section--${id}`}>
    {id === 'about' && <div id="home/about" className="home-about-layout home-section-anchor">
      <AboutLightStudy near={near} active={active} reducedMotion={reducedMotion} />
    </div>}
    {id === 'work' && <div id={`home/${id}`} className="home-section-inner home-work-layout home-section-anchor">
      <figure className="home-work-object">
        <div className="home-work-stage">
          {near && !unavailable ? <HeroThreeObject {...modelProps} variant="work" screenContent={WORK_REEL}
            rotationOverride={WORK_ROTATION} playbackPaused={reelPaused}
            playbackControls={reelControls} onPlaybackState={setReelState} /> :
            <img className="home-work-poster" src={WORK_REEL.poster} loading="lazy" alt="Microsoft Global Operations highlight reel" width={1920} height={1080} />}
          {near && !unavailable && <button type="button" className="home-work-playback-target"
            onClick={toggleReel}
            aria-label={reelState === 'playing' ? 'Pause highlight reel' : 'Play highlight reel'} />}
          <div className="home-work-iphone" role="img" aria-label="Employee experience dashboard on an iPhone">
            {near && !iphoneUnavailable
              ? <HeroThreeObject {...modelProps} variant="iphone" onUnavailable={() => setIphoneUnavailable(true)} />
              : <img src="/assets/work/employee-experience-dashboard.webp" alt="" loading="lazy" width={744} height={1624} />}
          </div>
        </div>
        <figcaption className="home-object-caption">
          <span>Microsoft Global Operations · RealComm highlights</span>
          {reelState === 'error' && <a href={WORK_REEL.src}>Open the reel</a>}
          <a href="/#work/microsoft-global-operations">View the case study</a>
        </figcaption>
      </figure>
      <div className="home-section-copy">
        {heading}
        <p className="home-section-lede">{section.lede}</p>
        <p className="home-section-intro">{section.introduction}</p>
        {section.paragraphs?.map(paragraph => <p key={paragraph} className="home-section-intro">{paragraph}</p>)}
        {action}
      </div>
    </div>}

    {id === 'vibe' && <div id="home/vibe" className="home-section-inner home-vibe-layout home-section-anchor">
      <div className="home-section-copy home-section-copy--center">
        {heading}
        <p className="home-section-lede">{section.lede}</p>
        <p className="home-section-intro">{section.introduction}</p>
      </div>
      <div className="home-vibe-stage">
        <HomeVibePreviews near={near} />
        <div className="home-vibe-brush" aria-hidden="true">
          {near && !unavailable && <HeroThreeObject {...modelProps} variant="vibe" modelScale={0.5} />}
        </div>
      </div>
      <div className="home-section-copy--center">{action}</div>
    </div>}

    {id === 'gallery' && <HomeGalleryCarousel projects={galleryProjects}
      introduction={<div>
        {heading}
        <p className="home-section-intro">{section.introduction}</p>
      </div>}
      action={action}
      portrait={near && !unavailable && <HeroThreeObject {...modelProps} variant="gallery" rotationOverride={PORTRAIT_ROTATION} />}
    />}

    {id === 'collaborate' && <div className="home-section-inner home-collaborate-layout">
      <div id={`home/${id}`} className="home-section-copy home-section-anchor">
        {heading}
        <p className="home-section-lede">{section.lede}</p>
        <p className="home-section-intro">{COLLABORATE_AI_GUIDE
          ? 'Ask about my work, how I think, or where I could help. Start right here on the phone, or give the conversation a little more room.'
          : section.introduction}</p>
        {COLLABORATE_AI_GUIDE && COLLABORATE_SHOW_STARTERS && <div className="home-conversation-starters" role="group" aria-label="Start a conversation on the phone">
          {CONVERSATION_STARTERS.map(starter => <button key={starter.id} type="button"
            className="home-section-action" disabled={startersDisabled} aria-controls="home-collaborate-phone"
            onClick={() => {
              guide.onStartStarter(starter.id)
              if (mobile) phoneRef.current?.scrollIntoView({ behavior: reducedMotion ? 'instant' : 'smooth', block: 'start' })
            }}>{starter.label}</button>)}
        </div>}
        <a className="home-direct-contact" href={COLLABORATE_CONTACT.mailtoUrl}>Or say hello to me directly</a>
      </div>
      <div id="home-collaborate-phone" ref={phoneRef} className="home-collaborate-phone">
        {near && !unavailable ? <HeroThreeObject {...modelProps} variant="collaborate" rotationOverride={PHONE_SECTION_POSES[mobile ? 'mobile' : 'desktop']}
          screenOverlay={COLLABORATE_AI_GUIDE ? <HomePhoneChat guide={guide} /> : undefined}
          onPhoneKey={COLLABORATE_AI_GUIDE ? onPhoneKey : undefined} /> :
          COLLABORATE_AI_GUIDE && <div className="home-phone-fallback"><HomePhoneChat guide={guide} /></div>}
      </div>
    </div>}
  </section>
}
