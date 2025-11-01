# Start Backend Server with Database Credentials
$env:DB_HOST = "localhost"
$env:DB_PORT = "5432"
$env:DB_NAME = "jobtracker"
$env:DB_USER = "postgres"
$env:DB_PASSWORD = "postgre"
$env:PORT = "3001"
$env:NODE_ENV = "development"
$env:JWT_SECRET = "uk-job-tracker-secret-key-2025-production-safe"
$env:ALLOWED_ORIGINS = "http://localhost:3000"

Write-Host "🚀 Starting backend server with database credentials..." -ForegroundColor Green
npm run dev

