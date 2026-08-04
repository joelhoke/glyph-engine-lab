-- Consented collaborate transcripts for POST /api/collaborate/share
-- (D1 binding: COLLABORATE_DB, separate database from FEEDBACK_DB).
-- Timestamps are Unix SECONDS. expires_at = created_at + 180 days; expired
-- rows are deleted opportunistically on writes and by the daily scheduled
-- cleanup Worker (workers/collaborate-cleanup). The id is a random receipt ID
-- the visitor can quote to request early deletion.
CREATE TABLE IF NOT EXISTS collaborate_shares(
  id TEXT PRIMARY KEY,
  transcript TEXT NOT NULL,
  email TEXT,
  consent_version TEXT NOT NULL,
  model_route TEXT,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_collaborate_shares_expires_at ON collaborate_shares(expires_at);
