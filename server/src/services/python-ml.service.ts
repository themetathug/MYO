/**
 * Python ML Service Integration
 * Communicates with the Python FastAPI service for AI/ML capabilities
 */

import axios, { AxiosInstance, AxiosError } from 'axios';
import { logger } from '../utils/logger';

// Type definitions
interface JobMatchRequest {
  user_cv: string;
  job_description: string;
  user_skills?: string[];
  job_requirements?: string[];
}

interface JobMatchResponse {
  match_score: number;
  recommendation: string;
  confidence: number;
  reasons: string[];
}

interface CVAnalysisRequest {
  cv_text: string;
  target_job?: string;
}

interface CVAnalysisResponse {
  skills_found: string[];
  experience_years?: number;
  recommendations: string[];
  optimization_score: number;
  strengths: string[];
  weaknesses: string[];
}

interface SuccessPredictionRequest {
  days_since_posted: number;
  cv_version_score: number;
  time_spent: number;
  previous_success_rate: number;
  job_board: string;
}

interface SuccessPredictionResponse {
  success_probability: number;
  recommendation: string;
  factors: Record<string, any>;
  confidence: number;
}

/**
 * Python ML Service Client
 */
export class PythonMLService {
  private static instance: AxiosInstance;
  private static readonly PYTHON_ML_URL = 
    process.env.PYTHON_ML_URL || 'http://localhost:8000';

  /**
   * Get or create axios instance
   */
  private static getClient(): AxiosInstance {
    if (!this.instance) {
      this.instance = axios.create({
        baseURL: this.PYTHON_ML_URL,
        timeout: 30000, // 30 seconds timeout for ML operations
        headers: {
          'Content-Type': 'application/json',
        },
      });

      // Add request interceptor for logging
      this.instance.interceptors.request.use(
        (config) => {
          logger.info(`Calling Python ML Service: ${config.method?.toUpperCase()} ${config.url}`);
          return config;
        },
        (error) => {
          logger.error('Python ML Service request error:', error);
          return Promise.reject(error);
        }
      );

      // Add response interceptor for error handling
      this.instance.interceptors.response.use(
        (response) => response,
        (error) => {
          if (error.response) {
            logger.error(
              `Python ML Service error: ${error.response.status} - ${error.response.data}`
            );
          } else if (error.request) {
            logger.error('Python ML Service: No response received');
          } else {
            logger.error('Python ML Service error:', error.message);
          }
          return Promise.reject(error);
        }
      );
    }

    return this.instance;
  }

  /**
   * Check if Python ML service is available
   */
  static async healthCheck(): Promise<boolean> {
    try {
      const client = this.getClient();
      const response = await client.get('/health');
      logger.info('Python ML service is healthy');
      return response.data.status === 'healthy';
    } catch (error) {
      logger.warn('Python ML service is not available');
      return false;
    }
  }

  /**
   * Match job with user's CV using AI
   */
  static async matchJobs(request: JobMatchRequest): Promise<JobMatchResponse> {
    try {
      const client = this.getClient();
      const response = await client.post<JobMatchResponse>('/api/v1/match-jobs', request);
      return response.data;
    } catch (error) {
      logger.error('Error in job matching:', error);
      
      // Return fallback response if Python service is unavailable
      if (this.isServiceUnavailable(error)) {
        return {
          match_score: 0.5,
          recommendation: 'unavailable',
          confidence: 0.3,
          reasons: ['AI service temporarily unavailable. Using fallback scoring.']
        };
      }
      
      throw error;
    }
  }

  /**
   * Analyze CV and provide optimization insights
   */
  static async analyzeCV(request: CVAnalysisRequest): Promise<CVAnalysisResponse> {
    try {
      const client = this.getClient();
      const response = await client.post<CVAnalysisResponse>('/api/v1/analyze-cv', request);
      return response.data;
    } catch (error) {
      logger.error('Error in CV analysis:', error);
      
      if (this.isServiceUnavailable(error)) {
        return {
          skills_found: [],
          recommendations: ['AI analysis temporarily unavailable'],
          optimization_score: 0.5,
          strengths: [],
          weaknesses: []
        };
      }
      
      throw error;
    }
  }

  /**
   * Predict application success probability
   */
  static async predictSuccess(
    request: SuccessPredictionRequest
  ): Promise<SuccessPredictionResponse> {
    try {
      const client = this.getClient();
      const response = await client.post<SuccessPredictionResponse>(
        '/api/v1/predict-success',
        request
      );
      return response.data;
    } catch (error) {
      logger.error('Error in success prediction:', error);
      
      if (this.isServiceUnavailable(error)) {
        return {
          success_probability: 0.5,
          recommendation: 'unavailable',
          factors: {},
          confidence: 0.5
        };
      }
      
      throw error;
    }
  }

  /**
   * Check if service is unavailable (network error, timeout, etc.)
   */
  private static isServiceUnavailable(error: unknown): boolean {
    if (axios.isAxiosError(error)) {
      const axiosError = error as AxiosError;
      return (
        !axiosError.response ||
        axiosError.code === 'ECONNREFUSED' ||
        axiosError.code === 'ETIMEDOUT'
      );
    }
    return false;
  }

  /**
   * Match current application with best fit CV version
   */
  static async recommendCVVersion(
    jobDescription: string,
    cvVersions: Array<{ id: string; name: string; content?: string }>
  ): Promise<{ cvVersionId: string; score: number } | null> {
    try {
      if (!cvVersions || cvVersions.length === 0) {
        return null;
      }

      // Get the best matching CV version
      let bestMatch = { cvVersionId: cvVersions[0].id, score: 0 };

      for (const cv of cvVersions) {
        if (!cv.content) continue;

        const match = await this.matchJobs({
          user_cv: cv.content,
          job_description: jobDescription,
        });

        if (match.match_score > bestMatch.score) {
          bestMatch = {
            cvVersionId: cv.id,
            score: match.match_score,
          };
        }
      }

      return bestMatch.score > 0.3 ? bestMatch : null;
    } catch (error) {
      logger.error('Error recommending CV version:', error);
      return null;
    }
  }
}

