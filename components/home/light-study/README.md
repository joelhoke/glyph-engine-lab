# Homepage light study

Renderer adapted from `/Users/joelhoke/Documents/3D Light Experiment/src`.
Synced with `joelhoke/Lightbox` commit `0ab08e7` (latest `origin/main` verified
on 2026-09-25). See `upstream.json` for the exact revision and integration
adaptations. The standalone editor and its global styles are excluded.

Includes Preview press-and-hold sticker flattening: press the portrait to
flatten its curled corner, then release to restore the saved shape. Hover,
reduced motion, pointer cancellation, and cleanup follow the upstream behavior.

`../AboutLightStudy.tsx` loads the renderer near the About section and switches
it to Preview mode. The saved project in
`public/assets/about-light-study/light-study-3.json` retains the original two
images, sticker curl, and solid greeting. Its HTML body block has been removed;
`content/aboutLightStudy.json` now owns the webpage's greeting/fallback and body
copy. Keep the greeting strings synchronized when editing them.

CSS owns the responsive layout in `../HomeSections.css`. Desktop uses the same
78rem content frame and 1.5rem gutters as the rest of the homepage, with artwork
left and body copy right. Mobile stacks artwork, greeting, and body. Measured
artwork and heading slots are passed to `setLayout()`; `layout.ts` fits the
geometry to those slots, including perspective and extrusion. Transparent PNG
padding does not count toward the artwork's visible bounds. Desktop centers the
bulb between the columns and anchors the entire simulated cord at the section's
top edge. Every segment below the ceiling responds to pulling; there is no
fixed extension or midair joint. Mobile retains the original suspension over
the portrait. Drag coordinates convert to the fixture's local physics frame.
When suspension dimensions change on resize, the rope resets to the same nominal
bulb position; identical layout measurements preserve ongoing interaction.
Textures are retained, and cord instance capacity grows only when needed.

The solid greeting uses local Cabin Bold (700) outlines; all body text uses the
site's `--font-mono` (Departure Mono). `scripts/build-about-font.py` converts the
Google Fonts Cabin variable font into the local Three.js typeface using
fonttools, with weight 700 and width 100. It is a development-only conversion;
there is no font conversion or third-party font request at runtime.

The wrapper reads `--about-wall`, `--color-text`, `--color-hero-blue-mid`, and
`--color-hero-blue-edge` from CSS and updates on system-theme changes. Dark wall:
`--color-page` (#090c12). Light wall: `--color-section-blue` (#dce7f3). The housing and cord retain the
site's blue object treatment in both themes. The warm light and real shadows
still affect the wall and objects.

Bulb brightness follows the system theme: 200% in dark mode and 100% in light
mode, applied both on initial load and when the theme changes.

`--about-glass` gives the transmissive bulb a subtle blue-grey smoke tint
(#b5bfcc) in light mode for contrast, retaining its warm clear tint in dark mode.

The wrapper also respects reduced motion, pauses offscreen rendering, disposes
on unmount/failure, and retains a semantic Cabin heading as a fallback for the
3D greeting. Body copy is always visible and selectable, with no duplicate
mobile paragraph block.

Model and font licenses are retained next to their assets. The bulb attribution
lives in `MODEL_CREDITS` in `content/site.ts`, alongside the other model credits
in the question-mark panel's Credits tab.

Preview: `npm run dev`, then `http://localhost:3000/#home/about`.
Checks: `node scripts/verify-about-light-study.cjs`,
`node scripts/verify-light-study-physics.cjs`, and `npm run build`.
The physics runner includes the upstream unit suite plus regressions for a
continuous desktop cord and desktop/mobile suspension changes.
