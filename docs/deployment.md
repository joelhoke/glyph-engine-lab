# Deployment — Cloudflare Pages

Production origin: **https://joelhoke.me** · Static export via
`output: 'export'` → `npm run build` emits `out/` · Pages project:
`jh-portfolio` (see `wrangler.toml`).

## The raw-HTML failure: investigation and fix

**Symptom.** Through the development tunnel and early Pages previews the page
occasionally rendered as raw, unstyled HTML.

**Evidence gathering (local reproduction of the serving layer).** The static
export was served from `out/` and every referenced asset was inspected:

- `GET /` → `200 text/html`
- `GET /_next/static/css/<hash>.css` → `200 text/css`
- `GET /_next/static/chunks/*.js` → `200 text/javascript`

The export itself is sound: correct paths (absolute `/_next/...`, so no
base-path issue), correct MIME types, no CSP in play, no service worker. The
HTML/JS/CSS contract holds end-to-end when assets are served as-is.

**Demonstrated cause.** The failure is environmental, at the layer in front of
the assets: when a request for `/_next/static/*.css` receives an **HTML
interstitial instead of the stylesheet** — a tunnel authorization/login page
(Cloudflare Access in front of the tunnel or the Pages preview) or an
HTML rewrite from an intermediate proxy — the browser's strict stylesheet MIME
check rejects it (`text/html` is never applied as CSS in standards mode) and
the page renders raw. The markup was never broken; the stylesheet never
arrived.

**Fixes shipped.**

1. `public/_headers` pins immutable caching for `/_next/static/*` and sets
   `X-Content-Type-Options: nosniff` plus baseline security headers on every
   response, so the platform's asset handling is explicit rather than assumed.
2. The page no longer depends on the external stylesheet for basic decency:
   `app/layout.tsx` inlines a minimal critical block covering the branded
   canvas fallback, the skip link, the `.visually-hidden` semantic digests
   (which would otherwise appear as duplicate raw text), and a true
   `<noscript>` note. A failed stylesheet now degrades to a presentable
   branded page instead of raw HTML.
3. Access policies must never cover asset paths: Cloudflare Access protects
   only `/protected-work*` and `/api/protected/*` (see the confidential-access
   section). The public site, including `/_next/*`, stays outside Access.

**Operational rules.**

- Do not put the whole Pages project (or its `*.pages.dev` previews) behind an
  Access policy that intercepts `/_next/*`; if preview protection is wanted,
  use Pages' built-in preview access, which serves assets correctly.
- If a dev tunnel is used, authenticate it without an HTML interstitial for
  asset requests (e.g. `cloudflared tunnel` with a named tunnel, not an
  Access-gated quick tunnel).
- After any deploy, smoke-test: `curl -sI https://joelhoke.me/` and one
  `/_next/static/css/*.css` URL from the HTML — both must return 200 with
  `text/html` / `text/css` respectively.

## Pages project setup

1. Create the Pages project `jh-portfolio` (direct upload or git integration).
2. Build command: `npm run build`. Output directory: `out`.
3. Before a direct upload, strip macOS AppleDouble files so `._*` artifacts
   never reach Pages: `find out -name '._*' -delete`.
4. Custom domain: `joelhoke.me` (apex via CNAME flattening; manage DNS in
   Cloudflare). Also attach `www.joelhoke.me` → redirect to apex.
5. `public/_headers` is honored automatically on every deploy.
6. Monitor usage against the free allowances (requests, Functions
  invocations, R2 Class A/B operations) in the Cloudflare dashboard.

## Rollback

Every Pages deployment stays available at its immutable
`<deployment>.jh-portfolio.pages.dev` URL. Roll back by promoting the previous
deployment in the dashboard (Deployments → ⋯ → Roll back). Do not delete the
previous production deployment until the new one passes the launch checklist.

## Confidential work

The confidential case-study viewer ships as a static shell
(`/protected-work?story=<id>`) plus Pages Functions under `/api/protected/*`,
backed by a **private** R2 bucket and a Cloudflare Access application.

### Architecture

- Public stories carry only an approved teaser and an opaque `protectedId`
  (`access: 'protected'` in `content/work.ts`). The ID reveals nothing; the
  mapping to private R2 keys (`manifests/<id>.json`, `media/<file>`) exists
  only in the bucket.
- `functions/api/protected/_middleware.ts` validates the Cloudflare Access
  JWT on every API request (RS256 against the team's JWKS, `exp`, `aud`) —
  the second layer after Access itself. Unset env fails closed (503).
- Endpoints: `GET /api/protected/work` (index), `GET /api/protected/work/:id`
  (manifest), `GET /api/protected/media/:id` (HTTP Range, 206 partial
  content, MIME allowlist: AVIF/WebP/JPEG/PNG/MP4/WebM/PDF/VTT).
- All protected responses: `Cache-Control: private, no-store`,
  `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer`, deny-all
  CSP on JSON. The viewer page is noindex and loads **no** analytics or
  third-party origins.
- IDs are validated against `^[a-z0-9][a-z0-9-]{0,63}$` (after decoding)
  before any R2 access — traversal, encoded separators, and unknown IDs are
  rejected with 400/404.

### One-time setup (Cloudflare dashboard)

1. **R2 bucket**: create a private bucket (e.g. `jh-protected-work`). Never
   enable public access, never place its contents under `public/`, in Git, or
   in the static export.
2. **Binding**: Pages project → Settings → Functions → R2 bucket bindings →
   bind the bucket as `PROTECTED_BUCKET` (production and preview). Dashboard
   bindings are the source of truth; `wrangler.toml` documents the names.
3. **Access application**: Zero Trust → Access → Applications → self-hosted:
   - Protect `joelhoke.me/protected-work*` and `joelhoke.me/api/protected/*`.
   - Auth method: one-time PIN (email OTP).
   - Policy: allowlist of approved email addresses. Every approved identity
     can read every protected story — per-story scoping is deliberately not
     implemented.
   - Session duration: **8 hours**.
4. **Env vars** (Pages project → Settings → Environment variables):
   - `ACCESS_TEAM_DOMAIN` — your team domain, `<team>.cloudflareaccess.com`.
   - `ACCESS_AUD` — the application's AUD tag (Zero Trust → Access →
     Applications → the app → Overview).

### Publishing confidential content

Keep the source directory **outside this repository**, laid out as described
in `scripts/publish-protected.mjs` (index + manifests + media). Then:

```
node scripts/publish-protected.mjs /path/to/confidential --bucket jh-protected-work --dry-run
node scripts/publish-protected.mjs /path/to/confidential --bucket jh-protected-work
```

The script validates the layout, IDs, MIME types, alt text, and file presence
before uploading via the wrangler CLI.

### Revocation, logout, rollback

- **Revoke a person**: remove their email from the Access policy (Zero Trust
  dashboard). Active sessions end within the 8-hour session TTL.
- **Revoke a story**: delete `manifests/<id>.json` and its `media/*` objects
  (`wrangler r2 object delete <bucket>/<key>`) and republish `index.json`.
- **Logout**: the viewer links to `/cdn-cgi/access/logout`, ending the Access
  session immediately.
- **Rollback**: Functions deploy with the Pages deployment; promote the
  previous deployment to roll both back. Bucket objects are unaffected by
  Pages rollbacks — re-run the publisher to restore content.

### Honest limitation

Access controls distribution — it cannot prevent an authorized visitor from
saving media or capturing their screen. Share confidential stories only with
people you trust with that ability.

## Feedback

`POST /api/feedback` stores visitor feedback (message + optional reply email)
in a **D1** database. Rows expire after **180 days** — timestamps are Unix
**seconds**, `expires_at = created_at + 180 * 24 * 60 * 60` — and expired rows
are deleted opportunistically on successful submissions. No IP, user agent,
analytics IDs, or page content is ever stored. There is no admin UI:
submissions are reviewed via the D1 dashboard or wrangler tooling.

### One-time setup (Cloudflare dashboard)

1. **D1 database**: create a database (e.g. `jh-feedback`):
   `wrangler d1 create jh-feedback`.
2. **Binding**: Pages project → Settings → Functions → D1 database bindings →
   bind the database as `FEEDBACK_DB` (production and preview). The function
   fails closed with 503 if the binding is missing.
3. **Migrations**: apply `migrations/` with wrangler:
   `wrangler d1 migrations apply jh-feedback` (add `--remote` for the remote
   database). The schema lives in `migrations/0001_create_feedback.sql`.
4. **Rate-limit rule**: Cloudflare dashboard → Security → WAF → Rate limiting
   rules → create rule:
   - Expression: `http.request.uri.path eq "/api/feedback"` and method `POST`.
   - Limit: **5 requests per 10 minutes**, counted **per IP**.
   - Action: **Block** (clients see 429).
   The function itself does not rate-limit; this rule is the enforcement.

### Operations

- **Review submissions**: D1 dashboard → `jh-feedback` → query
  `SELECT id, message, email, created_at FROM feedback ORDER BY created_at DESC;`
  or `wrangler d1 execute jh-feedback --command "..."`.
- **Manual cleanup** (beyond the opportunistic deletion):
  `DELETE FROM feedback WHERE expires_at < <unixnow>;`
  where `<unixnow>` is the current Unix time in seconds.
- **Rollback**: the function deploys with the Pages deployment; D1 data is
  unaffected by Pages rollbacks.

## Collaborate AI guide

The Collaborate page can answer visitor questions with an AI guide built
strictly from an approved knowledge pack (`functions/lib/collaborateProfile.ts`,
12 reviewed entries). Everything the guide may say traces back to a pack entry;
anything outside the pack is abstained and handed off to email.

### Architecture

- `POST /api/collaborate` (Pages Function, `functions/api/collaborate/index.ts`)
  receives the bounded conversation (≤ 12 visitor turns, ≤ 800 chars per
  message), classifies it into a routing category, and tries the category's
  candidate models in the approved `ROUTING_POLICY` order
  (`functions/lib/collaborateShared.ts`).
- Both candidates are called through **Cloudflare AI Gateway** (authenticated
  access, spend limits, metadata-only observability):
  - **OpenAI gpt-5.6-luna** via the Responses API with `store: false` and a
    strict `json_schema` response format.
  - **DeepSeek V4 Pro** (hosted on Fireworks infrastructure) via Chat
    Completions with `response_format: json_object`.
- The approved knowledge pack is sent **whole** in the system prompt on every
  turn — the corpus is small enough that embeddings/Vectorize would add
  moving parts without buying anything. Revisit retrieval only when the pack
  grows materially.
- Answers are **non-streaming**: the server validates the complete structured
  output (`validateModelAnswer` — JSON shape, 220-word cap, impersonation and
  commitment gates, source IDs must be active pack entries) before anything is
  shown. On timeout, provider error, rate limit, or invalid output the next
  policy candidate is tried; if both fail, a deterministic **email handoff**
  answer is returned (`modelClass: 'fallback'`) — no model involved.
- `POST /api/collaborate/share` stores an explicitly consented transcript in
  a **separate D1 database `jh-collaborate`** (binding `COLLABORATE_DB`,
  separate from `jh-feedback`). Rows expire after **180 days** (Unix-second
  timestamps, `expires_at = created_at + 180 * 24 * 60 * 60`). Expired rows
  are deleted two ways: opportunistically on writes, and by the daily
  scheduled cleanup Worker (`workers/collaborate-cleanup`, cron
  `17 4 * * *`). The visitor receives a random **receipt ID** they can quote
  to request early deletion. The optional reply email is never sent to a model.

### One-time setup (Cloudflare dashboard)

1. **D1 database**: `wrangler d1 create jh-collaborate`, then apply the schema
   from the repo root: `wrangler d1 migrations apply jh-collaborate --remote`
   (migration `migrations/0002_create_collaborate_shares.sql`).
2. **Binding**: Pages project → Settings → Functions → D1 database bindings →
   bind `jh-collaborate` as `COLLABORATE_DB` (production **and** preview). The
   share endpoint fails closed with 503 if the binding is missing.
3. **Cleanup Worker**: fill the `database_id` into
   `workers/collaborate-cleanup/wrangler.toml` and `wrangler deploy` from that
   directory (see its README).
4. **AI Gateway**: create a gateway with **authenticated access** enabled
   (Workers AI → AI Gateway → your gateway → settings → Authenticated
   Gateway, then create an API token).
5. **Env vars/secrets** (Pages project → Settings → Environment variables):
   `CF_ACCOUNT_ID`, `AIG_GATEWAY_ID`, `AIG_TOKEN` (gateway auth token),
   `OPENAI_API_KEY`, `DEEPSEEK_API_KEY`. The Function fails closed with 503 if
   the gateway config is missing.
6. **Spend limit**: set a gateway spend limit (**$20/month initial**) as the
   hard cost cap.
7. **Log payloads off**: the code sends `cf-aig-collect-log-payload: false` on
   every request — verify it in the gateway settings, because **raw prompts
   and answers are logged by default** otherwise.
8. **Rate-limit rule**: Cloudflare dashboard → Security → WAF → Rate limiting
   rules → create a rule alongside the existing feedback rule:
   - Expression: `http.request.uri.path eq "/api/collaborate"` and method `POST`.
   - Limit: **30 requests per 10 minutes**, counted **per IP**.
   - Action: **Block** (clients see 429).
   The 12-turn session limit itself is enforced in code
   (`COLLABORATE_MAX_VISITOR_TURNS` in `functions/lib/collaborateShared.ts`).

### Privacy and data handling

- Conversations are **ephemeral by default**: held client-side, never sent to
  GA4, never written to logs. A transcript reaches the server only when the
  visitor explicitly shares it.
- Gateway logging is **metadata-only** (the payload header above); provider
  calls carry no analytics identifiers.
- **Before launch**, verify that Cloudflare's hosted DeepSeek route preserves
  Fireworks' default zero-data-retention
  (<https://docs.fireworks.ai/guides/security_compliance/data_handling>).
  If it does not, remove `deepseek/deepseek-v4-pro` from `ROUTING_POLICY`.
- OpenAI is eligible with disclosure: API content is not used for training but
  may be retained up to 30 days for abuse monitoring unless a zero-retention
  agreement applies (<https://openai.com/enterprise-privacy/>). The adapter
  sends `store: false`.
- Shared transcripts are stored for 180 days with a consent version
  (`consent_version` column). **Early deletion** is a manual D1 delete by
  receipt ID for now:
  `wrangler d1 execute jh-collaborate --remote --command "DELETE FROM collaborate_shares WHERE id = '<receiptId>';"`

### Evals and model bake-off

`scripts/evals/run.js` scores each candidate model independently against the
question sets (`scripts/evals/questions.json`, `scripts/evals/adversarial.json`)
with hard gates (structured-output validity, voice, commitments, citations,
abstention quality). Run it **monthly**, and on any model, prompt, profile, or
price change:

```
node scripts/evals/run.js            # offline self-test, no keys needed
node scripts/evals/run.js --live     # full bake-off via the gateway
```

The report and a proposed routing policy land in `tmp-evals/` (`report.md`,
`routing-policy.proposed.json`). **Promotion is manual**: a human reviews the
report and copies the approved policy into `ROUTING_POLICY` in
`functions/lib/collaborateShared.ts`. Runtime routing is then automatic within
the approved policy — per category, candidates are tried in policy order, and
an empty array means no model serves that category (the deterministic email
handoff does). Cost figures in the report use list prices for relative
comparison; use actual gateway usage for economics — hosted rates differ from
list prices.

### Launch gates

All of the following before the guide ships:

- [ ] Full eval run shows **zero protected-detail leakage and zero invented
  hard facts** (employers, dates, titles, metrics, locations, numbers).
- [ ] Every returned source ID exists in the pack and supports the claims it
  is cited for.
- [ ] Third-person voice and correct abstention/email handoff in **every**
  boundary test (compensation, equity, availability, personal details,
  protected work, prompt injection, impersonation).
- [ ] Valid structured output after **at most one provider fallback**.
- [ ] **p95 latency < 8 s** and median accepted-answer **cost < $0.02**.
- [ ] Full UI/accessibility pass: keyboard, screen reader, `aria-live`
  announcements, focus restoration, 320px viewport, reduced motion, high
  contrast, and a no-JS `mailto:` fallback.
- [ ] Preview-tested with hiring managers, collaborators, and at least one
  startup founder.
- [ ] Flip the launch flag in `content/collaborate.ts`.
