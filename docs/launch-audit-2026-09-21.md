# Pre-push audit — 21 September 2026

Scope: current working tree and a fresh production export, plus read-only HTTP checks against joelhoke.me. No functional changes, commits, pushes, or deployments were made during this audit. The local development preview was restarted on port 3000 afterward. The production site is an earlier deployment, so live transport checks do not prove that the new homepage has been deployed.

Recommendation: address the confirmed privacy/consent problems, large assets, dependency findings, and unverified server-side abuse controls before launch. Existing build and metadata foundations are sound.

| Item | Finding and action |
| --- | --- |
| Privacy policy | Partial: the `?` panel contains a notice, but there is no dedicated public policy route. Its claim that uploads never leave the browser conflicts with Vibe autosaves that can send the original uploaded image, thumbnail, and creation state to the server. Seattle weather wording is also outdated. Publish an accurate, easily linked notice covering feedback, uploads/autosaves, sharing, AI providers, analytics, retention, and contact/deletion requests. |
| Terms & conditions | No dedicated terms found. Recommend short terms for the playground/upload and AI features: ownership, permission to store/display creations, prohibited content, moderation/removal, and AI limitations. This is a recommendation for this site's features, not a claim that every portfolio legally requires identical terms. |
| Frontend secrets | No common API-key/private-key patterns or prototype password hashes found in scanned public-facing source or generated JS/HTML. Model-provider secrets are server environment bindings; `.dev.vars` is ignored. Add `.env*` exclusions before introducing those files. This pattern scan is not a guarantee that arbitrary secrets cannot exist. |
| HTTPS | Live HTTP root returns 301 to HTTPS; HTTPS root returns 200. Baseline security headers are present. HSTS was not present in the sampled HTTPS response; consider enabling after confirming all affected hosts support HTTPS. |
| Cookie consent | Analytics is opt-in through the privacy panel; no automatic banner. A banner is not a substitute for consent enforcement, and an additional banner is not needed merely to duplicate an off-by-default choice. **Confirmed bug:** Allow → No thanks still leaves the analytics client active and able to emit events until reload. Fix withdrawal and test cookie/provider shutdown. |
| Meta titles/descriptions | Root and Gallery have configured titles, descriptions, and canonicals. Hash-based Work/Vibe experiences share the homepage metadata rather than independent crawlable pages. |
| Social preview image | Present and wired to Open Graph/Twitter: `/assets/og-1200x630.png`, 1200×630, 39,774 bytes. |
| Favicon | Present and linked. Actual files are 28×32 and 161×180, matching the metadata but not their filenames. Square 32×32 and 180×180 canvases are a useful polish item. |
| Sitemap / robots | Both present. Sitemap includes `/` and `/gallery`; creations, prototype, and protected routes are intentionally noindex or disallowed. Robots is discoverability guidance, not access control. |
| Image alt text | All 47 `<img>` occurrences in the generated HTML have an alt attribute. Empty alt is appropriate for decorative/duplicated card imagery with adjacent titles. This does not prove all descriptions or runtime-loaded images are semantically correct. |
| Image compression | Needs work: CRT normal/base-color/metallic-roughness PNGs total **44.44 MiB**; supplied Global Operations thumbnail is **7.13 MiB**, 3920×2240. Resize/compress the thumbnail and prepare appropriate optimized texture assets. Preserve normal/roughness map semantics and verify rendering. |
| Page speed | Build reports **243 kB first-load JS** for `/`, before runtime model/media loads. H.264 reel is **19.33 MiB**. Lazy media and offscreen suspension exist, but they do not establish measured speed. No Lighthouse/Core Web Vitals result was obtained. |
| Color contrast | Core text/muted/accent token pairs pass on their page backgrounds; phone text on peach is about **14:1**. Light-theme faint text `#64748b` on `#f4f6f9` is **4.40:1**, below 4.5:1 for normal text; this token is used by small footer text. Darken that token slightly. Translucent/moving backgrounds and focus/control contrast still need a rendered audit. |
| Mobile responsiveness | Dedicated mobile composition and layouts exist; recent mobile, keypad, gallery-loop, and history regression checks passed. User screenshots have informed the changes. Final real-device Safari/Chrome and keyboard/focus review remains unverified. |
| Custom 404 | Functional generated Next 404 exists; sampled missing routes return HTTP 404 locally and in production. No custom `app/not-found.tsx`; branded recovery links would be useful polish. |
| Broken links | All 12 unique internal path targets extracted from generated anchors resolve to exported files. Four of nine external targets returned 200; Microsoft returned four 403s and LinkedIn 405 to automated HEAD checks, so those five remain unverified rather than proven broken. Dynamic hashes, mailto delivery, and gated/R2 assets are outside that static check. |
| Form validation | Feedback, AI chat, and creation payloads have server validation and limits; tested validation passed. The feedback suite has one stale assertion expecting “Privacy and feedback” while the actual accessible label is “Privacy, feedback, and credits.” |
| Spam protection | Feedback honeypot exists. Feedback, chat, and creations depend on Cloudflare WAF rules for rate limits; live rule settings were not accessible in this audit. Deployment docs explicitly say prototype `/_unlock` has no WAF rate limit. Confirm/configure these controls; CAPTCHA need is secondary to rate limits and AI spend caps. |
| Analytics | GA4 opt-in implementation exists. No configured GA measurement ID found in this local production export; production build environment configuration and GA delivery remain unverified. Fix the consent-withdrawal bug before enabling it. |
| Single clear CTA | A product decision, not a universal one-button requirement. The hero intentionally offers five destinations with Work initially selected; each section has a relevant action. For a hiring-focused portfolio, make Work the clearest primary path. No need to remove useful contextual actions solely to satisfy the checklist. |

Confirmed consent-withdrawal reproduction: compiled `engine/analytics.ts` with a mocked document and `gtag`; called `grant()`, `deny()`, then `track(experience_view)`. Result: `activeAfterWithdrawal: true`, `eventsSentAfterWithdrawal: 1`. No requests were sent to Google. The existing analytics suite passes because it checks initial denial, not withdrawal after grant.

Privacy evidence: `components/AnalyticsConsent.tsx` says uploads never leave the device. `components/PortfolioExperience.tsx` captures an uploaded blob up to 5 MiB and passes it to `saveCreation`; `engine/creationClient.ts` includes it in multipart server requests. Qualified Vibe sessions also autosave after a debounce. The notice needs to describe this behavior, not simply say “optional uploads.”

Dependency audit: `npm audit --omit=dev` reports **1 critical and 2 high affected packages**: Next, PostCSS, and nanoid. Next is currently 14.2.5. Assess and patch supported dependencies before launch; do not assume the suggested patch clears every advisory. Many reported Next advisories require server features not used by this `output: 'export'` deployment, so the counts do not prove an exploitable production endpoint. The development server and build toolchain still warrant review. Full npm JSON is in `/tmp/jh-launch-dependency-audit.json` for this session.

Validation performed:

- `npm run build`: passed, 17 static pages, including type checking/linting.
- `node scripts/verify-analytics.js`: passed, with the withdrawal coverage gap above.
- `node scripts/verify-collaborate-api.js`: passed against mocked providers.
- `node scripts/verify-creations-api.js`: passed against mocked storage/auth.
- `node scripts/verify-feedback.js`: validation/handler checks passed; one outdated accessible-label assertion failed.
- Public credential-pattern scan: no matches, repeated against the fresh export; no secret values printed.
- Static export links, alt attributes, file dimensions/sizes, token contrast calculations, live HTTPS redirect, and HTTP 404 behavior checked.

Browser limitation: the [web-perf skill](/Users/joelhoke/.codex/skills/web-perf/SKILL.md) requires Chrome DevTools tools and says, “If unavailable, STOP—the chrome-devtools MCP server isn't configured.” Those tools are not available in this session. Accordingly, this report contains no invented speed scores, rendered contrast results, or real-device sign-off. Asset sizes are disk sizes, not measured compressed network transfer totals.

Reference guidance: [ICO privacy-notice content](https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/individual-rights/the-right-to-be-informed/what-privacy-information-should-we-provide/) describes information to disclose where that framework applies; [ICO storage/access guidance](https://ico.org.uk/for-organisations/direct-marketing-and-privacy-and-electronic-communications/guidance-on-the-use-of-storage-and-access-technologies/what-are-storage-and-access-technologies/) explains consent and exceptions; [W3C minimum contrast](https://www.w3.org/WAI/WCAG21/Understanding/contrast-minimum) gives the text thresholds; [Next static-export documentation](https://nextjs.org/docs/app/guides/static-exports) explains the distinction from server-hosted features. Exact legal obligations depend on the site's operation and applicable jurisdictions.

## Approved local remediation

The findings above preserve the original audit. The following changes were
subsequently implemented after approval; no commit, push, or production
configuration change has been made.

- Added `/privacy` and `/terms`, footer/panel links, route metadata and sitemap
  entries. Corrected the privacy panel, Vibe introduction and upload notice
  to disclose server autosaves, uploaded source images and gallery review;
  removed the obsolete Seattle-weather and local-only promises.
- Fixed consent withdrawal without reloading, provider disablement, accessible
  GA-cookie removal, late script-load races and explicit regrant. Regression
  tests use a mocked browser and send nothing to Google.
- Upgraded Next 14.2.5 → 16.3.5 and React 18.3.1 → 19.3.0. Adapted dynamic
  route params and the nullable canvas ref; retained Webpack. Full npm audit
  and production-only npm audit now report **zero known vulnerabilities**.
- Added `.env*` ignore rules with example-file exceptions. No credential
  rotation was performed: the public-code scan found no exposed secrets.
- Reduced the Global Operations thumbnail **7,473,591 → 76,260 bytes** by
  resizing to 1960px and encoding WebP. All uses follow its central constant.
  CRT texture set **47,196,142 → 10,016,149 bytes**: color maps are JPEG,
  normal/material maps remain PNG, dimensions capped at 2048px. Added the
  texture modifications to the model credit. Original source copies are in
  `/tmp/jh-launch-original-assets` for this session.
- Darkened light-theme faint text to `#5c6c82`. Added a branded 404 and padded
  existing favicon art to actual 32×32 and 180×180 squares.
- Added middleware protecting feedback, chat, sharing, creation writes,
  moderation and prototype password attempts. Atomic D1 counters, bounded
  bodies, origin checks, Retry-After responses, HMAC IP identifiers, and
  fail-closed behavior have regression coverage against real SQLite SQL.
  Migration `0005_request_limits.sql` has been applied **locally only**.
- Updated stale tests that expected outdated privacy claims/accessibility text.

Verification: production export and Cloudflare Functions compilation pass.
Analytics, feedback, chat/provider, sharing, creations, request protection,
Vibe copy, mobile hero, gallery loop, scroll/history, phone keypad and 3D dock
regressions pass. Real local Pages/D1 integration returned 201 for feedback
and transcript sharing, 429 after the feedback allowance, 413 for an oversized
chat body, 200 for both policy routes/assets, and 404 for a missing route.
Test submissions were removed from local storage afterward.

### Still required before launch

- **Production storage and retention:** read-only `wrangler d1 list` found
  only jh-creations. Feedback/shared-chat databases and bindings are not
  provisioned; the transcript cleanup Worker's binding is still a template.
  Add those and verify scheduled retention. Apply the request-limit migration
  to production **before** deploying the middleware. Exact order is in
  `docs/deployment.md`, “September 2026 launch remediation.”
- **Provider/analytics configuration:** production provider secrets, direct
  Moonshot spend cap, and analytics measurement ID/delivery remain unverified.
  Missing local provider credentials prevent a live AI response check.
- **Rendered review and speed measurement:** no attached browser/DevTools was
  available. No Lighthouse score, Core Web Vitals result, complete rendered
  contrast/accessibility audit, or real-device approval is claimed. The asset
  savings are measured file sizes, not observed loading times. Review both
  themes and mobile interactions after the framework upgrade.
- **Policy review:** the new text describes current behavior and should be
  reviewed as site copy, including the autosave/gallery permissions and
  provider handling. It is not a certification of legal compliance.

Preview: http://localhost:8788/ (Pages Functions and local storage), with
http://localhost:8788/privacy and http://localhost:8788/terms for copy review.

### Preview follow-up: reel and paint artifacts

The supplied Global Operations artwork remains the gallery thumbnail; the
homepage and case-study reel now use their original RealComm poster again.
The MP4 source was never replaced. HTTP probes found a local Wrangler
preview limitation: port 8788 returns 200/the whole file for `Range: bytes=0-1`,
whereas both production and Next dev on port 3000 return 206/two bytes.
Use http://localhost:3000 for Safari video review; its API proxy still uses
the Pages/D1 service on 8788. Do not infer a production video failure from
Wrangler's local static-media response.

Section CTA hairlines now paint as inset strokes. Paint containment is scoped
to the work stage and individual gallery image frames, keeping the carousel
full bleed and the decorative portrait free to overlap. This is a targeted
mitigation for the reported stray lines, not a visually verified root-cause
fix: browser discovery returned no connected browsers and Computer Use could
not start. Reel lifecycle/crop, gallery-loop, and mobile-hero checks pass;
the user still needs to confirm the resulting appearance in Safari.

### Reel playback follow-up

The compositor now requests `play()` while the video is still loading instead
of requiring a decoded frame first. Muted/inline attributes are set before
loading. Playback rejection is reported to the section; the control reads
“Play reel” until playback actually starts, rather than always assuming it is
playing. Clicking Play invokes the media directly within the user event so a
browser that requires user activation can authorize it. Reduced motion keeps
a static poster by default but allows explicit playback. The video remains
parked offscreen and on manual pause. Regression coverage includes loading,
autoplay rejection, synchronous manual retry, reduced-motion opt-in, crop,
pause races and disposal. Actual embedded-browser playback still needs user
confirmation; browser tools are unavailable in this session.

### Approved release preparation — September 21

The user reviewed the final local experience and approved commit/push to main,
including the blue pencil-sketch resting sprites and watercolor interaction.
The entire computer is now the accessible play/pause target; there is no
separate visible play/pause button. The user confirmed the reel and appearance.

Production request-limit schema was applied to jh-creations. Separate
jh-feedback and jh-collaborate databases were created and initialized with
their own schemas; real bindings are checked into wrangler.toml. The daily
retention Worker now sweeps both databases, with regression coverage proving
expired-row deletion, current-row preservation, and independent error handling.
Production secret names confirm MOONSHOT_API_KEY, OPENAI_API_KEY, AIG_TOKEN,
PROTOTYPES_AUTH_SECRET, and CREATIONS_ADMIN_PASSWORD are configured; values
were neither printed nor committed. Provider spend caps remain unverified.

Final production export passes. Runtime regression checks cover the reel,
mobile hero, gallery loop, physical keypad, request protection and retention.
Browser performance scores remain unmeasured; the user's visual review does
not substitute for a Lighthouse/Core Web Vitals measurement.
