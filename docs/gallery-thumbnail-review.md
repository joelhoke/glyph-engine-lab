# Theme-aware project thumbnails

Review locally at http://127.0.0.1:8788/gallery and http://127.0.0.1:8788/#home/gallery.

- Switch the system appearance between Light and Dark: Vehicle playground and Global Operations should change both their still image and active motion preview.
- In spherical and Grid views, hover a project, then leave it: only the active preview should play. Repeat in the homepage carousel and legacy collection pages.
- Open Global Operations in the portfolio: its linked prototype teaser uses the same themed artwork. Documentary case-study screenshots retain their original appearance.
- With reduced motion enabled, thumbnails remain still. Failed video playback retains the themed poster.

## Media provenance

Vehicle's dark poster and eight-second muted clip are captured from the existing public garage runtime with `setNight(true)`, then encoded by `scripts/build-gallery-previews.mjs`. This uses the actual night lighting, road and headlights, without an image filter.

Global Operations uses only the existing public, blurred teaser. Its dedicated dark source is `public/assets/work/global-operations-thumbnail-dark.webp`; the six-second muted promotional loop and matching poster live under `public/assets/gallery/previews/global-operations-demo-dark.*`. This is dark promotional artwork, not a capture of the protected application or a claim about its theme support.

The dark source was produced with the built-in image-generation tool from `public/assets/work/global-operations-thumbnail.webp`, with this prompt:

> Use case: precise-object-edit. Edit target: supplied existing public Global Operations teaser thumbnail. Produce a dedicated DARK MODE version of exactly this teaser. Preserve its landscape aspect ratio and all composition, position and proportions: large central four-color Microsoft squares and wordmark, intentionally heavily blurred dashboard behind. Change the interface's white surfaces to distinct charcoal and deep slate dark-mode surfaces, preserving the blurred panel structure and subdued purple/green/map/chart accents. Change Microsoft wordmark from gray to soft off-white for dark-mode contrast; keep the four squares' original red, green, blue and yellow colors. Keep background text completely blurred and illegible, add no new readable content. This is designed dark-mode artwork, not an overall dimmed light screenshot or a negative. No glow, no drop shadow, no new borders, no extra text. Text verbatim: Microsoft. Edge-to-edge image.

The originals remain available for light mode. Project media is registered in `content/projectPreviews.ts` and rendered by `components/ProjectThumbnail.tsx`, which selects the correct still before hydration using a picture source and switches clips on live system-theme changes. Protected content is never loaded to generate a public thumbnail.
