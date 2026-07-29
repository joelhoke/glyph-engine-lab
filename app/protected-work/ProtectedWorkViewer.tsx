'use client'

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import styles from './protected-work.module.css'

/** Manifest shape served by GET /api/protected/work/:id (validated at publish). */
type ProtectedManifest = {
  id: string
  title: string
  summary: string
  sections?: {
    heading: string
    paragraphs?: string[]
    items?: string[]
  }[]
  media?: {
    id: string
    type: 'image' | 'video'
    alt: string
    caption?: string
    width?: number
    height?: number
    poster?: string
    captions?: string
  }[]
}

type ViewerState =
  | { status: 'loading' }
  | { status: 'unauthenticated' }
  | { status: 'not-found' }
  | { status: 'error'; message: string }
  | { status: 'ready'; manifest: ProtectedManifest }

const LOGOUT_URL = '/cdn-cgi/access/logout'

/**
 * Fetches and renders one confidential story. The API sits behind Cloudflare
 * Access with an eight-hour session; a visible logout ends it. Every asset on
 * this page comes from /api/protected/* — no third-party origins, ever.
 */
export default function ProtectedWorkViewer() {
  const searchParams = useSearchParams()
  const storyId = searchParams.get('story') ?? ''
  const [state, setState] = useState<ViewerState>({ status: 'loading' })

  useEffect(() => {
    if (!storyId) {
      setState({ status: 'not-found' })
      return
    }
    let cancelled = false
    setState({ status: 'loading' })
    fetch(`/api/protected/work/${encodeURIComponent(storyId)}`, { credentials: 'same-origin' })
      .then(async (response) => {
        if (cancelled) return
        if (response.status === 401 || response.status === 403) {
          setState({ status: 'unauthenticated' })
          return
        }
        if (response.status === 404 || response.status === 400) {
          setState({ status: 'not-found' })
          return
        }
        if (!response.ok) {
          setState({ status: 'error', message: `The story could not be loaded (${response.status}).` })
          return
        }
        const manifest = (await response.json()) as ProtectedManifest
        setState({ status: 'ready', manifest })
      })
      .catch(() => {
        if (!cancelled) {
          setState({ status: 'error', message: 'The story could not be loaded. Check your connection and try again.' })
        }
      })
    return () => {
      cancelled = true
    }
  }, [storyId])

  return (
    <div className={styles.protectedShell}>
      <header className={styles.protectedHeader}>
        <span className={styles.protectedBrand}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/JHLogo-180.png" alt="" width={34} height={34} />
          joel hoke design — confidential
        </span>
        <a className={styles.protectedLogout} href={LOGOUT_URL}>
          Sign out
        </a>
      </header>
      <main className={styles.protectedMain} id="main-content">
        {state.status === 'loading' && (
          <p className={styles.protectedNotice} role="status">
            Loading the confidential case study…
          </p>
        )}
        {state.status === 'unauthenticated' && (
          <p className={styles.protectedNotice} role="alert">
            This area is private. Use your approved email to sign in through
            the access prompt, then return to this page.
          </p>
        )}
        {state.status === 'not-found' && (
          <p className={styles.protectedNotice} role="alert">
            This case study is not available. The link may be outdated — ask
            for a fresh one.
          </p>
        )}
        {state.status === 'error' && (
          <p className={styles.protectedNotice} role="alert">
            {state.message}
          </p>
        )}
        {state.status === 'ready' && <ManifestView manifest={state.manifest} />}
      </main>
    </div>
  )
}

function ManifestView({ manifest }: { manifest: ProtectedManifest }) {
  return (
    <>
      <h1 className={styles.protectedTitle}>{manifest.title}</h1>
      <p className={styles.protectedSummary}>{manifest.summary}</p>
      {manifest.sections?.map((section) => (
        <section key={section.heading} className={styles.protectedSection}>
          <h2>{section.heading}</h2>
          {section.paragraphs?.map((paragraph, i) => (
            <p key={i}>{paragraph}</p>
          ))}
          {section.items && (
            <ul>
              {section.items.map((item, i) => (
                <li key={i}>{item}</li>
              ))}
            </ul>
          )}
        </section>
      ))}
      {manifest.media?.map((entry) => (
        <figure key={entry.id} className={styles.protectedMedia}>
          {entry.type === 'image' ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={`/api/protected/media/${encodeURIComponent(entry.id)}`}
              alt={entry.alt}
              width={entry.width}
              height={entry.height}
              loading="lazy"
            />
          ) : (
            <video
              src={`/api/protected/media/${encodeURIComponent(entry.id)}`}
              poster={entry.poster}
              width={entry.width}
              height={entry.height}
              controls
              preload="none"
              aria-label={entry.alt}
            >
              {entry.captions && (
                <track kind="captions" src={entry.captions} label="English captions" default />
              )}
            </video>
          )}
          {entry.caption && <figcaption>{entry.caption}</figcaption>}
        </figure>
      ))}
    </>
  )
}
