import Bull from 'bull';
import { logger } from '../utils/logger';
import { pool } from '../database/client';

// Create queues - gracefully handle if Redis is not available
let analyticsQueue: Bull.Queue | null = null;
let emailQueue: Bull.Queue | null = null;
let exportQueue: Bull.Queue | null = null;

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

// Track which queues have already warned about Redis
const warnedQueues = new Set<string>();

function createQueue(name: string): Bull.Queue | null {
  try {
    const queue = new Bull(name, REDIS_URL, {
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 2000 },
        removeOnComplete: 100,
        removeOnFail: 50,
      },
    });

    queue.on('error', (err) => {
      // Only warn once per queue to avoid spam
      if (!warnedQueues.has(name)) {
        logger.warn(`Queue "${name}" error (Redis may not be running). Queue features disabled for this queue.`);
        warnedQueues.add(name);
      }
      // Use debug level for subsequent errors to avoid log spam
      logger.debug(`Queue "${name}" error:`, err.message);
    });

    return queue;
  } catch (error) {
    if (!warnedQueues.has(name)) {
      logger.warn(`Could not create queue "${name}" (Redis unavailable). Queue features disabled.`);
      warnedQueues.add(name);
    }
    return null;
  }
}

// Initialize queues
export async function initializeQueue(): Promise<void> {
  try {
    analyticsQueue = createQueue('analytics');
    emailQueue = createQueue('email');
    exportQueue = createQueue('export');

    // Setup processors only if queues are available
    if (emailQueue) {
      emailQueue.process(async (job) => {
        const { to, subject, html, text, type, data } = job.data;

        try {
          logger.info(`Sending email to ${to}: ${subject}`);

          const { EmailSenderService } = require('./email-sender.service');
          const emailService = new EmailSenderService();

          let success = false;

          if (type === 'STATUS_UPDATE' && data) {
            success = await emailService.sendStatusUpdateEmail(
              to, data.company, data.position, data.oldStatus, data.newStatus
            );
          } else if (type === 'GHOSTING_NOTIFICATION' && data) {
            success = await emailService.sendGhostingNotificationEmail(
              to, data.company, data.position, data.daysSinceApplication
            );
          } else {
            success = await emailService.sendEmail({ to, subject, html, text });
          }

          return { success };
        } catch (error) {
          logger.error(`Email job failed:`, error);
          throw error;
        }
      });
    }

    if (exportQueue) {
      exportQueue.process(async (job) => {
        const { userId, format, options } = job.data;

        try {
          logger.info(`Generating ${format} export for user ${userId}`);

          const { ExportService } = require('./export.service');
          const exportService = new ExportService();

          const exportData = await exportService.exportUserData(userId, {
            format: format as 'csv' | 'pdf' | 'json',
            ...options,
          });

          return { success: true, data: exportData, format };
        } catch (error) {
          logger.error(`Export job failed:`, error);
          throw error;
        }
      });
    }

    if (analyticsQueue) {
      analyticsQueue.process(async (job) => {
        const { userId, type } = job.data;

        try {
          logger.info(`Processing analytics job: ${type} for user ${userId}`);

          switch (type) {
            case 'APPLICATION_CREATED':
            case 'APPLICATION_UPDATED':
              await updateUserAnalytics(userId);
              break;
            case 'DAILY_SUMMARY':
              logger.info(`Daily summary for user ${userId}`);
              break;
            default:
              logger.warn(`Unknown analytics job type: ${type}`);
          }

          return { success: true };
        } catch (error) {
          logger.error(`Analytics job failed:`, error);
          throw error;
        }
      });

      analyticsQueue.on('completed', (job) => {
        logger.info(`Analytics job ${job.id} completed`);
      });

      analyticsQueue.on('failed', (job, err) => {
        logger.error(`Analytics job ${job.id} failed:`, err);
      });
    }

    logger.info('✅ Job queues initialized' + (!analyticsQueue ? ' (Redis unavailable - queues disabled)' : ''));
  } catch (error) {
    logger.warn('⚠️ Could not initialize queues (Redis may not be running). Queue features disabled.');
  }
}

// Helper: Update user analytics using pool
async function updateUserAnalytics(userId: string): Promise<void> {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const result = await pool.query(
      `SELECT 
         COUNT(*) as total,
         AVG(time_spent) as avg_time,
         COUNT(*) FILTER (WHERE status != 'APPLIED') as responses,
         COUNT(*) FILTER (WHERE status IN ('INTERVIEW_SCHEDULED', 'INTERVIEWED')) as interviews
       FROM applications
       WHERE user_id = $1 AND applied_at >= $2`,
      [userId, today]
    );

    const stats = result.rows[0];

    await pool.query(
      `INSERT INTO user_analytics (user_id, date, applications_count, avg_time_per_app, target_achievement)
       VALUES ($1, $2, $3, $4, 0)
       ON CONFLICT (user_id, date) DO UPDATE SET
       applications_count = $3,
       avg_time_per_app = $4`,
      [userId, today, parseInt(stats.total || 0), parseFloat(stats.avg_time || 0)]
    );
  } catch (error) {
    logger.error('Error updating user analytics:', error);
  }
}

// Public functions to queue jobs (with graceful fallback)
export async function queueAnalyticsUpdate(userId: string, data: any): Promise<void> {
  if (!analyticsQueue) {
    // Fallback: run inline if Redis not available
    await updateUserAnalytics(userId);
    return;
  }
  await analyticsQueue.add(data.type, { userId, ...data });
}

export async function queueEmail(data: {
  to: string;
  subject: string;
  html?: string;
  text?: string;
  type?: string;
  data?: any;
}): Promise<void> {
  if (!emailQueue) {
    // Fallback: send immediately if Redis not available
    try {
      const { EmailSenderService } = require('./email-sender.service');
      const emailService = new EmailSenderService();
      await emailService.sendEmail(data);
    } catch (error) {
      logger.error('Fallback email send failed:', error);
    }
    return;
  }
  await emailQueue.add('send-email', data);
}

export async function queueExport(userId: string, format: string, options?: any): Promise<void> {
  if (!exportQueue) {
    logger.warn('Export queue not available (Redis not running)');
    return;
  }
  await exportQueue.add('generate-export', { userId, format, options }, {
    timeout: 30000,
  });
}

// Clean up old completed jobs
export async function cleanQueues(): Promise<void> {
  if (analyticsQueue) await analyticsQueue.clean(24 * 60 * 60 * 1000);
  if (emailQueue) await emailQueue.clean(24 * 60 * 60 * 1000);
  if (exportQueue) await exportQueue.clean(24 * 60 * 60 * 1000);
}

// Graceful shutdown
export async function closeQueues(): Promise<void> {
  if (analyticsQueue) await analyticsQueue.close();
  if (emailQueue) await emailQueue.close();
  if (exportQueue) await exportQueue.close();
  logger.info('Job queues closed');
}

export async function getQueueHealthMetrics(): Promise<{
  redisAvailable: boolean;
  queues: Record<string, { waiting: number; active: number; completed: number; failed: number; paused: boolean }>;
}> {
  const queues: Record<string, Bull.Queue | null> = {
    analytics: analyticsQueue,
    email: emailQueue,
    export: exportQueue,
  };

  const result: Record<string, { waiting: number; active: number; completed: number; failed: number; paused: boolean }> = {};

  for (const [name, queue] of Object.entries(queues)) {
    if (!queue) {
      result[name] = { waiting: 0, active: 0, completed: 0, failed: 0, paused: false };
      continue;
    }

    const [waiting, active, completed, failed, paused] = await Promise.all([
      queue.getWaitingCount(),
      queue.getActiveCount(),
      queue.getCompletedCount(),
      queue.getFailedCount(),
      queue.isPaused(),
    ]);

    result[name] = { waiting, active, completed, failed, paused };
  }

  return {
    redisAvailable: !!analyticsQueue || !!emailQueue || !!exportQueue,
    queues: result,
  };
}
