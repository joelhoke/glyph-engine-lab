-- Vibe creations gallery for POST /api/creations
-- (D1 binding: CREATIONS_DB, separate database jh-creations from FEEDBACK_DB
-- and COLLABORATE_DB; binary media lives in the R2 bucket bound as
-- CREATIONS_BUCKET under thumb/, media/, and source/ key prefixes).
-- Timestamps are Unix SECONDS. Rows are inserted listed = 0 (held for review)
-- and promoted manually. A global FIFO cap of 100 rows is enforced on writes
-- (oldest evicted); there is no TTL.
CREATE TABLE IF NOT EXISTS creations(
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL,              -- 'auto' | 'image' | 'clip'
  state TEXT NOT NULL,             -- memento JSON
  config_hash TEXT NOT NULL,
  thumb_key TEXT,
  media_key TEXT,
  source_key TEXT,
  listed INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_creations_hash ON creations(config_hash);
CREATE INDEX IF NOT EXISTS idx_creations_listed_created ON creations(listed, created_at);
