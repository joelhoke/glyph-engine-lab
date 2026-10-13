<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->


# Reuse and single sources of truth

- Before adding UI, content, assets, styling, data fetching, or interaction logic, search for an existing implementation and identify its source of truth.
- Reuse the existing component or module. If it is page-specific, extract the working implementation into a shared component and update every affected consumer; do not copy it into a second implementation.
- “Use the same” means the same implementation, appearance, assets, materials, defaults, and interaction behavior. Reusing an asset while recreating its renderer or controls does not satisfy this requirement.
- Keep repeated copy, lists, configuration, design tokens, and data contracts in one owned source. Consume shared data through imports or a shared provider/hook instead of maintaining parallel copies or duplicate requests.
- Expose only the differences a consumer needs, such as placement or composition, through explicit props. Keep shared behavior and defaults in the shared implementation; avoid page-specific forks and speculative abstraction.
- Generated derivatives must name their canonical source and a reproducible generation step. Do not hand-maintain copies of assets or content.
- When replacing duplicate code, remove the superseded implementation and its unused assets/styles. Verify all affected consumers, including responsive layout, theme, accessibility, and interaction behavior.
- Before handing off, review the diff for duplicated content and logic. Explain any unavoidable duplication and its reason rather than introducing it silently.
