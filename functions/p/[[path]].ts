/**
 * GET /p/* — catch-all serving hosted-prototype bundle files from the
 * private PROTOTYPES_BUCKET R2 bucket (docs/prototypes-plan.md).
 *
 * Path layout: /p/<stack>/<slug>/<file…> maps to the R2 key
 * "<stack>/<slug>/<file…>"; the stack and viewer shells (/p/<stack>,
 * /p/<stack>/<slug>) are static-export pages and are handed back to the
 * Pages asset server via context.next() — unless the stack is gated.
 * Directory URLs (…/about/) resolve to their index.html. Every file segment
 * is validated and looked up in the manifest BEFORE any R2 access; anything
 * invalid, unknown, or disallowed answers a plain 404 — fail closed,
 * indistinguishable from missing.
 *
 * Phase 1 access control (functions/lib/prototypeAuth.ts): public stacks
 * serve openly; password/link stacks need a valid HMAC-signed cookie scoped
 * to /p/<stack>/. Gated shells render the password gate instead of the
 * export; POST /p/<stack>/_unlock verifies the manifest's PBKDF2 record and
 * issues the cookie. No configured PROTOTYPES_AUTH_SECRET fails closed.
 */

import { buildProtectedHeaders } from '../lib/protectedShared'
import {
  findPrototype,
  findStack,
  isValidPrototypeFilePath,
  isValidPrototypeSlug,
  PrototypeStack,
} from '../lib/prototypesManifest'
import {
  hasPrototypeAccess,
  issuePrototypeCookie,
  verifyPrototypePassword,
} from '../lib/prototypeAuth'

type PrototypesEnv = {
  PROTOTYPES_BUCKET?: R2Bucket
  /** HMAC signing secret for access cookies — dashboard-managed, never in the repo. */
  PROTOTYPES_AUTH_SECRET?: string
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
 * Access check (Phase 1): public stacks serve openly; password/link stacks
 * need a valid signed cookie (functions/lib/prototypeAuth.ts), scoped to
 * /p/<stack>/ and revocable via the manifest's tokenVersion. No secret
 * configured fails closed — same 404 as everything else.
 */
async function hasStackAccess(
  request: Request,
  stack: PrototypeStack,
  secret: string | undefined,
  nowMs: number,
): Promise<boolean> {
  if (stack.access.mode === 'public') return true
  if (!secret) return false
  return hasPrototypeAccess(request, stack.slug, stack.access.tokenVersion ?? 1, secret, nowMs)
}

function notFound(): Response {
  return new Response('Not found', {
    status: 404,
    headers: buildProtectedHeaders({ 'Content-Type': 'text/plain; charset=utf-8' }),
  })
}

/**
 * The password gate (Phase 1): served in place of a gated stack's shell
 * pages when no valid cookie rides the request. Intentionally bare — one
 * form posting to /p/<stack>/_unlock — and always noindexed.
 */
function gateResponse(stackSlug: string, stackTitle: string, failed = false): Response {
  const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="robots" content="noindex, nofollow" />
    <title>${stackTitle} — private prototype</title>
    <style>
      body { margin: 0; min-height: 100vh; display: grid; place-items: center; background: #090c12; color: #c5d4ea; font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; }
      form { display: grid; gap: 1rem; width: min(90vw, 22rem); padding: 2rem; border: 1px solid rgba(255,255,255,0.12); border-radius: 12px; background: rgba(14,18,24,0.9); }
      h1 { margin: 0; font-size: 1rem; letter-spacing: 0.08em; color: #f5f7fb; }
      p { margin: 0; font-size: 0.82rem; line-height: 1.6; }
      .error { color: #f2b28a; }
      input { font: inherit; padding: 0.65rem 0.8rem; border-radius: 8px; border: 1px solid rgba(255,255,255,0.16); background: rgba(255,255,255,0.06); color: #f5f7fb; }
      button { font: inherit; padding: 0.65rem; border-radius: 999px; border: 1px solid #8abaff; background: transparent; color: #bcd7ff; cursor: pointer; }
      button:hover { background: rgba(138,186,255,0.12); }
    </style>
  </head>
  <body>
    <form method="post" action="/p/${stackSlug}/_unlock">
      <h1>${stackTitle}</h1>
      <p>This prototype is shared privately. Enter the password Joel sent you.</p>
      ${failed ? '<p class="error">That password didn\u2019t work — try again, or ask Joel for a fresh one.</p>' : ''}
      <input type="password" name="password" autocomplete="current-password" required autofocus aria-label="Password" />
      <button type="submit">Unlock</button>
    </form>
  </body>
</html>`
  return new Response(html, {
    status: failed ? 403 : 200,
    headers: buildProtectedHeaders({
      'Content-Type': 'text/html; charset=utf-8',
      'X-Robots-Tag': 'noindex, nofollow',
    }),
  })
}

/**
 * POST /p/<stack>/_unlock (Phase 1): verify the password against the
 * manifest's PBKDF2 record; success sets the signed access cookie and
 * redirects to the stack shell, failure re-renders the gate with an error.
 * The `_unlock` action can never collide with a real prototype — slug rules
 * require a leading [a-z0-9].
 */
export const onRequestPost: PagesFunction<PrototypesEnv, 'path'> = async (context) => {
  const raw = context.params.path as string | string[]
  const segments = (Array.isArray(raw) ? raw : [raw]).map((segment) => {
    try {
      return decodeURIComponent(segment)
    } catch {
      return ''
    }
  })
  const [stackSlug, action] = segments
  if (segments.length !== 2 || action !== '_unlock' || !isValidPrototypeSlug(stackSlug)) {
    return notFound()
  }
  const stack = findStack(stackSlug)
  if (!stack || stack.access.mode !== 'password' || !stack.access.passwordHash) {
    return notFound()
  }
  const form = await context.request.formData().catch(() => null)
  const password = form?.get('password')
  const secret = context.env.PROTOTYPES_AUTH_SECRET
  const verified =
    typeof password === 'string' &&
    !!secret &&
    (await verifyPrototypePassword(password, stack.access.passwordHash))
  if (!verified) {
    return gateResponse(stack.slug, stack.title, true)
  }
  const cookie = await issuePrototypeCookie(
    stack.slug,
    stack.access.tokenVersion ?? 1,
    secret,
    Date.now(),
  )
  return new Response(null, {
    status: 303,
    headers: buildProtectedHeaders({
      Location: `/p/${stack.slug}/`,
      'Set-Cookie': cookie,
    }),
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
  // shells from the export — EXCEPT gated stacks (Phase 1): without a valid
  // access cookie their shells are replaced by the password gate before the
  // request ever reaches the static export. Unknown stacks hand through to
  // the export's own 404.
  if (fileSegments.length === 0 || fileSegments.every((segment) => segment === '')) {
    if (isValidPrototypeSlug(stackSlug)) {
      const shellStack = findStack(stackSlug)
      if (shellStack && shellStack.access.mode !== 'public') {
        const allowed = await hasStackAccess(
          context.request,
          shellStack,
          context.env.PROTOTYPES_AUTH_SECRET,
          Date.now(),
        )
        if (!allowed) return gateResponse(shellStack.slug, shellStack.title)
      }
    }
    return context.next()
  }
  // Directory URLs from multi-page bundles (e.g. an Eleventy site linking to
  // /about/) resolve to that directory's index.html — trailing empty
  // segments are dropped, and an extensionless final segment is treated as a
  // directory. Explicit file requests pass through untouched.
  const normalizedSegments = [...fileSegments]
  while (normalizedSegments.length > 0 && normalizedSegments[normalizedSegments.length - 1] === '') {
    normalizedSegments.pop()
  }
  if (normalizedSegments.length === 0) {
    return context.next()
  }
  if (!normalizedSegments[normalizedSegments.length - 1].includes('.')) {
    normalizedSegments.push('index.html')
  }
  if (!isValidPrototypeSlug(stackSlug) || !isValidPrototypeSlug(prototypeSlug)) {
    return notFound()
  }
  if (!isValidPrototypeFilePath(normalizedSegments)) {
    return notFound()
  }

  const stack = findStack(stackSlug)
  const prototype = stack ? findPrototype(stack, prototypeSlug) : null
  if (!stack || !prototype) {
    return notFound()
  }
  // Card thumbnails stay public even on gated stacks: the /gallery index and
  // the stack page show them to everyone. The carve-out is precise — only
  // the manifest-declared thumb file at the bundle root, never other assets.
  const isDeclaredThumb =
    normalizedSegments.length === 1 && normalizedSegments[0] === prototype.thumb
  if (!isDeclaredThumb) {
    const allowed = await hasStackAccess(
      context.request,
      stack,
      context.env.PROTOTYPES_AUTH_SECRET,
      Date.now(),
    )
    if (!allowed) {
      return notFound()
    }
  }

  const contentType = PROTOTYPE_MIME_BY_EXTENSION.get(
    normalizedSegments[normalizedSegments.length - 1].slice(
      normalizedSegments[normalizedSegments.length - 1].lastIndexOf('.'),
    ),
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

  const object = await bucket.get(`${stackSlug}/${prototypeSlug}/${normalizedSegments.join('/')}`)
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
