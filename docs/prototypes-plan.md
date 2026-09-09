# Hosted Prototypes — Implementation Plan (revised, validated against `main`)

**Goal:** host interactive prototypes on joelhoke.me, shareable with collaborators via
password or auto-unlocking magic links, with support for grouped "stacks" (e.g., tiered
design proposals for a client) presented as nested galleries.

**First pilot:** the tiered site-design proposals made for a local small business
(low/mid/high budget options as one stack).

> Revision note (2026-08-22): the original draft assumed "Vercel/Node runtime with
> Next.js middleware or route handlers." Validation against `main` (`8a8521c`) proved
> that wrong: `next.config.js` sets `output: 'export'`, the site is a **static export
> on Cloudflare Pages**, and Next middleware/route handlers never run in production.
> All server behavior below is therefore implemented as **Cloudflare Pages Functions**
> (`functions/`), following the existing `functions/api/protected/` precedent.
> Decisions confirmed with Joel: HMAC magic links (not Cloudflare Access OTP), Gallery
> as a real route with its own chrome (not coupled to the homepage-redesign header).

## Confirmed platform facts (from validation)

- Static export (`next.config.js:3`, `output: 'export'`); deploy via Cloudflare Pages,
  `pages_build_output_dir = "out"` (`wrangler.toml`). `docs/deployment.md` is the ops doc.
- Server layer = Pages Functions in `functions/` (Workers runtime, WebCrypto idiom).
- Existing gated-content precedent: `protected-work` = Cloudflare Access (email OTP,
  dashboard-configured) + `functions/api/protected/_middleware.ts` re-validating the
  Access JWT + private R2 bucket (`PROTECTED_BUCKET`) streamed through
  `functions/api/protected/media/[id].ts` (Range-aware, MIME allowlist, ID validation
  in `functions/lib/protectedShared.ts`). The static shell page pattern lives at
  `app/protected-work/page.tsx` (`noindex`, no content in the export).
- Rate limiting today is done by **WAF rules in the Cloudflare dashboard**, not code.
- D1 exists (`jh-feedback`, `jh-collaborate`) with a migrations + expiry-sweep pattern
  (`migrations/`, `workers/collaborate-cleanup/`) if state is ever needed.
- `public/_headers` sets `X-Frame-Options: SAMEORIGIN` — sandboxed iframes are fine
  for same-origin bundle serving (our case). No `robots.txt` exists yet; noindex is
  per-route metadata today.
- Top-level nav (`components/ExperienceNav.tsx`) is client-side hash-routed scenes
  (Work/Vibe/Collaborate), not routes. The homepage-redesign persistent header does
  not exist yet.

## Key design decisions

### 1. Gallery is a real route with its own chrome

- `/gallery` is an App Router route in the static export — the **public** face:
  listed explorations and experiments. It ships with a minimal header matching site
  chrome (dark base, monospace); integration into `ExperienceNav`/the future
  persistent header is a later, separate step.
- **Client stacks are unlisted by default** and never appear in `/gallery`; they are
  reachable only via direct URL + access grant. A stack can flip `listed: true` later
  to become portfolio evidence.
- Collaborators never navigate to prototypes — the magic link drops them directly
  into the stack.

### 2. Three access tiers per stack

| Tier       | Behavior |
| ---------- | -------- |
| `public`   | Listed in Gallery, no gate |
| `password` | Unlisted; gate page asks for a shared password |
| `link`     | Unlisted; URL carries an HMAC-signed token (`/s/<stack>?k=<token>`); the gate Function validates it, sets an `httpOnly` cookie, and redirects to a clean URL — the link *is* the password |

`password` and `link` can coexist on one stack (magic link for the client, password
as a read-it-out-on-a-call fallback).

### 3. Tokens, not accounts

No user accounts, no email flow. A magic-link token is an HMAC-signed payload
`{ stackSlug, tokenVersion, expiresAt }` signed with `PROTOTYPE_TOKEN_SECRET` (Pages
env var). Validation runs in a Pages Function using WebCrypto `HMAC-SHA-256`
(constant-time compare), matching the repo's hand-rolled crypto idiom in
`functions/lib/protectedShared.ts`. Success sets an `httpOnly`, `SameSite=Lax`,
`Secure` cookie scoped to that stack's path (`/p/<stack>/`). Revocation: rotate the
secret (global) or bump the stack's `tokenVersion` (per-stack).

## Data model

`functions/lib/prototypesManifest.ts` — a typed TS module imported by the Functions
(and by build-time code for the public Gallery). It ships inside the Pages Functions
bundle, **not** in `public/`, so unlisted stacks are never exposed by the static
export. Only hashes live here; the signing secret stays in env vars.

```ts
export const STACKS: PrototypeStack[] = [
  {
    slug: 'acme-refresh',              // unguessable-ish; defense in depth, not the secret
    title: 'ACME Café — site proposals',
    access: { mode: 'link', passwordHash: '…', tokenVersion: 1 },
    listed: false,
    framing: 'Three directions at three investment levels…',
    prototypes: [
      { slug: 'option-a-lean', title: 'Option A — Lean', tier: 'lower budget',
        summary: '…', thumb: 'thumb.webp' },
      // …
    ],
  },
  {
    slug: 'type-lab',
    title: 'Type & motion explorations',
    access: { mode: 'public' },
    listed: true,
    prototypes: [ /* … */ ],
  },
]
```

Password storage: PBKDF2-HMAC-SHA-256 hash (WebCrypto-native), salted, in the
manifest. Passwords are set via the scaffold/CLI scripts, never typed into the repo
in plaintext.

## How prototypes are hosted & served

- Each prototype is a **self-contained static bundle** (one folder, `index.html`
  entry, relative asset paths, `thumb.webp` thumbnail).
- **Gated bundles never touch `public/` or the export.** They are uploaded to a
  private **R2 bucket** (`PROTOTYPES_BUCKET` binding) by a publish script modeled on
  `scripts/publish-protected.mjs`, under keys `/<stack>/<slug>/<file>`.
- Serving: a catch-all Pages Function `functions/p/[[path]].ts` that
  1. parses `{stack}/{slug}/{file…}` from the path,
  2. validates stack/slug/file against `^[a-z0-9][a-z0-9-]*$` + the manifest,
  3. for non-public stacks requires a valid access cookie (HMAC-verified, unexpired,
     `tokenVersion` match) — else 404 (fail closed, indistinguishable from missing),
  4. streams the object from R2 with a strict MIME allowlist and security headers
     (reuse/adapt `protectedShared.ts` helpers).
- **Viewer chrome:** the viewer page is a static shell route
  (`app/p/[stack]/page.tsx` and `app/p/[stack]/[slug]/page.tsx`, `noindex`) that
  renders the sandboxed iframe (`sandbox="allow-scripts allow-same-origin"`,
  `src="/p/<stack>/<slug>/index.html"`), persistent mini-header, stack breadcrumb,
  and "back to options" link.
- Stack page (`/p/<stack>` without cookie) renders the password gate instead — the
  shell fetches a tiny gated manifest endpoint and falls back to the gate UI on 401.
- All `/p/*` and `/s/*` routes get `noindex, nofollow`; add `public/robots.txt`
  disallowing `/p/` and `/s/`, plus `X-Robots-Tag` via `public/_headers` path rules
  for good measure.

## Client-facing flow

1. Client opens magic link → `functions/s/[stack].ts?k=<token>` validates, sets the
   cookie, 302s to `/p/<stack>` — the **stack page**: framing note up top, then
   option cards (thumbnail, title, tier label, one-line summary).
2. Click a card → **prototype viewer** (sandboxed iframe + chrome), breadcrumb back.
3. v1 feedback affordance: mailto with prefilled subject per option (later phase).

The Gallery (`/gallery`) reuses the same stack/card components for `listed: true`
stacks — one component family, two contexts.

## Phases

### Phase 0 — Scaffold & hosting spike (0.5–1 day)

- [x] ~~Confirm runtime~~ **Done during validation:** Cloudflare Pages, static export,
  Pages Functions for anything dynamic.
- [ ] `app/gallery/page.tsx` with minimal own chrome (dark base, monospace, site
  header lockup). No `ExperienceNav` coupling.
- [ ] Document the bundle format (one folder, `index.html`, relative paths,
  `thumb.webp`) in `docs/` (this file + scaffold `--help`).
- [ ] `scripts/new-prototype.mjs`: creates bundle folder, manifest entry, placeholder
  thumbnail.
- [ ] Create `PROTOTYPES_BUCKET` R2 bucket + binding in `wrangler.toml`.

**Exit criteria:** a dummy public stack renders in `/gallery` and one prototype plays
in the sandboxed viewer served through the Function catch-all.

### Phase 1 — Access control core (1–2 days)

- [ ] `functions/lib/prototypeAuth.ts`: HMAC sign/verify (WebCrypto), cookie
  issue/parse, PBKDF2 password hash/verify.
- [ ] `functions/s/[stack].ts` gate: `?k=<token>` → validate → set cookie scoped to
  `/p/<stack>/` → 302 to clean URL; no/invalid token → 302 to `/p/<stack>` (gate UI).
- [ ] Password POST endpoint (e.g. `functions/s/[stack]/unlock.ts`): verifies PBKDF2
  hash, sets the same cookie. Rate-limited by a **WAF rule in the dashboard**
  (documented in `docs/deployment.md`, matching existing practice) + generic error
  copy, no oracle responses.
- [ ] `functions/p/[[path]].ts` gated file serving per above; verify a non-public
  bundle is *not* reachable without the cookie, and never present in `out/`.
- [ ] `scripts/make-link.mjs <stack> [--expires 30d]`: prints the magic URL (Node
  `crypto` HMAC, same secret from env).
- [ ] `noindex` on all stack/viewer routes; `public/robots.txt` + `_headers`
  `X-Robots-Tag` for `/p/*`, `/s/*`.

**Exit criteria:** token link unlocks and cleans the URL; password works and
rate-limits; direct file requests without a cookie 404; expired tokens and
post-`tokenVersion`-bump tokens fail closed.

### Phase 2 — Stack & viewer UX (1–2 days)

- [ ] Stack page component: framing note, option cards (thumbnail, title, tier,
  summary), responsive grid.
- [ ] Viewer: sandboxed iframe, breadcrumb, back-to-options, fullscreen escape hatch.
- [ ] Empty/error states: expired link ("ask Joel for a fresh link"), wrong password,
  missing prototype (404).
- [ ] Site chrome match: dark base, monospace, header lockup.

**Exit criteria:** full client flow (link → stack → prototype → back → next option)
works on desktop and phone.

### Phase 3 — Pilot: the small-business proposals (0.5 day)

- [ ] Package the three tiered proposals as bundles; write framing note and
  per-option summaries with tier labels.
- [ ] `scripts/make-link.mjs` with 60–90 day expiry aligned to the engagement.
- [ ] Dry-run as the client: fresh browser, phone, email the link to yourself.
- [ ] Send it. Optional: page-view ping for signal (reuse `/api/feedback` pattern).

**Exit criteria:** client reviews all three options without a support message.

### Phase 4 — Public Gallery & polish (0.5–1 day)

- [ ] `/gallery` index listing `listed: true` stacks as doorway-style cards (reuse
  the doorway card component when the redesign lands; stub with same visual language
  until then).
- [ ] Optional: per-option feedback (mailto v1, or small form → `/api/feedback`).
- [ ] Optional: expiry warnings in own view, link regeneration flow.
- [ ] OG metadata per public stack for link unfurls.

**Exit criteria:** Gallery ships with public explorations; unlisted stacks invisible.

## Effort summary

| Phase | Scope                   | Effort  |
| ----- | ----------------------- | ------- |
| 0     | Scaffold & spike        | 0.5–1 d |
| 1     | Access control core     | 1–2 d   |
| 2     | Stack & viewer UX       | 1–2 d   |
| 3     | Pilot with real client  | 0.5 d   |
| 4     | Public gallery & polish | 0.5–1 d |

**Total: ~4–6 working days.** Phases 0–3 get the client pilot out; Phase 4 is the
public layer.

## Security & ops checklist

- [ ] Gated bundles in R2 only — never in `public/`, never in the export (`out/`)
- [ ] `PROTOTYPE_TOKEN_SECRET` in Pages env vars; never in repo, manifest, or bundles
- [ ] Unguessable stack slugs *in addition to* tokens (defense in depth)
- [ ] WAF rate-limit rule on `/s/*` password endpoint; log failures
- [x] Shipped: `public/robots.txt` disallows `/p/`, `/s/`, `/protected-work`,
  `/api/`; the viewer route is per-route `noindex` and the Functions set
  `X-Robots-Tag: noindex, nofollow` on `/p/*` and `/s/*`
- [ ] Token expiry + revocation via per-stack `tokenVersion` bump
- [ ] Sandboxed iframes: prototypes can't touch top-window state or cookies
- [ ] Assume links get forwarded — gates stop casual browsers, not determined
  adversaries; don't host genuinely sensitive material

## Relationship to the homepage redesign

- **Decoupled:** Gallery ships as its own route with its own chrome; nav integration
  (fourth tab) waits for the redesign's persistent header.
- Reuses later: doorway card component for Gallery/stack cards.
- No conflicts: prototypes live under `/p/`, `/s/`, `/gallery`; the single-page
  experience at `/` is untouched.
