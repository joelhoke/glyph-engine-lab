# collaborate-cleanup

Daily scheduled Worker that deletes expired shared transcripts from the
Collaborate AI guide's D1 database (`collaborate_shares`, 180-day retention).
Writes also sweep opportunistically (see `functions/lib/collaborateShare.ts`);
this Worker is the authoritative daily sweep.

## One-time setup

From the **repo root**:

```
# 1. Create the database (note the database_id it prints)
wrangler d1 create jh-collaborate

# 2. Apply the schema (migrations/0002_create_collaborate_shares.sql)
wrangler d1 migrations apply jh-collaborate --remote
```

3. Put the `database_id` from step 1 into `wrangler.toml` (uncomment the
   `[[d1_databases]]` block).

4. Bind the same database to the Pages project: Pages dashboard →
   `jh-portfolio` → Settings → Functions → D1 database bindings → bind
   `jh-collaborate` as `COLLABORATE_DB` (production **and** preview).

Then deploy the Worker from **this directory**:

```
cd workers/collaborate-cleanup
wrangler deploy
```

The cron trigger (`17 4 * * *` — daily at 04:17 UTC) is declared in
`wrangler.toml`; `wrangler deploy` registers it. Verify with
`wrangler deployments list` or in the dashboard under Workers →
collaborate-cleanup → Triggers.

## Operations

- Logs: dashboard → Workers → collaborate-cleanup → Logs (each run logs the
  number of deleted rows).
- Manual sweep (same SQL the Worker runs):
  `wrangler d1 execute jh-collaborate --remote --command "DELETE FROM collaborate_shares WHERE expires_at < <unixnow>;"`

See `docs/deployment.md`, "Collaborate AI guide", for the full picture.
