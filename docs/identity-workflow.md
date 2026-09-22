# Portfolio guide identity workflow

`knowledge/identity/identity.md` is the canonical, human-reviewed description
of Joel's perspective, working style, and conversational character. It is the
only identity document that should be edited by hand.

The workflow intentionally automates delivery and validation, not authorship.
Nothing a visitor says to the public portfolio chat can update this document or
become knowledge for another conversation.

## Architecture

```text
private identity conversation
        ↓ human-reviewed edit
knowledge/identity/identity.md
        ↓ npm run identity:sync
functions/lib/generated/collaborateIdentity.ts
        ↓ buildModelMessages()
system rules + canonical identity + approved profile + visitor transcript
        ↓
model adapter and validated response
```

Cloudflare Pages Functions do not have a repository filesystem to read at
request time. The sync script therefore embeds the reviewed Markdown in a
generated TypeScript module before the function is bundled. `npm run build`
runs that synchronization automatically.

The generated file includes the identity version, review date, and a SHA-256
digest of the embedded Markdown. Never edit it directly.

## Updating the identity

1. Continue the private identity conversation in ChatGPT or another private
   workspace. Ask for an **identity delta**, not a full replacement.
2. Review the proposed language. Confirm that it reflects a durable view Joel
   actually holds and is appropriate for a public agent. Remove private facts,
   temporary feelings, inferred traits, and anything not intended for visitors.
3. Edit `knowledge/identity/identity.md`. Increment its version and set
   `updated` to the review date.
4. Run `npm run identity:sync` to regenerate the runtime module.
5. If the update introduces a claim the guide may answer directly, add or
   revise the corresponding citable entry in
   `functions/lib/collaborateProfile.ts`. The identity supplies interpretation;
   the profile remains the source-card and evidence index.
6. Add or update identity-oriented cases in `scripts/evals/questions.json`.
7. Run `npm run verify:collaborate-api` and `node scripts/evals/run.js`.
8. Run `npm run build`, then use the Cloudflare Pages preview documented in
   `docs/deployment.md`. Review the resulting chat before committing or
   deploying.

`npm run identity:check` is a read-only drift check. It fails when the
generated runtime module does not exactly match the canonical Markdown.

## Visitor isolation

The browser sends only a session ID and the current conversation transcript to
`POST /api/collaborate`. The server constructs a fresh system message from the
bundled identity and approved profile on every request. Visitor text remains in
user/assistant history and cannot replace the system message.

Conversations are ephemeral unless a visitor explicitly shares one. Shared
transcripts are stored in the separate `jh-collaborate` D1 database for human
review and are never retrieved into the model prompt, merged into the profile,
or used to rewrite the identity.

## Versioning policy

- Patch the wording without changing meaning: increment the minor version
  (`0.1` → `0.2`).
- Reframe a foundational principle or substantially restructure the document:
  increment the major version (`0.x` → `1.0`).
- Keep `status: evolving` while the interview process is active. Use
  `status: stable` only when changes have become infrequent and deliberate.
