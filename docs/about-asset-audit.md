# About asset attribution audit — 2026-10-06

## Confirmed sources

- All seven interest models: original downloaded GLB `asset.extras` identifies title, author, source and CC-BY-4.0 license. Compared these with generated credits. The source generator now parses the recorded license and emits an adjacent `ATTRIBUTIONS.txt`, rather than assigning CC BY unconditionally. Personal-finance labels replace Stocks.
- Edison bulb and six existing homepage models: checked the retained source `license.txt` files against site credits. The iPhone is Sketchfab Standard, not Creative Commons. Bulb usage now includes the shared homepage lighting and Smart-home object.
- McLaren MP4/5: original GLB metadata and `outputs/references/mclaren/START-HERE.txt` identify dark_igorek and CC BY 4.0. Added source, author, license and web-adaptation description to site credits and the generated garage notice.
- 4Runner roof basket: source `outputs/references/suv-niva/source/license.txt` identifies SUV Niva by zhe_kan, CC BY 4.0. The rack is adapted into the purchased 4Runner and has its own attribution.
- Fibre Arc: attributed to Originkit with links to each component and its actual component license, not CC BY or MIT. Licensing reference: https://www.originkit.dev/docs/licensing (reviewed 2026-10-06).
- Departure Mono: Helena Zhang; retained SIL OFL notice. Cabin: Cabin Project Authors; retained SIL OFL notice. Helvetiker: MAGENTA Ltd.; retained bundled font license. All are linked in the Credits panel.
- Three.js: MIT copyright/license is retained next to the generated garage runtime, with the bundled runtime's legal notice. The same site-wide Credits panel acknowledges Three.js.
- Lightbox: Joel's existing project supplies the shared lighting/sticker implementation, acknowledged with its source repository. No new third-party license is invented for author-owned work.
- Comic cover art is credited to its respective creators/publishers, with the League of Comic Geeks source profile and individual issue links. These acknowledgments do not describe the artwork as Creative Commons or grant a new license.

## User-confirmed provenance

Joel confirmed the original 4Runner body was purchased and requires no attribution. Recorded that statement without assigning CC BY to the body. It does not replace the separately verified CC BY attribution for the adapted roof basket.

## Unresolved

- Lancia Stratos: the GLB has only glTF version metadata. The supplied GLB/FBX/OBJ archives contain no license notice; `reference-info.json` records hashes, not author/license. A similarly named marketplace listing is insufficient to establish this file's provenance. No author or CC license has been guessed. The site entry says source/license pending; Joel is deciding whether to retain it. If retained, confirm the actual download source/license and update the same entry.
- The Smart-home floorplan is a code-native simplified trace of the image supplied in the conversation. That reference's author/source was not provided. Record it here for follow-up rather than asserting ownership or a CC license. The original image is not shipped.
- Family photography is user-supplied; the existing cutout is reused, and no new personal photos were generated. Future cutouts should carry the photographer credit if one is requested or required.

The former JWST star artwork was procedural and is retired. The JWST and city reference images were not copied into the website; the current lighting palette uses sampled colors. The bottle, confetti, chart and halftone accents are code-generated geometry, not downloaded models.

This audit covers the assets and components added for the About work plus the existing homepage model/font notices. It is not a claim that unverified sources are licensed merely because a credit is displayed.

- Liquid Glass Carousel was removed from the site and active credits when Creative media returned to the original cover list.
- The 4Runner web derivative restores the complete original geometry without simplification. Its wheel assemblies and lamp emitters are retained, with all original lamp metadata retained. About instantiates the low-beam and fog-light pairs for its shared click toggle; Gallery additionally retains high beams and the original individual light controls. Amber fog emission values are unchanged.



- Formula 1 story hero: user-supplied Ferrari race photograph, original preserved at `source-assets/about/f1-hero.png`; resized to WebP using `scripts/prepare-car-story-photo.mjs`. Photographer/source credit and license were not supplied; no Creative Commons license or photographer attribution has been inferred.

### Apple TV collection artwork (2026-10-09)

- Source: titles from the owner's local macOS TV library; portrait cover artwork from Apple's public catalog. Reviewed catalog IDs and exact artwork/source URLs are recorded in `source-assets/about/media/apple-catalog.json`. No receipt, billing or account identifiers are published.
- Reproduction: `node scripts/import-apple-tv-collection.mjs --write` reads the most recent 12 purchased movies exposed locally and selects portrait catalog art. `node scripts/refresh-media-covers.mjs` refreshes covers from the saved list without operating TV. Both use the shared 420×630 WebP pipeline, retaining full artwork and removing source metadata.
- Display: Creative Media → Movies, using the shared `HomeMedia` component. Public collection data lives in `content/apple-tv-collection.json`.
- Rights: original film studios/artwork rights holders retain copyright. Purchase of the movie does not grant an artwork redistribution license. The shared credits acknowledge provenance; this is not asserted to be Creative Commons or a license grant.

### Physical media piles and Xbox importer

- Cases, spines and page edges are procedural CSS using existing title artwork; no new downloaded model or component package.
- `scripts/import-xbox-collection.mjs --write` imports recent title history after direct Microsoft sign-in. The first successful snapshot contains 12 games. Portrait artwork comes from Microsoft’s public Store catalog, matched by exact Xbox title ID; all 12 sources/product IDs are recorded in `source-assets/about/media/xbox-catalog.json`. `node scripts/refresh-media-covers.mjs --xbox-only` reproduces the artwork independently. These promotional covers retain their respective publishers’ copyright; site credits acknowledge the source without claiming a reuse license.

- Physical cover normalization: `scripts/lib/physical-cover.mjs` owns dimensions, portrait validation, bounded downloads and encoding for both providers. CSS supplies case/spine treatment; artwork is not stretched or cropped into fabricated disc packaging. All 12 current movies have portrait covers. Xbox covers prefer the public catalog’s poster/box-art candidates; square-only art uses an explicit title-only case.


### Apple Music and retired desk models (2026-10-10)

- The downloaded Pokémon/Game Boy desk models were removed when Creative Media returned to a standard collection row. Their generated web derivatives and active credits were removed; original downloads remain intact.
- Apple Music artwork comes from the authorized recently-added library response, filtered to up to 12 unique albums. Artwork URLs and available Apple Music catalog links are retained in the public snapshot. Artwork remains copyrighted by its respective rights holders; the site acknowledgment does not claim a Creative Commons license. No user tokens, personal library IDs, addition timestamps or raw account response are included. The unused downloaded CD model has been replaced with the shared CSS album cases and removed from active credits.
