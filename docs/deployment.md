# Deployment — Cloudflare Pages

Production origin: **https://joelhoke.me** · Static export via
`output: 'export'` → `npm run build` emits `out/` · Pages project:
`glyph-engine-lab` (see `wrangler.toml`).

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

1. Create the Pages project `glyph-engine-lab` (direct upload or git integration).
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
`<deployment>.glyph-engine-lab.pages.dev` URL. Roll back by promoting the previous
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

## Creations gallery

Visitors can save vibe-playground compositions: `POST /api/creations`
(multipart: `state`, `configHash`, `kind`, optional `thumb` / `media` /
`source` files) stores the memento state and metadata in a **separate D1
database `jh-creations`** (binding `CREATIONS_DB`) and the binary media in a
dedicated R2 bucket (binding `CREATIONS_BUCKET`) under `thumb/`, `media/`, and
`source/` key prefixes. `GET /api/creations` returns the public gallery index
(listed rows only), `GET /api/creations/:id` returns one listed creation's
state, and `GET /api/creations/media/:key` streams media with HTTP Range
support (seekable `<video>`) and immutable year-long caching.

Rows are inserted **`listed = 0` (held for review)** and promoted manually —
there is no auto-publish. A duplicate `config_hash` short-circuits with
`200 { ok: true, duplicate: true }`. A global **FIFO cap of 100 rows** is
enforced on writes: the oldest rows are deleted and their R2 objects removed.
There is no TTL. Upload caps: state 512KB, thumb 1MB, clip media 25MB
(mp4/webm, `kind = 'clip'` only), source image 5MB. Both endpoints fail closed
with 503 if either binding is missing.

### One-time setup

Bindings are declared in `wrangler.toml` (this project's dashboard bindings
are locked to the toml) — they take effect on the next deploy.

1. **D1 database**: `jh-creations` already exists and its `database_id`
   (`dadd4690-af08-4ea8-8623-fa9a5bfd9cca`) is committed in `wrangler.toml` —
   nothing to create or paste. For a fresh environment, apply the schema:
   `wrangler d1 execute jh-creations --remote --file=migrations/0003_create_creations.sql`.
2. **R2 bucket**: `wrangler r2 bucket create jh-creations-media` (matches the
   `[[r2_buckets]]` block in `wrangler.toml`). Never enable public access —
   media is served only through `GET /api/creations/media/:key`.
3. **Rate-limit rule**: Cloudflare dashboard → Security → WAF → Rate limiting
   rules → create a rule alongside the existing feedback rule:
   - Expression: `starts_with(http.request.uri.path, "/api/creations")` and
     method `POST`.
   - Limit: **10 requests per 10 minutes**, counted **per IP**.
   - Action: **Block** (clients see 429).
   The prefix match is required: an exact `eq "/api/creations"` would miss
   `POST /api/creations/moderate` and the media paths. The admin login at
   `/api/creations/moderate` depends on this rule — there is no code-side
   lockout on the password check, so the WAF rule is the only brute-force
   throttle. The function itself does not rate-limit; this rule is the
   enforcement.
4. **Prototype unlock endpoint**: the password gate `POST /p/<stack>/_unlock`
   currently has **no** WAF rate-limit rule. Adding one (matching POSTs whose
   path ends with `/_unlock`) is recommended for stacks gated by a shared
   client password.

### Local preview

`wrangler pages dev` emulates both bindings from the `wrangler.toml`
declarations. Apply the schema to the local emulator first:
`wrangler d1 execute jh-creations --local --file=migrations/0003_create_creations.sql`.
`scripts/dev/seed-creations.js` seeds five sample creations against a running
dev server (and the moderation `UPDATE … SET listed = 1` with `--local`
promotes them).

### Moderation

Rows are reviewed on the site itself: `/gallery/creations` has a discreet
**Moderate** toggle (below the intro). Signing in with the admin password sets
an HMAC-signed `jh_creations_admin` cookie (HttpOnly, 14 days) via
`POST /api/creations/moderate` and reveals a **Pending review** queue with
Approve / Delete per piece (Delete also removes the R2 objects) plus Unlist on
listed pieces. Auth env (fail-closed when unset):

- `CREATIONS_ADMIN_PASSWORD` — PBKDF2 record (`pbkdf2$…`), generate with
  `node scripts/prototype-password.mjs` and set as a Pages project environment
  variable (dashboard) or in `.dev.vars` locally.
- `PROTOTYPES_AUTH_SECRET` — the existing shared signing secret, reused for
  the admin cookie.

The only way to revoke live admin sessions is rotating `PROTOTYPES_AUTH_SECRET`
— unlike prototype links, the admin cookie has no `tokenVersion`, so a rotation
also revokes every prototype gate cookie/link at once.

The wrangler CLI remains as a fallback:

- **List pending**:
  `wrangler d1 execute jh-creations --remote --command "SELECT id, kind, created_at FROM creations WHERE listed = 0 ORDER BY created_at DESC"`
- **Approve**:
  `wrangler d1 execute jh-creations --remote --command "UPDATE creations SET listed = 1 WHERE id = '<id>'"`
- **Reject/delete**:
  `wrangler d1 execute jh-creations --remote --command "DELETE FROM creations WHERE id = '<id>'"`
  — then also delete the row's R2 objects (`thumb/<id>.*`, `media/<id>.*`,
  `source/<id>.*`) from the `jh-creations-media` bucket, e.g.
  `wrangler r2 object delete jh-creations-media/thumb/<id>.webp`.
- **Purge edge cache after a delete**: Cloudflare dashboard → Caching →
  Purge Cache → Custom Purge (purge by URL) for
  `/api/creations/media/thumb/<id>.*`, `/api/creations/media/media/<id>.*`,
  and `/api/creations/media/source/<id>.*`. Media responses are cached
  `max-age=86400` since the safety pass (previously a year, immutable), so a
  deletion propagates within a day even without a purge.

## Collaborate AI guide

The Collaborate page can answer visitor questions with an AI guide built
strictly from an approved knowledge pack (`functions/lib/collaborateProfile.ts`,
28 reviewed entries). Everything the guide may say traces back to a pack entry;
anything outside the pack is abstained and handed off to email.

### Architecture

- `POST /api/collaborate` (Pages Function, `functions/api/collaborate/index.ts`)
  receives the bounded conversation (≤ 12 visitor turns, ≤ 800 chars per
  message), classifies it into a routing category, and tries the category's
  candidate models in the approved `ROUTING_POLICY` order
  (`functions/lib/collaborateShared.ts`).
- Candidates:
  - **Moonshot Kimi K2.6** via Chat Completions with `response_format:
    json_object` (primary candidate; the upstream model id is
    `MOONSHOT_MODEL`-overridable, default `kimi-k2.6`). For launch it goes
    **direct to api.moonshot.ai** (`AIG_MOONSHOT_URL` in `wrangler.toml`) —
    the gateway has no native moonshot provider. Its spend is therefore not
    covered by the gateway spend limit; watch the Moonshot balance instead,
    and revisit a gateway Custom Provider later to bring it under the gateway.
  - **DeepSeek V4 Pro** (hosted on Fireworks infrastructure) via Chat
    Completions with `response_format: json_object`, through **Cloudflare AI
    Gateway** (authenticated access, spend limits, metadata-only
    observability).
  - **OpenAI gpt-5.6-luna** via the Responses API with `store: false` and a
    strict `json_schema` response format, through the gateway.
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
5. **Env vars/secrets**: this project manages non-secret vars through
   `wrangler.toml` (`[vars]`: `CF_ACCOUNT_ID`, `AIG_GATEWAY_ID`) — the dashboard
   accepts **only secrets**: `AIG_TOKEN` (gateway auth token), `MOONSHOT_API_KEY`,
   `OPENAI_API_KEY`, `DEEPSEEK_API_KEY` (Pages project → Settings → Variables
   and Secrets, production **and** preview). The Function fails closed with 503
   if the gateway config is missing. `MOONSHOT_MODEL` is an optional non-secret
   var (add to `wrangler.toml` `[vars]`) overriding the default
   `kimi-k2.6` upstream model id.
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

### Local preview (no credentials needed)

The full conversation loop runs locally against a mock model server:

1. `COLLABORATE_AI_GUIDE` is already `true` in `content/collaborate.ts` (the
   guide has shipped) — no flip needed. The verify script
   (`scripts/verify-collaborate-content.js`) only asserts the flag exists and
   is a boolean; it does not pin the value.
2. `npm run build` (wrangler serves the static export, not the Next dev server).
3. `node scripts/dev/mock-collaborate-model.mjs` — serves both provider wire
   formats on :8790 with canned, validation-passing answers. Test knobs in a
   visitor message: `mock_fail_openai` (provider fallback), `mock_invalid`
   (malformed output fallback), `mock_fail_all` (deterministic email handoff).
4. `npx wrangler pages dev out --port 8788 --d1 COLLABORATE_DB=local-collaborate`
   — `.dev.vars` (gitignored, dummy IDs + the mock URLs) points the adapters at
   the mock via the `AIG_OPENAI_URL` / `AIG_DEEPSEEK_URL` overrides.
5. First run only, to enable the share flow locally: apply
   `migrations/0002_create_collaborate_shares.sql` to the local D1 sqlite under
   `.wrangler/state/v3/d1/miniflare-D1DatabaseObject/`.

### Privacy and data handling

- Conversations are **ephemeral by default**: held client-side, never sent to
  GA4, never written to logs. A transcript reaches the server only when the
  visitor explicitly shares it.
- Gateway logging is **metadata-only** (the payload header above); provider
  calls carry no analytics identifiers.
- **Before launch**, verify the data-retention terms of every serving provider:
  that Cloudflare's hosted DeepSeek route preserves Fireworks' default
  zero-data-retention
  (<https://docs.fireworks.ai/guides/security_compliance/data_handling>), and
  Moonshot's API data policy for Kimi. If either does not hold up, remove that
  adapter from `ROUTING_POLICY`.
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

**Shipped 2026-08** — all gates passed and the guide is live
(`COLLABORATE_AI_GUIDE = true` in `content/collaborate.ts`). Kept here as the
regression checklist for any model, prompt, profile, or pack change:

- [x] Full eval run shows **zero protected-detail leakage and zero invented
  hard facts** (employers, dates, titles, metrics, locations, numbers).
- [x] Every returned source ID exists in the pack and supports the claims it
  is cited for.
- [x] Third-person voice and correct abstention/email handoff in **every**
  boundary test (compensation, equity, availability, personal details,
  protected work, prompt injection, impersonation).
- [x] Valid structured output after **at most one provider fallback**.
- [x] **p95 latency < 8 s** and median accepted-answer **cost < $0.02**.
- [x] Full UI/accessibility pass: keyboard, screen reader, `aria-live`
  announcements, focus restoration, 320px viewport, reduced motion, high
  contrast, and a no-JS `mailto:` fallback.
- [x] Preview-tested with hiring managers, collaborators, and at least one
  startup founder.
- [x] Flip the launch flag in `content/collaborate.ts`.
