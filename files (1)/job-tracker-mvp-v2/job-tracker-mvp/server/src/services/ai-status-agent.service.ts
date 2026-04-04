import { logger } from '../utils/logger';
import { StatusDetectionService, StatusDetectionResult } from './status-detection.service';
import { pool } from '../database/client';

interface AIAnalysisResult {
  status: string;
  confidence: number;
  structuredData?: {
    interviewDate?: string;
    interviewTime?: string;
    location?: string;
    contactInfo?: string;
    actionItems?: string[];
  };
  reasoning?: string;
}

export class AIStatusAgent {
  private keywordDetector: StatusDetectionService;
  private useAI: boolean;
  private usePythonML: boolean;

  constructor() {
    this.keywordDetector = new StatusDetectionService();
    // Check if OpenAI API key is available
    this.useAI = !!process.env.OPENAI_API_KEY;
    // Python ML service is always available as fallback
    this.usePythonML = true;
    if (!this.useAI) {
      logger.info('ℹ️ OpenAI API key not found - using Python ML service + keyword detection');
    }
  }

  /**
   * Hybrid status detection: Try keyword first, use AI for ambiguous cases
   */
  async detectStatus(
    emailSubject: string,
    emailBody: string,
    userId?: string,
    applicationId?: string
  ): Promise<StatusDetectionResult & { structuredData?: any; aiUsed?: boolean }> {
    try {
      // Step 1: Try keyword detection first (fast, free)
      const keywordResult = this.keywordDetector.detectStatus(emailSubject, emailBody);

      // Step 2: If confidence is high enough, use keyword result
      if (keywordResult.confidence >= 0.85) {
        logger.info(`✅ High confidence keyword match: ${keywordResult.status} (${keywordResult.confidence})`);
        return {
          ...keywordResult,
          aiUsed: false,
        };
      }

      // Step 3: Try Python ML service first (free, always available)
      if (this.usePythonML) {
        try {
          const mlResult = await this.analyzeWithPythonML(emailSubject, emailBody);
          
          if (mlResult.confidence > keywordResult.confidence) {
            // Step 4: Learn from result
            if (userId && applicationId) {
              await this.recordDetection(userId, applicationId, {
                keywordResult,
                aiResult: mlResult,
                finalStatus: mlResult.status,
              });
            }

            return {
              status: mlResult.status,
              confidence: mlResult.confidence,
              matchedKeywords: keywordResult.matchedKeywords,
              reason: mlResult.reasoning || keywordResult.reason,
              structuredData: mlResult.structuredData,
              aiUsed: true,
            };
          }
        } catch (mlError) {
          logger.warn('Python ML service unavailable, trying OpenAI or keyword fallback');
        }
      }

      // Step 4: Use OpenAI for ambiguous cases (if available)
      if (this.useAI) {
        try {
          const aiResult = await this.analyzeWithAI(emailSubject, emailBody);
          
          if (userId && applicationId) {
            await this.recordDetection(userId, applicationId, {
              keywordResult,
              aiResult,
              finalStatus: aiResult.status,
            });
          }

          return {
            status: aiResult.status,
            confidence: aiResult.confidence,
            matchedKeywords: keywordResult.matchedKeywords,
            reason: aiResult.reasoning || keywordResult.reason,
            structuredData: aiResult.structuredData,
            aiUsed: true,
          };
        } catch (aiError) {
          logger.error('AI analysis failed, using keyword result:', aiError);
          return {
            ...keywordResult,
            aiUsed: false,
          };
        }
      } else {
        // No AI available, use keyword result
        logger.info(`Using keyword detection: ${keywordResult.status}`);
        return {
          ...keywordResult,
          aiUsed: false,
        };
      }
    } catch (error) {
      logger.error('Error in hybrid status detection:', error);
      // Ultimate fallback
      return {
        status: 'APPLIED',
        confidence: 0.5,
        matchedKeywords: [],
        reason: 'Detection failed, defaulting to APPLIED',
        aiUsed: false,
      };
    }
  }

  /**
   * Analyze email with Python ML service (free, no API key needed)
   */
  private async analyzeWithPythonML(
    emailSubject: string,
    emailBody: string
  ): Promise<AIAnalysisResult> {
    try {
      const axios = require('axios');
      const mlUrl = process.env.PYTHON_ML_URL || 'http://localhost:8000';
      
      const response = await axios.post(`${mlUrl}/api/v1/detect-status`, {
        email_subject: emailSubject,
        email_body: emailBody,
      }, { timeout: 10000 });

      const data = response.data;

      return {
        status: data.detected_status || 'APPLIED',
        confidence: Math.min(Math.max(data.confidence || 0.5, 0), 1),
        structuredData: data.extracted_data || undefined,
        reasoning: data.reasons?.join('; ') || 'Python ML analysis',
      };
    } catch (error) {
      logger.warn('Python ML status detection failed:', error);
      // Fallback to enhanced keyword analysis
      return this.enhancedKeywordAnalysis(emailSubject, emailBody);
    }
  }

  /**
   * Analyze email with AI (OpenAI API or fallback)
   */
  private async analyzeWithAI(
    emailSubject: string,
    emailBody: string
  ): Promise<AIAnalysisResult> {
    if (!this.useAI) {
      // Fallback: Enhanced keyword analysis
      return this.enhancedKeywordAnalysis(emailSubject, emailBody);
    }

    try {
      // Use OpenAI API for analysis
      const openai = require('openai');
      const client = new openai.OpenAI({
        apiKey: process.env.OPENAI_API_KEY,
      });

      const prompt = `Analyze this job application email and determine the status. Extract structured data.

Email Subject: ${emailSubject}
Email Body: ${emailBody}

Return JSON with:
{
  "status": "REJECTED" | "INTERVIEW_SCHEDULED" | "OFFERED" | "ACCEPTED" | "UNDER_REVIEW" | "PENDING_RESPONSE" | "APPLIED",
  "confidence": 0.0-1.0,
  "structuredData": {
    "interviewDate": "YYYY-MM-DD or null",
    "interviewTime": "HH:MM or null",
    "location": "string or null",
    "contactInfo": "string or null",
    "actionItems": ["string array"]
  },
  "reasoning": "brief explanation"
}`;

      const response = await client.chat.completions.create({
        model: 'gpt-4o-mini', // Use cheaper model for cost efficiency
        messages: [
          {
            role: 'system',
            content: 'You are an expert at analyzing job application emails. Extract status and structured data accurately.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.3, // Lower temperature for more consistent results
        max_tokens: 500,
      });

      const content = response.choices[0]?.message?.content || '{}';
      const parsed = JSON.parse(content);

      return {
        status: parsed.status || 'APPLIED',
        confidence: Math.min(Math.max(parsed.confidence || 0.7, 0), 1),
        structuredData: parsed.structuredData,
        reasoning: parsed.reasoning,
      };
    } catch (error) {
      logger.error('OpenAI API error, using fallback:', error);
      return this.enhancedKeywordAnalysis(emailSubject, emailBody);
    }
  }

  /**
   * Enhanced keyword analysis (fallback when AI unavailable)
   */
  private enhancedKeywordAnalysis(
    emailSubject: string,
    emailBody: string
  ): AIAnalysisResult {
    const text = `${emailSubject} ${emailBody}`.toLowerCase();
    
    // Enhanced pattern matching
    let status = 'APPLIED';
    let confidence = 0.6;
    const structuredData: any = {};
    const actionItems: string[] = [];

    // Extract interview dates
    const datePatterns = [
      /(?:interview|meeting|call)\s+(?:on|for)\s+(\w+day,?\s+\w+\s+\d+)/i,
      /(\d{1,2}\/\d{1,2}\/\d{2,4})/,
      /(\w+day,?\s+\w+\s+\d+)/i,
    ];
    for (const pattern of datePatterns) {
      const match = text.match(pattern);
      if (match) {
        structuredData.interviewDate = match[1];
        break;
      }
    }

    // Extract times
    const timePattern = /(\d{1,2}):(\d{2})\s*(?:am|pm|AM|PM)?/i;
    const timeMatch = text.match(timePattern);
    if (timeMatch) {
      structuredData.interviewTime = timeMatch[0];
    }

    // Extract locations
    const locationPatterns = [
      /(?:at|in|location:)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/,
      /(?:office|building|address:)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/,
    ];
    for (const pattern of locationPatterns) {
      const match = text.match(pattern);
      if (match) {
        structuredData.location = match[1];
        break;
      }
    }

    // Enhanced status detection
    if (text.includes('unfortunately') && text.includes('not moving forward')) {
      status = 'REJECTED';
      confidence = 0.9;
    } else if (text.includes('interview') || text.includes('schedule a call')) {
      status = 'INTERVIEW_SCHEDULED';
      confidence = 0.85;
      if (structuredData.interviewDate) confidence = 0.9;
    } else if (text.includes('offer') || text.includes('congratulations')) {
      status = 'OFFERED';
      confidence = 0.95;
    } else if (text.includes('welcome') && text.includes('team')) {
      status = 'ACCEPTED';
      confidence = 0.9;
    } else if (text.includes('under review') || text.includes('considering')) {
      status = 'UNDER_REVIEW';
      confidence = 0.75;
    } else if (text.includes('please provide') || text.includes('additional information')) {
      status = 'PENDING_RESPONSE';
      confidence = 0.7;
      actionItems.push('Provide additional information');
    }

    return {
      status,
      confidence,
      structuredData: Object.keys(structuredData).length > 0 ? structuredData : undefined,
      reasoning: `Enhanced keyword analysis: ${status}`,
    };
  }

  /**
   * Record detection for learning
   */
  private async recordDetection(
    userId: string,
    applicationId: string,
    detection: {
      keywordResult: StatusDetectionResult;
      aiResult: AIAnalysisResult;
      finalStatus: string;
    }
  ): Promise<void> {
    try {
      await pool.query(
        `INSERT INTO status_detection_logs 
         (user_id, application_id, keyword_status, keyword_confidence, ai_status, ai_confidence, final_status, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
         ON CONFLICT DO NOTHING`,
        [
          userId,
          applicationId,
          detection.keywordResult.status,
          detection.keywordResult.confidence,
          detection.aiResult.status,
          detection.aiResult.confidence,
          detection.finalStatus,
        ]
      );
    } catch (error) {
      logger.error('Error recording detection:', error);
      // Don't throw - learning is non-critical
    }
  }

  /**
   * Learn from user corrections
   */
  async learnFromCorrection(
    userId: string,
    applicationId: string,
    detectedStatus: string,
    correctedStatus: string,
    emailSubject: string,
    emailBody: string
  ): Promise<void> {
    try {
      await pool.query(
        `INSERT INTO status_corrections 
         (user_id, application_id, detected_status, corrected_status, email_subject, email_body_snippet, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
        [
          userId,
          applicationId,
          detectedStatus,
          correctedStatus,
          emailSubject,
          emailBody.substring(0, 500),
        ]
      );

      logger.info(`✅ Learned from correction: ${detectedStatus} → ${correctedStatus}`);
    } catch (error) {
      logger.error('Error learning from correction:', error);
    }
  }
}
