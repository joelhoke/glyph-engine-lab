/** Equivalent offset in the middle copy, preserving the visible project. */
export function galleryLoopOffset(offset: number, period: number, copiesBefore = 2): number {
  if (period <= 0) return 0
  const origin = period * copiesBefore
  return origin + ((offset - origin) % period + period) % period
}
