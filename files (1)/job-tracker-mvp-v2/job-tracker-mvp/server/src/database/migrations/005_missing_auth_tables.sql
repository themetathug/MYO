-- Migration 005: Create missing auth/recommendation/review-queue tables
-- These were added to init.sql and 002_add_ai_features.sql after the DB was bootstrapped,
-- so existing databases need this catch-up migration.

-- Recommendation events
CREATE TABLE IF NOT EXISTS recommendation_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  application_id UUID REFERENCES applications(id) ON DELETE SET NULL,
  session_id VARCHAR(255),
  recommendation_type VARCHAR(50) NOT NULL,
  recommendation_id VARCHAR(255) NOT NULL,
  recommended_cv_version_id UUID REFERENCES cv_versions(id) ON DELETE SET NULL,
  selected_cv_version_id UUID REFERENCES cv_versions(id) ON DELETE SET NULL,
  surface VARCHAR(50) DEFAULT 'dashboard',
  event_type VARCHAR(50) NOT NULL,
  model_name VARCHAR(100),
  model_version VARCHAR(100),
  score DECIMAL(5,2),
  reason_payload JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Medium-confidence email review queue
CREATE TABLE IF NOT EXISTS email_status_review_queue (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email_status_update_id UUID REFERENCES email_status_updates(id) ON DELETE CASCADE UNIQUE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  application_id UUID REFERENCES applications(id) ON DELETE CASCADE,
  detected_status VARCHAR(50) NOT NULL,
  detected_confidence DECIMAL(3,2) NOT NULL,
  queue_state VARCHAR(30) NOT NULL DEFAULT 'PENDING_REVIEW',
  review_action VARCHAR(20),
  corrected_status VARCHAR(50),
  review_notes TEXT,
  reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  queued_at TIMESTAMP DEFAULT NOW(),
  reviewed_at TIMESTAMP,
  expires_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Session persistence
CREATE TABLE IF NOT EXISTS auth_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  session_id VARCHAR(255) UNIQUE NOT NULL,
  ip_address VARCHAR(255),
  user_agent TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  last_used_at TIMESTAMP DEFAULT NOW(),
  revoked_at TIMESTAMP
);

-- Refresh tokens
CREATE TABLE IF NOT EXISTS refresh_tokens (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  session_id VARCHAR(255) NOT NULL,
  token_hash VARCHAR(128) UNIQUE NOT NULL,
  family_id VARCHAR(255) NOT NULL,
  rotated_from UUID REFERENCES refresh_tokens(id) ON DELETE SET NULL,
  expires_at TIMESTAMP NOT NULL,
  revoked_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  last_used_at TIMESTAMP
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_recommendation_events_user_id    ON recommendation_events(user_id);
CREATE INDEX IF NOT EXISTS idx_recommendation_events_type       ON recommendation_events(recommendation_type);
CREATE INDEX IF NOT EXISTS idx_recommendation_events_event_type ON recommendation_events(event_type);
CREATE INDEX IF NOT EXISTS idx_recommendation_events_created_at ON recommendation_events(created_at);
CREATE INDEX IF NOT EXISTS idx_email_review_queue_state         ON email_status_review_queue(user_id, queue_state, queued_at DESC);
CREATE INDEX IF NOT EXISTS idx_email_review_queue_app           ON email_status_review_queue(application_id);
CREATE INDEX IF NOT EXISTS idx_email_review_queue_confidence    ON email_status_review_queue(detected_confidence);
CREATE INDEX IF NOT EXISTS idx_auth_sessions_user_id            ON auth_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_auth_sessions_session_id         ON auth_sessions(session_id);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_id           ON refresh_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_session_id        ON refresh_tokens(session_id);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_family_id         ON refresh_tokens(family_id);
