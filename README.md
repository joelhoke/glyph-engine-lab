# PortfolioRenderer

## Adding a source type

Any file type becomes a source by producing one decodable frame for the shared
sampler (`engine/svgTargetSource.ts`): draw it to an offscreen canvas once,
sample the visible pixels, done. Nothing downstream — glyph assignment,
simulation, renderer — changes per type.

Officially accepted uploads: SVG (under 1 MB, self-contained, sanitized) and
PNG/WebP (under 4 MB, at most 4096 px per dimension). Everything else — JPEG,
AVIF, GIF, video, and animated SVG — is unsupported and rejected at selection.
A new type joins the accept list only after it meets the guardrails below and
passes real-device smoke tests.

Animated sources are a separate, internal path (`engine/animatedSource.ts`):
an owned offscreen provider renders frames downscaled into a tier-sized
staging canvas, and only that staging surface is sampled. The Black hole is
the only shipped provider; there is no public animation API, and new
providers follow the same lifecycle (`start`/`resize`/`renderFrame`/
`setPaused`/`stop`) rather than entering the upload accept list.

Guardrails for any new type:

- Decode once, never per frame.
- Cap file size and pixel dimensions before decode.
- Sampling stays viewport-bound via `resolveSamplingStep`.
- Ship a verify script for its validators (`scripts/verify-*.js`).
- Check FPS with `?debug=true` before shipping.

A type that can't meet these doesn't enter the engine.
