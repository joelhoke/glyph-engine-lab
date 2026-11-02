/** Site-only framing and motion; geometry/shader are extracted from Three.Gradient. */
export const STATEMENT_FLOWER = {
  // Exactly three varieties. Stops are viewport-passage fractions, ordered 0–1.
  sequence: ['plumeria', 'rose', 'daisy'] as const,
  stops: [0.1, 0.45, 0.55, 0.9] as const,
  // Shader supports 2–8 colors; cyclic stops are generated at index / count.
  palette: ['#C05F90', '#524C8C', '#7374A5', '#3B9EC8', '#F4F4F3'],
  gradient: { mode: 'noise' as const, scope: 'element' as const, scale: 1.2, softness: 0.85, direction: 0, phase: 0, speed: 0.055, noise: 0.35 },
  geometry: { petals: 5, length: 1, bend: 0.3 },
  framing: {
    // size/parallax: CSS pixels; width: viewport fraction; right: size fraction.
    // More negative right crops more of the flower at the section's right edge.
    desktop: { size: 720, width: 0.64, right: -0.24, parallax: 48 },
    phone: { size: 384, width: 0.896, right: -0.38, parallax: 20 },
    camera: [0, 4.2, 7.5] as const,
    target: [0, 0.85, 0] as const,
    viewHeight: 2.8, // World units: a smaller view makes the flower larger.
  },
  maxPixelRatio: 1.5,
  maxRenderSize: 1200,
  poster: '/assets/home/flower/plumeria.webp',
}

const smooth = (value: number) => {
  const t = Math.max(0, Math.min(1, value))
  return t * t * (3 - 2 * t)
}

/** The Rose hold permits an exact endpoint handoff with the same animation clock. */
export function flowerProgress(progress: number) {
  const [start, rose, leaveRose, daisy] = STATEMENT_FLOWER.stops
  return progress < (rose + leaveRose) / 2
    ? { index: 0, amount: smooth((progress - start) / (rose - start)) }
    : { index: 1, amount: smooth((progress - leaveRose) / (daisy - leaveRose)) }
}
