'use client'

/**
 * Playground creations stack page (feature/vibe-creations): the archived vibe
 * compositions, client-fetched from /api/creations. Each thumbnail opens the
 * full-screen media preview (the shared WorkMediaLightbox); its caption and
 * the card link both carry the "Open in playground" jump (/?memento=<id>#vibe)
 * that restores the piece in the live playground for remixing.
 *
 * Moderation: a faint "Moderate" link at the foot of the page opens a
 * password prompt (/api/creations/moderate — PBKDF2 record in
 * CREATIONS_ADMIN_PASSWORD, HMAC cookie session). Once authed, a "Pending
 * review" section at the foot lists unlisted saves with Approve / Delete, and
 * listed cards gain Unlist. The header renders statically; everything else waits on
 * the fetches, and failures degrade to the same quiet note as an empty
 * archive.
 */

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  fetchListedCreations,
  fetchPendingCreations,
  ListedCreation,
  moderateCreation,
  moderateLogin,
  ModerationAction,
} from '../../engine/creationClient'
import type { WorkMedia } from '../../content/work'
import WorkMediaLightbox from '../work/WorkMediaLightbox'
import styles from './gallery.module.css'

const KIND_LABELS: Record<ListedCreation['kind'], string> = {
  auto: 'Auto-save',
  image: 'Image',
  clip: 'Clip',
}

function formatCapturedAt(capturedAt: number): string {
  try {
    return new Date(capturedAt * 1000).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  } catch {
    return ''
  }
}

/** Map an archived creation onto the shared lightbox media shape. The caption
 *  action is the jump back into the live playground. */
function toLightboxMedia(creation: ListedCreation): WorkMedia {
  const caption = `Saved from the vibe playground · ${formatCapturedAt(creation.capturedAt)}`
  const captionAction = {
    href: `/?memento=${encodeURIComponent(creation.id)}#vibe`,
    label: 'Open in playground',
  }
  if (creation.kind === 'clip' && creation.mediaUrl) {
    return {
      kind: 'video',
      id: creation.id,
      src: creation.mediaUrl,
      width: 1280,
      height: 720,
      alt: 'Recorded clip of a vibe playground creation',
      caption,
      captionAction,
      poster: creation.thumbUrl ?? '',
      transcript: 'Ambient playground capture — no dialogue.',
    }
  }
  return {
    kind: 'image',
    id: creation.id,
    src: creation.thumbUrl ?? '',
    width: 640,
    height: 400,
    alt: 'Vibe playground creation',
    caption,
    captionAction,
  }
}

function CreationThumb({
  creation,
  onPreview,
  triggerRef,
}: {
  creation: ListedCreation
  onPreview: () => void
  triggerRef: React.MutableRefObject<HTMLButtonElement | null>
}) {
  return (
    <button
      type="button"
      className={styles.creationThumbButton}
      onClick={(event) => {
        triggerRef.current = event.currentTarget
        onPreview()
      }}
      aria-label={`Preview creation from ${formatCapturedAt(creation.capturedAt)}`}
    >
      {creation.thumbUrl ? (
        <img className={styles.cardThumb} src={creation.thumbUrl} alt="" loading="lazy" />
      ) : null}
      {creation.kind === 'clip' ? (
        <span className={styles.creationPlayBadge} aria-hidden="true">
          ▶
        </span>
      ) : null}
    </button>
  )
}

export default function CreationsGallery() {
  const [creations, setCreations] = useState<ListedCreation[] | null>(null)
  const [openIndex, setOpenIndex] = useState<number | null>(null)
  const triggerRef = useRef<HTMLButtonElement | null>(null)

  // Moderation: 'off' → visitor view, 'login' → password prompt, 'on' → authed.
  const [moderate, setModerate] = useState<'off' | 'login' | 'on'>('off')
  const [password, setPassword] = useState('')
  const [loginFailed, setLoginFailed] = useState(false)
  const [pending, setPending] = useState<ListedCreation[] | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

  const refreshListed = useCallback(() => {
    fetchListedCreations().then(setCreations)
  }, [])
  const refreshPending = useCallback(() => {
    fetchPendingCreations().then((list) => setPending(list ?? []))
  }, [])

  useEffect(() => {
    refreshListed()
  }, [refreshListed])

  const media = useMemo(() => (creations ?? []).map(toLightboxMedia), [creations])

  const enterModerate = () => {
    // A live cookie from an earlier session skips the prompt entirely.
    fetchPendingCreations().then((list) => {
      if (list !== null) {
        setPending(list)
        setModerate('on')
      } else {
        setModerate('login')
      }
    })
  }

  const submitLogin = (event: React.FormEvent) => {
    event.preventDefault()
    setLoginFailed(false)
    moderateLogin(password).then((ok) => {
      if (!ok) {
        setLoginFailed(true)
        return
      }
      setPassword('')
      setModerate('on')
      refreshPending()
    })
  }

  const runAction = (id: string, action: ModerationAction) => {
    if (action === 'delete' && !window.confirm('Delete this creation permanently?')) return
    setBusyId(id)
    moderateCreation(id, action).then((ok) => {
      setBusyId(null)
      if (!ok) return
      refreshListed()
      refreshPending()
    })
  }

  return (
    <>
      <Link href="/gallery" className={styles.backLink}>
        ← Gallery
      </Link>
      <h1 className={styles.title}>Playground creations</h1>
      <p className={styles.intro}>
        A growing collection of pieces from the vibe playground — some made by me, some
        by visitors passing through. If one catches your eye, open it in the playground
        and take it somewhere new, or start from a blank canvas and make something
        entirely your own.
      </p>
      {creations === null ? null : creations.length === 0 ? (
        <p className={styles.intro}>
          Nothing archived yet — the first pieces are waiting to be made in the playground.
        </p>
      ) : (
        <ul className={styles.cardGrid}>
          {creations.map((creation, index) => (
            <li key={creation.id}>
              <article className={styles.card}>
                <CreationThumb
                  creation={creation}
                  triggerRef={triggerRef}
                  onPreview={() => setOpenIndex(index)}
                />
                <div className={`${styles.cardBody} ${styles.creationCardBody}`}>
                  <span className={styles.cardTier}>{KIND_LABELS[creation.kind]}</span>
                  <span className={styles.cardTitle}>
                    {formatCapturedAt(creation.capturedAt)}
                  </span>
                  <a
                    className={styles.creationOpenLink}
                    href={`/?memento=${encodeURIComponent(creation.id)}#vibe`}
                  >
                    Open in playground
                  </a>
                  {moderate === 'on' ? (
                    <span className={styles.creationActions}>
                      <button
                        type="button"
                        className={styles.creationActionButton}
                        disabled={busyId === creation.id}
                        onClick={() => runAction(creation.id, 'unlist')}
                      >
                        Unlist
                      </button>
                    </span>
                  ) : null}
                </div>
              </article>
            </li>
          ))}
        </ul>
      )}
      {moderate === 'on' && pending !== null ? (
        <section className={styles.pendingSection} aria-labelledby="pending-heading">
          <h2 id="pending-heading" className={styles.pendingTitle}>
            Pending review ({pending.length})
          </h2>
          {pending.length === 0 ? (
            <p className={styles.intro}>Nothing waiting — the queue is clear.</p>
          ) : (
            <ul className={styles.cardGrid}>
              {pending.map((creation) => (
                <li key={creation.id}>
                  <article className={styles.card}>
                    {creation.thumbUrl ? (
                      <img
                        className={styles.cardThumb}
                        src={creation.thumbUrl}
                        alt=""
                        loading="lazy"
                      />
                    ) : null}
                    <div className={`${styles.cardBody} ${styles.creationCardBody}`}>
                      <span className={styles.cardTier}>{KIND_LABELS[creation.kind]}</span>
                      <span className={styles.cardTitle}>
                        {formatCapturedAt(creation.capturedAt)}
                      </span>
                      <span className={styles.creationActions}>
                        <button
                          type="button"
                          className={styles.creationActionButton}
                          disabled={busyId === creation.id}
                          onClick={() => runAction(creation.id, 'list')}
                        >
                          Approve
                        </button>
                        <button
                          type="button"
                          className={`${styles.creationActionButton} ${styles.creationActionDanger}`}
                          disabled={busyId === creation.id}
                          onClick={() => runAction(creation.id, 'delete')}
                        >
                          Delete
                        </button>
                      </span>
                    </div>
                  </article>
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}
      {moderate !== 'on' ? (
        <div className={styles.moderateFooter}>
          {moderate === 'off' ? (
            <button type="button" className={styles.moderateToggle} onClick={enterModerate}>
              Moderate
            </button>
          ) : (
            <form className={styles.moderateForm} onSubmit={submitLogin}>
              <input
                type="password"
                className={styles.moderateInput}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Admin password"
                aria-label="Admin password"
                autoComplete="current-password"
                // eslint-disable-next-line jsx-a11y/no-autofocus
                autoFocus
              />
              <button type="submit" className={styles.creationActionButton}>
                Sign in
              </button>
              {loginFailed ? (
                <span className={styles.moderateError}>Incorrect password.</span>
              ) : null}
            </form>
          )}
        </div>
      ) : null}
      {openIndex !== null && media.length > 0 ? (
        <WorkMediaLightbox
          media={media}
          startIndex={openIndex}
          storyTitle="Playground creations"
          onClose={() => setOpenIndex(null)}
          triggerRef={triggerRef}
        />
      ) : null}
    </>
  )
}
