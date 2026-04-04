-- Migration: Time Tracking Accuracy Upgrade
-- Adds second-level tracking fields and session-level audit table.

ALTER TABLE applications
  ADD COLUMN IF NOT EXISTS time_spent_seconds INTEGER;

ALTER TABLE applications
  ADD COLUMN IF NOT EXISTS time_quality VARCHAR(30);

-- Backfill seconds from existing minute-level values where possible
UPDATE applications
SET time_spent_seconds = time_spent * 60
WHERE time_spent_seconds IS NULL
  AND time_spent IS NOT NULL
  AND time_spent > 0;

CREATE TABLE IF NOT EXISTS application_tracking_sessions (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id               UUID REFERENCES users(id) ON DELETE CASCADE,
  application_id        UUID REFERENCES applications(id) ON DELETE CASCADE,
  session_id            VARCHAR(255) NOT NULL,
  normalized_url        TEXT NOT NULL,
  job_url               TEXT,
  capture_method        VARCHAR(50) DEFAULT 'EXTENSION_AUTO',
  trigger               VARCHAR(50),
  started_at            TIMESTAMP,
  ended_at              TIMESTAMP,
  total_time_seconds    INTEGER NOT NULL,
  active_time_seconds   INTEGER,
  paused_time_seconds   INTEGER,
  time_quality          VARCHAR(30) DEFAULT 'AUTO_HIGH',
  metadata              JSONB,
  created_at            TIMESTAMP DEFAULT NOW(),
  updated_at            TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, session_id, normalized_url)
);

CREATE INDEX IF NOT EXISTS idx_applications_time_spent_seconds  ON applications(time_spent_seconds);
CREATE INDEX IF NOT EXISTS idx_tracking_sessions_user_id        ON application_tracking_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_tracking_sessions_application_id ON application_tracking_sessions(application_id);
CREATE INDEX IF NOT EXISTS idx_tracking_sessions_created_at     ON application_tracking_sessions(created_at);
