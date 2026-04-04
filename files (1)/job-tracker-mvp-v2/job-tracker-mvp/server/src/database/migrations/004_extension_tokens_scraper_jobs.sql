-- Migration 004: Extension tokens, scraper job tracking, and application race-condition guard

-- 1. Extension tokens for deterministic cross-environment Chrome extension auth
CREATE TABLE IF NOT EXISTS extension_tokens (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID REFERENCES users(id) ON DELETE CASCADE,
  token_hash  VARCHAR(64) NOT NULL UNIQUE,
  label       VARCHAR(100) DEFAULT 'Chrome Extension',
  last_used_at TIMESTAMP,
  expires_at  TIMESTAMP NOT NULL,
  revoked_at  TIMESTAMP,
  created_at  TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_extension_tokens_user_id    ON extension_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_extension_tokens_token_hash ON extension_tokens(token_hash);

-- 2. Durable scraper job tracking
CREATE TABLE IF NOT EXISTS scraper_jobs (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID REFERENCES users(id) ON DELETE CASCADE,
  status      VARCHAR(30) NOT NULL DEFAULT 'QUEUED',
  sources     TEXT[],
  keywords    VARCHAR(255),
  location    VARCHAR(255),
  jobs_found  INTEGER DEFAULT 0,
  jobs_saved  INTEGER DEFAULT 0,
  error_msg   TEXT,
  started_at  TIMESTAMP,
  finished_at TIMESTAMP,
  created_at  TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_scraper_jobs_user_id    ON scraper_jobs(user_id);
CREATE INDEX IF NOT EXISTS idx_scraper_jobs_status     ON scraper_jobs(status);
CREATE INDEX IF NOT EXISTS idx_scraper_jobs_created_at ON scraper_jobs(created_at);

-- 3. Soft-delete support on users for privacy-policy compliant 30-day purge
ALTER TABLE users ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP;
CREATE INDEX IF NOT EXISTS idx_users_deleted_at ON users(deleted_at) WHERE deleted_at IS NOT NULL;

-- 4. Partial unique index to prevent race-condition duplicate applications.
--    Allows the same company+position only once per user per calendar day.
--    First, remove existing duplicates keeping the oldest record to avoid index creation failure.
DELETE FROM applications
WHERE id NOT IN (
  SELECT DISTINCT ON (user_id, lower(company), lower(position), DATE(applied_at))
    id
  FROM applications
  WHERE capture_method <> 'SCRAPER'
  ORDER BY user_id, lower(company), lower(position), DATE(applied_at), applied_at ASC
)
AND capture_method <> 'SCRAPER';

CREATE UNIQUE INDEX IF NOT EXISTS idx_applications_no_same_day_duplicate
  ON applications(user_id, lower(company), lower(position), DATE(applied_at))
  WHERE capture_method <> 'SCRAPER';
