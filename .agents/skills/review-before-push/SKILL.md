---
name: review-before-push
description: Standing workflow rule — prepare a local preview and wait for the user's review before any commit/push to main; only skip when the user explicitly asks to push without review
type: prompt
whenToUse: Whenever work is finished and a commit, merge, or push to main (or any shared branch) is on the table
---

The user reviews work locally before anything is pushed. Only skip this when
the user explicitly says they want to push without review (e.g. "push
straight to main", "no review needed", "just ship it"). A generic "looks
good, push it" IS approval — the review step is offering the preview, not
demanding ceremony.

When changes are ready:

1. **Prepare the preview before proposing a push.**
   - Full-stack changes (anything touching `functions/`, gallery, creations):
     `npm run build`, then serve the export with
     `npx wrangler pages dev out --port 8788` so Pages Functions, D1, and R2
     are emulated. Check whether a server is already running before starting
     a new one, and rebuild `out/` after any change — the server serves the
     export from disk.
   - Pure UI/content tweaks: `npm run dev` (port 3000) is enough, but the
     wrangler preview is always the safest default.
2. **Hand the user a concrete review checklist**: the exact local URL(s) to
   open and what to look at (e.g. "http://127.0.0.1:8788/gallery — card
   heights and meta alignment"). A screenshot from headless Chrome is a
   helpful addition, never a substitute for their own look.
3. **Wait.** Do not run `git commit`/`git push`/`git merge` until the user
   approves. Committing locally is fine only when the user has asked for it;
   pushing never happens before review approval.
4. **After approval**: commit with the repo's message style, push, and
   confirm the resulting Cloudflare Pages deploy check goes green before
   declaring it live.

Notes:

- This rule exists because production surprises happened (e.g. the runtime
  compatibility-date bug) — local preview with real bindings catches them.
- The rule applies to every push, not just big features; the review can be
  as quick as the user wants it to be.
