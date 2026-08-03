-- Feedback storage for POST /api/feedback (D1 binding: FEEDBACK_DB).
-- Timestamps are Unix SECONDS. expires_at = created_at + 180 days;
-- rows past expires_at are deleted opportunistically on submissions and can
-- be cleaned manually (see docs/deployment.md).
CREATE TABLE IF NOT EXISTS feedback(
  id TEXT PRIMARY KEY,
  message TEXT NOT NULL,
  email TEXT,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_feedback_expires_at ON feedback(expires_at);
