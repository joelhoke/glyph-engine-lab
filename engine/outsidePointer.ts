/** Share outside-press dismissal without adding a backdrop that intercepts clicks. */
export function listenForOutsidePointer(
  inside: () => readonly (Node | null | undefined)[],
  dismiss: () => void,
): () => void {
  const handlePointerDown = (event: PointerEvent) => {
    const target = event.target
    if (!(target instanceof Node)) return
    if (inside().some(element => element?.contains(target))) return
    dismiss()
  }
  document.addEventListener('pointerdown', handlePointerDown, true)
  return () => document.removeEventListener('pointerdown', handlePointerDown, true)
}
