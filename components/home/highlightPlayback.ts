/** One selected source, persistent visitor intent, and guarded asynchronous play. */
export class HighlightPlayback {
  private active = false
  private reduced = true
  private intent: 'auto' | 'play' | 'pause' = 'auto'
  private blocked = false
  private disposed = false
  private generation = 0
  private position = 0
  private source = ''

  constructor(private video: HTMLVideoElement, private onBlocked: (blocked: boolean) => void) {
    video.muted = true
    video.defaultMuted = true
    video.loop = true
    video.playsInline = true
    video.addEventListener('loadedmetadata', this.restore)
  }

  private shouldPlay() {
    return !this.disposed && this.active && !!this.source && !this.blocked &&
      this.intent !== 'pause' && (!this.reduced || this.intent === 'play')
  }

  private restore = () => {
    if (this.disposed) return
    if (this.position > 0 && Number.isFinite(this.video.duration)) {
      this.video.currentTime = Math.min(this.position, Math.max(0, this.video.duration - 0.05))
    }
  }

  setSource(source: string) {
    if (source === this.source || this.disposed) return
    if (this.video.readyState >= 1) this.position = this.video.currentTime
    this.generation++
    this.video.pause()
    this.source = source
    this.video.src = source
    this.video.load()
    this.sync()
  }

  configure(active: boolean, reduced: boolean) {
    const changed = this.active !== active || this.reduced !== reduced
    // A preference change is a fresh request for stillness; Play can opt in again.
    if (reduced && !this.reduced && this.intent === 'play') this.intent = 'auto'
    this.active = active
    this.reduced = reduced
    if (changed) this.sync()
  }

  play() {
    this.intent = 'play'
    this.blocked = false
    this.onBlocked(false)
    this.sync() // Synchronous play() preserves the button's user activation.
  }

  pause() {
    this.intent = 'pause'
    this.sync()
  }

  private sync() {
    const generation = ++this.generation
    if (!this.shouldPlay()) { this.video.pause(); return }
    this.video.play().then(() => {
      if (!this.shouldPlay()) this.video.pause()
    }).catch((error: unknown) => {
      if (generation !== this.generation || this.disposed) return
      if (error instanceof DOMException && error.name === 'AbortError') return
      this.blocked = true
      this.onBlocked(true)
    })
  }

  dispose() {
    this.disposed = true
    this.generation++
    this.video.pause()
    this.video.removeEventListener('loadedmetadata', this.restore)
    this.video.removeAttribute('src')
    this.video.load()
  }
}
