# Gallery playgrounds

The gallery and homepage carousel both read `content/galleryPlaygrounds.ts`.
Each playground has a static page under `app/gallery/` and a client component
under `components/gallery/`. The four additions run locally in the portfolio;
they do not embed or call the original private Sites.

`Controls.tsx` provides palette inputs, ranges, choice buttons, selects, and
playback/reset. Groups of up to four choices display as buttons. Neon Trip also
uses buttons for its six shapes. Three.Gradient shares the controls and CSS.
`useUndoHistory.ts` tracks visitor edits in each of the four new playgrounds.
The Undo button and Cmd/Ctrl+Z reverse one completed edit at a time. A slider
drag or typing session takes one step. Reset starts a fresh history.
`PlaygroundShell.tsx` gives the four new pages the existing heading, artwork,
control panel, and footer arrangement. `usePlayground.ts` owns lazy renderer
initialization, visibility, reduced-motion preferences, resets, and disposal.
The shared loop drives the Loonz renderer. Its physics runs in a worker.

## Sources

The four playgrounds run within the portfolio. DarkWater also links to a local
copy of its full studio for model imports and per-light editing.

| Project | Source revision |
| --- | --- |
| Neon Trip | Private Site `neon-shape-studio`, `bc4365ec82ccc91c1a2e072f14c9f6e12fb2909e` |
| Loonz | Private Site `loonz-air-studio`, `ab92b396bc4957fbad6a45a13595de855a3310dc` |
| DarkWater | `joelhoke/DarkWater`, `0d207080ebb992e98d30d10369bd7b0243301ae9` |
| Gradient Bands | `joelhoke/aurora-bands`, `d82d105c92c33ffafb293cdd2261b7927002cf9d` |

DarkWater's original MIT license and third-party notices live in its `engine/`
directory. Loonz uses the same `poly2tri` dependency for polygon triangulation.
Neon Trip credits [TatsuyaM](https://x.com/tatsuyabot/status/2119268136855962042) for inspiration.

## Small edits

- Gallery titles, summaries, order, and image paths: `content/galleryPlaygrounds.ts`.
- Shared spacing, breakpoint, artwork height: `playground.module.css`. Desktop
  controls are 20rem wide; the single-column layout begins below 768px.
- Neon colors, motion, and shape defaults: `neon/renderer.ts`, `neonDefaults`.
  Speed is 0.7, a multiplier of elapsed seconds; raising it makes light move faster.
- Loonz's starting composition: `loonz/engine/scene.ts`, `defaultScene()`.
  Drift defaults to 0.55 on a 0–1 scale. The 12-balloon cap comes from the original
  physics budget (`engine/types.ts`) and is also enforced by the UI.
- DarkWater defaults: `darkwater/DarkWaterPlayground.tsx`. Wave strength 0.65
  controls displacement; speed 0.7 scales simulation time. The adapter uses
  caustic quality 256 and CSS-pixel resolution to bound GPU cost in the gallery.
- Band presets: `gradient-bands/bands.ts`. Width is in the original 1200×800
  scene coordinates. The gallery limits compositions to 12 bands (a chosen UI
  budget, not an engine limit); adjust both the renderer guard and user hint.

For example, changing DarkWater's default speed from `0.7` to `0.4` slows waves
and ripples together, while its 0–2 speed slider still permits faster playback.
Keep geometry and physics changes in their engines rather than the shared UI.

## Verification and preview

Run `npm run build`, then `wrangler pages dev out --port 8788`.
Run `node scripts/verify-gallery-playgrounds.cjs` for desktop interactions,
drawing, palette edits, reset, mobile overflow, and reduced-motion checks.
The script uses installed Chrome (`CHROME_PATH` can override its executable)
and saves screenshots under `/tmp/jh-gallery-qa`.
Existing flower and carousel checks are `scripts/verify-gradient-playground.js`
and `scripts/verify-gallery-loop.js`.

Rebuild after edits so Pages serves the current export from `out/`. The four
new playgrounds have light and dark WebP thumbnails in `public/assets/gallery`
and matching H.264 hover recordings in its `previews/` directory.
Review locally before committing or pushing, as required by this repository.
