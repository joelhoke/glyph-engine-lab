/**
 * Single-loop frame scheduler (homepage-redesign phase 3): owns the pending
 * requestAnimationFrame handle for SceneCanvas so the scheduling invariants
 * live in exactly one place and stay headlessly testable:
 *
 * - Never schedule a frame while parked (suspended, or the tab hidden).
 * - At frame start the pending handle is consumed BEFORE any work — a bail
 *   never leaves a stale handle that would double-schedule on resume.
 * - At most one pending frame at any time: renderOnce while pending is a
 *   no-op, so suspend/resume cycles can never fork a second loop.
 * - park() cancels the pending frame; resume() re-arms exactly one.
 * - keepRunning() === false (reduced motion) renders one representative
 *   frame, then the loop parks itself.
 *
 * The rAF/cAF functions are injectable so node tests can drive the loop
 * without a browser.
 */
export type FrameLoopOptions = {
  /** One frame of work. Only ever called while running and not parked. */
  frame: (now: number) => void
  /** Whether the loop reschedules after a frame — false under reduced
   *  motion (one settled frame, then park). Read live after each frame. */
  keepRunning: () => boolean
  /** Parked = suspended || document.hidden. Read live at every decision. */
  isParked: () => boolean
  requestFrame?: (callback: (now: number) => void) => number
  cancelFrame?: (handle: number) => void
}

export type FrameLoop = {
  /** Re-arm a single frame when the loop is stopped; no-op while a frame is
   *  pending or while parked. Every config/theme/source/resize path in
   *  SceneCanvas re-arms through here. */
  renderOnce: () => void
  /** Park now: cancel any pending frame (suspend path). */
  park: () => void
  /** Unpark: re-arm exactly one frame if none is pending (resume path; the
   *  caller resets stale timing/velocity samples first). */
  resume: () => void
  /** Whether a frame is currently scheduled (diagnostics/tests). */
  isPending: () => boolean
  /** Cancel and detach — the loop can never fire again. */
  dispose: () => void
}

export function createFrameLoop(options: FrameLoopOptions): FrameLoop {
  const requestFrame =
    options.requestFrame ?? ((callback: (now: number) => void) => requestAnimationFrame(callback))
  const cancelFrame = options.cancelFrame ?? ((handle: number) => cancelAnimationFrame(handle))
  let pending: number | null = null
  let disposed = false

  const tick = (now: number) => {
    // Consume the handle first: whatever happens below, `pending` reflects
    // reality and renderOnce can re-arm cleanly.
    pending = null
    if (disposed || options.isParked()) return
    options.frame(now)
    if (disposed || options.isParked() || !options.keepRunning()) return
    pending = requestFrame(tick)
  }

  const renderOnce = () => {
    if (disposed || options.isParked()) return
    if (pending === null) pending = requestFrame(tick)
  }

  return {
    renderOnce,
    park: () => {
      if (pending !== null) {
        cancelFrame(pending)
        pending = null
      }
    },
    resume: renderOnce,
    isPending: () => pending !== null,
    dispose: () => {
      disposed = true
      if (pending !== null) {
        cancelFrame(pending)
        pending = null
      }
    },
  }
}
