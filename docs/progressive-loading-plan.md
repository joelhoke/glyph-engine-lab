# Progressive homepage loading

Prepared September 25, 2026, against the shipped About update (`29a2722`).
Status: approved; first implementation completed locally September 26, 2026.
Production build and browser checks pass. Local review is next.

## Implemented

- All five hero objects have server-rendered, theme-matched previews, captured
  from the real renderers. Each preview fades only after its object's first
  successful frame; reduced motion reveals immediately.
- Model initialization is limited to two jobs. Selected/focused hero objects
  and visible sections take priority; queued offscreen hero work waits for
  visibility. Unmounting or failure releases its place in the queue.
- Work keeps its existing images during model initialization. About uses the supplied transparent family artwork
  as its responsive placeholder and reveals after the loaded composition renders. Its
  HTML heading and copy survive failure without collapsing the artwork column.
- The phone's HTML chat stays mounted during loading and context loss, preserving
  drafts and focus. Vibe and Gallery have dedicated section-pose previews and
  retain their existing proximity gates.
- Eight PNG data maps now use smaller, lossless WebP equivalents. Decoded pixel
  equality was verified; originals and attribution remain in place. Referenced
  hero model data fell by 5.31 MiB, from about 19.76 to 14.44 MiB.
- Optional hand-flex sprites wait for interaction. Mobile initial geometry is
  closer to its hydrated geometry, and the canvas recovery branding no longer
  flashes behind the homepage composition.

See [validation and measurements](progressive-loading-validation.md) for the
review checklist, commands, and scope of the performance comparison.

The sections below preserve the approved sequence and its rationale.

## Intended experience

The homepage should look composed before its 3D objects are ready. Navigation,
copy, and links remain usable throughout loading. Each object starts as a static
render of that same object, in the same space, and transitions independently to
its interactive version after a successful first frame. No full-page loading
screen, global percentage, or wait for all five objects.

Use the existing desktop composition and mobile carousel. Preserve the About
scene's current theme treatment and mobile stacking. Dark-mode light brightness
is 200% on desktop and 100% on mobile; light mode stays at 100%.

## What the source inspection found

- `HomeHero` mounts all five hero objects. Their `active` prop primarily gates
  animation; it does not defer model loading.
- `HeroObject` shows fallback media only when its renderer is unavailable. It
  leaves an empty model slot during initialization. Existing fallback artwork
  does not consistently match the objects; the gallery fallback is a placeholder.
- `HomeNotebook` has a separate model/fallback path and needs the same treatment.
- `HeroThreeObject` reports failure through `onUnavailable`, but has no first-frame
  readiness callback. Model download completion alone is too early to reveal it.
- Sections already have proximity and visibility gates (`useSectionVisibility`).
  Some replace their fallback as soon as `near` becomes true, before rendering
  finishes. Keep those previews through initialization in a later pass.
- The portrait uses a high-priority center image. Additional head directions are
  preloaded on desktop pointer interaction; hand variants also preload on mount.
  Pencil and watercolor resources need separate consideration before deferring
  anything that could affect the current appearance.

### Asset inventory, not a performance baseline

These are rounded raw sizes of each hero model's glTF file plus its referenced
buffers and images. They are **not measured transfer sizes, initial requests,
load times, or decoded GPU memory**. Screen content and other homepage assets
are additional resources.

| Hero object | Referenced files | Raw total |
| --- | ---: | ---: |
| Work / CRT | 7 | 9.73 MiB |
| Vibe / brush | 3 | 0.06 MiB |
| Intro / notebook | 5 | 3.86 MiB |
| Collaborate / phone | 5 | 3.71 MiB |
| Gallery / frame | 5 | 2.40 MiB |
| Total | 25 | ~19.76 MiB |

The CRT normal map is approximately 5.20 MiB and its metallic/roughness map is
3.64 MiB. These are the first texture candidates to investigate. The blue finish
uses source texture detail, so removing maps outright would risk changing the
look. The section's iPhone model is separate from this hero inventory.

The complete pencil and watercolor sprite sets are 6.62 MiB and 6.41 MiB
respectively. Those totals include interaction variants and should not be
reported as initial page weight.

Browser access was approved for implementation. A limited production-build
baseline and comparison are recorded in the validation document linked above.

## Implementation sequence

### 1. Record the baseline and prepare matching previews

- Measure the production build, not the development server. Record the deployed
  commit, browser, viewport, network/CPU profile, and cold/warm cache conditions.
- Capture the request waterfall, first contentful paint, largest contentful
  paint, layout shifts, main-thread work, and time until each visible 3D object
  is usable. Use custom first-frame marks for the canvas objects rather than
  treating LCP as their readiness measurement.
- Export compact transparent previews from the actual five renderers using the
  shipped poses, framing, and finishes. Inspect both themes and mobile framing;
  create variants only where one image cannot match both. Generate from the
  real scene rather than approximate artwork.
- Store previews under `public/assets/home/hero-posters/` with explicit intrinsic
  dimensions and map them to their object IDs. Keep their byte cost small enough
  that the previews themselves do not become a new loading bottleneck.

### 2. First implementation: persistent previews and first-frame reveal

This is the first reviewable change. Keep the current model-loading order while
adding the visual loading lifecycle to all five objects, including the notebook.

| State | Visible result | Transition |
| --- | --- | --- |
| Poster / queued | Matching image in the existing slot | Model initialization starts |
| Loading | Same image; canvas initializes underneath | First successful usable frame |
| Ready | Live canvas; poster fades out | Normal interaction |
| Unavailable | Stable poster or existing functional fallback | Remount or deliberate retry |

- Render the poster in initial HTML. Keep the page and its text server rendered;
  do not disable SSR for the homepage to accommodate WebGL.
- Add a renderer callback such as `onFirstFrame`, fired once per initialization
  after a successful render with nonzero dimensions and the intended camera,
  pose, theme, and essential object content applied.
- Define essential content per builder. A video screen can use its poster for
  the first frame; readiness must not depend on autoplay permission or the end
  of optional media loading.
- Start with a roughly 200 ms opacity transition and validate visually. Reveal
  immediately with reduced motion. Do not introduce an artificial minimum wait.
- Keep identical slot geometry throughout. Preserve existing anchor hitboxes,
  focus styles, accessible labels, notebook behavior, and carousel controls.
  Posters are decorative where the containing link already names the object.
- Keep the poster on import, model, or WebGL initialization failure. Handle
  context loss after readiness by restoring a usable fallback. A slow request
  should remain on its poster, not be hidden by a timeout.
- Guard late callbacks after disposal or renderer replacement. Release listeners,
  timers, and per-instance GPU resources through the existing cleanup path.
- Avoid duplicate accessible content or loading announcements for decorative
  models. Keep functional phone/chat fallback content available where relevant.

### 3. Schedule expensive loading around what the visitor sees

Make this a separate change so its effects can be compared with step 2.

- Keep text, fonts, the initial portrait, and visible posters available promptly.
  Do not give every image or model the highest fetch priority.
- On mobile, prioritize the selected carousel slot (`work` initially). Promote a
  newly selected, focused, or tapped object without waiting for unrelated models.
- On desktop, use baseline evidence to choose the initial model priority. Trial
  a small initialization concurrency limit (for example, two), then measure;
  this is a starting hypothesis, not an established optimum.
- Preserve render-loop visibility gating separately from the loading queue.
  Reduced motion should still produce a usable static rendered frame.
- Coordinate hero and section priorities. Direct links such as `/#home/about`
  should prioritize their destination rather than queue behind an unseen hero.
- Defer optional sprite variants only after checking the current theme/style
  requirements. Keep the current frame until the next requested frame is decoded.
- Do not make the whole page await a shared `Promise.all` of every asset. Any
  idle-time loading path needs a fallback so queued content eventually loads.

### 4. Optimize the assets demonstrated to be expensive

- Start with the CRT's normal and metallic/roughness maps. Compare smaller
  dimensions and suitable compression at their actual rendered size, including
  the larger Work section presentation.
- Preserve map color-space semantics, UVs, material detail, and attribution.
  Consider separate hero assets if a smaller version degrades the section view.
- Re-measure transferred bytes, decode/upload work, and first-frame timing after
  each meaningful optimization. Review highlights and surface detail in both
  themes before accepting it.
- Do not add a shared decoded-scene cache casually. `gltfModel.ts` currently owns
  and disposes resources per instance; sharing textures or geometry changes
  that ownership contract. HTTP caching and shared live GPU resources are
  different concerns.

### 5. Apply the proven pattern to sections

Keep Work's image and iPhone fallback visible through first frame. Extend the
same behavior to other visible section models, preserving the phone's usable
chat fallback and media controls. For About, prepare a matching scene preview
while leaving the DOM body text and contact link immediately available; retain
an accessible heading before WebGL is ready and when it is unavailable.

Use existing proximity loading as the starting point. Reserve the same geometry
for previews and live scenes, including the mobile About stack. Validate deep
links and rapid scrolling before adjusting preload distances.

## Files involved

| File | Intended responsibility |
| --- | --- |
| `content/home.ts` | Hero poster metadata |
| `components/home/HeroObject.tsx` | Poster/loading/ready/failure presentation |
| `components/home/HomeNotebook.tsx` | Equivalent lifecycle for the special Intro path |
| `components/home/renderers/HeroThreeObject.tsx` | First-frame callback and renderer failure handling |
| `components/home/HomeMedia.tsx` | Existing image sizing and priority behavior |
| `components/home/HomeHero.tsx` | Preserve composition and carousel; later connect load priorities |
| `components/home/mobileHero.ts` | Existing mobile selection behavior to preserve |
| `components/home/HomeSpriteFrame.tsx` | Existing decode-before-swap behavior to preserve |
| `components/home/useSectionVisibility.ts` | Section proximity and activity gates |
| `components/home/HomeSection.tsx` | Later section preview retention |
| `components/home/AboutLightStudy.tsx` | Later About scene readiness and preview |

Read the installed Next.js guides before implementation, particularly
`node_modules/next/dist/docs/01-app/02-guides/lazy-loading.md`. Keep dynamic
WebGL loading inside the appropriate client boundary without sacrificing the
server-rendered shell.

## Review and acceptance

Test desktop (1440 × 900), mobile (390 × 844), and narrow mobile (320 px), with
light/dark themes, reduced motion, cold/warm cache, and constrained network/CPU.
Include direct section links, rapid navigation, mobile swipes, keyboard focus,
blocked model/texture requests, unavailable WebGL, and context loss.

The first change is ready when:

- Every hero slot has a recognizable preview while its model initializes.
- Each slot reveals independently after a successful first frame, with no empty
  flash or visible framing jump; no content moves because an asset finishes.
- Navigation, section links, and text remain available throughout loading.
- Failure preserves a useful image or functional fallback without an unhandled
  error or an endless page-level loading state.
- Existing docking, parallax, notebook, carousel, and accessibility behavior
  remain intact. Reduced motion skips the reveal animation.
- The production build and relevant existing hero verification scripts pass.
  Update `scripts/verify-hero-renderers.js` to assert initial poster markup;
  add focused lifecycle checks for late callbacks and failure transitions rather
  than brittle assertions about implementation text.
- Production measurements compare the same conditions before and after. Record
  regressions as well as gains; a smoother reveal alone is not evidence of
  reduced download or rendering cost.

After implementation, provide the local preview and a short review checklist
before committing or pushing, following the repository's review workflow.
