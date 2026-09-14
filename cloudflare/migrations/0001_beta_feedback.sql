CREATE TABLE IF NOT EXISTS beta_feedback (
  id TEXT PRIMARY KEY NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('bug', 'idea')),
  title TEXT NOT NULL CHECK (length(title) BETWEEN 1 AND 120),
  description TEXT NOT NULL CHECK (length(description) BETWEEN 1 AND 4000),
  email TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'planned', 'fixed')),
  created_at TEXT NOT NULL,
  build TEXT NOT NULL DEFAULT '' CHECK (length(build) <= 80),
  level INTEGER CHECK (level IS NULL OR level >= 1),
  wave INTEGER CHECK (wave IS NULL OR wave >= 1),
  ship TEXT NOT NULL DEFAULT '' CHECK (length(ship) <= 40),
  user_agent TEXT NOT NULL DEFAULT '' CHECK (length(user_agent) <= 512)
);

CREATE INDEX IF NOT EXISTS beta_feedback_email_created ON beta_feedback (email, created_at DESC);
