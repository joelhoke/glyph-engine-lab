# Work case study — authoring template

Copy this file when drafting a new story for `content/work.ts`. Every field
maps to the `WorkStory` model; delete optional blocks you don't use. Stories
render in array order — there is no fixed count.

> **WARNING — confidentiality**
> Never place confidential material in this repository: no NDA client names,
> no internal screenshots, no unreleased metrics, no confidential manifests or
> media. This repo (and the static export built from it) is fully public,
> including its Git history. Confidential case studies ship as a teaser here
> (`access: 'protected'` + an opaque `protectedId`) and are published
> out-of-band with `scripts/publish-protected.mjs` — see
> `docs/deployment.md`, "Confidential work".

---

## Identity

- **Project ID** (stable slug, unique — e.g. `acme-onboarding`):
- **Access** (`public` or `protected`):
- **Protected publishing ID** (only when protected — opaque, `[a-z0-9-]`, no
  client meaning, e.g. `pw-7f3a9c2d`):
- **Public teaser note** (protected only: what may be said publicly — keep it
  deliberately non-sensitive):

## Summary card

- **Title:**
- **Thesis** (one line — what it is and why it matters):
- **Role:**
- **Collaborators / team scope:**
- **Client or organization** (only if approved to name publicly):
- **Timeframe:**
- **Outcome** (one concise statement for the compact card):
- **Links** (label + https URL, may be empty):

## Narrative (expanded case study — public stories only)

The narrative is always rendered — the card's expanded reading panel is the
reveal (there is no in-story disclosure). Ordered sections; each becomes a
`details` entry. The standardized rhythm is:

1. **Outcome** — authored via the story's `outcome` + `outcomeParagraphs`
   (rendered first automatically; do not repeat it as a details section).
2. **Challenge** — the problem space, users, stakes.
3. **Approach** — research, iterations, how decisions were reached.
4. **Contributions** — what you personally owned; the shipped outcome.

Target roughly 350–550 words per public story (outcome + narrative copy,
excluding metadata and links) — `scripts/verify-work-content.js` enforces the
range and the rhythm.

Each section may attach: paragraphs, bullet lists, a callout line,
attachments (label + URL), and media references (media IDs, see below).

## Links

`links` render as the final **Related links** section — after all narrative,
inline media, and gallery content. Never place external links mid-story. The
protected-case-study CTA is an access action, not a related resource, and
keeps its own position.

## Canvas treatment

- **Glyph hero source** (path under `public/assets/work/`):
- **Source kind** (`svg` default, or `raster` for PNG/JPEG heroes):
- **Palette** (hex list, optional override):
- **Background** (two hex colors, optional gradient override):
- **Color mode** (`image-gradient` default, or `source-colors` to sample the
  SVG's own colors):

## Media (public stories only — one block per asset)

- **Media ID** (unique within the story):
- **Type** (`image` | `video` | `embed`):
- **Source** (path under `public/assets/work/` for images/video; images must
  be AVIF, WebP, JPEG, or PNG; hosted video MP4 or WebM):
- **Thumbnail** (optional smaller preview path):
- **Dimensions** (width × height, required for images and video):
- **Alt text** (required, meaningful):
- **Caption** (optional):
- **Poster** (required for hosted video):
- **Captions / transcript** (required for hosted video — WebVTT path and/or
  transcript text):
- **Embed** (for `embed` type: provider `youtube` | `vimeo`, video ID, title —
  the iframe loads only after the visitor chooses to play):
- **Confidentiality** (must be `public-approved` to live in this repo;
  anything else goes through the protected publishing flow):
