/**
 * GET /s/<stack>?k=<token> — magic-link gate (docs/prototypes-plan.md,
 * Phase 1). The link IS the credential: a valid HMAC token (minted by
 * scripts/prototype-link.mjs against the manifest's tokenVersion) issues
 * the stack's access cookie and redirects to the clean stack URL, so the
 * token never lingers in browser history or referrers. Invalid, expired,
 * or revoked tokens get a plain explanation page — no oracle about which
 * part failed.
 *
 * Works for any non-public stack: password stacks get magic links as a
 * coexistence path (link for the client, password as the backup).
 */

import { buildProtectedHeaders } from '../lib/protectedShared'
import { findStack, isValidPrototypeSlug } from '../lib/prototypesManifest'
import { issuePrototypeCookie, verifyPrototypeLinkToken } from '../lib/prototypeAuth'

type LinkEnv = {
  PROTOTYPES_AUTH_SECRET?: string
}

function invalidLinkResponse(): Response {
  const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="robots" content="noindex, nofollow" />
    <title>Link expired — joel hoke design</title>
    <style>
      body { margin: 0; min-height: 100vh; display: grid; place-items: center; background: #090c12; color: #c5d4ea; font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; }
      main { width: min(90vw, 24rem); padding: 2rem; border: 1px solid rgba(255,255,255,0.12); border-radius: 12px; background: rgba(14,18,24,0.9); }
      h1 { margin: 0 0 0.75rem; font-size: 1rem; letter-spacing: 0.08em; color: #f5f7fb; }
      p { margin: 0; font-size: 0.82rem; line-height: 1.6; }
    </style>
  </head>
  <body>
    <main>
      <h1>This link has expired</h1>
      <p>It may have been revoked or replaced. Ask Joel for a fresh link — or use the password if you have one.</p>
    </main>
  </body>
</html>`
  return new Response(html, {
    status: 403,
    headers: buildProtectedHeaders({
      'Content-Type': 'text/html; charset=utf-8',
      'X-Robots-Tag': 'noindex, nofollow',
    }),
  })
}

export const onRequestGet: PagesFunction<LinkEnv, 'stack'> = async (context) => {
  const stackSlug = String(context.params.stack ?? '')
  if (!isValidPrototypeSlug(stackSlug)) return invalidLinkResponse()
  const stack = findStack(stackSlug)
  if (!stack || stack.access.mode === 'public') return invalidLinkResponse()

  const token = new URL(context.request.url).searchParams.get('k') ?? ''
  const secret = context.env.PROTOTYPES_AUTH_SECRET
  const tokenVersion = stack.access.tokenVersion ?? 1
  const valid =
    !!secret && (await verifyPrototypeLinkToken(token, stack.slug, tokenVersion, secret, Date.now()))
  if (!valid) return invalidLinkResponse()

  const cookie = await issuePrototypeCookie(stack.slug, tokenVersion, secret, Date.now())
  return new Response(null, {
    status: 303,
    headers: buildProtectedHeaders({
      Location: `/p/${stack.slug}`,
      'Set-Cookie': cookie,
    }),
  })
}
