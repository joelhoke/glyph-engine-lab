# Security audit and remediation — October 21, 2026

## Assessment

**Overall exposure: Moderate**, based on application reachability rather than
the highest package severity. The initial dependency audit found one critical
and two high package findings. Their production attack prerequisites are absent
in this static-export/Workers architecture, but the development and build tools
needed updates. Source review also confirmed a publicly reachable gallery
moderation bypass, now fixed. The separate FIFO deletion/abuse risk below remains.
The existing live deployment is unchanged until this branch is reviewed and
deployed; repository remediation does not establish that production is patched.

Scope: tracked source and configuration at base `325541bbc203861b240e02e2cd37cca8b9a86504`,
the committed npm lockfile, a clean dependency installation, the build output,
and local Cloudflare emulation. The primary checkout contained unrelated changes
and was left untouched. No production data, secrets, or infrastructure were changed.
Cloudflare account inspection was attempted but unavailable due to expired CLI
authentication. External providers' internal runtimes and dashboard controls are
outside the verified scope. This is a targeted audit, not a claim of complete security.

## Architecture and input boundaries

| Execution surface | Runtime and evidence | Untrusted-input exposure |
| --- | --- | --- |
| Local development | `next dev --webpack`; initial shell Node **26.5.0**; prior `.nvmrc` was only `22`, engines `>=22.13.0` | Next dev processes requests and proxies `/api/*` to local Pages. Development servers and tunnels must not be exposed as production servers. Malicious sites visited by a developer are relevant to the Next MCP advisory. |
| Build / CI | `next.config.js` has `output: 'export'`; `npm run build` emits `out/`; no pre-existing checked-in CI workflow | Repository content, npm packages, downloaded Google Fonts, and tooling responses cross trust boundaries. No build endpoint accepts visitor uploads. New CI selects patched Node via `.nvmrc`. |
| Production static requests | Cloudflare Pages serves HTML/CSS/JS; all routes in the production build are static/SSG | React 19.3.0 and Three.js 0.186.0 execute in the browser. No deployed Next server, Server Actions, ISR, image optimizer, or `next/og` route was found. |
| Production APIs | `functions/`, Web APIs/WebCrypto, D1 and R2 | Public feedback, chat/share, gallery uploads and password gates. Shared middleware bounds actual body bytes, rejects cross-site mutations, and applies atomic per-IP D1 limits. SQL values are bound. Uploads are stored as bytes; no Node Brotli or Sharp decoding. |
| Background service | `workers/collaborate-cleanup`, scheduled D1 retention | Cloudflare Worker with a cron handler, no public request handler; no Node process. |
| Auxiliary tools | Node verification, publishing, image conversion and optional live AI eval scripts | Local source/media and configured remote services. Sharp is used by developer image tools. Node fetch/TLS/decompression risk still matters for dependencies or malicious upstream responses. |

Pages compatibility date is `2026-08-20`; cleanup is `2026-09-21`. Neither
configuration enables `nodejs_compat`, and Functions/Worker source imports no
Node built-ins. Workers is a different runtime; changing `.nvmrc` does not patch
Cloudflare's request-serving binaries. Even Node compatibility APIs do not imply
the standard Node process ([Cloudflare runtime documentation](https://developers.cloudflare.com/workers/runtime-apis/nodejs/)).

Outbound AI destinations come from server configuration, not visitor URLs.
The Access JWKS destination comes from `ACCESS_TEAM_DOMAIN`. Visitor messages
are request payloads rather than DNS/TLS hostnames. No direct Node `dns`, `tls`,
`zlib`/Brotli, custom startup snapshots, single-executable apps, Node permission
model, or Node ZIP reader use was found in application request handling.

No tracked PHP source, Composer manifest/lockfile, PHP deployment, or associated
PHP service was found. PHP being available in a hosting build image is not evidence
of use. PHP advisories are therefore not applicable to this repository's evidenced
architecture; third-party service implementations remain unverified.

## Node.js advisory assessment

The [official October announcement](https://nodejs.org/en/blog/vulnerability/october-2026-security-releases)
and release pages confirm **[22.23.4](https://nodejs.org/en/blog/release/v22.23.4/)**,
**[24.22.1](https://nodejs.org/en/blog/release/v24.22.1/)** and
**[26.12.1](https://nodejs.org/en/blog/release/v26.12.1/)**. All were checked before
changing declarations. Local validation used 22.23.4 to stay on the intended 22.x
line; its Apple Silicon archive SHA-256 matched the official release checksum.

| Finding | Advisory severity / affected lines | Actual exposure and disposition |
| --- | --- | --- |
| CVE-2026-111497, Brotli decoder memory corruption/RCE | High; 22/24/26 | Initial Node 26.5.0 is affected. No public Node decoder; network clients/tooling can process upstream compressed data. Patch development/build tools. |
| CVE-2026-105482, NUL in DNS resolution names | High; 22/24/26 | No visitor-controlled hostname reaches Node DNS in deployed code. Tooling runtime patched. |
| CVE-2026-105483, fullwidth IP hostname validation | High; 24/26 | Initial local 26.5.0 is in an affected line; intended 22.x is not listed for this CVE. No public Node TLS client. |
| CVE-2026-106069, loosely resolving IP hostname validation | High; 22/24/26 | No demonstrated visitor-to-Node-TLS path; outbound tooling still needs patched runtime. |
| CVE-2026-105481, pre-request keep-alive response | Medium; 22/24/26 | Node HTTP client/tooling exposure, not Workers request handling. Runtime updated. |
| CVE-2026-106072, non-canonical IPv4 certificate validation | Medium; 22/24/26 | Same outbound tooling boundary; runtime updated. |
| CVE-2026-106074, repeated randomness in startup snapshots/SEAs | Medium; 22/24/26 | No such packaging found. Production WebCrypto UUIDs execute in Workers. |
| CVE-2026-106070, ZIP header validation | Low; 26 | No Node ZIP reader use found. Patched runtime required for 26.x. |
| CVE-2026-106071, permission wildcard lookup | Low; 26 | No Node permission-model sandbox found. |
| CVE-2026-106073, realpathSync permission bypass | Low; 22/24/26 | No Node permission-model sandbox found; runtime updated. |

The release also updates c-ares, CA trust, OpenSSL, SQLite and Undici as
applicable. The tested 22.23.4 binary reports c-ares 1.34.9, OpenSSL 3.5.9,
SQLite 3.53.4 and Undici 6.29.1. These bundled components are not fixed by
`npm audit` or a package-lock-only change. Brotli's reported version remains
1.1.0 despite the backported fix; the Node release is the relevant patch identity.

## Dependency findings

Versions below are the original locked versions, also reproduced with `npm ci`.
The original primary checkout's installed dependencies were not used for validation.

| Package / advisory | Severity | Before → fixed | Reachability |
| --- | --- | --- | --- |
| Next `next/og` RCE, [GHSA-vcvr-r3jv-pc5j](https://github.com/vercel/next.js/security/advisories/GHSA-vcvr-r3jv-pc5j) | Critical | 16.3.5 → 16.3.8 (RCE fix starts at 16.3.6) | No `ImageResponse` usage or Node image endpoint; not a confirmed production RCE in this app. Patched defensively. |
| Next dev MCP disclosure, [GHSA-39w2-rjm5-chcv](https://github.com/vercel/next.js/security/advisories/GHSA-39w2-rjm5-chcv) | Low per advisory | 16.3.5 → 16.3.8 | Development-only, reachable through a malicious site visited while dev runs. Registry advisory range identifies 16.3.8 as fixed; the upstream advisory's release label is incomplete. |
| Next image-optimizer SSRF, [GHSA-cjq9-62q9-8jv4](https://github.com/advisories/GHSA-cjq9-62q9-8jv4) | High | 16.3.5 → 16.3.8 | No deployed Next image optimizer or `next/image` usage. |
| Next Draft Mode/cache leak, [GHSA-3w37-wq28-93x7](https://github.com/advisories/GHSA-3w37-wq28-93x7) | Moderate | 16.3.5 → 16.3.8 | No Draft Mode / `use cache` feature usage. |
| Next SSG/ISR cache poisoning, [GHSA-4jqv-mc3x-m676](https://github.com/advisories/GHSA-4jqv-mc3x-m676) and [GHSA-mcj8-r9mp-w47p](https://github.com/advisories/GHSA-mcj8-r9mp-w47p) | Moderate | 16.3.5 → 16.3.8 | No request-time Next server or ISR cache; static files are served by Pages. |
| Next metadata route disclosure, [GHSA-f87g-xv8r-7p7x](https://github.com/advisories/GHSA-f87g-xv8r-7p7x) | Moderate | 16.3.5 → 16.3.8 | No dynamic metadata image route found. |
| Sharp/librsvg CVE-2026-96889, [maintainer advisory](https://github.com/lovell/sharp/security/advisories/GHSA-wq5f-xc86-pv6w) | High | 0.35.4 → 0.35.5 | Local image-processing tools; not invoked on uploaded production media. Untrusted local SVGs could matter. Updated native libvips packages as part of the patch. |
| source-map-js CVE-2026-93749, [upstream fix](https://github.com/7rulnik/source-map-js/pull/79) | High | 1.2.1 → 1.2.2 | Next/PostCSS build-tool dependency. No public source-map ingestion endpoint. Updated within the existing dependency range. |

React, React DOM, Three.js and the other direct dependencies had no reported
findings in this audit. That is a scanner result, not proof of absence of defects.
No major framework upgrade, force fix, package manager change or broad refactor
was performed. The npm lockfile retains platform-specific optional packages.

## Application findings

### Fixed: approved gallery content could be replaced without review

**Moderate; production reachable.** `POST /api/creations` accepts a visitor's
session identifier, and `upsertSessionCreation` updates the corresponding row.
Previously `CREATION_UPDATE_SQL` left `listed = 1` unchanged after approval,
so that same visitor could replace approved state/images without another review.
Rate limiting and unguessable session IDs do not stop the original submitter.

The update now atomically sets `listed = 0` alongside the replacement. Editing
and autosave continue to work; the public gallery/state routes exclude the new
content until approved again. No schema change is required. A real SQLite test
failed all three visibility assertions before the fix and passed afterward.
The create/approve/edit/unpublish sequence also passed through local Pages HTTP,
D1 and R2. Approved content that was changed before this fix is not automatically
identified or revoked; manually review current published entries if concerned.

### Unresolved: public submissions can evict approved gallery entries

**Moderate; production reachable.** `CREATION_EVICT_*_SQL` retains only the newest
100 rows regardless of moderation status. The existing public creation allowance
is 300 writes per ten minutes per IP. Distinct valid submissions can therefore
evict older approved rows and their R2 objects. This was confirmed from the SQL,
not exercised against production. It is independent of the moderation fix.

Resolution requires choosing how to preserve approved work when storage is full:
separate pending/approved quotas, reject submissions at capacity, or change the
documented FIFO gallery contract. This audit leaves that product/retention policy
unchanged rather than silently increasing retained data or disabling submissions.
Back up approved media and decide the policy before treating residual risk as low.

### Operational limits and existing defenses

- D1 rate limits fail closed and actual body sizes are bounded. These do not stop
  distributed abuse or guarantee an AI spend ceiling. Confirm provider-side caps,
  particularly the direct Moonshot route, in the dashboards.
- Access-protected APIs validate signatures, expiry and audience; prototype/admin
  cookies are signed and HttpOnly. Missing auth configuration fails closed in tests.
  Live Access policies, credential quality and R2 privacy were not reverified.
- Uploaded SVG is served with `default-src 'none'` and `nosniff`. Media URLs remain
  public capability URLs, including pending media, and can be cached for a day.
  Gallery moderation is not a confidentiality boundary. A stricter private-media
  requirement would need a separate access/cache design.

## Changes and validation

- `.nvmrc` selects 22.23.4; engines allow only patched 22/24/26 release lines.
  `.npmrc` enforces engines; install/dev/build hooks check the executing Node.
  The existing shell remains 26.5.0 globally; validation used an isolated verified
  binary. The guard rejected that old shell and accepted the selected runtime.
- Next 16.3.8, Sharp 0.35.5 and source-map-js 1.2.2; regenerated npm lockfile.
- Added a read-only, SHA-pinned GitHub workflow for runtime checks, `npm ci`, audit,
  security regression tests, production build and app/Worker type checking. It
  uses no production secrets and contains no deployment step.
- Clean `npm ci` with lifecycle scripts enabled: passed on Node 22.23.4/npm 10.9.9.
- Fresh online `npm audit --json`: **0 critical, 0 high, 0 moderate, 0 low**.
- `npm run verify:security`: passed runtime boundaries, request limits/body/CSRF,
  prototype auth, protected API/JWT, gallery and real SQLite moderation, feedback,
  AI routing with mocked providers, transcript sharing and retention failure cases.
- `npm run build`: passed; all exported routes static/SSG. Required network access
  for the existing Google Fonts download; initial sandbox-only build failed DNS.
- `npm run typecheck`: passed for the full app/Functions and cleanup Worker.
- Local Wrangler 4.148.0 compiled the Functions and served the built export.
  HTTP checks passed static routes/security headers, missing-auth fail-closed
  behavior, cross-origin/body/rate limits, multipart upload to R2, SVG CSP, and
  creation approval followed by an edit returning to the review queue.
- No lint script/configuration exists; no lint pass is claimed. No live paid AI
  calls, production writes, remote migrations, or live exploit tests were run.
  Physical-device visual testing and authenticated live Access flows were not run.

## Required follow-up

1. Review and merge the remediation branch through the normal deployment process.
   No production deployment was requested or performed by this audit.
2. Select the patched runtime in each developer shell (`nvm install && nvm use`).
   Existing installations and running dev processes do not change automatically.
3. Verify Pages production and preview `NODE_VERSION` overrides and build logs.
   Set `22.23.4` or let `.nvmrc` select it. See
   [Cloudflare's build-image selection documentation](https://developers.cloudflare.com/pages/configuration/build-image/).
   Cloudflare authentication must be restored to inspect these settings; never
   paste credentials into this report or a pull request.
4. Decide and remediate the gallery FIFO abuse policy described above; review
   previously approved entries and verify backups. This remains an explicit
   blocker to calling the residual application risk low.
5. Verify provider budgets, Access policies, retention cron health and private
   storage settings in their dashboards. These could not be established by a
   source audit or local tests. Require the new security check in branch protection
   if this should be a merge gate; workflow presence alone does not enforce it.
