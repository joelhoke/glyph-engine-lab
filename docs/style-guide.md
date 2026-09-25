# joel hoke design — Style Guide

Source of truth for the brand as implemented on **joelhoke.me**. Every value
here is drawn from the shipped code (`app/globals.css`, `engine/`,
`content/`, `public/`) — when the two disagree, the code wins until one is
updated. Structure follows the key elements of a brand style guide (brand
story, audience, visual identity, voice, writing guidelines) from
[Figma's style guide primer](https://www.figma.com/resource-library/what-is-a-style-guide/),
plus component and accessibility sections specific to this site.

---

## 1. Brand story

A design portfolio that is itself the portfolio piece: text glyphs form
images, weather, and black holes on a persistent canvas, and the visitor can
bend every scene. The brand stands for craft at the intersection of people,
business, and technology — thoughtful, experimental, and a little playful,
never loud.

Positioning line (from the Work intro): *"Designing thoughtful experiences
where people, business, and technology meet."*

## 2. Audience

- **Hiring managers, design leaders, recruiters** — scanning Work for depth
  and outcomes. Give them real numbers and plain narrative, fast.
- **Potential collaborators and clients** — the Collaborate mode speaks to
  them directly, in first person, with low-friction contact.
- **Peers and the curious** — Vibe invites play; it should feel generous,
  not like a demo reel.
- **Approved confidential viewers** — NDA work behind authenticated access;
  tone there is professional and sparse.

## 3. Visual identity

### 3.1 Logo

- **Mark**: the "JH" monogram (`public/JHLogo-180.png`) and the full
  logotype (`public/assets/JH-Logotype.svg`, 511×182 viewBox, ships in the
  light brand gradient). The logotype is the landing hero source; the
  monogram is the default mark for Vibe/Collaborate and the decode-failure
  fallback everywhere.
- **Glyph-field form**: the monogram is also rasterized into the canvas
  target field (`LOGO_PATHS` in `engine/constants.ts`).
- **Usage**: show on dark backgrounds at ≥ 34 px (protected header) up to
  200 px (OG image). Never recolor the PNG; on the canvas, both mark and
  logotype take the fixed landing gradient (§3.2).

### 3.2 Color

**Theme tokens**: page, canvas, surface, text, text-muted, border, and
accent are semantic tokens defined twice — CSS custom properties in
`app/globals.css` (`--color-*` on `:root`, the dark default, overridden
inside `@media (prefers-color-scheme: light)`) and a typed canvas palette
in `engine/theme.ts` (`CANVAS_THEMES`). The shipped theme follows the
visitor's system preference (`useSystemTheme` in
`engine/useSystemTheme.ts` mirrors the same media query for the canvas);
there is no `data-theme` attribute, toggle, or persistence. Scene and
preset canvas colors carry dark+light tables resolved per theme
(`engine/playgroundTheme.ts`); the exact light palettes live in
`engine/sceneConfig.ts` and `content/vibe.ts`. The tables below are the
dark values.

**Core surfaces** (both themes ship; the browser follows the OS preference)

| Token | Dark | Light | Use |
|---|---|---|---|
| Page/canvas | `#090c12` | `#F4F6F9` | body, canvas base |
| Blue section surface | `#101826` | `#DCE7F3` | Vibe and Collaborate homepage bands |
| Panel surface | `#06090e` @ 62–92% over blur | `#FFFFFF` | cards, dock, banner |
| Elevated surface | `#0e1620` | `#FFFFFF` | skip link, overlays |
| Text | `#f7fbff` | `#101826` | primary text |
| Muted text | `#c5d4ea` | `#44536A` | secondary copy |
| Border | `rgba(255,255,255,.14)` | `rgba(16,24,38,.14)` | card/control borders |
| Accent | `#8abaff` | `#0C5E7D` | links, labels, focus |
| Accent hover | `#dbe9ff` | `#083F56` | hover/focus |
| Error | `#ff8a8a` | `#A12A2A` | errors |
| Success | — | `#1C6B49` | confirmations |
| Warm accent | `#f2b28a` | `#8A3F1A` | collaborate warmth |

**Theme transition**: live OS theme changes cross-fade the UI and canvas at
exactly `500ms ease-in-out` (`--theme-transition-duration`; the canvas fades
a snapshot of the last frame over the re-rendered scene). First paint never
animates (transitions arm only after hydration via `html.theme-ready`), and
`prefers-reduced-motion: reduce` applies the new theme immediately with no
fade anywhere.

**Text** (dark values; light uses the token table above)

| Token | Hex | Use |
|---|---|---|
| Primary | `#f5f7fb` / `#f7fbff` | headings, strong emphasis |
| Body | `#d8e2f2` / `#e8f0fa` | paragraphs |
| Muted | `#c5d4ea` | secondary copy, meta values |
| Faint | `#8aa4c5` | captions, footnotes |

**Accent**

| Token | Hex | Use |
|---|---|---|
| Primary accent | `#8abaff` | links, labels, focus rings, nav |
| Accent hover | `#dbe9ff` | link/button hover |
| Accent deep | `#5a8fd6` | pressed/secondary states |
| Cyan accent | `#8fe3f5` | callouts, consent CTA (on `#06090e` text) |
| Error | `#ff8a8a` | upload/status errors |
| Warm accent | `#f2b28a` / `#ffd9c4` | intro warmth, collaborate highlights |

**Brand gradients**

- Landing canvas background: dark `#090C12 → #101826`, light
  `#F4F6F9 → #DCE7F3` (`LANDING_CANVAS_GRADIENT` in `engine/theme.ts`)
- Landing JH glyph gradient (fixed, left to right, BOTH themes):
  `#0C5E7D → #3B9EC8` — one shared pair, independent of theme or background
  luminance (`engine/backgroundLuminance.ts`)
- Vibe glyph palettes: dark ROYGBV `#ff0000 #ff8800 #ffff00 #00ff00 #0088ff
  #8800ff`; light midpoint ROYGBV `#E0110C #D07200 #BCB200 #0ABF1E #0673BE
  #7B21D4` (same hues, deepened halfway for light backgrounds)

**Work brand-mark slot**: every Work slide may carry a `WorkBrandMark`
(default + optional light asset + optional alt) rendered once beside the
WORK heading — 28px high, up to 96px wide (72px on mobile), right-aligned
with `object-fit: contain`, stable across slide changes. All current
Microsoft slides share `MICROSOFT_BRAND_MARK` (white squares on dark,
`#101826` on light, decorative because Microsoft is named in copy); future
case studies supply their own mark or omit it. Hero sources with white
wordmarks ship `#101826` light twins via `lightSourceUrl` (e.g.
`story-03-light.svg`, `building-multiple-light.svg`).

**Weather mesh backdrops** (`SceneCanvas.MESH_BG_PALETTES`, rasterized
lazily per preset by `getMeshBg`): clear
`#DDEBEE/#F2E6D8`, rain `#012840/#364F59`, storm `#070926/#281259`, wind
`#6D808C/#BDAC89`, fog `#6E6E6E/#222222`, snow `#0D0D0D/#1C2B3E`. Painted
at the ambient config's `backdropOpacity` (default 0.55). The hero uses the
Clear preset with backdrop opacity at 0: slow drifting motes over its fixed
gradient and interactive glyph field, without the weather mesh backdrop.

Rules: never introduce a new accent without a role above; cyan is reserved
for highlights/call-to-action, blue for interaction; error red is never
decorative.

### 3.3 Typography

Two typefaces, both self-hosted (no remote font requests):

- **Cabin Bold (700)** — primary display headings only: the Vibe heading,
  the Collaborate heading, Work slide titles (Microsoft intro + project
  titles), and protected case-study titles. Loaded via `next/font/google`
  (`--font-display` on body), emitted as build assets.
- **Cabin Regular (400)** — the intentional exception to the mono default,
  reserved for the collaborate AI guide's conversation copy: visitor message
  text, guide response text, typed composer content, and the landing preview
  excerpts (~1rem, line-height 1.6–1.7, `font-weight: 400`, letter-spacing
  0.02em for legibility). Loaded from the
  same self-hosted `next/font` build as Cabin Bold.
- **Departure Mono** — everything else: body copy, navigation, toolbar and
  control text, Work mode labels, narrative section headings, dialogs,
  tuning UI, conversation metadata (timestamps, speaker labels), source
  chips, suggested prompts, and the glyph particles themselves. Self-hosted
  from `public/fonts` via `@font-face` in `globals.css` (SIL OFL, license
  alongside the woff2); falls back to the system mono stack (`--font-mono`).

| Style | Spec |
|---|---|
| Hero (landing) | glyph-built logotype/monogram on the canvas as ambient backdrop; the homepage hero (`components/home/HomeHero.tsx`: treated portrait chip with a soft lower fade, Cabin 700 intro card, and a five-slot destination fan) is the visible first impression; an oversized Cabin statement (`.home-statement`) sits directly below the hero |
| Display headings | Cabin 700; Work titles `clamp(1.7rem, 3vw, 2.4rem)`, line-height 1.05, letter-spacing −0.03em |
| Section heading | 1.05rem, mono, `#f5f7fb` |
| Mode eyebrow | 0.78rem, uppercase, letter-spacing 0.22em, accent blue |
| Body | 0.85–0.95rem, line-height 1.7–1.8 |
| Caption/meta | 0.72–0.8rem, muted |
| Wordmark | lowercase always: "joel hoke design", letter-spacing 0.08em |

Rules: Cabin never becomes a body, control, or particle font outside the
conversation-copy exception above; Departure Mono is never removed; sentence
case for prose, lowercase for the wordmark, uppercase only for eyebrow
labels.

### 3.4 Imagery & iconography

- **Glyph-field heroes**: each Work story samples a hero SVG
  (`public/assets/work/story-*.svg`); brand stories may use
  `colorMode: 'source-colors'` to paint with the client palette (e.g.
  Microsoft `#f25022 #7fba00 #00a4ef #ffb900`).
- **Case-study media**: AVIF/WebP/JPEG/PNG images and MP4/WebM video with
  posters; lazy-loaded, explicit dimensions, thumbnails 96×64 tiles.
  Self-hosted interactive viewers (e.g. a three.js scene, media kind
  `viewer`) ship as a static build under `public/assets/work/<name>/` with a
  required WebP poster (≤1600px, metadata-stripped, explicit dimensions) for
  the inline figure and gallery tile; the same-origin iframe loads only in
  the lightbox, and the viewer must render a static single frame via
  `?static=1` for reduced-motion sessions. `inlinePlayback: 'live'` mounts
  the running viewer inline (its `?inline=1` framing) with a whole-figure
  click-through to the full-screen route.
- **Icons**: inline SVG only (`components/icons/`), `stroke="currentColor"`,
  1.5px stroke, round caps — no icon font, no emoji in UI chrome.

## 4. Component patterns

- **Cards**: 12px radius, 1px `rgba(255,255,255,.08–.12)` border,
  `rgba(6,9,14,.62–.92)` fill, 8–10px backdrop blur. Vibe invitation card
  and control dock add the `border-beam` colorful beam (`BorderBeam`,
  strength 0.45).
- **Buttons**: pill (radius 999px), min-height 44px, mono at 0.82rem;
  default = translucent panel + border, hover = border to `#8abaff` and
  text to `#f7fbff`; primary (consent) = `#8fe3f5` fill on `#06090e`.
  Homepage hero destinations use 3D objects with labels beneath them.
  The Gallery section uses image-led project links (`.home-project`) in an
  edge-to-edge horizontal carousel; onward actions retain the pill style.
  The persistent site frame (`.site-header`, z-index 45 — above the
  foreground layer, below the tuning panel) carries the home lockup (the
  `JHMark` monogram, currentColor so it follows the theme) and a single
  "Menu" trigger (icon + visible label). The trigger opens the shared
  full-screen menu (`.site-menu`, a native `<dialog>` in the top layer):
  large Cabin links for Home → Work → Vibe → Gallery → Collaborate with
  active-destination indication, recruiter links secondary in Departure
  Mono. The homepage also closes with a normal-flow footer (`.home-footer`)
  carrying the same recruiter links.
- **Focus**: 2px `#8abaff` outline, 3–4px offset, `:focus-visible` only —
  never remove it.
- **Motion**: 160–320ms ease transitions; opacity + ≤18px translate for
  entrances (`work-story-in`); ambient canvas motion must respect
  `prefers-reduced-motion` (static representative frame). The canvas glyph
  field's render-in is a designed exception: a ~900ms rise +
  shuffle-staggered per-glyph fade (`engine/introReveal.ts`) on every
  mode entry — landing, work, vibe, collaborate — tunable per mode in
  the tuning panel.

### 4.1 Homepage

- **Content model** (`content/home.ts`): the whole landing is editable
  config — five hero slots in fan order (Work, Vibe, Introduction, Collaborate, Gallery), the oversized statement with
  `accent`/`warm` emphasis spans, and five sections (Work, Vibe, Gallery,
  Collaborate, About me) each with a heading, introduction, and onward action. Work features derive from `content/work.ts` so titles
  and theses never drift; the doorway stills are reused as 3:2 previews
  and as the WebGL-failure fallbacks for the hero's three.js objects.
  Hero slot content is typed `HeroContent` (card / image / custom);
  custom renderers are named by string and resolved through the
  `HeroRenderers` registry in `components/home/HeroObject.tsx` — never
  serialized into content, and never interactive inside a destination
  anchor.
- **Homepage alignment**: the header controls, statement, destination sections,
  and footer share `--home-content-width: 78rem` and `--home-content-gutter:
  1.5rem`. Vibe caption labels and gallery links sit flush with their outside
  content edges. Centered compositions remain centered; the Gallery carousel
  retains its full-bleed track.
- **Destination sections** (`HomeSection.tsx`, `HomeSections.css`): Work
  pairs the blue CRT on the left with the section copy and CTA. Its screen
  plays the Global Operations RealComm reel muted and looping, center-cropped
  to fill the curved screen; a pause control sits in the caption. Reduced
  motion shows the poster. Vibe uses two screens, one on each side of the
  brush, with their inner edges clipped behind the object and its splatter.
  The section brush is explicitly scaled to 0.5; hero tuning stays separate.
  Screens fetch the two newest published Playground creations by capture time
  and use their real thumbnails. Each opens its saved composition through the
  existing `?memento=<id>#vibe` restore path, labeled “See this in the playground.”
  “Browse gallery” is a separate caption link; unavailable pieces fall back to
  the playground. In development, Next proxies API and prototype asset routes
  to the local Pages server on port 8788, which must also be running.
  Gallery keeps its introduction left-aligned, with the cursor-reactive portrait
  immediately left of the Browse gallery CTA. The portrait extends 10% over
  the top of the full-width scroll-snap project carousel. Its section canvas
  is 20% larger at each breakpoint (252 × 312px on desktop), with a −65°
  Y rotation. The carousel supports: native swipe/trackpad scrolling, previous/next controls, and
  direct individual `/p/<stack>/<slug>` links. It does not auto-advance.
  All six currently listed projects appear, with password requirements
  labeled and existing access gates preserved. `app/page.tsx` passes only
  public project fields to the client; access hashes never cross that boundary.
  Collaborate features the open flip phone with a real HTML chat composer
  projected onto its LCD. Clicking the original model's physical keys is an
  Easter egg: raycasts use the visible mesh and its existing printed labels,
  with no keypad overlay or presentation change. The section phone retains
  its original X=0°, Y=0° rest pose. Key legends softly illuminate on hover;
  pressing depresses the existing mesh locally and briefly brightens the key.
  Release restores the geometry exactly; reduced motion changes state instantly.
  Idle feedback parks the animation loop. Traditional multi-tap input uses a
  900ms cycle window, 0 for space, * for symbols, and # for case. OK/green call
  sends, the return arrow deletes, the message key opens the conversation,
  and the red end key pops it out without discarding the draft. The normal
  screen composer remains the primary input. Model-key events read the
  controller's current state, including rapid presses before React renders.
  An empty draft uses an explicit placeholder in the projected screen; the
  Send button stretches to the input's full height. The native transcript and controls use dark text
  on the Collaborate peach surface. Draft, turns, pending/error state, and
  limits come from the existing shared conversation controller; full page,
  pop-out, and return-to-phone preserve them. The pop-out icon sits at the top
  right of the “Let’s chat” screen header. When chat moves out, the LCD shows
  the Logo Studio silhouette rasterized at 40×48 pixels in site blue, with
  a small return control. AI disclosure and direct email
  stay outside the small screen. A WebGL failure falls back to a normal chat
  card. Each model loads near its section and parks when offscreen, covered
  by the menu, or in a hidden tab. Desktop objects ease toward the cursor
  within their own section (maximum 0.18 radians per axis). The phone holds
  its current pose while its screen or keypad is hovered or a control has focus, so
  its inputs do not move away from the pointer. Reduced motion and touch
  keep still poses. On narrow screens Work and Collaborate stack; Vibe keeps
  its two screens and small centered brush. Model modification credits
  include the reel, interactive phone screen and keypad, and pixelated standby logo.
- **Hero anatomy**: placement, movement, and content are three nested
  elements — the fan rotation lives on the position element, parallax
  travel on the motion element (`--parallax-x/y`), content inside.
  The realistic AI SpriteSamples head sits deepest over the glyph field,
  with its matching hands. The sample's SVG monotone treatment maps black
  through the brand light blue, `#3B9EC8`, at the midpoint to white, in sRGB
  after a 1.35× luminance contrast boost. The brand blue is distinct from
  the paler `#8ABAFF` UI accent. Alpha is unchanged; the filter applies only to sprite images.
  Keeping the pointer anywhere inside the hero (or focusing its objects)
  crossfades the head and hands into the matching watercolor set over 260ms.
  Leaving the hero returns to monotone; moving between objects keeps watercolor.
  Both layers share one motion wrapper and pose; head angles and flex poses
  are decoded as pairs, and unavailable watercolor frames retain monotone.
  Reduced motion switches instantly. Watercolor uses the sample's 96% opacity.
  Source PNGs live in `/assets/home/sprites/ai` and `/assets/home/sprites/watercolor`;
  the oil set remains available.
  The head and hands keep all nine angles and both hand poses;
  decorative layers are pointer-transparent so input reaches the canvas,
  and only the destination anchors own hit areas. The five slots form a
  compact fan beneath the chin (0.5 spacing, 75% of each tuned scale);
  stacking is glyph field < portrait < floating objects, with the center
  intro slot on top at rest and the selected object raised on interaction. The
  slot render hosts bleed ~12% past their boxes so the objects may
  overlap each other and the portrait edges.
  Use the sample's original `size=200` dimensions: a 288×360 head canvas
  (about 200px visible head width) and 174px-wide hands. Keep the source
  alpha and transparent margins. Desktop hands follow the original outer
  Work/Gallery accordion geometry, including its spacing, scale compensation,
  cursor parallax and eased wrist rotation. They keep the original drift,
  local proximity response, tilt, and decoded flex pose with hysteresis.
  Wrists relax outward by 45° at rest and lift with the dock's magnification
  wave. The left hand retains its extra 10% outward movement on interaction.
  Mobile alone overrides the hand anchors: fixed spread 1.0, fixed scales,
  open pose and no movement as carousel selection changes. Both hands stay
  behind every object. Reduced motion disables sprite movement; frame loops
  park when settled or hidden.
  The nine decoded head angles follow the pointer on desktop with
  the sample's directional hysteresis; reduced motion and touch show neutral.
  The desktop fan anchor is now 50%, below the smaller head; approved fan
  spread (1.12), individual scales, angles and 3D rotations remain the
  expanded targets. Desktop hover or keyboard focus expands the spacing;
  a continuous dock magnification wave brings the selected object to 110%
  of its tuned size and gently grows its neighbors. Pointer position is
  measured against a fixed interaction area, keeping the hover stable as
  objects move. Hands retain their 174px width throughout. The animation
  parks when settled; reduced motion snaps directly to the target, and
  mobile preserves the entire head/hands/fan in one scaled composition.
  Below 768px, horizontal swipes select one adjacent object (wrapping at the
  ends); a first tap selects, a second tap navigates. Selected objects grow
  from 75% to 120% of their tuned scale; neighbors stay at 75%.
  Spacing stays at the desktop resting 0.5 through each selection, with
  matching resting angles and proportional adjustment from the spread tuner. A single
  label beneath the composition links to the selection, using the desktop
  pixel reveal, border, and shadow at 16px type with a minimum 48px tap
  height. Side arrows and Left/Right/Home/End keys supplement swiping.
  Vertical scrolling and pinch zoom remain native; dragging never follows
  an object link. Work is selected on landing, then selection advances left to right every
  five seconds and wraps after Gallery. Edge-mounted Previous/Next buttons
  supplement swipes. Manual interaction restarts the countdown.
  Cycling pauses while
  the hero is offscreen, the tab is hidden, a gesture is active, or keyboard
  focus is within the hero. Reduced motion disables automatic cycling. Hands stay behind objects.
- **Object labels**: Work, Vibe, Introduction, Collaborate, and Gallery
  appear below the selected object on hover or keyboard focus. Labels stay
  upright and at a consistent reading size as the dock magnifies, with a
  single 240ms stepped pixel reveal. Escape dismisses the current label;
  reduced motion shows it immediately. Mobile uses the single shared label
  beneath the composition. Labels never capture clicks, and the controls retain their
  existing descriptive accessible names.
- **Intro notebook** (`components/home/HomeNotebook.tsx`): the center
  slot's notebook opens for real — the "Notebook_Material" GLTF (a single
  merged mesh) stays the base, a procedural blue cover hinges around the
  spiral edge (~150° eased), and the introduction text bakes onto a page
  plane revealed underneath (Departure Mono, static texture). Hover (fine
  pointer), keyboard focus, or mobile selection opens it; activation follows
  the About me section link at `/#home/about`. Reduced motion snaps
  instantly; a sr-only copy of the blurb always stays in the DOM; a model
  failure falls back to the CSS-3D labeled cover.
- **About me**: the final homepage section is a casual introduction, with
  draft copy in `HOME_CONTENT.sections.about`. The existing notebook links
  here. It shares the section margins and anchor clearance; no separate
  biography page is created yet. Its action can later link to a longer page.
- **three.js slot objects** (`components/home/renderers/`): each
  destination slot renders one model — Work: "CRT Computer Monitor" by
  Dan (fizyman), CC-BY-4.0, with the artifacted Microsoft-logo screen
  (chunky MODE-2 pixels, scanlines, phosphor bleed baked into a canvas
  texture registered to the curved glass mesh). It rests dark; hover/focus
  plays one brief blue startup pulse before revealing the picture, then
  fades off on exit. Reduced motion skips the pulse;
  Vibe: ["Dandys World Brusha's PaintBrush"](https://sketchfab.com/3d-models/dandys-world-brushas-paintbrush-19397f41ab1847b8b5391e5896e19d63)
  by NotThatGuy™, CC-BY-4.0, replaces the foreground JH mark. Its starting
  Y rotation is 220°; the orientation control supports a full turn in either
  direction. One gentle subdivision pass (240 → 960 triangles) and smooth
  normals soften the silhouette and polygon shading while preserving the
  UV seams. Only the purple tip pigment becomes the site's light blue;
  the original handle color remains. The supplied PNG splat uses the site
  accent: light blue in dark mode, its original deep blue in light mode. It
  fades in on hover/focus and out on exit (instant under reduced motion).
  It stays behind the brush regardless of rotation, retaining its shallow
  0.12-unit relief and darker side walls traced from the alpha contour,
  including droplets and holes. The gallery Logo Studio and header marks
  remain their own assets. Collaborate: "Flip
  Phone" by Daniel_litt, CC-BY-4.0; Gallery: "Fancy Picture Frame" by
  Jamie McFarlane, CC-BY-4.0; the intro slot's notebook cover is
  "Notebook_Material" by tinderboxh, CC-BY-4.0. Credits also live in
  `public/assets/home/models/<name>/license.txt` beside each model and
  in the renderer module's header comment. The visible Credits tab uses
  `content/site.ts` (`MODEL_CREDITS`) for source, author, license, placement,
  and modification notes. Update that entry whenever adding or adapting
  a model, alongside its bundled license. Loading goes through
  `components/home/renderers/gltfModel.ts` (dynamic-imported GLTFLoader,
  bounding-box center + uniform-scale normalization); a future model
  swap replaces exactly one builder function per section. A failed or
  missing model reports `onUnavailable` and the dispatcher swaps in the
  slot's fallback media (or the branded placeholder).
  Finishes use `--color-hero-blue-light/mid/dark/edge` in both page themes:
  light blue for the monitor and phone; mid blue for the frame and
  notebook cover; theme-aware site blue for the splat. Imported color textures are
  desaturated in the material shader before tinting, preserving shading,
  normal maps and surface detail. Screen content keeps its original colors.
  The phone shares the computer's soft plastic roughness (0.52) and low
  metalness (0.08). Its dark source paint receives a 0.3 luminance lift
  before tinting so the closed shell remains visible on the dark page.
  The phone rests closed. Hover or keyboard focus opens its actual lid
  around the keypad hinge, revealing a warm backlight and “Let’s chat”
  bubble in Collaborate's warm palette: pale peach with dark lettering in
  both themes, plus the shared warm glow/accent tokens. The screen surface shares the lid's transform throughout;
  the panel fills the model's tall LCD region with a small bezel inset, and
  a 256×500 texture matches the lid proportions to avoid stretched lettering.
  reduced motion changes the pose instantly. Destination hit areas include the render
  bleed and stay fixed during hover lift; the notebook's transparent side
  gutters pass through to adjacent links.
  Conventions: `three` loads via dynamic import (own chunk, never in
  first-load JS); material colors re-read from the theme tokens on
  system-theme flips; triangle counts stay modest for ~150–250px slots;
  one builder = one section, keyed `three:<section>` in the registry.
  Render on demand through the shared frameLoop discipline — park while
  `active` is false (hero offscreen / menu-covered), one static frame
  under reduced motion, coarse pointer, or small viewports, never a
  busy rAF loop. A WebGL or setup failure reports `onUnavailable` and
  the dispatcher swaps in the slot's fallback image (or the branded
  placeholder).
- **Media convention** (`components/home/HomeMedia.tsx`): a stable
  aspect-ratio box from explicit width/height; a missing asset renders
  the branded placeholder (monogram + label), and swapping in the real
  asset never moves layout. Below-fold media lazy-loads; hero media and
  the portrait skip lazy loading.
- **Sections**: heading + introduction + feature cards + one onward
  action. Odd feature counts lead with one large card (Work 1+2, Vibe
  single); even counts tile evenly (Gallery). Introduction wrappers carry
  the `#home/<section>` hash targets, with `scroll-margin-top` clearing the
  fixed header. This avoids anchoring to outer padding or the top of a taller
  neighboring model; menu clicks and direct links use the same target. Work
  anchors to the content row instead (discounting its top padding), keeping
  the taller CRT fully visible alongside the introduction.
- **Parallax** (`components/home/useHeroParallax.ts`): per-slot travel
  capped at `HERO_DEPTH_PX` (portrait 6px deepest; outer fan slots
  20px; intro 12px), eased at a 120ms time constant, drifting against the
  pointer. Disabled under <768px viewports, reduced motion, coarse or
  no-hover pointers, hero offscreen, or the menu overlay; parks once
  settled and returns to neutral when the pointer leaves.

### 4.2 Navigation

- **CTA arrows**: reserve the trailing ↗ marker for off-site web links.
  Internal destination links, cards, and action labels stay plain. Directional
  controls (previous/next/back), send, and the phone pop-out icon retain their
  functional symbols.

- **Destination model** (`engine/homeNavigation.ts`): every nav target
  is a typed `SiteDestination` — home (`/` or `#home/<section>`), work
  (optionally `#work/<storyId>`), scene (`#vibe`), or a
  plain route (`/gallery`) — with `destinationHref` the single
  serializer. `#home/<section>` parses BEFORE the experience hash parser
  (`engine/experienceHash.ts` keeps owning `#work/#vibe/#collaborate`);
  Home and Gallery never become engine scenes.
- **Collaborate navigation**: `/#home/collaborate` replaces the standalone
  landing. Menu and no-JS links target the homepage section; legacy
  `#collaborate` links redirect there. Full conversation remains at
  `#collaborate/chat`; its Back button returns to the section and puts the
  conversation back in the phone. Pop-out/minimize returns to that section
  with the companion/resume bar. Draft and transcript stay in the shared
  controller. Reloading a chat URL with no in-memory conversation returns
  to the homepage phone.
- **Menu** (`components/navigation/SiteMenu.tsx`): a native `<dialog>`
  driven with `showModal()` from effects only — the native top layer
  sidesteps every z-index contract. Large Cabin destination links with
  `aria-current`, recruiter links secondary in Departure Mono, focus
  restored to the trigger on dismissal, destination headings focused on
  navigation, document scroll locked and restored exactly, brief
  entrance (none under reduced motion). Menu links are real anchors:
  modified clicks stay native; only unmodified primary clicks route
  through the coordinator. Gallery routes render the same header through
  the thin `GalleryHeader` adapter with plain links.
- **No-JS**: the layout ships a `<noscript>` nav row (`.noscript-nav`)
  with plain links to every destination plus the recruiter links.

### 4.3 Motion & scheduling

- **One scheduler** (`engine/frameLoop.ts`): the canvas runs a single
  frame loop with the parked invariants in one place — never schedule
  while suspended or `document.hidden`, at most one pending frame,
  `park()` cancels, `resume()` re-arms exactly one, and reduced motion
  renders one settled frame then parks. Every config/theme/source/resize
  path re-arms through `renderOnceRef`.
- **Suspension contract**: on suspend the loop parks, pointer/press
  state clears, and the animated provider pauses; resume re-arms exactly
  one frame WITHOUT resetting the composition (no scene rebuild, no
  ripple wipe). On Home the loop parks while the hero is scrolled off
  screen or the menu is open.
- **Parallax discipline**: the hero parallax reuses the same scheduler
  — it parks once the eased position settles, re-arms on pointer input,
  and disables under reduced motion, coarse/no-hover pointers, <768px
  viewports, hero offscreen, or an open menu. Travel is capped per slot
  (6–20px) and always eased; nothing animates continuously.
- **Reduced motion everywhere**: one representative frame, then parked
  — canvas, ambient effects, Black hole, landing atmosphere, hero
  parallax, and the menu's entrance.

## 5. Brand voice

Quiet, warm, direct, first person. Confident without superlatives; playful
without exclamation points.

- **Do** (from shipped copy): "Good — bring the messy version." · "Strange
  problems are my favorite kind." · "Make it yours."
- **Don't**: marketing hype ("world-class", "cutting-edge"), passive
  corporate voice, exclamation stacking, emoji in prose.
- Channel nuance: Work = precise and outcome-led; Vibe = invitational;
  Collaborate = personal and energizing; protected viewer = sparse,
  professional; error/status copy = plain, actionable, never blaming.

## 6. Writing guidelines

- Plain sentences, readability around grade 8; contractions welcome.
- Link labels are descriptive, never "click here"; outbound links get the
  `↗` marker; internal calls to action have no arrows. Directional controls
  (back, carousel, send) retain their functional icons.
- Numbers: en dashes for ranges (2025–2026), metrics stated plainly
  ("48+ Power BI dashboards").
- The hero uses the fixed Clear weather preset: slow drifting motes over
  the themed gradient and interactive glyph field. It makes no weather request and
  does not change with the date, season, or cached conditions. Weather
  effects remain available in Vibe; homepage copy should not claim that
  the background reflects Seattle's weather.
- Approved terms: "glyph field", "case study", "Make it yours" (CTA),
  "confidential case study" (not "secret"/"locked").
- Alt text is required and meaningful; transcripts/captions ship with all
  video.

## 7. Accessibility (non-negotiables)

- Skip link first in tab order; all dialogs focus-trapped with Escape and
  restored trigger focus. The full-screen menu is a native `<dialog>` in
  the top layer, driven with `showModal()` from effects only — dismissal
  restores trigger focus, navigation moves focus to the destination
  heading, and document scroll locks and restores exactly.
- `aria-expanded`/`aria-controls` on every disclosure (Vibe card/dock,
  case-study expansion, the menu trigger); status changes announced via
  `role="status"`.
- Semantic, visually-hidden content digests keep the site fully readable
  without the canvas; the homepage hero, statement, and sections are real
  SSR DOM (the LCP path, not the canvas), and the branded fallback covers
  the visual side of a canvas failure. A `<noscript>` nav row in the root
  layout keeps every destination reachable with JavaScript off.
- Reduced motion: static frames everywhere — canvas, ambient effects, Black
  hole, landing atmosphere, hero parallax, and the menu entrance.

## 8. Maintenance

This guide lives with the code and updates with it: any change to the
palettes (`engine/playgroundConfig.ts`), type scale (`app/globals.css`), or
voice (`content/*.ts`) should land with its style-guide edit in the same
change. Review at each launch, at least once a year.

### Debugger visibility

The tuning panel has a persistent header with Minimize/Open controls. Escape
minimizes it and returns focus to that control. Mobile starts minimized; the
choice is remembered in session storage. The controls stay mounted, preserving
working values, and the separate diagnostics readout hides while minimized.
