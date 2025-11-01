-- Script to view all tables and data in PostgreSQL database
-- Connect to database first: psql -h localhost -U postgres -d jobtracker

-- 1. List all tables in the database
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
ORDER BY table_name;

-- 2. Show structure of applications table
SELECT 
    column_name,
    data_type,
    character_maximum_length,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'applications'
ORDER BY ordinal_position;

-- 3. Show all data from applications table
SELECT * FROM applications ORDER BY created_at DESC LIMIT 20;

-- 4. Count total applications
SELECT COUNT(*) as total_applications FROM applications;

-- 5. Count applications by status
SELECT status, COUNT(*) as count 
FROM applications 
GROUP BY status 
ORDER BY count DESC;

-- 6. Count applications by job_board_source
SELECT job_board_source, COUNT(*) as count 
FROM applications 
GROUP BY job_board_source 
ORDER BY count DESC;

-- 7. Show recent applications with details
SELECT 
    id,
    company,
    position,
    location,
    job_board_source,
    status,
    capture_method,
    applied_at,
    created_at
FROM applications 
ORDER BY created_at DESC 
LIMIT 10;

-- 8. Show users table structure
SELECT 
    column_name,
    data_type,
    character_maximum_length,
    is_nullable
FROM information_schema.columns
WHERE table_name = 'users'
ORDER BY ordinal_position;

-- 9. Show all users (without passwords)
SELECT 
    id,
    email,
    first_name,
    last_name,
    subscription,
    weekly_target,
    monthly_target,
    created_at
FROM users;

-- 10. Count applications per user
SELECT 
    u.email,
    COUNT(a.id) as application_count
FROM users u
LEFT JOIN applications a ON u.id = a.user_id
GROUP BY u.id, u.email
ORDER BY application_count DESC;

