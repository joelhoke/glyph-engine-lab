# Progressive loading validation

Implemented locally September 26, 2026. The starting production revision was
`29a2722` (About light study). No commit or deployment is part of this validation.

## Local review

Run `npm run dev` and open:

- `http://localhost:3000/`: refresh in dark/light mode; the five objects should
  start as recognizable images and become interactive independently. On mobile,
  check carousel arrows, swipes, and destination links.
- `http://localhost:3000/#home/about`: confirm the family composition and HTML
  greeting remain visible while the scene initializes, then the 3D greeting and
  bulb take over. Check desktop and narrow mobile.
- `http://localhost:3000/#home/work`: both existing images remain until the CRT
  and iPhone are rendered. Playback becomes available with the CRT.
- `http://localhost:3000/#home/collaborate`: type a draft while the phone model
  is still loading; it should retain the draft and focus when the phone appears.
- `http://localhost:3000/#home/vibe` and `/#home/gallery`: section-pose previews
  remain while these models load. Ordinary content and links stay usable.

A throttled connection makes the transitions easier to inspect. The app does
not impose a delay when assets are already cached. Reduced motion skips fades.

## Changes and controls

`content/home.ts` maps model IDs to theme-specific previews.
`components/home/ModelPoster.tsx` selects the system theme before hydration;
section previews load lazily. `HeroThreeObject.tsx` reports readiness after a
successful nonzero-sized render, catches rendering/context failures, and retains
resource ownership through cleanup. Camera sizing uses the local element box,
so outer CSS transforms do not change the projection behind its preview.

`components/home/modelLoadQueue.ts` controls initialization independently of the
animation loops. The concurrency limit defaults to **2**. Priority values:
selected/focused hero **40**, visible section **30**, notebook **15**, Work **14**,
other visible hero **10**, nearby section **5**, offscreen hero **-1** (wait).
Changing these values changes loading order, not the page's visibility or links.
The limit is a measured starting point; slow requests can still keep models on
previews for a substantial time. In-flight requests are not preempted.

Hero and Work reveal fades are **200 ms**; About crossfades its placeholder,
scene, and HTML heading over **300 ms**. These live in `app/globals.css` and
`components/home/HomeSections.css`, with zero-duration reduced-motion overrides.
About brightness is **100% on mobile** in either theme, **200% on dark-mode
desktop**, and **100% on light-mode desktop**, including live breakpoint changes.
About's first-frame signal uses its existing `study-render` event after project,
theme, and layout initialization. Phone chat keeps the same DOM across its
fallback and projected presentations, including terminal WebGL failure.

## Asset reduction

Eight PNG normal/metallic/roughness maps were repacked to lossless WebP. The
optimization script compared the entire decoded RGBA buffers before changing
any glTF URI. No resolution, quantization, material, or color values changed.
Original PNGs and model licensing remain alongside the generated assets.

Referenced files for all five hero models now total **14.44 MiB**, approximately
**5.31 MiB smaller**. This excludes optional screen content and page resources.
The five initial hero previews add approximately **43 KiB per theme**. About
uses the user-supplied transparent family artwork in both themes and layouts,
encoded as a **113 KiB WebP** without changing its dimensions. It fits inside
the artwork slot rather than stretching across the section behind the copy.

Commands for regeneration:

```sh
node scripts/dev/capture-hero-posters.cjs http://localhost:3000
node scripts/dev/capture-section-posters.cjs http://localhost:3000
node scripts/dev/optimize-hero-textures.cjs
```

The texture script only rewrites a PNG reference when the WebP is both smaller
and pixel-identical. Already converted references are left alone.

## Supplementary production-build measurements

These are local lab samples, not field Core Web Vitals or a Lighthouse audit.
Chrome DevTools MCP was unavailable, so the skill's formal audit was not run.
The comparison used Playwright/Chrome, production static exports served locally,
5 Mbps download, 1 Mbps upload, 40 ms latency, 4× CPU slowdown, DPR 1, dark mode,
and disabled browser cache. Each page was observed for 45 seconds without input.
Headless Chrome does not reproduce a physical phone's GPU or a production CDN.

The table compares the original baseline with the core hero/queue/texture pass.
The final small Vibe/Gallery section previews were added afterward and verified
functionally. Treat the figures as directional samples, not repeatable promises.

| Observed metric | Desktop before | Desktop after | Mobile before | Mobile after |
| --- | ---: | ---: | ---: | ---: |
| First contentful paint | 1.47 s | 1.46 s | 2.22 s | 1.36 s |
| Observed LCP | 1.47 s | 1.46 s | 2.22 s | 1.36 s |
| First hero model draw | 31.95 s | 18.38 s | 30.58 s | 18.96 s |
| All five hero model draws | 41.78 s | 31.59 s | 40.19 s | 32.01 s |
| Hero preview downloads complete | — | ~3.4 s | — | ~5.3 s |

Desktop was 1440 × 900; mobile was 390 × 844 with touch/mobile emulation. The
first post-change desktop run recorded only three model draws; it is excluded
from the comparison. A repeat with request, console, and model-state logging
reported no errors and all five models ready. Both incomplete and repeated raw
results are retained locally rather than silently dropping the incomplete run.
The preview-download times come from Resource Timing, not a paint measurement.
The two complete comparison runs reported no unprompted layout shifts during
observation; this is not a field CLS assessment. No INP claim is made.

Reproduce the cold-load samples against a production export:

```sh
npm run build
python3 -m http.server 4173 --bind 127.0.0.1 --directory out
node scripts/dev/measure-home-loading.cjs http://127.0.0.1:4173 tmp-verify-progressive/after.json
```

The JSON includes every resource's transfer size and timing, model states,
first-frame marks, browser version, profile, and errors. Results and screenshots
live in ignored `tmp-verify-progressive/`.

## Verification

The production build, TypeScript, and these regression checks passed:

```sh
node scripts/verify-model-load-queue.cjs
node scripts/verify-hero-renderers.js
node scripts/verify-hero-dock.js
node scripts/verify-mobile-hero.js
node scripts/verify-hero-parallax.js
node scripts/verify-hero-finishes.js
node scripts/verify-about-light-study.cjs
node scripts/verify-light-study-physics.cjs
node scripts/verify-progressive-loading.cjs http://127.0.0.1:4173
```

The browser checks hold model requests to assert preview visibility, then release
those requests to assert readiness and unchanged slot dimensions. They cover
1440/390/320 px in both themes, reduced motion, unavailable WebGL, live context
loss, About deep-link success/failure, Work image retention, section-pose
previews, and chat draft/focus preservation. Queue tests cover priority promotion,
concurrency, idempotent release, pending cancellation, and visibility gating.
An About success check timed out during one full run; an isolated diagnostic
loaded successfully, and the subsequent full suite passed. Manual browser checks
also confirmed a warm reload and server-rendered previews with JavaScript disabled.
Existing dock, phone interaction, mobile navigation, material, heading-alignment,
and all 35 light-study physics/project tests remain passing.
