# API Documentation

**Base URL**: `http://localhost:3001/api`

All authenticated endpoints require the `Authorization` header:
```
Authorization: Bearer <your_jwt_token>
```

---

## 🔐 Authentication

### Register
**POST** `/auth/register`

Create a new user account.

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "password123",
  "firstName": "John",
  "lastName": "Doe",
  "consentTracking": true,
  "consentAnalytics": true
}
```

**Response (201):**
```json
{
  "message": "Account created successfully",
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "firstName": "John",
    "lastName": "Doe",
    "subscription": "FREE",
    "createdAt": "2024-01-01T00:00:00.000Z"
  },
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

---

### Login
**POST** `/auth/login`

Login to existing account.

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "password123"
}
```

**Response (200):**
```json
{
  "message": "Login successful",
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "firstName": "John",
    "lastName": "Doe",
    "subscription": "FREE",
    "weeklyTarget": 10,
    "monthlyTarget": 40
  },
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

---

### Logout
**POST** `/auth/logout`

**Headers:** `Authorization: Bearer <token>`

**Response (200):**
```json
{
  "message": "Logged out successfully"
}
```

---

## 📋 Applications

### Get All Applications
**GET** `/applications`

**Headers:** `Authorization: Bearer <token>`

**Query Parameters:**
- `status` (optional): Filter by status (APPLIED, INTERVIEW_SCHEDULED, etc.)
- `source` (optional): Filter by job board (LinkedIn, Indeed, etc.)
- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 20)

**Response (200):**
```json
{
  "applications": [
    {
      "id": "uuid",
      "company": "Google",
      "position": "Software Engineer",
      "location": "London, UK",
      "jobBoardSource": "LinkedIn",
      "jobUrl": "https://linkedin.com/jobs/...",
      "salary": "£70,000 - £90,000",
      "status": "APPLIED",
      "timeSpent": 1800,
      "appliedAt": "2024-01-01T00:00:00.000Z",
      "captureMethod": "EXTENSION"
    }
  ],
  "pagination": {
    "total": 45,
    "page": 1,
    "limit": 20,
    "pages": 3
  }
}
```

---

### Create Application
**POST** `/applications`

**Headers:** `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "company": "Google",
  "position": "Software Engineer",
  "location": "London, UK",
  "jobBoardSource": "LinkedIn",
  "jobUrl": "https://linkedin.com/jobs/...",
  "salary": "£70,000 - £90,000",
  "timeSpent": 1800,
  "notes": "Applied via referral",
  "captureMethod": "EXTENSION"
}
```

**Response (201):**
```json
{
  "message": "Application created successfully",
  "application": {
    "id": "uuid",
    "company": "Google",
    "position": "Software Engineer",
    ...
  }
}
```

---

### Update Application
**PATCH** `/applications/:id`

**Headers:** `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "status": "INTERVIEW_SCHEDULED",
  "interviewDate": "2024-01-15T10:00:00.000Z",
  "notes": "First round interview with hiring manager"
}
```

**Response (200):**
```json
{
  "message": "Application updated successfully",
  "application": { ... }
}
```

---

### Delete Application
**DELETE** `/applications/:id`

**Headers:** `Authorization: Bearer <token>`

**Response (200):**
```json
{
  "message": "Application deleted successfully"
}
```

---

## 📊 Analytics

### Dashboard Stats
**GET** `/analytics/dashboard`

**Headers:** `Authorization: Bearer <token>`

**Query Parameters:**
- `period` (optional): Days to include (default: 30)

**Response (200):**
```json
{
  "totalApplications": 45,
  "weeklyApplications": 12,
  "monthlyApplications": 45,
  "averageTimePerApp": 25,
  "responseRate": 35.5,
  "interviewRate": 15.5,
  "applicationsByStatus": {
    "APPLIED": 30,
    "INTERVIEW_SCHEDULED": 7,
    "INTERVIEWED": 5,
    "OFFERED": 2,
    "REJECTED": 1
  },
  "applicationsBySource": {
    "LinkedIn": 25,
    "Indeed": 15,
    "Direct": 5
  },
  "weeklyTarget": 10,
  "monthlyTarget": 40,
  "targetAchievement": 120
}
```

---

### Time Stats
**GET** `/analytics/time-stats`

**Headers:** `Authorization: Bearer <token>`

**Response (200):**
```json
{
  "averageTimePerApp": 25,
  "timeBySource": {
    "LinkedIn": 30,
    "Indeed": 20,
    "Direct": 45
  },
  "peakApplicationHours": {
    "9": 5,
    "14": 8,
    "20": 12
  }
}
```

---

### Source Performance
**GET** `/analytics/source-performance`

**Headers:** `Authorization: Bearer <token>`

**Response (200):**
```json
{
  "sources": [
    {
      "source": "LinkedIn",
      "total": 25,
      "responseRate": 40,
      "interviewRate": 20,
      "averageTimeToResponse": 5.5
    },
    {
      "source": "Indeed",
      "total": 15,
      "responseRate": 30,
      "interviewRate": 13,
      "averageTimeToResponse": 7.2
    }
  ]
}
```

---

### Application Trend
**GET** `/analytics/trend`

**Headers:** `Authorization: Bearer <token>`

**Query Parameters:**
- `days` (optional): Number of days (default: 30)

**Response (200):**
```json
{
  "trend": [
    { "date": "2024-01-01", "count": 3 },
    { "date": "2024-01-02", "count": 5 },
    { "date": "2024-01-03", "count": 2 }
  ]
}
```

---

## 🤖 AI/ML Analytics

### AI Recommendations
**GET** `/ml-analytics/recommendations`

**Headers:** `Authorization: Bearer <token>`

**Query Parameters:**
- `jobDescription` (required): Job description text

**Response (200):**
```json
{
  "recommendation": {
    "bestCVVersion": {
      "id": "uuid",
      "name": "Tech CV v2",
      "compatibilityScore": 87.5
    },
    "suggestions": [
      "Add more keywords related to cloud computing",
      "Emphasize leadership experience",
      "Include quantifiable achievements"
    ],
    "matchingSkills": ["Python", "AWS", "Docker"],
    "missingSkills": ["Kubernetes", "Terraform"]
  }
}
```

---

### Analyze CV
**POST** `/ml-analytics/analyze-cv`

**Headers:** `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "cvText": "Full CV text content...",
  "targetJob": "Software Engineer at Google"
}
```

**Response (200):**
```json
{
  "score": 82,
  "strengths": [
    "Strong technical skills",
    "Relevant experience",
    "Clear achievements"
  ],
  "improvements": [
    "Add more quantifiable results",
    "Include keywords: 'scalability', 'microservices'",
    "Shorten work history descriptions"
  ],
  "atsScore": 78,
  "keywordMatch": 65
}
```

---

### Predict Success
**POST** `/ml-analytics/predict-success`

**Headers:** `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "jobDescription": "We are looking for...",
  "cvText": "Your CV content...",
  "applicationData": {
    "yearsExperience": 5,
    "educationLevel": "Masters",
    "relevantSkills": ["Python", "AWS", "Docker"]
  }
}
```

**Response (200):**
```json
{
  "successProbability": 75.5,
  "confidenceLevel": "HIGH",
  "factors": {
    "skillMatch": 85,
    "experienceMatch": 70,
    "educationMatch": 90
  },
  "recommendation": "APPLY"
}
```

---

## 👤 User Profile

### Get Profile
**GET** `/users/profile`

**Headers:** `Authorization: Bearer <token>`

**Response (200):**
```json
{
  "id": "uuid",
  "email": "user@example.com",
  "firstName": "John",
  "lastName": "Doe",
  "subscription": "FREE",
  "weeklyTarget": 10,
  "monthlyTarget": 40,
  "createdAt": "2024-01-01T00:00:00.000Z",
  "_count": {
    "applications": 45,
    "cvVersions": 3,
    "coldEmails": 12
  }
}
```

---

### Update Profile
**PUT** `/users/profile`

**Headers:** `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "firstName": "John",
  "lastName": "Smith",
  "profileData": {
    "linkedin": "https://linkedin.com/in/john",
    "skills": ["Python", "JavaScript", "AWS"]
  }
}
```

**Response (200):**
```json
{
  "message": "Profile updated successfully",
  "user": { ... }
}
```

---

### Update Targets
**PUT** `/users/targets`

**Headers:** `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "weeklyTarget": 15,
  "monthlyTarget": 60
}
```

**Response (200):**
```json
{
  "message": "Targets updated successfully",
  "targets": {
    "weeklyTarget": 15,
    "monthlyTarget": 60
  }
}
```

---

## 📧 Cold Emails

### Create Cold Email
**POST** `/cold-emails`

**Headers:** `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "recipientCompany": "Google",
  "recipientEmail": "recruiter@google.com",
  "recipientName": "Jane Smith",
  "subject": "Software Engineer Opportunity",
  "sentAt": "2024-01-01T10:00:00.000Z"
}
```

**Response (201):**
```json
{
  "message": "Cold email tracked successfully",
  "coldEmail": { ... }
}
```

---

### Update Cold Email
**PATCH** `/cold-emails/:id`

**Headers:** `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "responseReceived": true,
  "responseDate": "2024-01-05T14:30:00.000Z",
  "ledToInterview": true
}
```

**Response (200):**
```json
{
  "message": "Cold email updated successfully",
  "coldEmail": { ... }
}
```

---

## ❌ Error Responses

All errors follow this format:

**400 Bad Request:**
```json
{
  "error": "Validation failed",
  "message": "Invalid email format",
  "details": [
    {
      "field": "email",
      "message": "Must be a valid email address"
    }
  ]
}
```

**401 Unauthorized:**
```json
{
  "error": "Unauthorized",
  "message": "Invalid or expired token"
}
```

**404 Not Found:**
```json
{
  "error": "Not found",
  "message": "Application not found"
}
```

**500 Internal Server Error:**
```json
{
  "error": "Internal server error",
  "message": "Something went wrong"
}
```

---

## 🔒 Rate Limiting

- **Limit**: 100 requests per 15 minutes per IP
- **Header**: `X-RateLimit-Remaining` shows remaining requests
- **429 Response**: "Too many requests from this IP, please try again later."

---

## 🧪 Testing

Use tools like Postman or curl:

```bash
# Login
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"password123"}'

# Get applications
curl http://localhost:3001/api/applications \
  -H "Authorization: Bearer <your_token>"
```

---

## 📝 Notes

- All timestamps are in ISO 8601 format
- All responses are JSON
- Pagination defaults: page=1, limit=20
- Maximum limit: 100 items per request

