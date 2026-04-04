import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../database/client';
import { logger } from '../utils/logger';
import { validateQuery } from '../middleware/validation.middleware';
import { CacheService } from '../services/redis.service';

const router = Router();

// Get dashboard analytics
router.get('/dashboard', async (req, res) => {
  try {
    const userId = req.user?.id;
    const period = parseInt(req.query.period as string) || 30;

    // Try to get from cache first
    const cacheKey = `analytics:dashboard:${userId}:${period}`;
    const cached = await CacheService.get(cacheKey);
    if (cached) {
      return res.json(cached);
    }

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - period);

    // Get total applications
    const totalApplications = await prisma.application.count({
      where: {
        userId,
        appliedAt: { gte: startDate },
      },
    });

    // Get weekly applications
    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - 7);
    const weeklyApplications = await prisma.application.count({
      where: {
        userId,
        appliedAt: { gte: weekStart },
      },
    });

    // Get monthly applications
    const monthStart = new Date();
    monthStart.setMonth(monthStart.getMonth() - 1);
    const monthlyApplications = await prisma.application.count({
      where: {
        userId,
        appliedAt: { gte: monthStart },
      },
    });

    // Get average time per application
    const timeStats = await prisma.application.aggregate({
      where: {
        userId,
        appliedAt: { gte: startDate },
        timeSpent: { not: null },
      },
      _avg: { timeSpent: true },
    });
    const averageTimePerApp = Math.round((timeStats._avg.timeSpent || 0) / 60); // Convert to minutes

    // Get response rate
    const withResponse = await prisma.application.count({
      where: {
        userId,
        appliedAt: { gte: startDate },
        responseDate: { not: null },
      },
    });
    const responseRate = totalApplications > 0 ? (withResponse / totalApplications) * 100 : 0;

    // Get interview rate
    const interviews = await prisma.application.count({
      where: {
        userId,
        appliedAt: { gte: startDate },
        status: { in: ['INTERVIEW_SCHEDULED', 'INTERVIEWED'] },
      },
    });
    const interviewRate = totalApplications > 0 ? (interviews / totalApplications) * 100 : 0;

    // Get target achievement
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { weeklyTarget: true, monthlyTarget: true },
    });
    
    const targetAchievement = user?.weeklyTarget 
      ? (weeklyApplications / user.weeklyTarget) * 100 
      : 0;

    // Get current streak
    const currentStreak = await prisma.streak.findFirst({
      where: {
        userId,
        isActive: true,
      },
      select: { currentDays: true },
    });

    // Get top sources
    const sources = await prisma.application.groupBy({
      by: ['jobBoardSource'],
      where: {
        userId,
        appliedAt: { gte: startDate },
        jobBoardSource: { not: null },
      },
      _count: { jobBoardSource: true },
    });

    const topSources = await Promise.all(
      sources.slice(0, 5).map(async (source) => {
        const successful = await prisma.application.count({
          where: {
            userId,
            jobBoardSource: source.jobBoardSource,
            appliedAt: { gte: startDate },
            status: { in: ['INTERVIEW_SCHEDULED', 'INTERVIEWED', 'OFFERED', 'ACCEPTED'] },
          },
        });

        return {
          source: source.jobBoardSource || 'Unknown',
          count: source._count.jobBoardSource,
          successRate: (successful / source._count.jobBoardSource) * 100,
        };
      })
    );

    // Get applications by status
    const statusGroups = await prisma.application.groupBy({
      by: ['status'],
      where: {
        userId,
        appliedAt: { gte: startDate },
      },
      _count: { status: true },
    });

    const applicationsByStatus = statusGroups.reduce(
      (acc, group) => ({
        ...acc,
        [group.status]: group._count.status,
      }),
      {} as Record<string, number>
    );

    // Get daily activity
    const applications = await prisma.application.findMany({
      where: {
        userId,
        appliedAt: { gte: startDate },
      },
      select: {
        appliedAt: true,
      },
      orderBy: { appliedAt: 'asc' },
    });

    const dailyActivity = applications.reduce((acc, app) => {
      const date = app.appliedAt.toISOString().split('T')[0];
      const existing = acc.find(d => d.date === date);
      if (existing) {
        existing.count++;
      } else {
        acc.push({ date, count: 1 });
      }
      return acc;
    }, [] as { date: string; count: number }[]);

    // Get peak application time
    const timeDistribution = applications.reduce((acc, app) => {
      const hour = app.appliedAt.getHours();
      acc[hour] = (acc[hour] || 0) + 1;
      return acc;
    }, {} as Record<number, number>);

    const peakApplicationTime = Object.entries(timeDistribution).reduce(
      (max, [hour, count]) => (count > max.count ? { hour: parseInt(hour), count } : max),
      { hour: 0, count: 0 }
    ).hour;

    // Get CV version performance
    const cvVersions = await prisma.cVVersion.findMany({
      where: { userId },
      include: {
        _count: {
          select: { applications: true },
        },
      },
    });

    const cvVersionPerformance = await Promise.all(
      cvVersions.map(async (cv) => {
        const successful = await prisma.application.count({
          where: {
            cvVersionId: cv.id,
            status: { in: ['INTERVIEW_SCHEDULED', 'INTERVIEWED', 'OFFERED', 'ACCEPTED'] },
          },
        });

        return {
          name: `${cv.name} v${cv.version}`,
          conversionRate: cv._count.applications > 0 
            ? (successful / cv._count.applications) * 100 
            : 0,
          applications: cv._count.applications,
        };
      })
    );

    const analyticsData = {
      totalApplications,
      weeklyApplications,
      monthlyApplications,
      averageTimePerApp,
      responseRate,
      interviewRate,
      targetAchievement,
      currentStreak: currentStreak?.currentDays || 0,
      topSources,
      applicationsByStatus,
      dailyActivity,
      peakApplicationTime,
      cvVersionPerformance,
    };

    // Cache the results
    await CacheService.set(cacheKey, analyticsData, 300); // Cache for 5 minutes

    res.json(analyticsData);
  } catch (error) {
    logger.error('Error fetching dashboard analytics:', error);
    res.status(500).json({
      error: 'Failed to fetch analytics',
      message: 'Unable to retrieve dashboard data',
    });
  }
});

// Get detailed analytics
router.get('/detailed', async (req, res) => {
  try {
    const userId = req.user?.id;
    const { startDate, endDate, groupBy = 'day' } = req.query;

    const start = startDate ? new Date(startDate as string) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const end = endDate ? new Date(endDate as string) : new Date();

    // Get applications in date range
    const applications = await prisma.application.findMany({
      where: {
        userId,
        appliedAt: {
          gte: start,
          lte: end,
        },
      },
      include: {
        cvVersion: true,
        events: true,
      },
      orderBy: { appliedAt: 'asc' },
    });

    // Group by specified period
    const grouped = applications.reduce((acc, app) => {
      let key: string;
      
      switch (groupBy) {
        case 'hour':
          key = app.appliedAt.toISOString().slice(0, 13);
          break;
        case 'day':
          key = app.appliedAt.toISOString().split('T')[0];
          break;
        case 'week':
          const weekStart = new Date(app.appliedAt);
          weekStart.setDate(weekStart.getDate() - weekStart.getDay());
          key = weekStart.toISOString().split('T')[0];
          break;
        case 'month':
          key = app.appliedAt.toISOString().slice(0, 7);
          break;
        default:
          key = app.appliedAt.toISOString().split('T')[0];
      }

      if (!acc[key]) {
        acc[key] = {
          period: key,
          applications: [],
          count: 0,
          avgTime: 0,
          responses: 0,
          interviews: 0,
        };
      }

      acc[key].applications.push(app);
      acc[key].count++;
      if (app.timeSpent) acc[key].avgTime += app.timeSpent;
      if (app.responseDate) acc[key].responses++;
      if (['INTERVIEW_SCHEDULED', 'INTERVIEWED'].includes(app.status)) {
        acc[key].interviews++;
      }

      return acc;
    }, {} as Record<string, any>);

    // Calculate averages
    Object.values(grouped).forEach((group: any) => {
      group.avgTime = group.avgTime / group.count;
      group.responseRate = (group.responses / group.count) * 100;
      group.interviewRate = (group.interviews / group.count) * 100;
      delete group.applications; // Remove raw applications from response
    });

    res.json({
      period: { start, end },
      groupBy,
      data: Object.values(grouped),
    });
  } catch (error) {
    logger.error('Error fetching detailed analytics:', error);
    res.status(500).json({
      error: 'Failed to fetch analytics',
      message: 'Unable to retrieve detailed analytics',
    });
  }
});

// Get conversion funnel
router.get('/funnel', async (req, res) => {
  try {
    const userId = req.user?.id;
    const period = parseInt(req.query.period as string) || 30;

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - period);

    // Get counts for each stage
    const [applied, viewed, shortlisted, interviewed, offered, accepted] = await Promise.all([
      prisma.application.count({
        where: { userId, appliedAt: { gte: startDate } },
      }),
      prisma.application.count({
        where: {
          userId,
          appliedAt: { gte: startDate },
          status: { in: ['VIEWED', 'SHORTLISTED', 'INTERVIEW_SCHEDULED', 'INTERVIEWED', 'OFFERED', 'ACCEPTED'] },
        },
      }),
      prisma.application.count({
        where: {
          userId,
          appliedAt: { gte: startDate },
          status: { in: ['SHORTLISTED', 'INTERVIEW_SCHEDULED', 'INTERVIEWED', 'OFFERED', 'ACCEPTED'] },
        },
      }),
      prisma.application.count({
        where: {
          userId,
          appliedAt: { gte: startDate },
          status: { in: ['INTERVIEWED', 'OFFERED', 'ACCEPTED'] },
        },
      }),
      prisma.application.count({
        where: {
          userId,
          appliedAt: { gte: startDate },
          status: { in: ['OFFERED', 'ACCEPTED'] },
        },
      }),
      prisma.application.count({
        where: {
          userId,
          appliedAt: { gte: startDate },
          status: 'ACCEPTED',
        },
      }),
    ]);

    const funnel = [
      { stage: 'Applied', count: applied, percentage: 100 },
      { stage: 'Viewed', count: viewed, percentage: applied > 0 ? (viewed / applied) * 100 : 0 },
      { stage: 'Shortlisted', count: shortlisted, percentage: applied > 0 ? (shortlisted / applied) * 100 : 0 },
      { stage: 'Interviewed', count: interviewed, percentage: applied > 0 ? (interviewed / applied) * 100 : 0 },
      { stage: 'Offered', count: offered, percentage: applied > 0 ? (offered / applied) * 100 : 0 },
      { stage: 'Accepted', count: accepted, percentage: applied > 0 ? (accepted / applied) * 100 : 0 },
    ];

    res.json(funnel);
  } catch (error) {
    logger.error('Error fetching funnel analytics:', error);
    res.status(500).json({
      error: 'Failed to fetch funnel',
      message: 'Unable to retrieve conversion funnel',
    });
  }
});

// Track custom event
router.post('/event', async (req, res) => {
  try {
    const userId = req.user?.id;
    const { eventType, eventData } = req.body;

    // Log the event (could be sent to analytics service)
    logger.info('Analytics event', {
      userId,
      eventType,
      eventData,
      timestamp: new Date(),
    });

    res.json({ success: true });
  } catch (error) {
    logger.error('Error tracking event:', error);
    res.status(500).json({
      error: 'Failed to track event',
      message: 'Unable to record analytics event',
    });
  }
});

export default router;
