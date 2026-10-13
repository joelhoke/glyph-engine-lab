# Apple Music recently added albums

The Music stack opens the same horizontal collection as Comics, Movies and Games. Its square cases read `content/apple-music-collection.json`. The closed stack shows its first three album covers using the same MediaPile/MediaCase components, hover, entrance and unfolding behavior as the other collections.

## Connect the owner's account

1. In Apple Developer → Certificates, Identifiers & Profiles → Identifiers, register a **Media ID** for `Joel Hoke — Recent Listens` (for example `media.me.joelhoke.recent-listens`) and enable MusicKit.
2. Create a **Media Services** key associated with that identifier. Save the `.p8` outside this repository. Record the Key ID and your membership Team ID.
3. Copy `.env.music.example` to ignored `.env.music.local` and fill those three values. Only the key path goes in the environment file.
4. Run `node --env-file=.env.music.local scripts/import-apple-music.mjs`. Open its local URL and authorize your Apple Music account.
5. The importer saves up to twelve unique albums from the recently-added library feed, in response order; playlists and songs are excluded. Run `npm run build` to update the local preview. Re-run the importer to refresh; this first version does not claim continuous syncing.

The private signing key remains local. The short-lived developer JWT and MusicKit account authorization are only used by the local setup page. The importer does not write user tokens to disk. Public output contains album title, artist, artwork, an Apple Music URL when available, and a hash of the album/artist for identity; it omits personal library IDs, exact timestamps, play counts and raw account responses. Visitors do not sign in. Failed/empty API responses preserve the previous snapshot. No new movie, game or trading-card connections are added.

Sources: [Apple's Media ID/key setup](https://developer.apple.com/help/account/capabilities/create-a-media-identifier-and-private-key), [developer tokens](https://developer.apple.com/documentation/applemusicapi/generating-developer-tokens), [recently added resources](https://developer.apple.com/documentation/applemusicapi/get-recently-added-resources), [MusicKit on the Web](https://js-cdn.music.apple.com/musickit/v3/docs/).

Library artwork is used when present. Missing artwork and links are filled from Apple’s US catalog only when both album and artist names match. Unmatched titles retain their text fallback; no different album is substituted.
