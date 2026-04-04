# Python ML Service
## UK Jobs Insider - AI/ML Capabilities

This is the Python microservice that provides AI/ML capabilities for the Job Tracker application.

## 🚀 Quick Start

### Local Development

```bash
# Navigate to Python service directory
cd python-ml-service

# Create virtual environment
python -m venv venv

# Activate virtual environment
# Windows:
venv\Scripts\activate
# Linux/Mac:
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Run the service
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

### Using Docker

```bash
# From project root
docker-compose up python-ml

# Or to build and run
docker build -t python-ml-service .
docker run -p 8000:8000 python-ml-service
```

## 📡 API Endpoints

### Health Check
```
GET /health
```

### Job Matching
```
POST /api/v1/match-jobs
```
**Request:**
```json
{
  "user_cv": "CV text content...",
  "job_description": "Job posting description...",
  "user_skills": ["JavaScript", "Python"],
  "job_requirements": ["React", "Node.js"]
}
```

**Response:**
```json
{
  "match_score": 0.85,
  "recommendation": "high_match",
  "confidence": 0.85,
  "reasons": ["Strong skill alignment", "Good experience match"]
}
```

### CV Analysis
```
POST /api/v1/analyze-cv
```
**Request:**
```json
{
  "cv_text": "Full CV content...",
  "target_job": "Software Engineer"
}
```

**Response:**
```json
{
  "skills_found": ["JavaScript", "React", "Node.js"],
  "experience_years": 3.5,
  "recommendations": [
    "Add more technical skills",
    "Include project descriptions"
  ],
  "optimization_score": 0.75,
  "strengths": ["Strong technical skills diversity"],
  "weaknesses": ["Limited industry experience"]
}
```

### Success Prediction
```
POST /api/v1/predict-success
```
**Request:**
```json
{
  "days_since_posted": 2,
  "cv_version_score": 0.85,
  "time_spent": 1200,
  "previous_success_rate": 0.25,
  "job_board": "LinkedIn"
}
```

**Response:**
```json
{
  "success_probability": 0.73,
  "recommendation": "high_chance",
  "factors": {
    "cv_score": 0.85,
    "time_invested": 1200,
    "fresh_posting": true,
    "job_board": "LinkedIn"
  },
  "confidence": 0.8
}
```

## 🏗️ Architecture

```
┌─────────────────────────────────────┐
│   Node.js Backend (TypeScript)      │
│   - Authentication                   │
│   - CRUD Operations                  │
│   - API Gateway                      │
└──────────────┬──────────────────────┘
               │ HTTP/REST
               ▼
┌─────────────────────────────────────┐
│   Python ML Service (FastAPI)        │
│   - Job Matching                    │
│   - CV Analysis                     │
│   - Success Prediction              │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│   Shared Resources                   │
│   - PostgreSQL                       │
│   - Redis                            │
└─────────────────────────────────────┘
```

## 🔧 Configuration

### Environment Variables

Create a `.env` file:
```env
DATABASE_URL=postgresql://jobtracker:jobtracker123@localhost:5432/job_tracker_db
REDIS_URL=redis://localhost:6379
NODE_API_URL=http://localhost:3001

# Optional: OpenAI API Key
OPENAI_API_KEY=sk-...

# Optional: Sentry
SENTRY_DSN=https://...
```

## 🧪 Testing

```bash
# Run tests
pytest

# Run with coverage
pytest --cov=. --cov-report=html

# Run specific test file
pytest tests/test_job_matching.py
```

## 📦 Dependencies

Key dependencies:
- **FastAPI**: Modern Python web framework
- **Uvicorn**: ASGI server
- **Pandas/NumPy**: Data processing
- **scikit-learn**: Machine learning
- **OpenAI**: GPT integration
- **sentence-transformers**: Semantic similarity
- **Redis**: Caching and communication

## 🚀 Future Enhancements

### Short Term
- [ ] Real ML model training with user data
- [ ] Sentence transformers for better semantic matching
- [ ] OpenAI integration for intelligent insights

### Medium Term
- [ ] Personalized recommendation engine
- [ ] Advanced CV parsing with NLP
- [ ] Salary prediction models

### Long Term
- [ ] Real-time interview coaching
- [ ] Automated application optimization
- [ ] Multi-language support

## 📊 Monitoring

The service includes health checks and logging:
```bash
# Check health
curl http://localhost:8000/health

# View logs
docker logs job-tracker-python-ml
```

## 🔐 Security

- Input validation using Pydantic
- CORS protection
- Rate limiting (to be added)
- Environment variable management

## 📝 License

Proprietary - UK Jobs Insider © 2024

