/**
 * Stable glyph-to-target assignment.
 *
 * Given the size of the existing glyph population and a target count,
 * produces a deterministic order-preserving mapping from glyph index to
 * target index. Because the mapping only depends on the two counts, the
 * same inputs always produce the same mapping, and re-targeting (resize,
 * source switch) remaps the existing population by index instead of
 * respawning it.
 */

export type GlyphAssignment = {
  /** Target index per glyph; -1 means the glyph has no target. */
  glyphToTarget: Int32Array
  /** Number of glyphs that received a target. */
  assignedCount: number
}

/**
 * Maps each glyph to at most one target, preserving order:
 * - When there are at least as many glyphs as targets, glyph `i` takes
 *   target `i` so every target is covered; remaining glyphs are
 *   unassigned (-1) and become ambient/hidden per scene behavior.
 * - When there are fewer glyphs than targets, glyphs spread evenly
 *   across the target list; every glyph receives a unique target.
 *
 * Counts are floored and clamped at zero, so out-of-range inputs are
 * safe. The function is pure: no randomness, no mutation of inputs.
 */
export function assignGlyphsToTargets(glyphCount: number, targetCount: number): GlyphAssignment {
  const glyphs = Math.max(0, Math.floor(glyphCount))
  const targets = Math.max(0, Math.floor(targetCount))
  const glyphToTarget = new Int32Array(glyphs)

  if (glyphs === 0 || targets === 0) {
    glyphToTarget.fill(-1)
    return { glyphToTarget, assignedCount: 0 }
  }

  let assignedCount = 0
  for (let i = 0; i < glyphs; i += 1) {
    if (glyphs >= targets) {
      glyphToTarget[i] = i < targets ? i : -1
    } else {
      glyphToTarget[i] = Math.floor((i * targets) / glyphs)
    }
    if (glyphToTarget[i] >= 0) assignedCount += 1
  }

  return { glyphToTarget, assignedCount }
}
