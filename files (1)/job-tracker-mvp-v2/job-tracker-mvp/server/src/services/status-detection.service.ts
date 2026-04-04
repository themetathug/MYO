import { logger } from '../utils/logger';

export interface StatusDetectionResult {
  status: string;
  confidence: number;
  matchedKeywords: string[];
  reason?: string;
}

export class StatusDetectionService {
  // Status keyword patterns with confidence scores
  private statusPatterns = {
    REJECTED: {
      keywords: [
        'we have decided to move forward with other candidates',
        'unfortunately',
        'not selected',
        'position has been filled',
        'we will not be moving forward',
        'other candidates',
        'not proceed',
        'not a fit',
        'thank you for your interest',
        'we regret to inform',
        'not moving forward',
        'decided to pursue other candidates',
        'position has been closed',
        'not the right fit',
        'better suited candidates',
      ],
      baseConfidence: 0.9,
    },
    INTERVIEW_SCHEDULED: {
      keywords: [
        'interview',
        'schedule a call',
        'would like to speak with you',
        'next steps',
        'move forward in the process',
        'phone screen',
        'technical interview',
        'video call',
        'meeting',
        'discuss your application',
        'chat about the role',
        'interview process',
        'screening call',
        'initial interview',
        'first round',
      ],
      baseConfidence: 0.85,
    },
    OFFERED: {
      keywords: [
        'offer',
        'congratulations',
        'welcome to the team',
        'offer letter',
        'we are pleased to offer',
        'we would like to offer',
        'job offer',
        'employment offer',
        'extending an offer',
        'offer of employment',
        'delighted to offer',
      ],
      baseConfidence: 0.95,
    },
    ACCEPTED: {
      keywords: [
        'welcome aboard',
        'looking forward to working with you',
        'start date',
        'onboarding',
        'first day',
        'welcome to',
        'excited to have you',
        'joining the team',
      ],
      baseConfidence: 0.9,
    },
    PENDING_RESPONSE: {
      keywords: [
        'additional information needed',
        'please provide',
        'follow-up required',
        'clarification',
        'more details',
        'further information',
        'please confirm',
        'could you please',
        'we need',
      ],
      baseConfidence: 0.7,
    },
    UNDER_REVIEW: {
      keywords: [
        'under review',
        'reviewing applications',
        'still reviewing',
        'in the process of reviewing',
        'considering your application',
        'evaluating candidates',
      ],
      baseConfidence: 0.75,
    },
  };

  /**
   * Detect application status from email subject and body
   * Enhanced with NLP-like features: sentiment analysis, context understanding
   */
  detectStatus(emailSubject: string, emailBody: string): StatusDetectionResult {
    const text = `${emailSubject} ${emailBody}`.toLowerCase();
    let bestMatch: StatusDetectionResult = {
      status: 'APPLIED',
      confidence: 0,
      matchedKeywords: [],
    };

    // Analyze sentiment and context
    const sentiment = this.analyzeSentiment(text);
    const context = this.analyzeContext(text);

    // Check each status pattern
    for (const [status, config] of Object.entries(this.statusPatterns)) {
      const matchedKeywords: string[] = [];
      
      // Find matching keywords (with word boundary matching for better accuracy)
      for (const keyword of config.keywords) {
        const keywordLower = keyword.toLowerCase();
        // Use word boundaries to avoid partial matches
        const regex = new RegExp(`\\b${keywordLower.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
        if (regex.test(text)) {
          matchedKeywords.push(keyword);
        }
      }

      if (matchedKeywords.length > 0) {
        // Calculate base confidence
        const keywordRatio = matchedKeywords.length / config.keywords.length;
        let confidence = Math.min(
          config.baseConfidence * (1 + keywordRatio * 0.3),
          0.98
        );

        // Boost confidence if multiple keywords match
        if (matchedKeywords.length >= 2) {
          confidence = Math.min(confidence + 0.1, 0.98);
        }

        // Apply sentiment analysis adjustments
        if (status === 'REJECTED' && sentiment.isNegative) {
          confidence = Math.min(confidence + 0.05, 0.98);
        } else if (status === 'OFFERED' && sentiment.isPositive) {
          confidence = Math.min(confidence + 0.05, 0.98);
        } else if (status === 'REJECTED' && sentiment.isPositive) {
          confidence = Math.max(confidence - 0.1, 0.5); // Reduce confidence
        }

        // Apply context adjustments
        if (context.hasActionWords && status === 'INTERVIEW_SCHEDULED') {
          confidence = Math.min(confidence + 0.05, 0.98);
        }
        if (context.hasTimeReferences && status === 'INTERVIEW_SCHEDULED') {
          confidence = Math.min(confidence + 0.03, 0.98);
        }

        if (confidence > bestMatch.confidence) {
          bestMatch = {
            status,
            confidence,
            matchedKeywords,
            reason: this.generateReason(status, matchedKeywords, sentiment, context),
          };
        }
      }
    }

    // Additional checks for context
    if (bestMatch.confidence > 0) {
      // Check for negative indicators that might reduce confidence
      const negativeIndicators = [
        'test email',
        'do not reply',
        'automated message',
        'unsubscribe',
        'no-reply',
        'noreply',
      ];
      
      const hasNegativeIndicator = negativeIndicators.some(indicator =>
        text.includes(indicator)
      );
      
      if (hasNegativeIndicator && bestMatch.confidence < 0.8) {
        bestMatch.confidence *= 0.7; // Reduce confidence
      }

      // Check for positive reinforcement phrases
      const positivePhrases = [
        'congratulations',
        'pleased to',
        'excited to',
        'welcome',
        'delighted',
      ];
      
      if (positivePhrases.some(phrase => text.includes(phrase)) && 
          (bestMatch.status === 'OFFERED' || bestMatch.status === 'ACCEPTED')) {
        bestMatch.confidence = Math.min(bestMatch.confidence + 0.05, 0.98);
      }
    }

    logger.info(
      `Status detection: ${bestMatch.status} (confidence: ${bestMatch.confidence.toFixed(2)}, sentiment: ${sentiment.label})`
    );
    
    return bestMatch;
  }

  /**
   * Analyze sentiment of email text (simple NLP-like approach)
   */
  private analyzeSentiment(text: string): {
    isPositive: boolean;
    isNegative: boolean;
    score: number;
    label: string;
  } {
    const positiveWords = [
      'congratulations', 'excited', 'pleased', 'delighted', 'welcome',
      'great', 'excellent', 'wonderful', 'fantastic', 'amazing',
      'successful', 'approved', 'accepted', 'looking forward',
    ];

    const negativeWords = [
      'unfortunately', 'regret', 'sorry', 'unable', 'cannot',
      'not selected', 'not moving forward', 'declined', 'rejected',
      'disappointed', 'difficult decision',
    ];

    let positiveCount = 0;
    let negativeCount = 0;

    for (const word of positiveWords) {
      const regex = new RegExp(`\\b${word}\\b`, 'gi');
      const matches = text.match(regex);
      if (matches) positiveCount += matches.length;
    }

    for (const word of negativeWords) {
      const regex = new RegExp(`\\b${word}\\b`, 'gi');
      const matches = text.match(regex);
      if (matches) negativeCount += matches.length;
    }

    const total = positiveCount + negativeCount;
    const score = total > 0 ? (positiveCount - negativeCount) / total : 0;

    return {
      isPositive: score > 0.2,
      isNegative: score < -0.2,
      score,
      label: score > 0.2 ? 'positive' : score < -0.2 ? 'negative' : 'neutral',
    };
  }

  /**
   * Analyze context of email (action words, time references, etc.)
   */
  private analyzeContext(text: string): {
    hasActionWords: boolean;
    hasTimeReferences: boolean;
    hasFormalLanguage: boolean;
  } {
    const actionWords = [
      'schedule', 'arrange', 'coordinate', 'set up', 'plan',
      'meet', 'discuss', 'speak', 'call', 'interview',
    ];

    const timeReferences = [
      'tomorrow', 'next week', 'monday', 'tuesday', 'wednesday',
      'thursday', 'friday', 'at', 'on', 'time', 'date',
      'calendar', 'availability', 'when', 'schedule',
    ];

    const formalPhrases = [
      'dear', 'sincerely', 'regards', 'best regards',
      'thank you for', 'we would like', 'please',
    ];

    const hasActionWords = actionWords.some(word => text.includes(word));
    const hasTimeReferences = timeReferences.some(word => text.includes(word));
    const hasFormalLanguage = formalPhrases.some(phrase => text.includes(phrase));

    return {
      hasActionWords,
      hasTimeReferences,
      hasFormalLanguage,
    };
  }

  /**
   * Generate human-readable reason for status detection
   */
  private generateReason(
    _status: string,
    matchedKeywords: string[],
    sentiment: any,
    context: any
  ): string {
    const reasons: string[] = [];

    if (matchedKeywords.length > 0) {
      reasons.push(`Matched ${matchedKeywords.length} keyword(s): ${matchedKeywords.slice(0, 2).join(', ')}`);
    }

    if (sentiment.label !== 'neutral') {
      reasons.push(`Sentiment: ${sentiment.label}`);
    }

    if (context.hasActionWords) {
      reasons.push('Contains action words');
    }

    return reasons.join('; ') || 'Pattern match';
  }

  /**
   * Extract company domain from email address
   */
  extractCompanyDomain(emailFrom: string): string {
    try {
      // Handle formats like:
      // "hr@netflix.com"
      // "John Doe <hr@netflix.com>"
      // "hr@netflix.com (via Greenhouse)"
      const match = emailFrom.match(/@([a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
      if (match) {
        return match[1].toLowerCase();
      }
      
      // Fallback: try to extract from full string
      const parts = emailFrom.split('@');
      if (parts.length > 1) {
        const domain = parts[parts.length - 1].split(/[<>()]/)[0].trim();
        return domain.toLowerCase();
      }
      
      return '';
    } catch (error) {
      logger.error('Error extracting company domain:', error);
      return '';
    }
  }

  /**
   * Check if email is from a known ATS (Applicant Tracking System)
   * These often have different domains than the company
   */
  isATSEmail(domain: string): { isATS: boolean; companyDomain?: string } {
    const atsDomains: Record<string, string> = {
      'greenhouse.io': 'greenhouse',
      'lever.co': 'lever',
      'workday.com': 'workday',
      'taleo.net': 'taleo',
      'icims.com': 'icims',
      'smartrecruiters.com': 'smartrecruiters',
      'ashbyhq.com': 'ashby',
      'bamboohr.com': 'bamboohr',
      'jobvite.com': 'jobvite',
    };

    for (const [atsDomain, atsName] of Object.entries(atsDomains)) {
      if (domain.includes(atsDomain)) {
        return { isATS: true, companyDomain: atsName };
      }
    }

    return { isATS: false };
  }

  /**
   * Normalize company domain (remove www, subdomains for matching)
   */
  normalizeDomain(domain: string): string {
    if (!domain) return '';
    
    // Remove www.
    let normalized = domain.replace(/^www\./i, '');
    
    // For ATS domains, keep as is
    const atsCheck = this.isATSEmail(normalized);
    if (atsCheck.isATS) {
      return normalized;
    }
    
    // Remove common subdomains (jobs, careers, apply, etc.)
    normalized = normalized.replace(/^(jobs|careers|apply|recruiting|hr|talent)\./i, '');
    
    return normalized.toLowerCase();
  }

  /**
   * Match email domain to application company
   * Returns match confidence (0-1)
   */
  matchDomainToCompany(
    emailDomain: string,
    applicationCompany: string,
    applicationDomain?: string
  ): number {
    if (!emailDomain || !applicationCompany) return 0;

    const normalizedEmailDomain = this.normalizeDomain(emailDomain);
    const normalizedAppDomain = applicationDomain
      ? this.normalizeDomain(applicationDomain)
      : '';

    // Exact domain match
    if (normalizedAppDomain && normalizedEmailDomain === normalizedAppDomain) {
      return 1.0;
    }

    // Check if email domain contains company name
    const companyNameLower = applicationCompany.toLowerCase().replace(/\s+/g, '');
    if (normalizedEmailDomain.includes(companyNameLower)) {
      return 0.9;
    }

    // Check if company name contains domain
    if (companyNameLower.includes(normalizedEmailDomain.split('.')[0])) {
      return 0.85;
    }

    // Partial match (e.g., "netflix" in "netflix.com")
    const domainBase = normalizedEmailDomain.split('.')[0];
    if (companyNameLower.includes(domainBase) || domainBase.includes(companyNameLower)) {
      return 0.7;
    }

    return 0;
  }
}
