import Bull from 'bull';
import { logger } from '../utils/logger';
import { prisma } from '../database/client';

// Create queues
const analyticsQueue = new Bull('analytics', process.env.REDIS_URL || 'redis://localhost:6379');
const emailQueue = new Bull('email', process.env.REDIS_URL || 'redis://localhost:6379');
const exportQueue = new Bull('export', process.env.REDIS_URL || 'redis://localhost:6379');

// Initialize queues
export async function initializeQueue(): Promise<void> {
  // Analytics queue processor
  analyticsQueue.process(async (job) => {
    const { userId, type, data } = job.data;
    
    try {
      logger.info(`Processing analytics job: ${type} for user ${userId}`);
      
      switch (type) {
        case 'APPLICATION_CREATED':
        case 'APPLICATION_UPDATED':
          await updateUserAnalytics(userId);
          break;
        
        case 'BULK_APPLICATIONS_CREATED':
          await updateUserAnalytics(userId);
          await updateStreakData(userId);
          break;
        
        case 'DAILY_SUMMARY':
          await generateDailySummary(userId);
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

  // Email queue processor
  emailQueue.process(async (job) => {
    const { to, subject, template, data } = job.data;
    
    try {
      logger.info(`Sending email to ${to}: ${subject}`);
      // TODO: Implement email sending logic
      // await sendEmail(to, subject, template, data);
      return { success: true };
    } catch (error) {
      logger.error(`Email job failed:`, error);
      throw error;
    }
  });

  // Export queue processor
  exportQueue.process(async (job) => {
    const { userId, format, filters } = job.data;
    
    try {
      logger.info(`Generating ${format} export for user ${userId}`);
      // TODO: Implement export logic
      // const exportUrl = await generateExport(userId, format, filters);
      return { success: true, url: 'export-url' };
    } catch (error) {
      logger.error(`Export job failed:`, error);
      throw error;
    }
  });

  // Queue event listeners
  analyticsQueue.on('completed', (job, result) => {
    logger.info(`Analytics job ${job.id} completed`);
  });

  analyticsQueue.on('failed', (job, err) => {
    logger.error(`Analytics job ${job.id} failed:`, err);
  });

  logger.info('Job queues initialized');
}

// Helper functions
async function updateUserAnalytics(userId: string): Promise<void> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Get today's applications
  const applications = await prisma.application.findMany({
    where: {
      userId,
      appliedAt: {
        gte: today,
      },
    },
    include: {
      cvVersion: true,
    },
  });

  // Calculate metrics
  const avgTimePerApp = applications.reduce((sum, app) => sum + (app.timeSpent || 0), 0) / applications.length || 0;
  const responses = applications.filter(app => app.responseDate !== null).length;
  const interviews = applications.filter(app => app.status === 'INTERVIEW_SCHEDULED' || app.status === 'INTERVIEWED').length;

  // Get user's target
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { weeklyTarget: true },
  });

  // Calculate target achievement
  const targetAchievement = user?.weeklyTarget 
    ? (applications.length / user.weeklyTarget) * 100 
    : 0;

  // Update or create analytics record
  await prisma.userAnalytics.upsert({
    where: {
      userId_date: {
        userId,
        date: today,
      },
    },
    update: {
      applicationsCount: applications.length,
      avgTimePerApp,
      responses,
      interviews,
      targetAchievement,
    },
    create: {
      userId,
      date: today,
      applicationsCount: applications.length,
      avgTimePerApp,
      responses,
      interviews,
      targetAchievement,
    },
  });
}

async function updateStreakData(userId: string): Promise<void> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Check if user has applications today
  const todayApplications = await prisma.application.count({
    where: {
      userId,
      appliedAt: {
        gte: today,
      },
    },
  });

  if (todayApplications === 0) return;

  // Get or create current streak
  const currentStreak = await prisma.streak.findFirst({
    where: {
      userId,
      isActive: true,
    },
    orderBy: {
      startDate: 'desc',
    },
  });

  if (currentStreak) {
    // Check if streak is continuous
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    const yesterdayApplications = await prisma.application.count({
      where: {
        userId,
        appliedAt: {
          gte: yesterday,
          lt: today,
        },
      },
    });

    if (yesterdayApplications > 0) {
      // Continue streak
      await prisma.streak.update({
        where: { id: currentStreak.id },
        data: {
          currentDays: currentStreak.currentDays + 1,
          longestDays: Math.max(currentStreak.longestDays, currentStreak.currentDays + 1),
        },
      });
    } else {
      // Break streak and start new one
      await prisma.streak.update({
        where: { id: currentStreak.id },
        data: {
          isActive: false,
          endDate: yesterday,
        },
      });

      await prisma.streak.create({
        data: {
          userId,
          startDate: today,
          currentDays: 1,
          longestDays: 1,
          isActive: true,
        },
      });
    }
  } else {
    // Create new streak
    await prisma.streak.create({
      data: {
        userId,
        startDate: today,
        currentDays: 1,
        longestDays: 1,
        isActive: true,
      },
    });
  }
}

async function generateDailySummary(userId: string): Promise<void> {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  yesterday.setHours(0, 0, 0, 0);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const applications = await prisma.application.findMany({
    where: {
      userId,
      appliedAt: {
        gte: yesterday,
        lt: today,
      },
    },
  });

  if (applications.length > 0) {
    // Queue email with daily summary
    await emailQueue.add('daily-summary', {
      userId,
      applications: applications.length,
      date: yesterday,
    });
  }
}

// Public functions to queue jobs
export async function queueAnalyticsUpdate(userId: string, data: any): Promise<void> {
  await analyticsQueue.add(data.type, { userId, ...data }, {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000,
    },
  });
}

export async function queueEmail(data: {
  to: string;
  subject: string;
  template: string;
  data: any;
}): Promise<void> {
  await emailQueue.add('send-email', data, {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000,
    },
  });
}

export async function queueExport(userId: string, format: string, filters?: any): Promise<void> {
  await exportQueue.add('generate-export', { userId, format, filters }, {
    attempts: 2,
    timeout: 30000, // 30 seconds timeout for export jobs
  });
}

// Clean up old completed jobs
export async function cleanQueues(): Promise<void> {
  await analyticsQueue.clean(24 * 60 * 60 * 1000); // Clean jobs older than 24 hours
  await emailQueue.clean(24 * 60 * 60 * 1000);
  await exportQueue.clean(24 * 60 * 60 * 1000);
}

// Graceful shutdown
export async function closeQueues(): Promise<void> {
  await analyticsQueue.close();
  await emailQueue.close();
  await exportQueue.close();
  logger.info('Job queues closed');
}
