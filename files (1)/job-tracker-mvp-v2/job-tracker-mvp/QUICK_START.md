# 🚀 Quick Start Guide - All Services

## Current Status

✅ **Frontend**: Running on `http://localhost:3000`  
✅ **PostgreSQL**: Running (port 5432)  
❌ **Backend**: Need database credentials

## Setup Steps

### 1. Database Configuration

You need to set the PostgreSQL password. Create a `.env` file in the `server/` directory:

```env
DB_HOST=localhost
DB_PORT=5432
DB_NAME=jobtracker
DB_USER=postgres
DB_PASSWORD=YOUR_POSTGRES_PASSWORD_HERE
PORT=3001
NODE_ENV=development
JWT_SECRET=uk-job-tracker-secret-key-2025-production-safe
ALLOWED_ORIGINS=http://localhost:3000
```

**Replace `YOUR_POSTGRES_PASSWORD_HERE` with your actual PostgreSQL password!**

### 2. Initialize Database

Run this SQL to create the database (if it doesn't exist):

```sql
CREATE DATABASE jobtracker;
```

### 3. Start Services

**Terminal 1 - Backend:**
```powershell
cd "files (1)/job-tracker-mvp-v2/job-tracker-mvp/server"
npm run dev
```

**Terminal 2 - Frontend (already running):**
```powershell
cd "files (1)/job-tracker-mvp-v2/job-tracker-mvp/client"
npm run dev
```

### 4. Verify All Services

- Frontend: http://localhost:3000 ✅
- Backend: http://localhost:3001/health (should return JSON)
- Database: PostgreSQL on port 5432 ✅

## Alternative: Use Docker

If you prefer Docker:

```powershell
cd "files (1)/job-tracker-mvp-v2/job-tracker-mvp"
docker-compose up -d
```

This will start:
- PostgreSQL (port 5432)
- Backend (port 3001)
- Frontend (port 3000)

