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
at the ambient config's `backdropOpacity` (default 0.55; the landing's
seasonal atmosphere sets 0, so the mesh never lightens its fixed
background — weather particles still render).

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
| Hero (landing) | glyph-built logotype/monogram on the canvas — no HTML hero text |
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
  The persistent site frame (`.site-header`, z-index 45 — above the
  foreground layer, below the tuning panel) carries the home lockup (the
  `JHMark` monogram, currentColor so it follows the theme), the section
  tabs (`.experience-nav-list` pill classes — Gallery is a route link, not
  a mode), and the recruiter links; on ≤560px phones the recruiter links
  move to a fixed bottom bar (`.site-footer`) so the header stays one row.
- **Focus**: 2px `#8abaff` outline, 3–4px offset, `:focus-visible` only —
  never remove it.
- **Motion**: 160–320ms ease transitions; opacity + ≤18px translate for
  entrances (`work-story-in`); ambient canvas motion must respect
  `prefers-reduced-motion` (static representative frame).

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
  `↗` marker, internal flows `→`.
- Numbers: en dashes for ranges (2025–2026), metrics stated plainly
  ("48+ Power BI dashboards").
- Never describe the seasonal landing atmosphere as live or current
  weather — it is a "seasonal mood".
- Approved terms: "glyph field", "case study", "Make it yours" (CTA),
  "confidential case study" (not "secret"/"locked").
- Alt text is required and meaningful; transcripts/captions ship with all
  video.

## 7. Accessibility (non-negotiables)

- Skip link first in tab order; all dialogs focus-trapped with Escape and
  restored trigger focus.
- `aria-expanded`/`aria-controls` on every disclosure (Vibe card/dock,
  case-study expansion); status changes announced via `role="status"`.
- Semantic, visually-hidden content digests keep the site fully readable
  without the canvas; the branded fallback covers no-JS.
- Reduced motion: static frames everywhere — canvas, ambient effects, Black
  hole, seasonal atmosphere.

## 8. Maintenance

This guide lives with the code and updates with it: any change to the
palettes (`engine/playgroundConfig.ts`), type scale (`app/globals.css`), or
voice (`content/*.ts`) should land with its style-guide edit in the same
change. Review at each launch, at least once a year.
