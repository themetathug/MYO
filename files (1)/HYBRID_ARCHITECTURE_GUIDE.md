# Hybrid Architecture Guide (Node.js + Python)
## UK Jobs Insider - Job Tracker

## 🎯 Overview

This application uses a **hybrid microservices architecture** combining:
- **Node.js/TypeScript** for backend API
- **Python/FastAPI** for AI/ML capabilities
- Shared PostgreSQL and Redis

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    CLIENT LAYER                             │
├─────────────────┬──────────────────┬─────────────────────┤
│   Dashboard     │   Browser        │   Extension         │
│   (React)       │   Extension      │   (Chrome)          │
└────────┬────────┴────────┬─────────┴────────┬────────────┘
         │                  │                    │
         └──────────────────┴────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                  API GATEWAY LAYER                          │
│              Node.js Backend (TypeScript)                   │
├─────────────────────────────────────────────────────────────┤
│  • Authentication (JWT)                                     │
│  • CRUD Operations                                          │
│  • Request Routing                                          │
│  • Rate Limiting                                            │
└────────────┬───────────────────────┬──────────────────────┘
             │                       │
             │ HTTP/REST             │ Message Queue
             ▼                       ▼
    ┌─────────────────┐    ┌──────────────────────┐
    │  Python ML      │    │  Background Jobs     │
    │  Service        │    │  (Bull Queue)        │
    │  (FastAPI)      │    │                      │
    │                 │    │  - Analytics         │
    │  • Job Matching │    │  - Email Sending     │
    │  • CV Analysis  │    │  - Data Processing   │
    │  • Predictions  │    └──────────────────────┘
    │  • NLP          │
    └─────────────────┘
             │
             └──────────┬──────────────┘
                        ▼
        ┌─────────────────────────────┐
        │      DATA LAYER             │
        ├─────────────┬───────────────┤
        │ PostgreSQL  │    Redis     │
        │ (Primary)   │   (Cache)    │
        └─────────────┴───────────────┘
```

## 🔄 Communication Flow

### Pattern 1: Synchronous HTTP (Current Implementation)

```
User Request → Node.js → HTTP Call → Python ML → Response
                         ←───────────←───────────←
```

**Use Case**: Job matching, CV analysis, success prediction

**Example:**
```typescript
// In Node.js
const matchResult = await PythonMLService.matchJobs({
  user_cv: cvText,
  job_description: jobDesc
});
```

### Pattern 2: Asynchronous Queue (Future)

```
Node.js publishes job → Redis Queue → Python Worker processes
                                            ↓
                                    Updates PostgreSQL
```

**Use Case**: Heavy ML processing, background analysis

## 📁 Project Structure

```
job-tracker-mvp/
├── server/                    # Node.js Backend
│   ├── src/
│   │   ├── routes/
│   │   │   ├── analytics.routes.ts      # Basic analytics
│   │   │   ├── ml-analytics.routes.ts    # AI-powered features ⭐
│   │   │   └── ...
│   │   ├── services/
│   │   │   ├── python-ml.service.ts     # Python integration ⭐
│   │   │   └── ...
│   │   └── index.ts
│   └── package.json
│
├── python-ml-service/         # Python ML Service ⭐ NEW
│   ├── main.py                # FastAPI app
│   ├── requirements.txt       # Python dependencies
│   ├── Dockerfile             # Container config
│   └── README.md              # Service docs
│
├── client/                    # React Frontend
│   └── src/
│
├── extension/                 # Chrome Extension
│   └── ...
│
└── docker-compose.yml         # Orchestrates all services
```

## 🚀 How to Run

### Option 1: Full Stack with Docker

```bash
# Start all services
docker-compose up

# Services will be available at:
# - Frontend: http://localhost:3000
# - Node.js API: http://localhost:3001
# - Python ML: http://localhost:8000
# - PostgreSQL: localhost:5432
# - Redis: localhost:6379
```

### Option 2: Individual Services

#### Start Node.js Backend
```bash
cd server
npm install
npm run dev
```

#### Start Python ML Service
```bash
cd python-ml-service
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload
```

#### Start Frontend
```bash
cd client
npm install
npm run dev
```

## 🔌 Integration Points

### 1. Environment Variables

**Node.js (.env):**
```env
PORT=3001
DATABASE_URL=postgresql://jobtracker:jobtracker123@localhost:5432/job_tracker_db
REDIS_URL=redis://localhost:6379
PYTHON_ML_URL=http://localhost:8000  # ⭐ New
```

**Python ML (.env):**
```env
DATABASE_URL=postgresql://jobtracker:jobtracker123@localhost:5432/job_tracker_db
REDIS_URL=redis://localhost:6379
NODE_API_URL=http://localhost:3001
```

### 2. API Endpoints

#### From Frontend/Extension
```
POST /api/applications          # Node.js
GET  /api/analytics/dashboard   # Node.js
GET  /api/ml-analytics/insights # → Python ML ⭐
```

#### Between Services
```
Node.js → Python ML:
  POST /api/v1/match-jobs
  POST /api/v1/analyze-cv
  POST /api/v1/predict-success
```

### 3. Code Integration

**Node.js calls Python:**
```typescript
import { PythonMLService } from '../services/python-ml.service';

// In a route handler
const matchResult = await PythonMLService.matchJobs({
  user_cv: cvText,
  job_description: jobDesc
});
```

**Python responds:**
```python
@app.post("/api/v1/match-jobs")
async def match_jobs(request: JobMatchRequest):
    # Process with ML
    match_score = calculate_match(...)
    return {"match_score": match_score, ...}
```

## 🎯 Use Cases

### Use Case 1: Smart Job Matching
```
User applies for job
    ↓
Extension/Native App captures job details
    ↓
Frontend sends to Node.js
    ↓
Node.js calls Python ML Service
    ↓
Python analyzes CV vs Job description
    ↓
Returns match score and recommendation
    ↓
Node.js saves application with AI insights
```

### Use Case 2: CV Optimization
```
User uploads/updates CV
    ↓
Frontend sends to Node.js
    ↓
Node.js calls Python ML Service
    ↓
Python analyzes CV (skills, experience, content)
    ↓
Returns personalized recommendations
    ↓
Frontend displays AI suggestions
```

### Use Case 3: Success Prediction
```
User creates application
    ↓
Node.js calls Python ML Service with:
  - Days since job posted
  - CV version score
  - Time spent on application
  - Previous success rate
    ↓
Python predicts success probability
    ↓
Returns recommendation (high/moderate/low chance)
    ↓
User gets AI-powered insights
```

## 📊 Data Flow

### Between Services
```
Node.js ←→ PostgreSQL (shared)
Python ←→ PostgreSQL (shared)
Node.js ←→ Redis (shared)
Python ←→ Redis (shared)
Node.js ←→ Python (HTTP/REST)
```

### Service Discovery
- Services communicate via Docker network names:
  - `backend` (Node.js)
  - `python-ml` (Python)
  - `postgres` (Database)
  - `redis` (Cache)

## 🔒 Security

### Authentication
- Node.js handles JWT authentication
- Python service trusts Node.js (or validates via API key)

### CORS
- Frontend → Node.js: Allowed
- Node.js → Python: Allowed
- External → Python: Blocked (unless whitelisted)

### Data Privacy
- Both services access shared database
- Sensitive PII encrypted in Node.js
- Python processes anonymized data for ML

## 📈 Scaling Strategy

### Current (MVP)
```
1 Node.js instance
1 Python instance
1 PostgreSQL
1 Redis
```

### Future (Production)
```
Node.js (Horizontally scaled)
├─ 3 instances behind Load Balancer

Python (Horizontally scaled)
├─ 3 instances for ML processing

PostgreSQL
├─ Primary + Replica

Redis
├─ Cluster mode
```

## 🐛 Troubleshooting

### Python ML Service Not Responding
```bash
# Check if running
docker ps | grep python-ml

# View logs
docker logs job-tracker-python-ml

# Restart
docker-compose restart python-ml
```

### Connection Issues
```bash
# From Node.js to Python
curl http://localhost:8000/health

# Check network
docker network inspect job-tracker-network
```

## ✅ Benefits of Hybrid Approach

### Why This Architecture?

✅ **Node.js Benefits:**
- Fast I/O operations
- Real-time features (WebSocket)
- Large ecosystem
- JSON-friendly APIs
- Great for CRUD operations

✅ **Python Benefits:**
- Superior ML libraries
- Better for data processing
- NLP capabilities
- Scientific computing
- AI model integration

✅ **Together:**
- Best of both worlds
- Independent scaling
- Language-appropriate tasks
- Microservices flexibility

## 🎓 Learning Resources

### Node.js/TypeScript
- Express.js: https://expressjs.com
- TypeScript: https://typescriptlang.org

### Python/FastAPI
- FastAPI: https://fastapi.tiangolo.com
- Scikit-learn: https://scikit-learn.org

### Deployment
- Docker Compose: https://docs.docker.com/compose
- Kubernetes (future): https://kubernetes.io

---

**Built with ❤️ for the UK Jobs Insider community**

