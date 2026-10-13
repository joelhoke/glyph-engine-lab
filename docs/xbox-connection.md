# Xbox collection connection

Status: live Microsoft authorization and Xbox history retrieval succeeded on October 9, 2026. The public snapshot contains 12 recent games with portrait Microsoft Store artwork. Account tokens were held in memory only and discarded when the importer exited. History is a manually refreshed snapshot, not a continuous feed.

This is an owner-run local import, not a public login button or continuous activity tracker. Visitors receive the last exported titles/covers. It reuses the same `MediaPick`, `HomeMedia` and `MediaPile` as the other collections.

## Setup

1. In Microsoft Entra → App registrations, register an owner-controlled application for personal Microsoft accounts. Name it `Joel Hoke Xbox collection`.
2. In Authentication → Advanced settings, enable public client flows for device sign-in. No client secret, browser redirect, Graph profile, mail, files or offline-access permission is needed by this importer.
3. The registered public Application ID is saved in `scripts/xbox/app.json` (not a credential). `MICROSOFT_CLIENT_ID` can override it for another registration; no secret is stored.
4. Run `node scripts/import-xbox-collection.mjs`. Open the verification URL printed by Microsoft (personal accounts use microsoft.com/link) and enter the displayed code, using the account for the gamertag in `content/media-profiles.json`. Read the Microsoft consent screen before granting access. The importer validates the signed-in gamertag and rejects other accounts.
5. The first run only prints up to 12 recent game names. Run with `--write` to sign in again and write the public snapshot. Rebuild to include it in the site.

Tokens exist only in process memory. No refresh token is requested, so each import requires sign-in. Exact play timestamps, account/XUID identifiers, achievements, friends and raw service responses are not persisted. Hidden titles and apps are excluded. Artwork requests go only to allowlisted Microsoft image hosts with no authentication headers; images are capped, validated as portrait box art and converted to 420×630 WebP and stripped of source metadata.

The history adapter uses Xbox's TitleHub endpoint, as documented by the primary OpenXbox implementation. **It is not a supported public Microsoft API**; Microsoft may reject an app or change this contract. Direct Microsoft authentication does not guarantee Xbox history access. If the app's scope or TitleHub request is rejected, stop there and retain the existing snapshot; do not borrow another application's credentials or substitute achievement history as “recently played.” Empty/error responses preserve the last collection. Missing artwork uses the shared placeholder.

Sources: [Microsoft device authorization](https://learn.microsoft.com/en-us/entra/identity-platform/v2-oauth2-device-code), [OpenXbox TitleHub adapter](https://github.com/OpenXbox/xbox-webapi-python/tree/master/xbox/webapi/api/provider/titlehub). Run `node scripts/xbox/verify.mjs` for offline protocol/error/filtering checks. Those do not establish live service compatibility.

Artwork can be refreshed independently with `node scripts/refresh-media-covers.mjs --xbox-only`. Public catalog lookup matches exact Xbox title IDs and prefers portrait Poster/BoxArt assets. Sources and product IDs live in `source-assets/about/media/xbox-catalog.json`; derivatives use the shared physical-cover normalizer and content-hashed URLs.
