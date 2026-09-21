-- Apply to CREATIONS_DB before deploying request-protection middleware.
-- Only HMAC identifiers, counters and expiry times; no raw IP addresses.
CREATE TABLE IF NOT EXISTS request_limits (
  key TEXT PRIMARY KEY,
  requests INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS request_limits_expiry ON request_limits(expires_at);
