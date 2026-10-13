/** One-shot layout animation for the shared physical cases. No frame loop or image clones. */
export function captureMediaPile(pile: HTMLElement) {
  return new Map(Array.from(pile.querySelectorAll<HTMLElement>('[data-media-case]')).map(element =>
    [element.dataset.mediaCase!, element.getBoundingClientRect()] as const))
}
export type MediaPileSnapshot = ReturnType<typeof captureMediaPile>

export function unfoldMediaCases(track: HTMLElement, origin: MediaPileSnapshot) {
  const animations: Animation[] = []
  const sourceStack = [...origin.values()]
  const fallback = sourceStack.at(-1)
  if (!fallback || typeof track.animate !== 'function') return () => {}
  const viewport = track.getBoundingClientRect()
  // Read all destinations before animation writes, so layout is measured just once.
  const cases = Array.from(track.querySelectorAll<HTMLElement>('[data-media-case]')).map(element => ({
    element, stand: element.parentElement!, destination: element.getBoundingClientRect(),
    container: element.parentElement!.getBoundingClientRect(),
  }))
  for (const [index, { element, stand, destination, container }] of cases.entries()) {
    if (!destination.width || !destination.height || destination.left > viewport.right) continue
    const source = origin.get(element.dataset.mediaCase!) ?? fallback
    if (!source.width || !source.height) continue
    const sx = source.width / destination.width, sy = source.height / destination.height
    const dx = source.left - container.left - sx * (destination.left - container.left)
    const dy = source.top - container.top - sy * (destination.top - container.top)
    const animation = stand.animate([
      { transform: `translate(${dx}px, ${dy}px) scale(${sx}, ${sy})`, opacity: origin.has(element.dataset.mediaCase!) ? 1 : 0 },
      { transform: 'translate(0px, 0px) scale(1, 1)', opacity: 1 },
    ], { duration: 680, delay: Math.min(index, 6) * 45, easing: 'cubic-bezier(.18,.75,.2,1)', fill: 'both' })
    animation.onfinish = () => animation.cancel()
    animations.push(animation)
  }
  const cancel = () => animations.forEach(animation => animation.cancel())
  // Direct manipulation takes precedence over an entrance animation.
  track.addEventListener('wheel', cancel, { passive: true })
  track.addEventListener('pointerdown', cancel, { passive: true })
  track.addEventListener('keydown', cancel)
  window.addEventListener('resize', cancel)
  return () => {
    cancel()
    track.removeEventListener('wheel', cancel)
    track.removeEventListener('pointerdown', cancel)
    track.removeEventListener('keydown', cancel)
    window.removeEventListener('resize', cancel)
  }
}
