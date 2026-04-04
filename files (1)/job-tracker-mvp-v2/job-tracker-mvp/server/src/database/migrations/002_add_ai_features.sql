-- Migration: Add AI Features Tables
-- Adds tables for AI status detection, job matching, predictions, and learning

-- Status Detection Learning Tables
CREATE TABLE IF NOT EXISTS status_detection_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  application_id UUID REFERENCES applications(id) ON DELETE CASCADE,
  keyword_status VARCHAR(50),
  keyword_confidence DECIMAL(3,2),
  ai_status VARCHAR(50),
  ai_confidence DECIMAL(3,2),
  final_status VARCHAR(50),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS status_corrections (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  application_id UUID REFERENCES applications(id) ON DELETE CASCADE,
  detected_status VARCHAR(50),
  corrected_status VARCHAR(50),
  email_subject TEXT,
  email_body_snippet TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Job Matches table
CREATE TABLE IF NOT EXISTS job_matches (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  application_id UUID REFERENCES applications(id) ON DELETE CASCADE UNIQUE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  match_score DECIMAL(3,2) NOT NULL,
  recommendation VARCHAR(50) NOT NULL,
  confidence DECIMAL(3,2) NOT NULL,
  reasons JSONB,
  skill_gaps JSONB,
  matched_skills JSONB,
  missing_skills JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Success Predictions table
CREATE TABLE IF NOT EXISTS success_predictions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  application_id UUID REFERENCES applications(id) ON DELETE CASCADE UNIQUE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  success_probability DECIMAL(3,2) NOT NULL,
  recommendation VARCHAR(50) NOT NULL,
  confidence DECIMAL(3,2) NOT NULL,
  factors JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- User Learning Profiles table
CREATE TABLE IF NOT EXISTS user_learning_profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  pattern_type VARCHAR(50) NOT NULL,
  detected_value VARCHAR(255),
  corrected_value VARCHAR(255),
  frequency INTEGER DEFAULT 1,
  last_updated TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, pattern_type, detected_value, corrected_value)
);

-- Company Email History table
CREATE TABLE IF NOT EXISTS company_email_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  company_domain VARCHAR(255) NOT NULL,
  email_subject TEXT,
  email_from VARCHAR(255),
  email_date TIMESTAMP,
  detected_status VARCHAR(50),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Calendar Events table
CREATE TABLE IF NOT EXISTS calendar_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  application_id UUID REFERENCES applications(id) ON DELETE CASCADE UNIQUE,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  start_date TIMESTAMP NOT NULL,
  end_date TIMESTAMP,
  location VARCHAR(255),
  reminder_minutes INTEGER DEFAULT 15,
  google_calendar_id VARCHAR(255),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_status_detection_logs_user_id ON status_detection_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_status_detection_logs_application_id ON status_detection_logs(application_id);
CREATE INDEX IF NOT EXISTS idx_status_corrections_user_id ON status_corrections(user_id);
CREATE INDEX IF NOT EXISTS idx_status_corrections_application_id ON status_corrections(application_id);
CREATE INDEX IF NOT EXISTS idx_job_matches_user_id ON job_matches(user_id);
CREATE INDEX IF NOT EXISTS idx_job_matches_application_id ON job_matches(application_id);
CREATE INDEX IF NOT EXISTS idx_job_matches_match_score ON job_matches(match_score);
CREATE INDEX IF NOT EXISTS idx_success_predictions_user_id ON success_predictions(user_id);
CREATE INDEX IF NOT EXISTS idx_success_predictions_application_id ON success_predictions(application_id);
CREATE INDEX IF NOT EXISTS idx_user_learning_profiles_user_id ON user_learning_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_learning_profiles_pattern_type ON user_learning_profiles(pattern_type);
CREATE INDEX IF NOT EXISTS idx_company_email_history_user_id ON company_email_history(user_id);
CREATE INDEX IF NOT EXISTS idx_company_email_history_domain ON company_email_history(company_domain);
CREATE INDEX IF NOT EXISTS idx_company_email_history_date ON company_email_history(email_date);
CREATE INDEX IF NOT EXISTS idx_calendar_events_application_id ON calendar_events(application_id);
CREATE INDEX IF NOT EXISTS idx_calendar_events_start_date ON calendar_events(start_date);

-- Add cv_versions.last_used_at for usage attribution
ALTER TABLE cv_versions
  ADD COLUMN IF NOT EXISTS last_used_at TIMESTAMP;

-- Recommendation events table
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

-- Medium confidence review queue table
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

-- Session/refresh persistence tables
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

CREATE INDEX IF NOT EXISTS idx_recommendation_events_user_id ON recommendation_events(user_id);
CREATE INDEX IF NOT EXISTS idx_recommendation_events_type ON recommendation_events(recommendation_type);
CREATE INDEX IF NOT EXISTS idx_recommendation_events_event_type ON recommendation_events(event_type);
CREATE INDEX IF NOT EXISTS idx_recommendation_events_created_at ON recommendation_events(created_at);
CREATE INDEX IF NOT EXISTS idx_email_review_queue_state ON email_status_review_queue(user_id, queue_state, queued_at DESC);
CREATE INDEX IF NOT EXISTS idx_email_review_queue_app ON email_status_review_queue(application_id);
CREATE INDEX IF NOT EXISTS idx_email_review_queue_confidence ON email_status_review_queue(detected_confidence);
CREATE INDEX IF NOT EXISTS idx_auth_sessions_user_id ON auth_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_auth_sessions_session_id ON auth_sessions(session_id);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_id ON refresh_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_session_id ON refresh_tokens(session_id);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_family_id ON refresh_tokens(family_id);

