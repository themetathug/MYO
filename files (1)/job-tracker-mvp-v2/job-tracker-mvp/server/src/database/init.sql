-- UK Job Tracker — Complete Database Schema
-- Single source of truth. All tables and columns defined here.
-- Run once on a fresh database; subsequent changes go in migrations/.

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ─────────────────────────────────────────
-- Core tables
-- ─────────────────────────────────────────

CREATE TABLE IF NOT EXISTS users (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email            VARCHAR(255) UNIQUE NOT NULL,
  password_hash    VARCHAR(255) NOT NULL,
  first_name       VARCHAR(100),
  last_name        VARCHAR(100),
  subscription     VARCHAR(20)  DEFAULT 'FREE',
  weekly_target    INTEGER      DEFAULT 50,
  monthly_target   INTEGER      DEFAULT 40,
  deleted_at       TIMESTAMP,
  created_at       TIMESTAMP    DEFAULT NOW(),
  updated_at       TIMESTAMP    DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS cv_versions (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id          UUID REFERENCES users(id) ON DELETE CASCADE,
  name             VARCHAR(255) NOT NULL,
  cv_content       TEXT,
  file_name        VARCHAR(255),
  performance_score DECIMAL(5,2) DEFAULT 0,
  conversion_rate  DECIMAL(5,2) DEFAULT 0,
  last_used_at     TIMESTAMP,
  is_active        BOOLEAN      DEFAULT true,
  created_at       TIMESTAMP    DEFAULT NOW(),
  updated_at       TIMESTAMP    DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS applications (
  id                     UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id                UUID REFERENCES users(id) ON DELETE CASCADE,
  company                VARCHAR(255) NOT NULL,
  position               VARCHAR(255) NOT NULL,
  location               VARCHAR(255),
  job_board_source       VARCHAR(100),
  job_url                TEXT,
  salary                 VARCHAR(100),
  status                 VARCHAR(50)  DEFAULT 'APPLIED',
  notes                  TEXT,
  time_spent             INTEGER,
  time_spent_seconds     INTEGER,
  time_quality           VARCHAR(30),
  capture_method         VARCHAR(50)  DEFAULT 'MANUAL',
  metadata               JSONB,
  last_email_date        TIMESTAMP,
  company_domain         VARCHAR(255),
  ghosting_threshold_days INTEGER     DEFAULT 25,
  auto_status_enabled    BOOLEAN      DEFAULT true,
  cv_version_id          UUID REFERENCES cv_versions(id) ON DELETE SET NULL,
  applied_at             TIMESTAMP    DEFAULT NOW(),
  response_date          TIMESTAMP,
  interview_date         TIMESTAMP,
  created_at             TIMESTAMP    DEFAULT NOW(),
  updated_at             TIMESTAMP    DEFAULT NOW()
);

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

CREATE TABLE IF NOT EXISTS user_analytics (
  id                   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id              UUID REFERENCES users(id) ON DELETE CASCADE,
  date                 DATE NOT NULL,
  applications_count   INTEGER  DEFAULT 0,
  avg_time_per_app     DECIMAL,
  target_achievement   DECIMAL,
  UNIQUE(user_id, date)
);

CREATE TABLE IF NOT EXISTS cold_emails (
  id                   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id              UUID REFERENCES users(id) ON DELETE CASCADE,
  recipient_email      VARCHAR(255) NOT NULL,
  recipient_name       VARCHAR(255),
  company              VARCHAR(255),
  position             VARCHAR(255),
  location             VARCHAR(255),
  job_url              TEXT,
  sender_email         VARCHAR(255),
  source               VARCHAR(50)  DEFAULT 'MANUAL',
  subject              VARCHAR(500),
  message              TEXT,
  sent_at              TIMESTAMP    DEFAULT NOW(),
  response_date        TIMESTAMP,
  responded            BOOLEAN      DEFAULT FALSE,
  response_time_hours  INTEGER,
  conversion_status    VARCHAR(50),
  created_at           TIMESTAMP    DEFAULT NOW(),
  updated_at           TIMESTAMP    DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS company_contacts (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id             UUID REFERENCES users(id) ON DELETE CASCADE,
  company             VARCHAR(255) NOT NULL,
  domain              VARCHAR(255) NOT NULL,
  email_addresses     VARCHAR(255)[],
  notes               TEXT,
  is_verified         BOOLEAN      DEFAULT false,
  verified_at         TIMESTAMP,
  last_contact_date   TIMESTAMP,
  contact_count       INTEGER      DEFAULT 0,
  created_at          TIMESTAMP    DEFAULT NOW(),
  updated_at          TIMESTAMP    DEFAULT NOW(),
  UNIQUE(user_id, domain)
);

CREATE TABLE IF NOT EXISTS user_email_settings (
  id                           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id                      UUID REFERENCES users(id) ON DELETE CASCADE UNIQUE,
  email_sync_enabled           BOOLEAN   DEFAULT false,
  email_provider               VARCHAR(50),
  email_address                VARCHAR(255),
  email_password_encrypted     TEXT,
  imap_host                    VARCHAR(255),
  imap_port                    INTEGER,
  imap_tls                     BOOLEAN   DEFAULT true,
  last_sync_at                 TIMESTAMP,
  sync_frequency_minutes       INTEGER   DEFAULT 30,
  notification_enabled         BOOLEAN   DEFAULT true,
  ghosting_notification_enabled BOOLEAN  DEFAULT true,
  created_at                   TIMESTAMP DEFAULT NOW(),
  updated_at                   TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS notifications (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id        UUID REFERENCES users(id) ON DELETE CASCADE,
  type           VARCHAR(50)  NOT NULL,
  title          VARCHAR(255) NOT NULL,
  message        TEXT         NOT NULL,
  application_id UUID REFERENCES applications(id) ON DELETE CASCADE,
  metadata       JSONB,
  read           BOOLEAN      DEFAULT false,
  created_at     TIMESTAMP    DEFAULT NOW()
);

-- ─────────────────────────────────────────
-- AI / ML tables
-- ─────────────────────────────────────────

CREATE TABLE IF NOT EXISTS email_status_updates (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  application_id      UUID REFERENCES applications(id) ON DELETE CASCADE,
  user_id             UUID REFERENCES users(id) ON DELETE CASCADE,
  email_subject       TEXT,
  email_from          VARCHAR(255),
  email_domain        VARCHAR(255),
  detected_status     VARCHAR(50),
  confidence_score    DECIMAL(3,2),
  email_date          TIMESTAMP,
  email_body_snippet  TEXT,
  metadata            JSONB,
  created_at          TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS status_detection_logs (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id             UUID REFERENCES users(id) ON DELETE CASCADE,
  application_id      UUID REFERENCES applications(id) ON DELETE CASCADE,
  keyword_status      VARCHAR(50),
  keyword_confidence  DECIMAL(3,2),
  ai_status           VARCHAR(50),
  ai_confidence       DECIMAL(3,2),
  final_status        VARCHAR(50),
  created_at          TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS status_corrections (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id             UUID REFERENCES users(id) ON DELETE CASCADE,
  application_id      UUID REFERENCES applications(id) ON DELETE CASCADE,
  detected_status     VARCHAR(50),
  corrected_status    VARCHAR(50),
  email_subject       TEXT,
  email_body_snippet  TEXT,
  created_at          TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS job_matches (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  application_id  UUID REFERENCES applications(id) ON DELETE CASCADE UNIQUE,
  user_id         UUID REFERENCES users(id) ON DELETE CASCADE,
  match_score     DECIMAL(3,2) NOT NULL,
  recommendation  VARCHAR(50)  NOT NULL,
  confidence      DECIMAL(3,2) NOT NULL,
  reasons         JSONB,
  skill_gaps      JSONB,
  matched_skills  JSONB,
  missing_skills  JSONB,
  created_at      TIMESTAMP DEFAULT NOW(),
  updated_at      TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS success_predictions (
  id                   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  application_id       UUID REFERENCES applications(id) ON DELETE CASCADE UNIQUE,
  user_id              UUID REFERENCES users(id) ON DELETE CASCADE,
  success_probability  DECIMAL(3,2),
  recommendation       VARCHAR(50),
  confidence           DECIMAL(3,2),
  factors              JSONB,
  created_at           TIMESTAMP DEFAULT NOW(),
  updated_at           TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_learning_profiles (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID REFERENCES users(id) ON DELETE CASCADE,
  pattern_type    VARCHAR(50)  NOT NULL,
  detected_value  VARCHAR(100) NOT NULL,
  corrected_value VARCHAR(100) NOT NULL,
  frequency       INTEGER      DEFAULT 1,
  last_updated    TIMESTAMP    DEFAULT NOW(),
  UNIQUE(user_id, pattern_type, detected_value, corrected_value)
);

CREATE TABLE IF NOT EXISTS learning_feedback (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id       UUID REFERENCES users(id) ON DELETE CASCADE,
  feature_type  VARCHAR(50) NOT NULL,
  feature_id    UUID,
  feedback_type VARCHAR(50) NOT NULL,
  feedback_data JSONB,
  created_at    TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS calendar_events (
  id                   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  application_id       UUID REFERENCES applications(id) ON DELETE CASCADE UNIQUE,
  title                VARCHAR(500) NOT NULL,
  description          TEXT,
  start_date           TIMESTAMP NOT NULL,
  end_date             TIMESTAMP,
  location             VARCHAR(500),
  reminder_minutes     INTEGER   DEFAULT 15,
  google_calendar_link TEXT,
  created_at           TIMESTAMP DEFAULT NOW(),
  updated_at           TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS company_email_history (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID REFERENCES users(id) ON DELETE CASCADE,
  company_domain  VARCHAR(255) NOT NULL,
  email_subject   TEXT,
  email_from      VARCHAR(255),
  email_date      TIMESTAMP,
  detected_status VARCHAR(50),
  created_at      TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS recommendation_events (
  id                        UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id                   UUID REFERENCES users(id) ON DELETE CASCADE,
  application_id            UUID REFERENCES applications(id) ON DELETE SET NULL,
  session_id                VARCHAR(255),
  recommendation_type       VARCHAR(50) NOT NULL,
  recommendation_id         VARCHAR(255) NOT NULL,
  recommended_cv_version_id UUID REFERENCES cv_versions(id) ON DELETE SET NULL,
  selected_cv_version_id    UUID REFERENCES cv_versions(id) ON DELETE SET NULL,
  surface                   VARCHAR(50) DEFAULT 'dashboard',
  event_type                VARCHAR(50) NOT NULL,
  model_name                VARCHAR(100),
  model_version             VARCHAR(100),
  score                     DECIMAL(5,2),
  reason_payload            JSONB,
  created_at                TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS email_status_review_queue (
  id                     UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email_status_update_id UUID REFERENCES email_status_updates(id) ON DELETE CASCADE UNIQUE,
  user_id                UUID REFERENCES users(id) ON DELETE CASCADE,
  application_id         UUID REFERENCES applications(id) ON DELETE CASCADE,
  detected_status        VARCHAR(50) NOT NULL,
  detected_confidence    DECIMAL(3,2) NOT NULL,
  queue_state            VARCHAR(30) NOT NULL DEFAULT 'PENDING_REVIEW',
  review_action          VARCHAR(20),
  corrected_status       VARCHAR(50),
  review_notes           TEXT,
  reviewed_by            UUID REFERENCES users(id) ON DELETE SET NULL,
  queued_at              TIMESTAMP DEFAULT NOW(),
  reviewed_at            TIMESTAMP,
  expires_at             TIMESTAMP,
  created_at             TIMESTAMP DEFAULT NOW(),
  updated_at             TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS auth_sessions (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id       UUID REFERENCES users(id) ON DELETE CASCADE,
  session_id    VARCHAR(255) UNIQUE NOT NULL,
  ip_address    VARCHAR(255),
  user_agent    TEXT,
  created_at    TIMESTAMP DEFAULT NOW(),
  last_used_at  TIMESTAMP DEFAULT NOW(),
  revoked_at    TIMESTAMP
);

CREATE TABLE IF NOT EXISTS refresh_tokens (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id       UUID REFERENCES users(id) ON DELETE CASCADE,
  session_id    VARCHAR(255) NOT NULL,
  token_hash    VARCHAR(128) UNIQUE NOT NULL,
  family_id     VARCHAR(255) NOT NULL,
  rotated_from  UUID REFERENCES refresh_tokens(id) ON DELETE SET NULL,
  expires_at    TIMESTAMP NOT NULL,
  revoked_at    TIMESTAMP,
  created_at    TIMESTAMP DEFAULT NOW(),
  last_used_at  TIMESTAMP
);

-- ─────────────────────────────────────────
-- Indexes
-- ─────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_users_email                         ON users(email);
CREATE INDEX IF NOT EXISTS idx_applications_user_id               ON applications(user_id);
CREATE INDEX IF NOT EXISTS idx_applications_status                ON applications(status);
CREATE INDEX IF NOT EXISTS idx_applications_source                ON applications(job_board_source);
CREATE INDEX IF NOT EXISTS idx_applications_applied_at            ON applications(applied_at);
CREATE INDEX IF NOT EXISTS idx_applications_time_spent_seconds    ON applications(time_spent_seconds);
CREATE INDEX IF NOT EXISTS idx_applications_company_domain        ON applications(company_domain);
CREATE INDEX IF NOT EXISTS idx_applications_last_email_date       ON applications(last_email_date);
CREATE INDEX IF NOT EXISTS idx_cv_versions_user_id                ON cv_versions(user_id);
CREATE INDEX IF NOT EXISTS idx_cold_emails_user_id                ON cold_emails(user_id);
CREATE INDEX IF NOT EXISTS idx_cold_emails_sent_at                ON cold_emails(sent_at);
CREATE INDEX IF NOT EXISTS idx_company_contacts_user_id           ON company_contacts(user_id);
CREATE INDEX IF NOT EXISTS idx_company_contacts_domain            ON company_contacts(domain);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id              ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read                 ON notifications(read);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at           ON notifications(created_at);
CREATE INDEX IF NOT EXISTS idx_email_status_updates_application   ON email_status_updates(application_id);
CREATE INDEX IF NOT EXISTS idx_email_status_updates_user_id       ON email_status_updates(user_id);
CREATE INDEX IF NOT EXISTS idx_email_status_updates_domain        ON email_status_updates(email_domain);
CREATE INDEX IF NOT EXISTS idx_status_detection_logs_user_id      ON status_detection_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_status_detection_logs_app_id       ON status_detection_logs(application_id);
CREATE INDEX IF NOT EXISTS idx_status_corrections_user_id         ON status_corrections(user_id);
CREATE INDEX IF NOT EXISTS idx_status_corrections_app_id          ON status_corrections(application_id);
CREATE INDEX IF NOT EXISTS idx_job_matches_user_id                ON job_matches(user_id);
CREATE INDEX IF NOT EXISTS idx_job_matches_application_id         ON job_matches(application_id);
CREATE INDEX IF NOT EXISTS idx_job_matches_match_score            ON job_matches(match_score);
CREATE INDEX IF NOT EXISTS idx_success_predictions_user_id        ON success_predictions(user_id);
CREATE INDEX IF NOT EXISTS idx_success_predictions_application_id ON success_predictions(application_id);
CREATE INDEX IF NOT EXISTS idx_calendar_events_application_id     ON calendar_events(application_id);
CREATE INDEX IF NOT EXISTS idx_company_email_history_user_id      ON company_email_history(user_id);
CREATE INDEX IF NOT EXISTS idx_company_email_history_domain       ON company_email_history(company_domain);
CREATE INDEX IF NOT EXISTS idx_user_learning_profiles_user_id     ON user_learning_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_learning_feedback_user_id          ON learning_feedback(user_id);
CREATE INDEX IF NOT EXISTS idx_recommendation_events_user_id      ON recommendation_events(user_id);
CREATE INDEX IF NOT EXISTS idx_recommendation_events_type         ON recommendation_events(recommendation_type);
CREATE INDEX IF NOT EXISTS idx_recommendation_events_event_type   ON recommendation_events(event_type);
CREATE INDEX IF NOT EXISTS idx_recommendation_events_created_at   ON recommendation_events(created_at);
CREATE INDEX IF NOT EXISTS idx_email_review_queue_state           ON email_status_review_queue(user_id, queue_state, queued_at DESC);
CREATE INDEX IF NOT EXISTS idx_email_review_queue_app             ON email_status_review_queue(application_id);
CREATE INDEX IF NOT EXISTS idx_email_review_queue_confidence      ON email_status_review_queue(detected_confidence);
CREATE INDEX IF NOT EXISTS idx_auth_sessions_user_id              ON auth_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_auth_sessions_session_id           ON auth_sessions(session_id);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_id             ON refresh_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_session_id          ON refresh_tokens(session_id);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_family_id           ON refresh_tokens(family_id);
CREATE INDEX IF NOT EXISTS idx_tracking_sessions_user_id          ON application_tracking_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_tracking_sessions_application_id   ON application_tracking_sessions(application_id);
CREATE INDEX IF NOT EXISTS idx_tracking_sessions_created_at       ON application_tracking_sessions(created_at);

-- Extension tokens: long-lived, revocable, per-user tokens for the Chrome extension.
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

-- Scraper jobs: durable status tracking for background scrape tasks.
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
