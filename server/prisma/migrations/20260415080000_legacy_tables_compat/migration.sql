-- Legacy compatibility tables used by existing route SQL (snake_case names).
-- Keep Prisma canonical tables (`"Application"`, `"ColdEmail"`) unchanged.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS applications (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id TEXT NOT NULL REFERENCES "User"(id) ON DELETE CASCADE,
  company TEXT NOT NULL,
  position TEXT NOT NULL,
  location TEXT,
  job_board_source TEXT,
  job_url TEXT,
  salary TEXT,
  status TEXT NOT NULL DEFAULT 'APPLIED',
  notes TEXT,
  time_spent INTEGER,
  capture_method TEXT NOT NULL DEFAULT 'MANUAL',
  applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  response_date TIMESTAMPTZ,
  interview_date TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_applications_user_id ON applications(user_id);
CREATE INDEX IF NOT EXISTS idx_applications_applied_at ON applications(applied_at DESC);
CREATE INDEX IF NOT EXISTS idx_applications_status ON applications(status);

CREATE TABLE IF NOT EXISTS cold_emails (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id TEXT NOT NULL REFERENCES "User"(id) ON DELETE CASCADE,
  recipient_email TEXT,
  recipient_name TEXT,
  company TEXT,
  subject TEXT,
  message TEXT,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  response_date TIMESTAMPTZ,
  responded BOOLEAN NOT NULL DEFAULT false,
  conversion_status TEXT,
  response_time_hours INTEGER,
  position TEXT,
  location TEXT,
  job_url TEXT,
  sender_email TEXT,
  source TEXT DEFAULT 'MANUAL',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cold_emails_user_id ON cold_emails(user_id);
CREATE INDEX IF NOT EXISTS idx_cold_emails_sent_at ON cold_emails(sent_at DESC);