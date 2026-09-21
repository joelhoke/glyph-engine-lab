# collaborate-cleanup

Daily retention sweep for feedback and consented shared chat transcripts.
Both tables expire after 180 days; the scheduled Worker deletes expired rows
at 04:17 UTC, independently of future site submissions. Each database is
attempted even if the other fails. Logs contain table names and counts only.

The real database IDs are configured in both this directory's wrangler.toml
and the root Pages configuration. Apply only each database's own schema:

```sh
npx wrangler d1 execute jh-feedback --remote --file migrations/0001_create_feedback.sql
npx wrangler d1 execute jh-collaborate --remote --file migrations/0002_create_collaborate_shares.sql
```

From the repository root:

```sh
npx wrangler types workers/collaborate-cleanup/worker-configuration.d.ts --config workers/collaborate-cleanup/wrangler.toml --env-interface RetentionEnv
npx tsc -p workers/collaborate-cleanup/tsconfig.json
node scripts/verify-retention-cleanup.js
npx wrangler deploy --config workers/collaborate-cleanup/wrangler.toml
```

No public HTTP endpoint is enabled. Monitor scheduled executions in
Cloudflare Workers → collaborate-cleanup → Logs/Triggers.
