/**
 * Hosted-prototypes manifest (docs/prototypes-plan.md). The single typed
 * source of truth for stacks and their prototypes, imported by the Pages
 * Functions (functions/p/[[path]].ts) and by build-time code for the public
 * Gallery (app/gallery). It ships inside the Pages Functions bundle, never in
 * public/ — unlisted stacks must not leak into the static export. Only
 * password HASHES live here; the signing secret stays in env vars.
 *
 * Access tiers per stack (Phase 1 implements the non-public paths):
 *   public   — listed in /gallery, no gate
 *   password — unlisted, shared-password gate
 *   link     — unlisted, HMAC magic link sets an httpOnly cookie
 */

// --- Validation ---------------------------------------------------------------

/**
 * Stack and prototype slugs: lowercase slug, no separators that could
 * traverse a key space (mirrors PROTECTED_ID_PATTERN in protectedShared.ts).
 * Applied BEFORE any manifest lookup or R2 access.
 */
export const PROTOTYPE_SLUG_PATTERN = /^[a-z0-9][a-z0-9-]{0,63}$/

export function isValidPrototypeSlug(slug: unknown): slug is string {
  return typeof slug === 'string' && PROTOTYPE_SLUG_PATTERN.test(slug)
}

/**
 * A file path inside a bundle, segment by segment (`assets/app.js`). Each
 * segment is a lowercase filename; `..` and dotfile segments are rejected
 * outright so a crafted path can never escape the bundle's key prefix.
 */
export const PROTOTYPE_FILE_SEGMENT_PATTERN = /^[a-z0-9][a-z0-9._-]{0,127}$/

export function isValidPrototypeFilePath(segments: string[]): boolean {
  if (segments.length === 0 || segments.length > 8) return false
  return segments.every(
    (segment) => !segment.includes('..') && PROTOTYPE_FILE_SEGMENT_PATTERN.test(segment),
  )
}

// --- Data model ----------------------------------------------------------------

export type PrototypeAccessMode = 'public' | 'password' | 'link'

export type StackAccess = {
  mode: PrototypeAccessMode
  /** PBKDF2-HMAC-SHA-256 hash, salted (password/link stacks, Phase 1). Set
   *  via scripts, never plaintext in the repo. */
  passwordHash?: string
  /** Bump to revoke every outstanding magic-link token for this stack. */
  tokenVersion?: number
}

export type PrototypeEntry = {
  slug: string
  title: string
  /** Optional tier label for grouped proposals (e.g. 'lower budget'). */
  tier?: string
  /** One-line summary shown on the option card. */
  summary: string
  /** Thumbnail filename inside the bundle, served at
   *  /p/<stack>/<slug>/<thumb>. */
  thumb: string
}

export type PrototypeStack = {
  slug: string
  title: string
  access: StackAccess
  /** Listed stacks render in /gallery; client stacks stay unlisted and are
   *  reachable only via direct URL + access grant. */
  listed: boolean
  /** Optional framing note at the top of the stack page. */
  framing?: string
  prototypes: PrototypeEntry[]
}

export const STACKS: PrototypeStack[] = [
  // === SCAFFOLD: scripts/new-prototype.mjs inserts new stacks after this line ===
  {
    slug: 'type-lab',
    title: 'Type & motion explorations',
    access: { mode: 'public' },
    listed: true,
    framing:
      'Small self-contained studies in motion and interaction — a place for experiments that do not fit a case study.',
    prototypes: [
      {
        slug: 'orbit-toy',
        title: 'Orbit toy',
        summary: 'A tiny canvas gravity sketch — move the pointer, click to scatter.',
        thumb: 'thumb.webp',
      },
    ],
  },
]

// --- Lookups ---------------------------------------------------------------------

export function findStack(slug: string): PrototypeStack | null {
  if (!isValidPrototypeSlug(slug)) return null
  return STACKS.find((stack) => stack.slug === slug) ?? null
}

export function findPrototype(stack: PrototypeStack, slug: string): PrototypeEntry | null {
  if (!isValidPrototypeSlug(slug)) return null
  return stack.prototypes.find((prototype) => prototype.slug === slug) ?? null
}

/** Public Gallery index: listed stacks only, resolved at build time. */
export function listedStacks(): PrototypeStack[] {
  return STACKS.filter((stack) => stack.listed)
}
