/** Spot samples from the user's 399×501 neon-street reference (2026-09-30).
 * Coordinates are original-image pixels; these values are the sampled pixels,
 * selected near saturated-color cluster centers, not another copy of site tokens.
 */
export const SCENE_LIGHT_PALETTE = [
  '#27c4ec', // cyan reflection, (359, 474)
  '#1e76b6', // electric blue signage, (380, 189)
  '#d73d79', // pink reflection, (146, 397)
  '#df1817', // red reflection, (103, 491)
  '#e6a738', // amber signage, (174, 215)
  '#38a3bf', // teal reflection, (275, 407)
] as const;

export const LIGHT_CYCLE_SECONDS_PER_COLOR = 10;
