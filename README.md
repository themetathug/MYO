# MYO

World first intellectual job tracker.

# UK Job Tracker - Professional Job Application Manager

A full-stack job tracking platform with AI-powered insights, automated scraping, and beautiful 3D glassmorphism UI.

## 🚀 Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Start PostgreSQL database
# (Uses SQLite by default - no Docker needed)

# 3. Start all services
npm run dev
```

Open http://localhost:3000

## 📁 Project Structure

```
job-tracker/
├── client/              # Next.js Frontend (Port 3000)
├── server/              # Node.js Backend API (Port 3001)
├── python-ml-service/   # Python AI Service (Port 8000)
├── extension/           # Chrome Extension for auto-scraping
└── README.md           # You are here
```

## 🛠️ Tech Stack

- **Frontend**: Next.js 14, React, TypeScript, Tailwind CSS, Framer Motion
- **Backend**: Node.js, Express, TypeScript, Prisma ORM
- **Database**: PostgreSQL (SQLite for development)
- **AI/ML**: Python, FastAPI, scikit-learn
- **Scraping**: Chrome Extension (LinkedIn, Indeed, TotalJobs, Reed)

## 📖 API Documentation

See [API.md](./API.md) for complete API reference.

### Quick API Overview

**Base URL**: `http://localhost:3001/api`

#### Authentication
- `POST /auth/register` - Create account
- `POST /auth/login` - Login
- `POST /auth/logout` - Logout

#### Applications
- `GET /applications` - List all applications
- `POST /applications` - Create application
- `PATCH /applications/:id` - Update application
- `DELETE /applications/:id` - Delete application

#### Analytics
- `GET /analytics/dashboard` - Get dashboard stats
- `GET /analytics/time-stats` - Time analysis
- `GET /analytics/source-performance` - Source performance

#### AI Features
- `GET /ml-analytics/recommendations` - AI job recommendations
- `POST /ml-analytics/analyze-cv` - CV analysis
- `POST /ml-analytics/predict-success` - Success prediction

## 🎨 Features

- ✅ 3D Glassmorphism UI with animations
- ✅ Custom cursor effects
- ✅ Automatic job scraping (Chrome extension)
- ✅ AI-powered CV analysis
- ✅ Real-time analytics dashboard
- ✅ Application tracking & status management
- ✅ Source performance metrics
- ✅ Streak tracking
- ✅ Time per application analytics

## 🔧 Development

```bash
# Frontend only
cd client && npm run dev

# Backend only
cd server && npm run dev

# Python ML service
cd python-ml-service && python -m uvicorn main:app --reload --port 8000
```

## 📦 Installation

### Prerequisites
- Node.js 18+
- Python 3.11+
- PostgreSQL (or use SQLite)

### Steps

1. **Clone and Install**
```bash
git clone <repo>
cd job-tracker
npm install
```

2. **Setup Database**
```bash
cd server
npx prisma migrate deploy
npx prisma generate
```

3. **Start Services**
```bash
# Terminal 1 - Frontend
cd client && npm run dev

# Terminal 2 - Backend
cd server && npm run dev

# Terminal 3 - Python ML
cd python-ml-service && python -m uvicorn main:app --reload --port 8000
```

4. **Install Chrome Extension**
- Go to `chrome://extensions`
- Enable "Developer mode"
- Click "Load unpacked"
- Select the `extension/` folder

## 🌐 Environment Variables

Create `.env` files:

**server/.env**
```
DATABASE_URL="postgresql://user:password@localhost:5432/jobtracker"
REDIS_URL="redis://localhost:6379"
JWT_SECRET="your-secret-key"
ENCRYPTION_KEY="32-character-encryption-key"
NODE_ENV="development"
PORT=3001
```

**client/.env.local**
```
NEXT_PUBLIC_API_URL=http://localhost:3001
```

## 📊 Database Schema

- **User** - User accounts
- **Application** - Job applications
- **CVVersion** - CV versions & performance
- **ColdEmail** - Cold email tracking
- **UserAnalytics** - Daily analytics
- **Streak** - Application streaks
- **Session** - Auth sessions

## 🎯 What Gets Tracked

- ⏱️ Time per application
- 📊 Applications sent count
- 🎯 Target achievement
- 📄 CV conversion rate
- 📧 Cold email metrics
- ⏰ Employer response time
- 📍 Source channel performance
- 📅 Application timing trends
- 🔥 Daily streaks

## 🔌 Chrome Extension

The extension automatically captures:
- Company name
- Job title
- Location
- Salary
- Job URL
- Job description

**Supported Sites:**
- LinkedIn
- Indeed (UK & Global)
- TotalJobs
- Reed.co.uk
- CV-Library
- Monster
- Glassdoor

## 🤖 AI Features

- CV optimization suggestions
- Job-CV compatibility scoring
- Application success prediction
- ATS keyword analysis
- Best CV version recommendations

## 📱 Screenshots

- Dashboard with 3D cards
- Application tracking
- Analytics charts
- Chrome extension popup

## 🐛 Troubleshooting

**Database connection failed?**
```bash
cd server
npx prisma migrate reset
npx prisma generate
```

**Port already in use?**
```bash
# Windows
netstat -ano | findstr :3000
taskkill /PID <PID> /F

# Mac/Linux
lsof -ti:3000 | xargs kill -9
```

## 📄 License

MIT License

## 🤝 Contributing

Pull requests welcome!

## 📧 Support

For issues, please open a GitHub issue.
