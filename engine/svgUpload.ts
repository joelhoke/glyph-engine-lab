/**
 * Client-side SVG upload parsing and sanitization.
 *
 * This module is intentionally small and focused: it reads a user-selected
 * file, validates the markup with a browser DOMParser, rejects unsafe or
 * external content, and returns a self-contained data-URL representation that
 * the existing SVG target pipeline can consume directly.
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
  url: string
  filename: string
}

export type SvgUploadErrorResult = {
  ok: false
  error: string
}

export type SvgUploadResult = SvgUploadSuccessResult | SvgUploadErrorResult

export function isUploadTooLarge(sizeInBytes: number): boolean {
  return sizeInBytes > MAX_UPLOAD_SIZE_BYTES
}

/**
 * Validate an already-parsed SVG Document and, if safe, turn the original
 * markup into a base64 data URL for the renderer.
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

  return {
    ok: true,
    url: svgContentToDataUrl(content),
    filename,
  }
}

/**
 * Read and validate a user-selected File object.
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

function svgContentToDataUrl(content: string): string {
  const bytes = new TextEncoder().encode(content)
  let binary = ''
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i])
  }
  return `data:image/svg+xml;base64,${btoa(binary)}`
}
