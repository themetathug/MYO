import { pool } from '../database/client';
import { logger } from '../utils/logger';
import { NotificationService } from './notification.service';

export class GhostingDetectionService {
  /**
   * Check for ghosted applications and update their status
   * @param userId - User ID to check applications for
   * @param thresholdDays - Number of days without response to consider ghosted (default: 25)
   */
  async checkForGhostedApplications(
    userId: string,
    thresholdDays?: number
  ): Promise<{ ghostedCount: number; ghostedApplications: any[] }> {
    try {
      // Get user's default threshold or use provided one
      const defaultThreshold = thresholdDays || 25;

      const thresholdDate = new Date();
      thresholdDate.setDate(thresholdDate.getDate() - defaultThreshold);

      logger.info(
        `Checking for ghosted applications for user ${userId} (threshold: ${defaultThreshold} days)`
      );

      // Get applications that:
      // 1. Are older than threshold
      // 2. Status is still APPLIED or UNDER_REVIEW
      // 3. No email communication in last threshold days
      // 4. Auto status is enabled (if column exists)
      const result = await pool.query(
        `SELECT 
          a.id,
          a.company,
          a.position,
          a.status,
          a.applied_at,
          a.last_email_date,
          a.ghosting_threshold_days,
          a.auto_status_enabled
        FROM applications a
        WHERE a.user_id = $1
          AND a.status IN ('APPLIED', 'UNDER_REVIEW')
          AND a.applied_at < $2
          AND (
            a.last_email_date IS NULL 
            OR a.last_email_date < $2
          )
          AND (a.auto_status_enabled IS NULL OR a.auto_status_enabled = true)
        ORDER BY a.applied_at ASC`,
        [userId, thresholdDate]
      );

      const ghostedApplications = result.rows;
      let updatedCount = 0;

      // Update each ghosted application
      for (const app of ghostedApplications) {
        // Use application-specific threshold if set, otherwise use default
        const appThreshold = app.ghosting_threshold_days || defaultThreshold;
        const appThresholdDate = new Date();
        appThresholdDate.setDate(appThresholdDate.getDate() - appThreshold);

        // Double-check with application-specific threshold
        if (
          new Date(app.applied_at) < appThresholdDate &&
          (!app.last_email_date || new Date(app.last_email_date) < appThresholdDate)
        ) {
          await pool.query(
            `UPDATE applications 
             SET status = 'GHOSTED',
                 updated_at = NOW()
             WHERE id = $1 AND status IN ('APPLIED', 'UNDER_REVIEW')`,
            [app.id]
          );

          updatedCount++;
          logger.info(
            `Marked application as GHOSTED: ${app.company} - ${app.position} (${app.id})`
          );

          // Send notification
          try {
            const notificationService = new NotificationService();
            const daysSinceApplication = Math.floor(
              (Date.now() - new Date(app.applied_at).getTime()) / (1000 * 60 * 60 * 24)
            );
            await notificationService.notifyGhostingDetected(
              userId,
              app.id,
              app.company,
              app.position,
              daysSinceApplication
            );
          } catch (notifError) {
            logger.error('Error sending ghosting notification:', notifError);
            // Don't fail if notification fails
          }
        }
      }

      logger.info(
        `Ghosting detection complete: ${updatedCount} applications marked as ghosted for user ${userId}`
      );

      return {
        ghostedCount: updatedCount,
        ghostedApplications: ghostedApplications.slice(0, updatedCount),
      };
    } catch (error) {
      logger.error('Error checking for ghosted applications:', error);
      throw error;
    }
  }

  /**
   * Check all users for ghosted applications (for cron job)
   */
  async checkAllUsersForGhostedApplications(): Promise<{
    totalGhosted: number;
    usersProcessed: number;
  }> {
    try {
      // Get all users
      const usersResult = await pool.query('SELECT id FROM users');

      let totalGhosted = 0;
      let usersProcessed = 0;

      for (const user of usersResult.rows) {
        try {
          const result = await this.checkForGhostedApplications(user.id);
          totalGhosted += result.ghostedCount;
          usersProcessed++;
        } catch (error) {
          logger.error(`Error processing user ${user.id} for ghosting:`, error);
          // Continue with other users
        }
      }

      logger.info(
        `Ghosting detection batch complete: ${totalGhosted} total applications marked as ghosted across ${usersProcessed} users`
      );

      return {
        totalGhosted,
        usersProcessed,
      };
    } catch (error) {
      logger.error('Error in batch ghosting detection:', error);
      throw error;
    }
  }

  /**
   * Get applications approaching ghosting threshold (for notifications)
   */
  async getApproachingGhosting(
    userId: string,
    warningDays: number = 5
  ): Promise<any[]> {
    try {
      const thresholdDate = new Date();
      thresholdDate.setDate(thresholdDate.getDate() - 25 + warningDays); // 5 days before 25-day threshold

      const result = await pool.query(
        `SELECT 
          id,
          company,
          position,
          applied_at,
          last_email_date,
          ghosting_threshold_days,
          status
        FROM applications
        WHERE user_id = $1
          AND status IN ('APPLIED', 'UNDER_REVIEW')
          AND applied_at < $2
          AND (
            last_email_date IS NULL 
            OR last_email_date < $2
          )
          AND (auto_status_enabled IS NULL OR auto_status_enabled = true)
        ORDER BY applied_at ASC`,
        [userId, thresholdDate]
      );

      return result.rows;
    } catch (error) {
      logger.error('Error getting approaching ghosting applications:', error);
      return [];
    }
  }
}
