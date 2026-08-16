/**
 * Client-side SVG upload parsing and sanitization.
 *
 * This module is intentionally small and focused: it reads a user-selected
 * file, validates the markup with a browser DOMParser, rejects unsafe or
 * external content, and returns the validated markup plus its resolved
 * intrinsic size. Validation is deliberately split from URL creation
 * (createSvgObjectUrl) so the caller owns the Blob-URL lifecycle — the URL is
 * minted only for a candidate that passed validation and is revoked by the
 * caller's registry when the candidate fails or is superseded.
 *
 * Size normalization: mobile file pickers deliver SVGs that rely on viewBox
 * alone or on percentage width/height, which several mobile engines decode as
 * 0×0 (or a 300×150 default) in an <img>. When the root lacks fixed numeric
 * dimensions but they can be resolved (numeric width/height first, viewBox as
 * fallback), the resolved size is injected into the returned markup so the
 * decoded image always reports real intrinsic dimensions.
 *
 * Error messages are literal strings; content/vibe.ts maps them to friendly
 * copy and scripts/verify-vibe-content.js fails if the two drift apart.
 */

export const MAX_UPLOAD_SIZE_BYTES = 1024 * 1024
export const DEFAULT_UPLOADED_SVG_FILENAME = 'JH.svg'

const SVG_ROOT_TAG = 'svg'
const DISALLOWED_TAGS = new Set(['script', 'foreignobject'])
const EXTERNAL_SCHEME_RE = /^https?:|^\/\//i
const JAVASCRIPT_SCHEME_RE = /^javascript:/i
const DATA_URL_RE = /^data:/i

export type SvgUploadSuccessResult = {
  ok: true
  /** Validated, size-normalized SVG markup — safe to hand to a Blob. */
  markup: string
  filename: string
  /** Intrinsic CSS-pixel width resolved from width/height or viewBox; null when unknown. */
  intrinsicWidth: number | null
  /** Intrinsic CSS-pixel height resolved from width/height or viewBox; null when unknown. */
  intrinsicHeight: number | null
}

export type SvgUploadErrorResult = {
  ok: false
  error: string
}

export type SvgUploadResult = SvgUploadSuccessResult | SvgUploadErrorResult

export function isUploadTooLarge(sizeInBytes: number): boolean {
  return sizeInBytes > MAX_UPLOAD_SIZE_BYTES
}

/** Fixed numeric length (plain number or px); percentages and other units
 *  return null — they are not usable intrinsic dimensions. */
function parseFixedLength(raw: string | null): number | null {
  if (!raw) return null
  const match = /^\s*(\d+(?:\.\d+)?)\s*(px)?\s*$/i.exec(raw)
  if (!match) return null
  const value = Number.parseFloat(match[1])
  return Number.isFinite(value) && value > 0 ? value : null
}

/** viewBox width/height when the attribute holds four finite numbers with a
 *  positive size; null otherwise. */
function parseViewBoxSize(raw: string | null): { width: number; height: number } | null {
  if (!raw) return null
  const parts = raw
    .trim()
    .split(/[\s,]+/)
    .map((part) => Number(part))
  if (parts.length !== 4 || parts.some((part) => !Number.isFinite(part))) return null
  if (parts[2] <= 0 || parts[3] <= 0) return null
  return { width: parts[2], height: parts[3] }
}

/**
 * Resolve the intrinsic size of a validated SVG root: fixed numeric
 * width/height win, a missing axis falls back to the viewBox (preserving its
 * aspect ratio when the other axis is fixed), and a viewBox-only root yields
 * the viewBox size itself. Either axis is null when nothing resolves it.
 */
export function resolveSvgIntrinsicSize(root: Element): {
  width: number | null
  height: number | null
} {
  const viewBox = parseViewBoxSize(root.getAttribute('viewBox'))
  let width = parseFixedLength(root.getAttribute('width'))
  let height = parseFixedLength(root.getAttribute('height'))
  if (width === null && height !== null && viewBox) {
    width = height * (viewBox.width / viewBox.height)
  } else if (height === null && width !== null && viewBox) {
    height = width * (viewBox.height / viewBox.width)
  }
  if (width === null && viewBox) width = viewBox.width
  if (height === null && viewBox) height = viewBox.height
  return { width, height }
}

const SVG_ROOT_OPEN_RE = /<svg(?=[\s/>])/i
const WIDTH_ATTR_RE = /\s+width\s*=\s*("[^"]*"|'[^']*')/i
const HEIGHT_ATTR_RE = /\s+height\s*=\s*("[^"]*"|'[^']*')/i

/**
 * Set the root <svg> tag's width/height to the resolved values, replacing any
 * existing (percentage or stale) attributes. String-level so it needs no DOM
 * serializer: the markup is already known to be valid XML, where attribute
 * values are always quoted. Returns the input unchanged when no root tag is
 * found (defensive — validation has already guaranteed one).
 */
export function upsertSvgRootSize(markup: string, width: number, height: number): string {
  const match = SVG_ROOT_OPEN_RE.exec(markup)
  if (!match) return markup
  const tagStart = match.index
  // Scan to the end of the opening tag, respecting quoted attribute values.
  let tagEnd = tagStart + 4
  let quote: string | null = null
  while (tagEnd < markup.length) {
    const ch = markup[tagEnd]
    if (quote) {
      if (ch === quote) quote = null
    } else if (ch === '"' || ch === "'") {
      quote = ch
    } else if (ch === '>') {
      break
    }
    tagEnd += 1
  }
  if (tagEnd >= markup.length) return markup
  let tag = markup.slice(tagStart, tagEnd + 1)
  tag = tag.replace(WIDTH_ATTR_RE, '').replace(HEIGHT_ATTR_RE, '')
  const closing = tag.endsWith('/>') ? '/>' : '>'
  const head = tag.slice(0, tag.length - closing.length)
  const sized = `${head} width="${width}" height="${height}"${closing}`
  return markup.slice(0, tagStart) + sized + markup.slice(tagEnd + 1)
}

/**
 * Mint the renderer-facing Blob URL for validated markup. Split from
 * validation so the caller owns the URL's lifecycle (registry-tracked,
 * revoked exactly once on failure/replacement — see engine/sourcePromotion).
 */
export function createSvgObjectUrl(markup: string): string {
  return URL.createObjectURL(new Blob([markup], { type: 'image/svg+xml' }))
}

/**
 * Validate an already-parsed SVG Document and, if safe, return the normalized
 * markup plus the resolved intrinsic size for the renderer.
 */
export function validateSvgDocument(
  doc: Document,
  content: string,
  filename = DEFAULT_UPLOADED_SVG_FILENAME,
): SvgUploadResult {
  const parserError = doc.querySelector('parsererror')
  if (parserError) {
    return { ok: false, error: 'The uploaded SVG is not valid XML.' }
  }

  const root = doc.documentElement
  if (!root || root.tagName.toLowerCase() !== SVG_ROOT_TAG) {
    return { ok: false, error: 'The uploaded SVG is missing an <svg> root.' }
  }

  const allElements = [root, ...Array.from(root.querySelectorAll('*'))]

  for (const element of allElements) {
    const tag = element.tagName.toLowerCase()

    if (DISALLOWED_TAGS.has(tag)) {
      return { ok: false, error: 'The uploaded SVG contains disallowed content.' }
    }

    if (tag === 'link') {
      return { ok: false, error: 'The uploaded SVG contains external resource references.' }
    }

    if (tag === 'image') {
      const href = getHref(element)
      if (href !== undefined && !DATA_URL_RE.test(href)) {
        return { ok: false, error: 'The uploaded SVG contains an external image reference.' }
      }
    }

    if (tag === 'use') {
      const href = getHref(element)
      if (href !== undefined && !href.startsWith('#')) {
        return { ok: false, error: 'The uploaded SVG contains an unsafe external reference.' }
      }
    }

    for (const attr of Array.from(element.attributes)) {
      const name = attr.name.toLowerCase()
      const value = attr.value.trim()

      if (name.startsWith('on')) {
        return { ok: false, error: 'The uploaded SVG contains unsafe event handlers.' }
      }

      // Namespace declarations are required for SVG and are not resource references.
      if (name === 'xmlns' || name.startsWith('xmlns:')) {
        continue
      }

      if (JAVASCRIPT_SCHEME_RE.test(value)) {
        return { ok: false, error: 'The uploaded SVG contains unsafe script URLs.' }
      }

      if (EXTERNAL_SCHEME_RE.test(value)) {
        return { ok: false, error: 'The uploaded SVG contains external references.' }
      }

      if (name === 'style') {
        const styleError = checkStyle(value)
        if (styleError) {
          return { ok: false, error: styleError }
        }
      }
    }

    if (tag === 'style') {
      const styleError = checkStyle(element.textContent ?? '')
      if (styleError) {
        return { ok: false, error: styleError }
      }
    }
  }

  // Normalize root sizing so mobile engines decode real intrinsic dimensions:
  // a root lacking fixed numeric width/height gets the resolved size injected.
  const size = resolveSvgIntrinsicSize(root)
  let markup = content
  const widthFixed = parseFixedLength(root.getAttribute('width')) !== null
  const heightFixed = parseFixedLength(root.getAttribute('height')) !== null
  if (size.width !== null && size.height !== null && (!widthFixed || !heightFixed)) {
    markup = upsertSvgRootSize(content, size.width, size.height)
  }

  return {
    ok: true,
    markup,
    filename,
    intrinsicWidth: size.width,
    intrinsicHeight: size.height,
  }
}

/**
 * Read and validate a user-selected File object. The MIME type is NOT trusted
 * here (mobile pickers report empty or generic values): the DOM parse above
 * is what confirms a valid SVG root — routing by name/type lives in
 * engine/sourcePromotion (resolveUploadRoute).
 */
export function readUploadedSvg(file: File): Promise<SvgUploadResult> {
  if (isUploadTooLarge(file.size)) {
    return Promise.resolve({
      ok: false,
      error: 'The SVG file must be smaller than 1 MB.',
    })
  }

  return new Promise((resolve) => {
    const reader = new FileReader()

    reader.onload = () => {
      const content = String(reader.result)
      const parser = new DOMParser()
      const doc = parser.parseFromString(content, 'image/svg+xml')
      resolve(validateSvgDocument(doc, content, file.name))
    }

    reader.onerror = () => {
      resolve({ ok: false, error: 'Could not read the selected file.' })
    }

    reader.readAsText(file)
  })
}

function getHref(element: Element): string | undefined {
  for (const attr of Array.from(element.attributes)) {
    const name = attr.name.toLowerCase()
    if (name === 'href' || name === 'xlink:href') {
      return attr.value.trim()
    }
  }
  return undefined
}

function checkStyle(text: string): string | null {
  if (/@import/i.test(text)) {
    return 'The uploaded SVG contains external stylesheets.'
  }

  if (/@font-face/i.test(text)) {
    return 'The uploaded SVG contains external fonts.'
  }

  if (/url\s*\(\s*["']?(https?:|\/\/)/i.test(text)) {
    return 'The uploaded SVG contains external references.'
  }

  if (JAVASCRIPT_SCHEME_RE.test(text)) {
    return 'The uploaded SVG contains unsafe script URLs.'
  }

  return null
}
