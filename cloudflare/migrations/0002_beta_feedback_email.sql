-- New reports and their notification queue entry are committed together. Existing
-- reports remain in the inbox; any historical email backfill is deliberate.
CREATE TABLE IF NOT EXISTS beta_feedback_email_outbox (
  report_id TEXT PRIMARY KEY NOT NULL REFERENCES beta_feedback(id) ON DELETE CASCADE,
  queued_at TEXT NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  next_attempt_at INTEGER NOT NULL DEFAULT 0,
  lease_token TEXT,
  leased_until INTEGER NOT NULL DEFAULT 0,
  sent_at TEXT,
  provider_message_id TEXT,
  last_error TEXT CHECK (last_error IS NULL OR last_error IN (
    'sender_not_ready', 'recipient_unavailable', 'rate_limited', 'delivery_failed'
  )),
  last_error_at TEXT
);

CREATE INDEX IF NOT EXISTS beta_feedback_email_due
  ON beta_feedback_email_outbox (sent_at, next_attempt_at, leased_until);

CREATE TRIGGER IF NOT EXISTS beta_feedback_queue_email
AFTER INSERT ON beta_feedback
BEGIN
  INSERT INTO beta_feedback_email_outbox (report_id, queued_at)
  VALUES (NEW.id, NEW.created_at);
END;
