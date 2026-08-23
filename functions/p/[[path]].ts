/**
 * GET /p/* — catch-all serving hosted-prototype bundle files from the
 * private PROTOTYPES_BUCKET R2 bucket (docs/prototypes-plan.md, Phase 0).
 *
 * Path layout: /p/<stack>/<slug>/<file…> maps to the R2 key
 * "<stack>/<slug>/<file…>"; the stack and viewer shells (/p/<stack>,
 * /p/<stack>/<slug>) are static-export pages and are handed back to the
 * Pages asset server via context.next(). Every file segment is validated
 * and looked up in the manifest BEFORE any R2 access; anything invalid,
 * unknown, or disallowed answers a plain 404 — fail closed,
 * indistinguishable from missing.
 *
 * Phase 0 serves public stacks without a cookie. The `hasStackAccess` seam
 * below is where Phase 1 drops in the HMAC cookie check for password/link
 * stacks (functions/lib/prototypeAuth.ts).
 */

import { buildProtectedHeaders } from '../lib/protectedShared'
import {
  findPrototype,
  findStack,
  isValidPrototypeFilePath,
  isValidPrototypeSlug,
  PrototypeStack,
} from '../lib/prototypesManifest'

type PrototypesEnv = {
  PROTOTYPES_BUCKET?: R2Bucket
}

/**
 * Strict allowlist: only these bundle file types may leave the bucket, keyed
 * by extension (R2-stored content types are not trusted). Anything else —
 * including extensionless files — 404s.
 */
const PROTOTYPE_MIME_BY_EXTENSION = new Map([
  ['.html', 'text/html; charset=utf-8'],
  ['.css', 'text/css; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.mjs', 'text/javascript; charset=utf-8'],
  ['.json', 'application/json'],
  ['.webp', 'image/webp'],
  ['.png', 'image/png'],
  ['.jpg', 'image/jpeg'],
  ['.jpeg', 'image/jpeg'],
  ['.avif', 'image/avif'],
  ['.mp4', 'video/mp4'],
  ['.webm', 'video/webm'],
  ['.mp3', 'audio/mpeg'],
  ['.wav', 'audio/wav'],
  ['.woff', 'font/woff'],
  ['.woff2', 'font/woff2'],
  ['.vtt', 'text/vtt'],
])

/**
 * Access seam (Phase 0): public stacks serve openly; password/link stacks
 * fail closed until the HMAC cookie check lands here (Phase 1,
 * docs/prototypes-plan.md §3). The cookie will be scoped to /p/<stack>/ and
 * verified against the stack's tokenVersion.
 */
function hasStackAccess(_request: Request, stack: PrototypeStack): boolean {
  return stack.access.mode === 'public'
}

function notFound(): Response {
  return new Response('Not found', {
    status: 404,
    headers: buildProtectedHeaders({ 'Content-Type': 'text/plain; charset=utf-8' }),
  })
}

export const onRequestGet: PagesFunction<PrototypesEnv, 'path'> = async (context) => {
  // Pages catch-all params arrive as string[]; the ambient type declares
  // string, so normalize defensively.
  const raw = context.params.path as string | string[]
  const segments = (Array.isArray(raw) ? raw : [raw]).map((segment) => {
    try {
      return decodeURIComponent(segment)
    } catch {
      return ''
    }
  })

  const [stackSlug, prototypeSlug, ...fileSegments] = segments
  // The stack and viewer pages (/p/<stack>, /p/<stack>/<slug>) are static
  // shells from the export — hand them back to the Pages asset server. Only
  // paths with an actual file segment are bundle requests.
  if (fileSegments.length === 0 || fileSegments.every((segment) => segment === '')) {
    return context.next()
  }
  if (!isValidPrototypeSlug(stackSlug) || !isValidPrototypeSlug(prototypeSlug)) {
    return notFound()
  }
  if (!isValidPrototypeFilePath(fileSegments)) {
    return notFound()
  }

  const stack = findStack(stackSlug)
  if (!stack || !findPrototype(stack, prototypeSlug)) {
    return notFound()
  }
  if (!hasStackAccess(context.request, stack)) {
    return notFound()
  }

  const contentType = PROTOTYPE_MIME_BY_EXTENSION.get(
    fileSegments[fileSegments.length - 1].slice(fileSegments[fileSegments.length - 1].lastIndexOf('.')),
  )
  if (!contentType) {
    return notFound()
  }

  // The bucket binding may be absent (local dev without --r2, or the bucket
  // not yet created): fail closed with the same 404 as a missing object.
  const bucket = context.env.PROTOTYPES_BUCKET
  if (!bucket) {
    return notFound()
  }

  const object = await bucket.get(`${stackSlug}/${prototypeSlug}/${fileSegments.join('/')}`)
  if (!object) {
    return notFound()
  }

  return new Response(object.body, {
    status: 200,
    headers: buildProtectedHeaders({
      'Content-Type': contentType,
      'Content-Length': String(object.size),
    }),
  })
}
