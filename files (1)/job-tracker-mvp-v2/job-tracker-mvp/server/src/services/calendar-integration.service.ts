import { logger } from '../utils/logger';
import { ExtractedContext } from './email-context-extractor.service';

export interface CalendarEvent {
  title: string;
  description: string;
  startDate: Date;
  endDate?: Date;
  location?: string;
  attendees?: string[];
  reminder?: number; // minutes before
}

export class CalendarIntegrationService {
  /**
   * Create calendar event from extracted email context
   */
  async createEventFromEmail(
    applicationId: string,
    company: string,
    position: string,
    context: ExtractedContext
  ): Promise<CalendarEvent | null> {
    try {
      if (!context.interviewDate) {
        logger.info('No interview date found, skipping calendar event');
        return null;
      }

      const startDate = this.parseDate(context.interviewDate, context.interviewTime);
      if (!startDate) {
        logger.warn('Could not parse interview date');
        return null;
      }

      // Default to 1 hour duration if no end time
      const endDate = new Date(startDate);
      endDate.setHours(endDate.getHours() + 1);

      const event: CalendarEvent = {
        title: `Interview: ${position} at ${company}`,
        description: `Job interview for ${position} position at ${company}`,
        startDate,
        endDate,
        location: context.location || 'TBD',
        reminder: 15, // 15 minutes before
      };

      // Store event in database (for future Google Calendar integration)
      await this.storeEvent(applicationId, event);

      logger.info(`✅ Calendar event created for interview: ${company} - ${position}`);
      return event;
    } catch (error) {
      logger.error('Error creating calendar event:', error);
      return null;
    }
  }

  /**
   * Parse date and time from extracted context
   */
  private parseDate(dateStr: string, timeStr?: string): Date | null {
    try {
      // Try parsing various date formats
      let date: Date | null = null;

      // Format: "Monday, January 15, 2024"
      if (dateStr.match(/^\w+,\s+\w+\s+\d{1,2},?\s+\d{4}$/i)) {
        date = new Date(dateStr);
      }
      // Format: "15/01/2024"
      else if (dateStr.match(/^\d{1,2}\/\d{1,2}\/\d{2,4}$/)) {
        const parts = dateStr.split('/');
        if (parts[2].length === 2) {
          parts[2] = '20' + parts[2];
        }
        date = new Date(`${parts[2]}-${parts[1]}-${parts[0]}`);
      }
      // Format: "15-01-2024"
      else if (dateStr.match(/^\d{1,2}-\d{1,2}-\d{2,4}$/)) {
        const parts = dateStr.split('-');
        if (parts[2].length === 2) {
          parts[2] = '20' + parts[2];
        }
        date = new Date(`${parts[2]}-${parts[1]}-${parts[0]}`);
      }
      // Relative dates: "next Monday", "this Friday"
      else if (dateStr.match(/^(next|this)\s+\w+$/i)) {
        date = this.parseRelativeDate(dateStr);
      }
      // Default: try Date constructor
      else {
        date = new Date(dateStr);
      }

      if (!date || isNaN(date.getTime())) {
        return null;
      }

      // Add time if provided
      if (timeStr) {
        const time = this.parseTime(timeStr);
        if (time) {
          date.setHours(time.hours, time.minutes, 0, 0);
        }
      }

      return date;
    } catch (error) {
      logger.error('Error parsing date:', error);
      return null;
    }
  }

  /**
   * Parse relative dates like "next Monday"
   */
  private parseRelativeDate(dateStr: string): Date | null {
    const lower = dateStr.toLowerCase();
    const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const dayIndex = days.findIndex(day => lower.includes(day));
    
    if (dayIndex === -1) return null;

    const today = new Date();
    const currentDay = today.getDay();
    const isNext = lower.includes('next');

    let daysToAdd = dayIndex - currentDay;
    if (daysToAdd <= 0 || isNext) {
      daysToAdd += 7;
    }
    if (isNext) {
      daysToAdd += 7; // Next week
    }

    const targetDate = new Date(today);
    targetDate.setDate(today.getDate() + daysToAdd);
    return targetDate;
  }

  /**
   * Parse time string
   */
  private parseTime(timeStr: string): { hours: number; minutes: number } | null {
    try {
      const lower = timeStr.toLowerCase();
      const isPM = lower.includes('pm');
      const isAM = lower.includes('am');

      // Extract hours and minutes
      const match = timeStr.match(/(\d{1,2}):?(\d{2})?/);
      if (!match) return null;

      let hours = parseInt(match[1]);
      const minutes = match[2] ? parseInt(match[2]) : 0;

      // Convert to 24-hour format
      if (isPM && hours !== 12) {
        hours += 12;
      } else if (isAM && hours === 12) {
        hours = 0;
      }

      return { hours, minutes };
    } catch (error) {
      return null;
    }
  }

  /**
   * Store event in database (for future Google Calendar sync)
   */
  private async storeEvent(applicationId: string, event: CalendarEvent): Promise<void> {
    try {
      const { pool } = require('../database/client');
      await pool.query(
        `INSERT INTO calendar_events 
         (application_id, title, description, start_date, end_date, location, reminder_minutes, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
         ON CONFLICT (application_id) DO UPDATE SET
         title = EXCLUDED.title,
         start_date = EXCLUDED.start_date,
         end_date = EXCLUDED.end_date,
         location = EXCLUDED.location,
         updated_at = NOW()`,
        [
          applicationId,
          event.title,
          event.description,
          event.startDate,
          event.endDate,
          event.location,
          event.reminder,
        ]
      );
    } catch (error) {
      logger.error('Error storing calendar event:', error);
      // Don't throw - calendar events are non-critical
    }
  }

  /**
   * Generate Google Calendar link (for manual addition)
   */
  generateGoogleCalendarLink(event: CalendarEvent): string {
    const params = new URLSearchParams({
      action: 'TEMPLATE',
      text: event.title,
      dates: `${this.formatDateForGoogle(event.startDate)}/${this.formatDateForGoogle(event.endDate || event.startDate)}`,
      details: event.description,
      location: event.location || '',
    });

    return `https://calendar.google.com/calendar/render?${params.toString()}`;
  }

  /**
   * Format date for Google Calendar (YYYYMMDDTHHMMSSZ)
   */
  private formatDateForGoogle(date: Date): string {
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    const day = String(date.getUTCDate()).padStart(2, '0');
    const hours = String(date.getUTCHours()).padStart(2, '0');
    const minutes = String(date.getUTCMinutes()).padStart(2, '0');
    const seconds = String(date.getUTCSeconds()).padStart(2, '0');
    return `${year}${month}${day}T${hours}${minutes}${seconds}Z`;
  }
}
