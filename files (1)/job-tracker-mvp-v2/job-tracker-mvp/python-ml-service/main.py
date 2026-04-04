"""
UK Jobs Insider - Python ML Service
Provides AI/ML capabilities including job matching, CV analysis, and predictive analytics
"""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import os
import logging
from typing import Optional, Dict, Any
from dotenv import load_dotenv
import openai
from sentence_transformers import SentenceTransformer
import numpy as np
from sklearn.metrics.pairwise import cosine_similarity
import re

# Load environment variables
load_dotenv()

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize OpenAI client (optional - for advanced features)
openai_api_key = os.getenv('OPENAI_API_KEY')
if openai_api_key:
    openai.api_key = openai_api_key
    logger.info("✅ OpenAI API key loaded")
else:
    logger.warning("⚠️ OpenAI API key not found - using fallback methods")

# Initialize sentence transformer for semantic similarity (works offline)
try:
    model = SentenceTransformer('all-MiniLM-L6-v2')
    logger.info("✅ Sentence transformer model loaded")
except Exception as e:
    logger.warning(f"⚠️ Could not load sentence transformer: {e}")
    model = None

app = FastAPI(
    title="UK Jobs Insider ML Service",
    description="AI/ML capabilities for job tracking and analysis",
    version="1.0.0"
)

# CORS middleware for Node.js communication
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, restrict to specific origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Request/Response Models
class JobMatchRequest(BaseModel):
    user_cv: str
    job_description: str
    user_skills: Optional[list] = None
    job_requirements: Optional[list] = None

class JobMatchResponse(BaseModel):
    match_score: float
    recommendation: str
    confidence: float
    reasons: list

class CVAnalysisRequest(BaseModel):
    cv_text: str
    target_job: Optional[str] = None

class CVAnalysisResponse(BaseModel):
    skills_found: list
    experience_years: Optional[float]
    recommendations: list
    optimization_score: float
    strengths: list
    weaknesses: list

class SuccessPredictionRequest(BaseModel):
    days_since_posted: int
    cv_version_score: float
    time_spent: int
    previous_success_rate: float
    job_board: str

class SuccessPredictionResponse(BaseModel):
    success_probability: float
    recommendation: str
    factors: Dict[str, Any]
    confidence: float

# Health Check
@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "service": "python-ml",
        "version": "1.0.0"
    }

# Job Matching Endpoint
@app.post("/api/v1/match-jobs", response_model=JobMatchResponse)
async def match_jobs(request: JobMatchRequest):
    """
    AI-powered job matching using semantic similarity
    
    Analyzes how well a user's CV matches a job description
    Returns match score and recommendation
    """
    try:
        logger.info("Processing job match request")
        
        # Method 1: Use sentence transformers for semantic similarity (best quality)
        if model:
            try:
                # Create embeddings for CV and job description
                cv_embedding = model.encode([request.user_cv], convert_to_numpy=True)
                job_embedding = model.encode([request.job_description], convert_to_numpy=True)
                
                # Calculate cosine similarity
                similarity = cosine_similarity(cv_embedding, job_embedding)[0][0]
                match_score = float(similarity)
                
                # Extract specific skills for detailed reasons
                cv_skills = extract_skills_from_cv(request.user_cv)
                job_skills = extract_keywords(request.job_description)
                matched_skills = set(cv_skills).intersection(set(job_skills))
                missing_skills = set(job_skills).difference(set(cv_skills))
                
                # Generate detailed reasons
                reasons = []
                if len(matched_skills) > 0:
                    reasons.append(f"Matched {len(matched_skills)} key skills: {', '.join(list(matched_skills)[:5])}")
                if len(missing_skills) > 0:
                    reasons.append(f"Missing {len(missing_skills)} skills: {', '.join(list(missing_skills)[:5])}")
                if not reasons:
                    reasons.append("Semantic similarity analysis completed")
                
            except Exception as e:
                logger.warning(f"Semantic similarity failed, using fallback: {e}")
                # Fallback to keyword matching
                cv_keywords = extract_keywords(request.user_cv)
                job_keywords = extract_keywords(request.job_description)
                match_score = calculate_similarity(cv_keywords, job_keywords)
                reasons = ["Keyword-based matching"]
        else:
            # Fallback: Keyword-based matching
            cv_keywords = extract_keywords(request.user_cv)
            job_keywords = extract_keywords(request.job_description)
            match_score = calculate_similarity(cv_keywords, job_keywords)
            reasons = ["Keyword-based matching"]
        
        # Determine recommendation
        if match_score >= 0.75:
            recommendation = "high_match"
            confidence = min(match_score + 0.1, 0.98)
        elif match_score >= 0.55:
            recommendation = "moderate_match"
            confidence = match_score
        else:
            recommendation = "low_match"
            confidence = max(match_score - 0.1, 0.3)
        
        return JobMatchResponse(
            match_score=round(match_score, 3),
            recommendation=recommendation,
            confidence=round(confidence, 3),
            reasons=reasons
        )
        
    except Exception as e:
        logger.error(f"Error in job matching: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

# CV Analysis Endpoint
@app.post("/api/v1/analyze-cv", response_model=CVAnalysisResponse)
async def analyze_cv(request: CVAnalysisRequest):
    """
    Analyze CV and provide optimization insights
    
    Extracts skills, experience, and provides AI-powered recommendations
    """
    try:
        logger.info("Processing CV analysis request")
        
        # Extract information from CV
        skills = extract_skills_from_cv(request.cv_text)
        experience = extract_experience_years(request.cv_text)
        
        # Generate recommendations
        recommendations = generate_cv_recommendations(
            request.cv_text,
            skills,
            request.target_job
        )
        
        # Calculate optimization score
        optimization_score = calculate_optimization_score(
            skills,
            experience,
            recommendations
        )
        
        # Identify strengths and weaknesses
        strengths = identify_strengths(skills, experience)
        weaknesses = identify_weaknesses(skills, experience)
        
        return CVAnalysisResponse(
            skills_found=skills,
            experience_years=experience,
            recommendations=recommendations,
            optimization_score=optimization_score,
            strengths=strengths,
            weaknesses=weaknesses
        )
        
    except Exception as e:
        logger.error(f"Error in CV analysis: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

# Success Prediction Endpoint
@app.post("/api/v1/predict-success", response_model=SuccessPredictionResponse)
async def predict_success(request: SuccessPredictionRequest):
    """
    Predict application success based on historical data and current metrics
    
    Uses enhanced ML-based prediction with multiple factors
    """
    try:
        logger.info("Processing success prediction request")
        
        # Enhanced prediction algorithm with weighted factors
        factors = {}
        base_probability = 0.4  # Base success rate
        
        # Factor 1: CV Quality (30% weight)
        cv_factor = request.cv_version_score * 0.3
        factors["cv_quality"] = round(cv_factor, 3)
        base_probability += cv_factor
        
        # Factor 2: Historical Success Rate (25% weight)
        historical_factor = min(request.previous_success_rate * 0.25, 0.25)
        factors["historical_rate"] = round(historical_factor, 3)
        base_probability += historical_factor
        
        # Factor 3: Time Investment (15% weight)
        # More time = better application quality
        time_factor = min((request.time_spent / 1800) * 0.15, 0.15)  # Max at 30 minutes
        factors["time_investment"] = round(time_factor, 3)
        base_probability += time_factor
        
        # Factor 4: Job Freshness (10% weight)
        # Fresher postings = better chances
        freshness_factor = max(0, (7 - request.days_since_posted) / 7) * 0.1
        factors["job_freshness"] = round(freshness_factor, 3)
        base_probability += freshness_factor
        
        # Factor 5: Job Board Performance (10% weight)
        board_performance = {
            "LinkedIn": 0.08,
            "Indeed": 0.05,
            "Reed": 0.06,
            "Totaljobs": 0.05,
            "Direct": 0.10,
            "Company Website": 0.12,
        }
        board_factor = board_performance.get(request.job_board, 0.05)
        factors["job_board"] = round(board_factor, 3)
        base_probability += board_factor
        
        # Factor 6: Application Volume Adjustment
        # Too many applications might indicate lower quality
        # (This would need user's total application count - simplified for now)
        volume_adjustment = 0.0  # Can be enhanced with user data
        factors["volume_adjustment"] = volume_adjustment
        base_probability += volume_adjustment
        
        # Clamp between 0.1 and 0.95
        success_probability = min(max(base_probability, 0.1), 0.95)
        
        # Calculate confidence based on data quality
        confidence_factors = [
            1.0 if request.cv_version_score > 0 else 0.5,  # Has CV score
            1.0 if request.previous_success_rate > 0 else 0.5,  # Has history
            1.0 if request.time_spent > 0 else 0.5,  # Has time data
        ]
        confidence = sum(confidence_factors) / len(confidence_factors)
        
        # Determine recommendation
        if success_probability >= 0.7:
            recommendation = "high_chance"
        elif success_probability >= 0.5:
            recommendation = "moderate_chance"
        else:
            recommendation = "low_chance"
        
        return SuccessPredictionResponse(
            success_probability=round(success_probability, 3),
            recommendation=recommendation,
            factors=factors,
            confidence=round(confidence, 3)
        )
        
    except Exception as e:
        logger.error(f"Error in success prediction: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

# Helper Functions (Simplified for MVP)
def extract_keywords(text: str) -> set:
    """Extract keywords from text"""
    # Common tech skills
    common_skills = {
        'javascript', 'python', 'react', 'node.js', 'typescript',
        'java', 'c#', 'sql', 'html', 'css', 'git', 'aws', 'docker'
    }
    text_lower = text.lower()
    found_keywords = {skill for skill in common_skills if skill in text_lower}
    return found_keywords

def calculate_similarity(set1: set, set2: set) -> float:
    """Calculate Jaccard similarity between two sets"""
    if not set1 and not set2:
        return 0.0
    intersection = len(set1.intersection(set2))
    union = len(set1.union(set2))
    return intersection / union if union > 0 else 0.0

def extract_skills_from_cv(cv_text: str) -> list:
    """Extract skills from CV text with enhanced detection"""
    skills = []
    
    # Comprehensive tech skills database
    tech_keywords = [
        # Programming Languages
        'JavaScript', 'TypeScript', 'Python', 'Java', 'C#', 'C++', 'C', 'Go', 'Rust', 'Swift', 'Kotlin',
        'PHP', 'Ruby', 'Scala', 'R', 'MATLAB', 'Perl', 'Shell', 'Bash',
        # Web Technologies
        'React', 'Vue', 'Angular', 'Node.js', 'Express', 'Next.js', 'Nuxt.js', 'Svelte',
        'HTML', 'CSS', 'SCSS', 'SASS', 'Tailwind', 'Bootstrap', 'jQuery',
        # Backend & Databases
        'SQL', 'PostgreSQL', 'MySQL', 'MongoDB', 'Redis', 'Elasticsearch', 'DynamoDB',
        'Django', 'Flask', 'FastAPI', 'Spring', 'Laravel', 'Rails',
        # Cloud & DevOps
        'AWS', 'Azure', 'GCP', 'Docker', 'Kubernetes', 'Terraform', 'Ansible', 'Jenkins',
        'CI/CD', 'Git', 'GitHub', 'GitLab', 'Bitbucket',
        # Data & ML
        'Machine Learning', 'Deep Learning', 'AI', 'Data Analysis', 'Data Science',
        'TensorFlow', 'PyTorch', 'Pandas', 'NumPy', 'Scikit-learn',
        # Other
        'GraphQL', 'REST API', 'Microservices', 'Agile', 'Scrum', 'DevOps',
        'Linux', 'Windows', 'macOS', 'iOS', 'Android',
    ]
    
    cv_lower = cv_text.lower()
    
    # Extract skills (case-insensitive)
    for skill in tech_keywords:
        # Use word boundaries for better matching
        pattern = r'\b' + re.escape(skill.lower()) + r'\b'
        if re.search(pattern, cv_lower, re.IGNORECASE):
            skills.append(skill)
    
    # Also look for common patterns like "X years of experience in Y"
    experience_pattern = r'(\d+)\+?\s*years?\s*(?:of\s*)?experience\s*(?:in|with)?\s*([A-Za-z\s]+)'
    matches = re.findall(experience_pattern, cv_text, re.IGNORECASE)
    for years, tech in matches:
        tech_clean = tech.strip()
        if tech_clean and len(tech_clean) < 30:  # Reasonable skill name length
            skills.append(tech_clean)
    
    # Remove duplicates while preserving order
    seen = set()
    unique_skills = []
    for skill in skills:
        skill_lower = skill.lower()
        if skill_lower not in seen:
            seen.add(skill_lower)
            unique_skills.append(skill)
    
    return unique_skills

def extract_experience_years(cv_text: str) -> float:
    """Extract years of experience from CV"""
    # Simplified extraction
    import re
    years_pattern = r'(\d+)\+?\s*(?:years?|year|yrs)'
    matches = re.findall(years_pattern, cv_text.lower())
    if matches:
        return float(max(matches))
    return 2.0  # Default

def generate_cv_recommendations(cv_text: str, skills: list, target_job: Optional[str]) -> list:
    """Generate AI-powered recommendations"""
    recommendations = []
    
    if len(skills) < 5:
        recommendations.append("Add more technical skills to your CV")
    
    if 'project' not in cv_text.lower():
        recommendations.append("Include project descriptions to showcase experience")
    
    if target_job:
        recommendations.append(f"Tailor CV to highlight relevant {target_job} experience")
    
    recommendations.append("Add quantifiable achievements with numbers")
    
    return recommendations[:3]  # Return top 3

def calculate_optimization_score(skills: list, experience: float, recommendations: list) -> float:
    """Calculate CV optimization score"""
    score = 0.0
    
    # Skills component (40%)
    skills_score = min(len(skills) / 10, 1.0) * 0.4
    score += skills_score
    
    # Experience component (30%)
    experience_score = min(experience / 5, 1.0) * 0.3
    score += experience_score
    
    # Recommendations component (30%)
    optimization_score = max(0, (3 - len(recommendations)) / 3) * 0.3
    score += optimization_score
    
    return round(score, 2)

def identify_strengths(skills: list, experience: float) -> list:
    """Identify CV strengths"""
    strengths = []
    
    if len(skills) >= 8:
        strengths.append("Strong technical skills diversity")
    
    if experience >= 3:
        strengths.append("Solid industry experience")
    
    return strengths

def identify_weaknesses(skills: list, experience: float) -> list:
    """Identify CV weaknesses"""
    weaknesses = []
    
    if len(skills) < 5:
        weaknesses.append("Limited technical skills")
    
    if experience < 2:
        weaknesses.append("Limited industry experience")
    
    return weaknesses

# Status Detection Models
class StatusDetectionRequest(BaseModel):
    email_subject: str
    email_body: str

class StatusDetectionResponse(BaseModel):
    detected_status: str
    confidence: float
    reasons: list
    extracted_data: Optional[Dict[str, Any]] = None

def extract_entities_from_email(text: str) -> Dict[str, Any]:
    """Extract structured data from email text (dates, times, locations)"""
    import re
    entities: Dict[str, Any] = {}
    
    # Extract dates
    date_patterns = [
        r'(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday),?\s+(\w+\s+\d{1,2},?\s+\d{4})',
        r'(\d{1,2}/\d{1,2}/\d{2,4})',
        r'(\d{1,2}-\d{1,2}-\d{2,4})',
        r'(\d{1,2}(?:st|nd|rd|th)?\s+\w+\s+\d{4})',
    ]
    for pattern in date_patterns:
        match = re.search(pattern, text, re.IGNORECASE)
        if match:
            entities['date'] = match.group(1) if match.lastindex else match.group(0)
            break
    
    # Extract times
    time_pattern = r'(\d{1,2}:\d{2}\s*(?:am|pm|AM|PM)?)'
    time_match = re.search(time_pattern, text)
    if time_match:
        entities['time'] = time_match.group(1)
    
    # Extract locations
    location_patterns = [
        r'(?:at|in|location:)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)',
        r'(?:via|on)\s+(Zoom|Teams|Google Meet|Microsoft Teams)',
    ]
    for pattern in location_patterns:
        match = re.search(pattern, text)
        if match:
            entities['location'] = match.group(1)
            break
    
    if 'remote' in text.lower() or 'virtual' in text.lower():
        entities['location'] = entities.get('location', 'Remote')
    
    return entities

# AI Status Detection Endpoint
@app.post("/api/v1/detect-status", response_model=StatusDetectionResponse)
async def detect_status(request: StatusDetectionRequest):
    """
    AI-powered email status detection.
    Analyzes email subject and body to determine application status.
    Uses semantic similarity when model is available.
    """
    try:
        logger.info("Processing AI status detection request")
        
        text = f"Subject: {request.email_subject}\nBody: {request.email_body}".lower()
        
        # Define status templates for semantic matching
        status_templates = {
            "REJECTED": [
                "unfortunately we have decided to move forward with other candidates",
                "we regret to inform you that your application was not successful",
                "after careful consideration we will not be proceeding with your application",
            ],
            "INTERVIEW_SCHEDULED": [
                "we would like to invite you for an interview",
                "we would like to schedule a call to discuss the role",
                "congratulations you have been selected for an interview",
            ],
            "OFFERED": [
                "we are pleased to offer you the position",
                "congratulations we would like to extend an offer",
                "we are delighted to offer you employment",
            ],
            "ACCEPTED": [
                "welcome aboard we look forward to your start date",
                "congratulations and welcome to the team",
                "your acceptance has been confirmed",
            ],
            "UNDER_REVIEW": [
                "we are currently reviewing your application",
                "your application is still being considered",
                "we will get back to you shortly with an update",
            ],
            "PENDING_RESPONSE": [
                "please provide additional information",
                "we need some more details from you",
                "could you please confirm your availability",
            ],
        }
        
        detected_status = "UNDER_REVIEW"
        confidence = 0.5
        reasons = []
        
        # Method 1: Semantic similarity (best quality)
        if model:
            try:
                text_embedding = model.encode([text], convert_to_numpy=True)
                best_score = 0.0
                best_status = "UNDER_REVIEW"
                
                for status, templates in status_templates.items():
                    template_embeddings = model.encode(templates, convert_to_numpy=True)
                    similarities = cosine_similarity(text_embedding, template_embeddings)[0]
                    max_sim = float(np.max(similarities))
                    
                    if max_sim > best_score:
                        best_score = max_sim
                        best_status = status
                
                if best_score > 0.3:
                    detected_status = best_status
                    confidence = min(best_score + 0.3, 0.98)
                    reasons.append(f"Semantic similarity match (score: {best_score:.3f})")
                    
            except Exception as e:
                logger.warning(f"Semantic detection failed, using keyword fallback: {e}")
        
        # Method 2: Enhanced keyword-based (fallback + reinforcement)
        keyword_status, keyword_conf, keyword_reasons = keyword_detect_status(text)
        
        if keyword_conf > confidence:
            detected_status = keyword_status
            confidence = keyword_conf
            reasons = keyword_reasons
        elif keyword_status == detected_status:
            # Both agree - boost confidence
            confidence = min(confidence + 0.1, 0.98)
            reasons.append("Keyword analysis confirms semantic detection")
        
        # Extract structured data
        extracted_data = extract_entities_from_email(f"{request.email_subject} {request.email_body}")
        
        return StatusDetectionResponse(
            detected_status=detected_status,
            confidence=round(confidence, 3),
            reasons=reasons if reasons else ["Analysis completed"],
            extracted_data=extracted_data if extracted_data else None,
        )
        
    except Exception as e:
        logger.error(f"Error in AI status detection: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

def keyword_detect_status(text: str):
    """Keyword-based status detection"""
    status_keywords = {
        "REJECTED": {
            "keywords": ["unfortunately", "not moving forward", "other candidates", "not selected", "regret to inform", "position has been filled"],
            "confidence": 0.9,
        },
        "INTERVIEW_SCHEDULED": {
            "keywords": ["interview", "schedule a call", "would like to speak", "next steps", "phone screen", "video call"],
            "confidence": 0.85,
        },
        "OFFERED": {
            "keywords": ["offer", "congratulations", "pleased to offer", "welcome to the team", "offer letter"],
            "confidence": 0.95,
        },
        "ACCEPTED": {
            "keywords": ["welcome aboard", "start date", "onboarding", "first day", "excited to have you"],
            "confidence": 0.9,
        },
        "UNDER_REVIEW": {
            "keywords": ["under review", "reviewing", "considering", "evaluating"],
            "confidence": 0.75,
        },
        "PENDING_RESPONSE": {
            "keywords": ["please provide", "additional information", "follow-up", "clarification"],
            "confidence": 0.7,
        },
    }
    
    best_status = "UNDER_REVIEW"
    best_confidence = 0.5
    best_reasons = []
    
    for status, config in status_keywords.items():
        matched = [kw for kw in config["keywords"] if kw in text]
        if matched:
            conf = min(config["confidence"] * (1 + len(matched) * 0.1), 0.98)
            if conf > best_confidence:
                best_confidence = conf
                best_status = status
                best_reasons = [f"Matched keywords: {', '.join(matched[:3])}"]
    
    return best_status, best_confidence, best_reasons

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)

