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

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

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
        
        # TODO: Implement actual ML model
        # For MVP, using simple heuristic-based matching
        
        # Extract keywords from CV
        cv_keywords = extract_keywords(request.user_cv)
        
        # Extract keywords from job description
        job_keywords = extract_keywords(request.job_description)
        
        # Calculate match score
        match_score = calculate_similarity(cv_keywords, job_keywords)
        
        # Determine recommendation
        if match_score >= 0.8:
            recommendation = "high_match"
            confidence = match_score
            reasons = ["Strong skill alignment", "Good experience match"]
        elif match_score >= 0.6:
            recommendation = "moderate_match"
            confidence = match_score
            reasons = ["Some relevant experience", "Partial skill match"]
        else:
            recommendation = "low_match"
            confidence = match_score
            reasons = ["Limited relevant experience", "Some skills missing"]
        
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
    
    Uses ML model to predict interview/offer probability
    """
    try:
        logger.info("Processing success prediction request")
        
        # TODO: Implement actual ML model with trained data
        # For MVP, using rule-based prediction
        
        # Calculate base probability
        base_probability = 0.5
        
        # Adjust based on factors
        if request.cv_version_score > 0.8:
            base_probability += 0.15
        if request.previous_success_rate > 0.3:
            base_probability += 0.1
        if request.time_spent > 600:  # More than 10 minutes
            base_probability += 0.1
        if request.days_since_posted < 7:
            base_probability += 0.1
        
        # Job board adjustments
        board_adjustments = {
            "LinkedIn": 0.05,
            "Indeed": 0.02,
            "Direct": 0.08,
        }
        base_probability += board_adjustments.get(request.job_board, 0)
        
        # Clamp between 0 and 1
        success_probability = min(max(base_probability, 0), 1)
        
        # Determine recommendation
        if success_probability >= 0.7:
            recommendation = "high_chance"
            confidence = 0.8
        elif success_probability >= 0.5:
            recommendation = "moderate_chance"
            confidence = 0.7
        else:
            recommendation = "low_chance"
            confidence = 0.6
        
        return SuccessPredictionResponse(
            success_probability=round(success_probability, 3),
            recommendation=recommendation,
            factors={
                "cv_score": request.cv_version_score,
                "time_invested": request.time_spent,
                "fresh_posting": request.days_since_posted < 7,
                "job_board": request.job_board
            },
            confidence=confidence
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
    """Extract skills from CV text"""
    skills = []
    tech_keywords = [
        'JavaScript', 'Python', 'React', 'Node.js', 'TypeScript',
        'Java', 'C#', 'SQL', 'AWS', 'Docker', 'Kubernetes',
        'Machine Learning', 'AI', 'Data Analysis'
    ]
    cv_lower = cv_text.lower()
    for skill in tech_keywords:
        if skill.lower() in cv_lower:
            skills.append(skill)
    return skills

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

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)

