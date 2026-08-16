/**
 * Transactional upload promotion (mobile SVG-loading hardening).
 *
 * Three pure, DOM-free pieces of the upload pipeline, extracted from
 * components/PortfolioExperience.tsx so the node harness can cover them
 * (scripts/verify-svg-lifecycle.js):
 *
 * 1. resolveUploadRoute — file routing that never trusts an exact MIME match.
 *    Mobile pickers report empty or generic MIME values (application/
 *    octet-stream) for real SVGs, so a .svg filename routes to the SVG
 *    sanitizer regardless of the declared type and the DOM parse there is
 *    what confirms (or rejects) the content. Declared raster types route to
 *    the raster sniffer; everything else stays unsupported.
 *
 * 2. SourceUrlRegistry — exactly-once Blob-URL ownership. Every upload Blob
 *    URL is registered at creation; release() revokes only a URL the registry
 *    still owns, so double-release (stale attempt + failure path, history
 *    trim + unmount) can never revoke twice, and releaseOrphans() drops every
 *    owned URL not in the caller's retained set (live source + history).
 *
 * 3. resolveSourcePromotion — the promote/reject decision for a validated
 *    candidate: only a successful decode with at least one visible target is
 *    promoted to the field (and recorded in history); anything else is a
 *    transactional rejection carrying a sanitizer-style error literal that
 *    content/vibe.ts maps to friendly copy.
 */

import { RASTER_MIME_TYPES } from './rasterUpload'
import {
  RASTER_EMPTY_FIELD_ERROR,
  RASTER_UNDECODABLE_ERROR,
  SVG_EMPTY_FIELD_ERROR,
  SVG_UNDECODABLE_ERROR,
  VisualSourceKind,
} from './visualSource'

export type UploadRoute = 'svg' | 'raster' | 'unsupported'

const SVG_MIME_TYPE = 'image/svg+xml'
const SVG_EXTENSION_RE = /\.svg$/i

/**
 * Route a picked file to a validator. Declared raster MIME types win (the
 * raster sniffer still verifies magic bytes); an SVG MIME type or a .svg
 * filename — whatever the declared type, including empty/generic mobile
 * values — routes to the SVG sanitizer, whose parse is the real check.
 */
export function resolveUploadRoute(file: { name: string; type: string }): UploadRoute {
  const type = (file.type ?? '').trim().toLowerCase()
  if ((RASTER_MIME_TYPES as readonly string[]).includes(type)) return 'raster'
  if (type === SVG_MIME_TYPE) return 'svg'
  if (SVG_EXTENSION_RE.test(file.name ?? '')) return 'svg'
  return 'unsupported'
}

/**
 * Exactly-once owner for upload Blob URLs. Only blob: URLs are tracked
 * (built-in /assets paths and preset URLs need no lifecycle); release of an
 * unowned or already-released URL is a no-op.
 */
export type SourceUrlRegistry = {
  /** Begin tracking an URL (no-op for non-blob URLs). */
  own(url: string): void
  owns(url: string): boolean
  /** Revoke iff still owned; guarantees at most one revocation per URL. */
  release(url: string): void
  /** Revoke every owned URL absent from `retained` (each exactly once). */
  releaseOrphans(retained: ReadonlySet<string>): void
}

export function createSourceUrlRegistry(
  revokeUrl: (url: string) => void,
): SourceUrlRegistry {
  const owned = new Set<string>()
  return {
    own(url) {
      if (url.startsWith('blob:')) owned.add(url)
    },
    owns(url) {
      return owned.has(url)
    },
    release(url) {
      if (!owned.has(url)) return
      owned.delete(url)
      revokeUrl(url)
    },
    releaseOrphans(retained) {
      for (const url of Array.from(owned)) {
        if (retained.has(url)) continue
        owned.delete(url)
        revokeUrl(url)
      }
    },
  }
}

/** The candidate's pre-promotion probe: did the decode/sample pipeline
 *  produce a field with visible targets? */
export type SourcePromotionProbe = {
  ok: boolean
  targetCount: number
  error?: string
}

export type SourcePromotionDecision =
  | { promote: true }
  | { promote: false; error: string }

/**
 * Promote only a genuinely renderable candidate: a successful probe with at
 * least one visible target. Transparent/zero-target artwork and decode
 * failures reject with sanitizer-style literals (visualSource.ts) so the
 * caller can keep the previous source and show friendly copy.
 */
export function resolveSourcePromotion(
  probe: SourcePromotionProbe,
  kind: VisualSourceKind = 'svg',
): SourcePromotionDecision {
  if (probe.ok && probe.targetCount > 0) return { promote: true }
  if (!probe.ok) {
    return {
      promote: false,
      error: kind === 'raster' ? RASTER_UNDECODABLE_ERROR : SVG_UNDECODABLE_ERROR,
    }
  }
  return {
    promote: false,
    error: kind === 'raster' ? RASTER_EMPTY_FIELD_ERROR : SVG_EMPTY_FIELD_ERROR,
  }
}
