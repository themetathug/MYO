-- Simple database schema WITHOUT Prisma

-- Create extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  first_name VARCHAR(100),
  last_name VARCHAR(100),
  subscription VARCHAR(20) DEFAULT 'FREE',
  weekly_target INTEGER DEFAULT 50,
  monthly_target INTEGER DEFAULT 40,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Applications table
CREATE TABLE IF NOT EXISTS applications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  company VARCHAR(255) NOT NULL,
  position VARCHAR(255) NOT NULL,
  location VARCHAR(255),
  job_board_source VARCHAR(100),
  job_url TEXT,
  salary VARCHAR(100),
  status VARCHAR(50) DEFAULT 'APPLIED',
  notes TEXT,
  time_spent INTEGER,
  applied_at TIMESTAMP DEFAULT NOW(),
  response_date TIMESTAMP,
  interview_date TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Analytics table
CREATE TABLE IF NOT EXISTS user_analytics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  applications_count INTEGER DEFAULT 0,
  avg_time_per_app DECIMAL,
  target_achievement DECIMAL,
  UNIQUE(user_id, date)
);

-- Cold Emails table
CREATE TABLE IF NOT EXISTS cold_emails (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  recipient_email VARCHAR(255) NOT NULL,
  recipient_name VARCHAR(255),
  company VARCHAR(255),
  subject VARCHAR(500),
  message TEXT,
  sent_at TIMESTAMP DEFAULT NOW(),
  response_date TIMESTAMP,
  responded BOOLEAN DEFAULT FALSE,
  response_time_hours INTEGER, -- Time from sent_at to response_date in hours
  conversion_status VARCHAR(50), -- 'NO_RESPONSE', 'INTERESTED', 'NOT_INTERESTED', 'FOLLOW_UP'
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Add email parser fields if missing
DO $$ 
BEGIN
  -- Add position field
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'cold_emails' AND column_name = 'position'
  ) THEN
    ALTER TABLE cold_emails ADD COLUMN position VARCHAR(255);
  END IF;
  
  -- Add location field
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'cold_emails' AND column_name = 'location'
  ) THEN
    ALTER TABLE cold_emails ADD COLUMN location VARCHAR(255);
  END IF;
  
  -- Add job_url field
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'cold_emails' AND column_name = 'job_url'
  ) THEN
    ALTER TABLE cold_emails ADD COLUMN job_url TEXT;
  END IF;
  
  -- Add sender_email field
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'cold_emails' AND column_name = 'sender_email'
  ) THEN
    ALTER TABLE cold_emails ADD COLUMN sender_email VARCHAR(255);
  END IF;
  
  -- Add source field
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'cold_emails' AND column_name = 'source'
  ) THEN
    ALTER TABLE cold_emails ADD COLUMN source VARCHAR(50) DEFAULT 'MANUAL';
  END IF;
END $$;

-- Add capture_method column to applications if missing
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'applications' AND column_name = 'capture_method'
  ) THEN
    ALTER TABLE applications ADD COLUMN capture_method VARCHAR(50) DEFAULT 'MANUAL';
  END IF;
END $$;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_applications_user_id ON applications(user_id);
CREATE INDEX IF NOT EXISTS idx_applications_status ON applications(status);
CREATE INDEX IF NOT EXISTS idx_applications_source ON applications(job_board_source);
CREATE INDEX IF NOT EXISTS idx_applications_applied_at ON applications(applied_at);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_cold_emails_user_id ON cold_emails(user_id);
CREATE INDEX IF NOT EXISTS idx_cold_emails_sent_at ON cold_emails(sent_at);

