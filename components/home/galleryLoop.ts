/** Equivalent offset in the middle copy, preserving the visible project. */
export function galleryLoopOffset(offset: number, period: number, copiesBefore = 2): number {
  if (period <= 0) return 0
  const origin = period * copiesBefore
  // WebKit can round scrollLeft just below the fractional origin. Match the
  // carousel's 1px settle tolerance so modulo cannot send it around again.
  if (Math.abs(offset - origin) <= 1) return origin
  return origin + ((offset - origin) % period + period) % period
}
