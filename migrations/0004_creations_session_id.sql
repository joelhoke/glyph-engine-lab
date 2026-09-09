-- Session-keyed autosave for vibe creations: a visitor's auto-save row is
-- keyed to their browser session so later edits UPDATE the same row instead of
-- inserting new ones (the archived snapshot always reflects the latest work).
-- NULL for insert-only exports ('image'/'clip'); the partial unique index
-- guards against racing first saves from the same session.
ALTER TABLE creations ADD COLUMN session_id TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_creations_session
  ON creations(session_id) WHERE session_id IS NOT NULL;
