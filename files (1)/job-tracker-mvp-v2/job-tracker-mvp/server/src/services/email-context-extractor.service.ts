import { logger } from '../utils/logger';

export interface ExtractedContext {
  interviewDate?: string;
  interviewTime?: string;
  location?: string;
  contactInfo?: string;
  actionItems?: string[];
  salary?: string;
  startDate?: string;
  deadline?: string;
}

export class EmailContextExtractor {
  /**
   * Extract structured data from email content
   */
  async extractContext(emailSubject: string, emailBody: string): Promise<ExtractedContext> {
    const text = `${emailSubject} ${emailBody}`;
    const context: ExtractedContext = {};

    try {
      // Extract interview date
      context.interviewDate = this.extractDate(text);
      
      // Extract interview time
      context.interviewTime = this.extractTime(text);
      
      // Extract location
      context.location = this.extractLocation(text);
      
      // Extract contact information
      context.contactInfo = this.extractContactInfo(text);
      
      // Extract action items
      context.actionItems = this.extractActionItems(text);
      
      // Extract salary information
      context.salary = this.extractSalary(text);
      
      // Extract start date
      context.startDate = this.extractStartDate(text);
      
      // Extract deadlines
      context.deadline = this.extractDeadline(text);

      return context;
    } catch (error) {
      logger.error('Error extracting email context:', error);
      return {};
    }
  }

  /**
   * Extract date from text (various formats)
   */
  private extractDate(text: string): string | undefined {
    const datePatterns = [
      // "Monday, January 15, 2024"
      /(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday),?\s+(\w+\s+\d{1,2},?\s+\d{4})/i,
      // "January 15, 2024"
      /(\w+\s+\d{1,2},?\s+\d{4})/i,
      // "15/01/2024" or "01/15/2024"
      /(\d{1,2}\/\d{1,2}\/\d{2,4})/,
      // "15-01-2024"
      /(\d{1,2}-\d{1,2}-\d{2,4})/,
      // "15th January 2024"
      /(\d{1,2}(?:st|nd|rd|th)?\s+\w+\s+\d{4})/i,
      // "next Monday", "this Friday"
      /(?:next|this|on)\s+(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)/i,
    ];

    for (const pattern of datePatterns) {
      const match = text.match(pattern);
      if (match) {
        return match[1] || match[0];
      }
    }

    return undefined;
  }

  /**
   * Extract time from text
   */
  private extractTime(text: string): string | undefined {
    const timePatterns = [
      // "3:00 PM", "15:00"
      /(\d{1,2}:\d{2}\s*(?:am|pm|AM|PM)?)/i,
      // "3 PM", "15:00"
      /(\d{1,2}\s*(?:am|pm|AM|PM))/i,
      // "at 3pm"
      /at\s+(\d{1,2}(?::\d{2})?\s*(?:am|pm|AM|PM)?)/i,
    ];

    for (const pattern of timePatterns) {
      const match = text.match(pattern);
      if (match) {
        return match[1] || match[0];
      }
    }

    return undefined;
  }

  /**
   * Extract location from text
   */
  private extractLocation(text: string): string | undefined {
    const locationPatterns = [
      // "at [Location]", "in [Location]"
      /(?:at|in|location:)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*(?:\s+[A-Z]{2})?)/,
      // "office at [Location]"
      /office\s+(?:at|in)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/,
      // "address: [Location]"
      /address:?\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/,
      // "via Zoom", "via Teams", "remote"
      /(?:via|on)\s+(Zoom|Teams|Google Meet|Microsoft Teams|remote|Remote)/i,
    ];

    for (const pattern of locationPatterns) {
      const match = text.match(pattern);
      if (match) {
        return match[1] || match[0];
      }
    }

    // Check for common location keywords
    if (text.toLowerCase().includes('remote') || text.toLowerCase().includes('virtual')) {
      return 'Remote';
    }

    return undefined;
  }

  /**
   * Extract contact information
   */
  private extractContactInfo(text: string): string | undefined {
    // Email addresses
    const emailPattern = /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/;
    const emailMatch = text.match(emailPattern);
    if (emailMatch) {
      return emailMatch[1];
    }

    // Phone numbers (UK format)
    const phonePatterns = [
      /(\+44\s?\d{4}\s?\d{3}\s?\d{3})/,
      /(0\d{4}\s?\d{3}\s?\d{3})/,
      /(\+44\s?\d{2}\s?\d{4}\s?\d{4})/,
    ];

    for (const pattern of phonePatterns) {
      const match = text.match(pattern);
      if (match) {
        return match[1];
      }
    }

    return undefined;
  }

  /**
   * Extract action items from text
   */
  private extractActionItems(text: string): string[] {
    const actionItems: string[] = [];
    const actionPatterns = [
      /(?:please|kindly|we need|you need|required)\s+(?:to\s+)?([^.!?]+(?:\.|!|\?))/gi,
      /(?:action|next step|required):\s*([^.!?]+(?:\.|!|\?))/gi,
      /(?:reply|respond|confirm|submit|send|provide)\s+(?:by|before|until)\s+([^.!?]+(?:\.|!|\?))/gi,
    ];

    for (const pattern of actionPatterns) {
      const matches = text.matchAll(pattern);
      for (const match of matches) {
        if (match[1]) {
          actionItems.push(match[1].trim());
        }
      }
    }

    // Limit to top 5 action items
    return actionItems.slice(0, 5);
  }

  /**
   * Extract salary information
   */
  private extractSalary(text: string): string | undefined {
    const salaryPatterns = [
      /(?:salary|compensation|pay):?\s*£?(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)\s*(?:per\s+)?(?:year|annum|annually|yr|pa)/i,
      /£(\d{1,3}(?:,\d{3})*(?:k|K)?)\s*(?:per\s+)?(?:year|annum|annually|yr|pa)/i,
      /(\d{1,3}(?:,\d{3})*(?:k|K)?)\s*(?:per\s+)?(?:year|annum|annually|yr|pa)/i,
    ];

    for (const pattern of salaryPatterns) {
      const match = text.match(pattern);
      if (match) {
        return `£${match[1]}${match[2] ? ' ' + match[2] : ''}`;
      }
    }

    return undefined;
  }

  /**
   * Extract start date
   */
  private extractStartDate(text: string): string | undefined {
    const startDatePatterns = [
      /(?:start\s+date|start\s+on|begin|commence):?\s+(\w+\s+\d{1,2},?\s+\d{4})/i,
      /(?:start\s+date|start\s+on|begin|commence):?\s+(\d{1,2}\/\d{1,2}\/\d{2,4})/i,
      /(?:starting|from)\s+(\w+\s+\d{1,2},?\s+\d{4})/i,
    ];

    for (const pattern of startDatePatterns) {
      const match = text.match(pattern);
      if (match) {
        return match[1];
      }
    }

    return undefined;
  }

  /**
   * Extract deadline
   */
  private extractDeadline(text: string): string | undefined {
    const deadlinePatterns = [
      /(?:deadline|due\s+date|by|before|until):?\s+(\w+\s+\d{1,2},?\s+\d{4})/i,
      /(?:deadline|due\s+date|by|before|until):?\s+(\d{1,2}\/\d{1,2}\/\d{2,4})/i,
      /(?:respond|reply|submit|send)\s+(?:by|before|until)\s+(\w+\s+\d{1,2},?\s+\d{4})/i,
    ];

    for (const pattern of deadlinePatterns) {
      const match = text.match(pattern);
      if (match) {
        return match[1];
      }
    }

    return undefined;
  }
}
