import { pool } from '../database/client';
import { logger } from '../utils/logger';

export interface Notification {
  userId: string;
  type: 'STATUS_UPDATE' | 'GHOSTING_DETECTED' | 'GHOSTING_WARNING' | 'EMAIL_SYNC_ERROR' | 'AI_REVIEW_REQUIRED';
  title: string;
  message: string;
  applicationId?: string;
  metadata?: Record<string, any>;
}

export class NotificationService {
  /**
   * Send notification to user (store in database for now, can extend to email/push later)
   */
  async sendNotification(notification: Notification): Promise<void> {
    try {
      // Check if user has notifications enabled
      const settings = await pool.query(
        `SELECT 
          notification_enabled,
          ghosting_notification_enabled
        FROM user_email_settings
        WHERE user_id = $1`,
        [notification.userId]
      );

      const userSettings = settings.rows[0] || {};
      
      // Check notification type and user preferences
      if (notification.type === 'GHOSTING_DETECTED' || notification.type === 'GHOSTING_WARNING') {
        if (userSettings.ghosting_notification_enabled === false) {
          logger.info(`Ghosting notifications disabled for user ${notification.userId}`);
          return;
        }
      } else {
        if (userSettings.notification_enabled === false) {
          logger.info(`Notifications disabled for user ${notification.userId}`);
          return;
        }
      }

      // Store notification in database (can be extended to send email/push)
      await pool.query(
        `INSERT INTO notifications 
         (user_id, type, title, message, application_id, metadata, created_at, read)
         VALUES ($1, $2, $3, $4, $5, $6, NOW(), false)`,
        [
          notification.userId,
          notification.type,
          notification.title,
          notification.message,
          notification.applicationId || null,
          notification.metadata ? JSON.stringify(notification.metadata) : null,
        ]
      );

      logger.info(`Notification sent: ${notification.type} to user ${notification.userId}`);
    } catch (error) {
      logger.error('Error sending notification:', error);
      // Don't throw - notifications are non-critical
    }
  }

  /**
   * Notify user about status update from email
   */
  async notifyStatusUpdate(
    userId: string,
    applicationId: string,
    oldStatus: string,
    newStatus: string,
    company: string,
    position: string
  ): Promise<void> {
    const statusLabels: Record<string, string> = {
      REJECTED: 'Rejected',
      INTERVIEW_SCHEDULED: 'Interview Scheduled',
      OFFERED: 'Offer Received',
      ACCEPTED: 'Accepted',
      UNDER_REVIEW: 'Under Review',
      GHOSTED: 'Ghosted',
    };

    await this.sendNotification({
      userId,
      type: 'STATUS_UPDATE',
      title: `Application Status Updated: ${company}`,
      message: `Your application for ${position} at ${company} has been updated from ${statusLabels[oldStatus] || oldStatus} to ${statusLabels[newStatus] || newStatus}.`,
      applicationId,
      metadata: {
        oldStatus,
        newStatus,
        company,
        position,
      },
    });
  }

  /**
   * Notify user about ghosted application
   */
  async notifyGhostingDetected(
    userId: string,
    applicationId: string,
    company: string,
    position: string,
    daysSinceApplication: number
  ): Promise<void> {
    await this.sendNotification({
      userId,
      type: 'GHOSTING_DETECTED',
      title: `Application Marked as Ghosted: ${company}`,
      message: `Your application for ${position} at ${company} has been automatically marked as "Ghosted" after ${daysSinceApplication} days with no response.`,
      applicationId,
      metadata: {
        company,
        position,
        daysSinceApplication,
      },
    });
  }

  /**
   * Notify user about approaching ghosting threshold
   */
  async notifyGhostingWarning(
    userId: string,
    applicationId: string,
    company: string,
    position: string,
    daysSinceApplication: number,
    thresholdDays: number
  ): Promise<void> {
    const daysRemaining = thresholdDays - daysSinceApplication;
    
    await this.sendNotification({
      userId,
      type: 'GHOSTING_WARNING',
      title: `Application Approaching Ghosting Threshold: ${company}`,
      message: `Your application for ${position} at ${company} will be marked as "Ghosted" in ${daysRemaining} days if no response is received.`,
      applicationId,
      metadata: {
        company,
        position,
        daysSinceApplication,
        thresholdDays,
        daysRemaining,
      },
    });
  }

  /**
   * Notify user about email sync error
   */
  async notifyEmailSyncError(
    userId: string,
    errorMessage: string
  ): Promise<void> {
    await this.sendNotification({
      userId,
      type: 'EMAIL_SYNC_ERROR',
      title: 'Email Sync Error',
      message: `There was an error syncing your email: ${errorMessage}. Please check your email settings.`,
      metadata: {
        errorMessage,
      },
    });
  }
}
