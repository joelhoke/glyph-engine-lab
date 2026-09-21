'use client'

import { createFrameLoop, FrameLoop } from '../../../engine/frameLoop'

/**
 * Screen content compositor for the hero's object screens (CRT, phone, …).
 * One canvas per screen; the host renderer wraps it in a CanvasTexture and
 * maps it onto the screen surface. Content config lives with the renderer
 * registration (never in serializable home content).
 *
 * Parking discipline (engine/frameLoop.ts): static kinds paint once;
 * slides/video run the painter's own parked loop only while active and
 * animating — parked when the object parks (hero offscreen, menu covered),
 * and reduced motion yields a static first frame / poster.
 */
export type ScreenContent =
  | { kind: 'artifact-logo' }
  | { kind: 'slides'; images: string[]; intervalMs?: number }
  | { kind: 'video'; src: string; poster?: string; fit?: 'cover' | 'contain' }

export type ScreenPlaybackState = 'loading' | 'playing' | 'paused' | 'blocked' | 'error'
export type ScreenPlaybackControls = { play: () => void; pause: () => void }

export type ScreenPainter = {
  /** Call directly from a click/tap so restricted browsers retain user activation. */
  play?: () => void
  pause?: () => void
  /** The canvas content is drawn into (wrap in a CanvasTexture). */
  canvas: HTMLCanvasElement
  /** True while the content needs continuous frames (video playing, a
   *  crossfade in flight) — read by the host's keepRunning. */
  needsFrames: () => boolean
  /** Paint the current state immediately (first frame / static content). */
  paintNow: () => void
  /** Park/unpark alongside the host object. */
  setActive: (active: boolean) => void
  setReducedMotion: (reduced: boolean) => void
  dispose: () => void
}

type PainterOptions = {
  width: number
  height: number
  /** Called after each repaint so the host re-renders with the new texture. */
  requestFrame: () => void
  /** Terminal content failure (video unloadable, missing images). */
  onError?: () => void
  onPlaybackState?: (state: ScreenPlaybackState) => void
}

/** The artifacted Microsoft-logo recipe (BBC MODE 2 flavor): chunky
 *  nearest-neighbor quadrants, phosphor bleed, scanlines, tube vignette. */
export function paintArtifactLogo(ctx: CanvasRenderingContext2D, width: number, height: number) {
  const cell = Math.max(2, Math.round(width / 32))
  ctx.filter = 'none'
  ctx.globalAlpha = 1
  ctx.fillStyle = '#101018'
  ctx.fillRect(0, 0, width, height)
  const quadW = 7 * cell
  const quadH = 6 * cell
  const gutter = cell
  const logoW = quadW * 2 + gutter
  const logoH = quadH * 2 + gutter
  const left = Math.round((width - logoW) / 2)
  const top = Math.round((height - logoH) / 2)
  const drawLogo = (alpha: number, blur: boolean) => {
    ctx.save()
    ctx.globalAlpha = alpha
    if (blur) ctx.filter = 'blur(3px)'
    const quads = [
      { color: '#ff3b30', cx: 0, cy: 0 }, // MODE 2 red
      { color: '#33d17a', cx: 1, cy: 0 }, // MODE 2 green
      { color: '#2d7ff9', cx: 0, cy: 1 }, // MODE 2 blue
      { color: '#ffd60a', cx: 1, cy: 1 }, // MODE 2 yellow
    ]
    for (const { color, cx, cy } of quads) {
      ctx.fillStyle = color
      ctx.fillRect(left + cx * (quadW + gutter), top + cy * (quadH + gutter), quadW, quadH)
    }
    ctx.restore()
  }
  drawLogo(0.55, true) // phosphor bleed
  drawLogo(1, false) // sharp chunky pixels
  // Scanlines: fine dark rows plus a coarser per-cell interlace read.
  ctx.fillStyle = 'rgba(0, 0, 0, 0.22)'
  for (let y = 0; y < height; y += 3) ctx.fillRect(0, y, width, 1)
  ctx.fillStyle = 'rgba(0, 0, 0, 0.28)'
  for (let y = 0; y < height; y += cell) ctx.fillRect(0, y, width, 1)
  // Soft vignette toward the tube edges.
  const vignette = ctx.createRadialGradient(
    width / 2,
    height / 2,
    Math.min(width, height) * 0.3,
    width / 2,
    height / 2,
    Math.max(width, height) * 0.62,
  )
  vignette.addColorStop(0, 'rgba(0,0,0,0)')
  vignette.addColorStop(1, 'rgba(0,0,0,0.42)')
  ctx.fillStyle = vignette
  ctx.fillRect(0, 0, width, height)
}

const SLIDE_FADE_MS = 400

export function createScreenPainter(content: ScreenContent, options: PainterOptions): ScreenPainter {
  const canvas = document.createElement('canvas')
  canvas.width = options.width
  canvas.height = options.height
  const ctx = canvas.getContext('2d')

  let active = true
  let reducedMotion = false
  let explicitPlayback = false
  const motionAllowed = () => !reducedMotion || (content.kind === 'video' && explicitPlayback)
  let disposed = false
  let failed = false
  const fail = () => {
    if (failed || disposed) return
    failed = true
    options.onError?.()
  }

  // The painter's own parked loop (same discipline as the host's): runs only
  // while the content genuinely animates.
  let loop: FrameLoop | null = null
  let needs = false
  const ensureLoop = () => {
    if (loop) return
    loop = createFrameLoop({
      frame: () => {
        advance()
        options.requestFrame()
      },
      keepRunning: () => needs,
      isParked: () => !active || !motionAllowed(),
    })
  }
  const setNeeds = (next: boolean) => {
    needs = next
    if (!next) loop?.park()
    if (next && active && motionAllowed()) {
      ensureLoop()
      loop?.renderOnce()
    }
  }

  // --- slides state -----------------------------------------------------------
  const slideImages: HTMLImageElement[] = []
  let slideIndex = 0
  let slideFade: { from: number; to: number; progress: number } | null = null
  let slideTimer: number | null = null

  const drawCover = (img: HTMLImageElement, alpha: number) => {
    if (!ctx || !img.complete || img.naturalWidth === 0) return
    ctx.globalAlpha = alpha
    const scale = Math.max(canvas.width / img.width, canvas.height / img.height)
    const w = img.width * scale
    const h = img.height * scale
    ctx.drawImage(img, (canvas.width - w) / 2, (canvas.height - h) / 2, w, h)
    ctx.globalAlpha = 1
  }

  // --- video state -------------------------------------------------------------
  let video: HTMLVideoElement | null = null
  let poster: HTMLImageElement | null = null
  let playbackState: ScreenPlaybackState = 'loading'
  let playGeneration = 0
  let playPending = false
  const reportPlayback = (state: ScreenPlaybackState) => {
    if (disposed) return
    playbackState = state
    options.onPlaybackState?.(state)
  }

  const drawVideoFrame = (source: CanvasImageSource, width: number, height: number) => {
    if (!ctx || !width || !height) return
    const fit = content.kind === 'video' && content.fit === 'contain' ? Math.min : Math.max
    const scale = fit(canvas.width / width, canvas.height / height)
    ctx.fillStyle = '#03080d'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.drawImage(source, (canvas.width - width * scale) / 2,
      (canvas.height - height * scale) / 2, width * scale, height * scale)
  }

  const advance = () => {
    if (!ctx) return
    if (content.kind === 'slides') {
      if (slideFade) {
        slideFade.progress = Math.min(1, slideFade.progress + 16 / SLIDE_FADE_MS)
        if (slideFade.progress >= 1) {
          slideIndex = slideFade.to
          slideFade = null
          setNeeds(false)
        }
      }
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      if (slideFade) {
        drawCover(slideImages[slideFade.from], 1)
        drawCover(slideImages[slideFade.to], slideFade.progress)
      } else {
        drawCover(slideImages[slideIndex], 1)
      }
      return
    }
    if (content.kind === 'video') {
      if ((!motionAllowed() || !video || video.readyState < 2) && poster?.complete && poster.naturalWidth) {
        drawVideoFrame(poster, poster.naturalWidth, poster.naturalHeight)
      } else if (video && video.readyState >= 2) {
        drawVideoFrame(video, video.videoWidth, video.videoHeight)
      }
    }
  }

  const paintNow = () => {
    advance()
    options.requestFrame()
  }

  const startVideo = (manual = false) => {
    if (!video || disposed || !active || !motionAllowed() || playPending) return
    if (!manual && (playbackState === 'blocked' || playbackState === 'error')) return
    if (!video.paused && needs) return
    const playing = video
    const ticket = ++playGeneration
    playPending = true
    reportPlayback('loading')
    // play() initiates loading too; waiting for canplay first can deadlock
    // browsers that defer decoding until a playback request/user gesture.
    void playing
      .play()
      .then(() => {
        if (disposed || !active || !motionAllowed()) { playing.pause(); return }
        if (ticket !== playGeneration) return
        playPending = false
        reportPlayback('playing')
        setNeeds(true)
      })
      .catch((error: { name?: string }) => {
        if (disposed || ticket !== playGeneration) return
        playPending = false
        setNeeds(false)
        reportPlayback(error?.name === 'NotSupportedError' ? 'error' : 'blocked')
      })
  }
  const pauseVideo = () => {
    playGeneration += 1
    playPending = false
    video?.pause()
    setNeeds(false)
    reportPlayback('paused')
  }

  // --- kind setup ----------------------------------------------------------------
  if (content.kind === 'slides') {
    const intervalMs = content.intervalMs ?? 4000
    for (const src of content.images) {
      const img = new Image()
      img.onerror = fail
      img.src = src
      slideImages.push(img)
    }
    const startTimer = () => {
      if (slideTimer !== null || slideImages.length < 2) return
      slideTimer = window.setInterval(() => {
        if (!active || reducedMotion || failed) return
        slideFade = { from: slideIndex, to: (slideIndex + 1) % slideImages.length, progress: 0 }
        setNeeds(true)
      }, intervalMs)
    }
    const stopTimer = () => {
      if (slideTimer !== null) {
        window.clearInterval(slideTimer)
        slideTimer = null
      }
    }
    // Start cycling immediately — the painter defaults to active/non-reduced
    // (the host re-asserts both right after build).
    startTimer()
    return {
      canvas,
      needsFrames: () => needs,
      paintNow,
      setActive: (next) => {
        active = next
        if (next && !reducedMotion) startTimer()
        else stopTimer()
      },
      setReducedMotion: (next) => {
        reducedMotion = next
        if (next) {
          stopTimer()
          slideFade = null
          setNeeds(false)
          paintNow() // static first slide
        } else if (active) {
          startTimer()
        }
      },
      dispose: () => {
        disposed = true
        stopTimer()
        loop?.dispose()
        loop = null
      },
    }
  }

  if (content.kind === 'video') {
    video = document.createElement('video')
    video.muted = true
    video.defaultMuted = true
    video.loop = true
    video.playsInline = true
    video.setAttribute('muted', '')
    video.setAttribute('playsinline', '')
    video.preload = 'auto'
    if (content.poster) {
      video.poster = content.poster
      poster = new Image()
      poster.onload = () => { if (!disposed) paintNow() }
      poster.src = content.poster
    }
    video.addEventListener('error', () => {
      if (disposed) return
      playGeneration += 1
      playPending = false
      setNeeds(false)
      reportPlayback('error')
      fail()
    })
    video.addEventListener('pause', () => {
      if (disposed) return
      setNeeds(false)
      reportPlayback('paused')
    })
    video.addEventListener('canplay', () => {
      if (disposed) return
      paintNow()
      if (active && motionAllowed()) startVideo()
    })
    // Attach events and playback attributes before beginning the request.
    video.src = content.src
    video.load()
    return {
      canvas,
      play: () => { explicitPlayback = true; startVideo(true) },
      pause: () => { explicitPlayback = false; pauseVideo() },
      needsFrames: () => needs,
      paintNow,
      setActive: (next) => {
        active = next
        if (next && motionAllowed()) startVideo()
        else pauseVideo()
      },
      setReducedMotion: (next) => {
        reducedMotion = next
        if (next) {
          explicitPlayback = false
          pauseVideo()
          paintNow() // poster / first frame
        } else if (active) {
          startVideo()
        }
      },
      dispose: () => {
        disposed = true
        pauseVideo()
        if (video) { video.removeAttribute('src'); video.load() }
        video = null
        if (poster) { poster.onload = null; poster = null }
        loop?.dispose()
        loop = null
      },
    }
  }

  // artifact-logo: static, one paint.
  return {
    canvas,
    needsFrames: () => false,
    paintNow: () => {
      if (!ctx) return
      paintArtifactLogo(ctx, canvas.width, canvas.height)
      options.requestFrame()
    },
    setActive: (next) => {
      active = next
    },
    setReducedMotion: () => {},
    dispose: () => {
      disposed = true
      loop?.dispose()
      loop = null
    },
  }
}
