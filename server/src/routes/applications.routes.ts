import { Router } from 'express';
import { z } from 'zod';
import { pool } from '../database/client';
import { logger } from '../utils/logger';
import { validateRequest } from '../middleware/validation.middleware';

const router = Router();

// Validation schemas
const createApplicationSchema = z.object({
  company: z.string().min(1).max(255),
  position: z.string().min(1).max(255),
  location: z.string().optional(),
  jobBoardSource: z.string().optional(),
  jobUrl: z.string().url().optional(),
  salary: z.string().optional(),
  status: z.enum(['APPLIED', 'VIEWED', 'SHORTLISTED', 'INTERVIEW_SCHEDULED', 'INTERVIEWED', 'OFFERED', 'REJECTED', 'WITHDRAWN', 'ACCEPTED']).default('APPLIED'),
  notes: z.string().optional(),
  timeSpent: z.number().optional(),
  captureMethod: z.enum(['MANUAL', 'EXTENSION', 'EMAIL_SYNC', 'API']).default('MANUAL'),
});

// Get all applications for user
router.get('/', async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'You must be logged in to view applications.',
      });
    }

    let page = 1;
    let limit = 20;
    if (typeof req.query.page === 'string' && !isNaN(Number(req.query.page))) {
      page = Math.max(1, parseInt(req.query.page, 10));
    }
    if (typeof req.query.limit === 'string' && !isNaN(Number(req.query.limit))) {
      limit = Math.max(1, parseInt(req.query.limit, 10));
    }
    const offset = (page - 1) * limit;

    // Get applications
    const result = await pool.query(
      `SELECT * FROM applications 
       WHERE user_id = $1 
       ORDER BY applied_at DESC 
       LIMIT $2 OFFSET $3`,
      [userId, limit, offset]
    );

    // Get total count
    const countResult = await pool.query(
      'SELECT COUNT(*) FROM applications WHERE user_id = $1',
      [userId]
    );

    const total = parseInt(countResult.rows[0].count);

    return res.json({
      applications: result.rows,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    logger.error('Error fetching applications:', error);
    return res.status(500).json({
      error: 'Failed to fetch applications',
      message: 'Unable to retrieve applications. Please try again.',
    });
  }
});

// Get single application
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;

    const result = await pool.query(
      'SELECT * FROM applications WHERE id = $1 AND user_id = $2',
      [id, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: 'Application not found',
        message: 'The requested application does not exist.',
      });
    }

    return res.json(result.rows[0]);
  } catch (error) {
    logger.error('Error fetching application:', error);
    return res.status(500).json({
      error: 'Failed to fetch application',
      message: 'Unable to retrieve application details.',
    });
  }
});

// Create new application
router.post('/', validateRequest(createApplicationSchema), async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const {
      company,
      position,
      location,
      jobBoardSource,
      jobUrl,
      salary,
      status = 'APPLIED',
      notes,
      timeSpent,
      captureMethod = 'MANUAL',
    } = req.body;

    // Check for duplicates: same user, company, position
    // Priority 1: Check by jobUrl (most reliable - exact match or normalized)
    let duplicateCheck = { rows: [] };
    if (jobUrl) {
      // Normalize URL - remove query params and trailing slashes for comparison
      const normalizedUrl = jobUrl.split('?')[0].replace(/\/+$/, '').toLowerCase();
      
      // Check for exact match first
      duplicateCheck = await pool.query(
        `SELECT id FROM applications 
         WHERE user_id = $1 AND job_url = $2`,
        [userId, jobUrl]
      );
      
      // If no exact match, check normalized version (removing query params)
      // Use SPLIT_PART to get URL without query params, then trim trailing slashes
      if (duplicateCheck.rows.length === 0) {
        duplicateCheck = await pool.query(
          `SELECT id FROM applications 
           WHERE user_id = $1 
           AND job_url IS NOT NULL
           AND LOWER(RTRIM(SPLIT_PART(job_url, '?', 1), '/')) = $2`,
          [userId, normalizedUrl]
        );
      }
    }
    
    // Priority 2: Check by company + position (case-insensitive, trimmed, within 90 days)
    if (duplicateCheck.rows.length === 0) {
      duplicateCheck = await pool.query(
        `SELECT id FROM applications 
         WHERE user_id = $1 
         AND LOWER(TRIM(company)) = LOWER(TRIM($2))
         AND LOWER(TRIM(position)) = LOWER(TRIM($3))
         AND applied_at >= NOW() - INTERVAL '90 days'`,
        [userId, company.trim(), position.trim()]
      );
    }

    if (duplicateCheck.rows.length > 0) {
      logger.info(`Duplicate application skipped: ${company} - ${position} for user ${userId}`);
      return res.status(200).json({
        message: 'Application already exists (duplicate skipped)',
        application: duplicateCheck.rows[0],
        duplicate: true,
      });
    }

    const result = await pool.query(
      `INSERT INTO applications 
       (user_id, company, position, location, job_board_source, job_url, salary, status, notes, time_spent, capture_method, applied_at, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW(), NOW(), NOW())
       RETURNING *`,
      [
        userId,
        company,
        position,
        location || null,
        jobBoardSource || null,
        jobUrl || null,
        salary || null,
        status,
        notes || null,
        timeSpent || null,
        captureMethod,
      ]
    );

    logger.info(`Application created: ${result.rows[0].id} for user ${userId}`);

    return res.status(201).json({
      message: 'Application created successfully',
      application: result.rows[0],
    });
  } catch (error) {
    logger.error('Error creating application:', error);
    return res.status(500).json({
      error: 'Failed to create application',
      message: 'Unable to create application. Please try again.',
    });
  }
});

// Update application
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;
    const updates = req.body;

    // Build update query dynamically
    const allowedFields = ['company', 'position', 'location', 'salary', 'status', 'notes', 'time_spent', 'response_date', 'interview_date'];
    const updateFields: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    for (const [key, value] of Object.entries(updates)) {
      const dbKey = key === 'jobBoardSource' ? 'job_board_source' :
                    key === 'jobUrl' ? 'job_url' :
                    key === 'timeSpent' ? 'time_spent' :
                    key === 'responseDate' ? 'response_date' :
                    key === 'interviewDate' ? 'interview_date' :
                    key.toLowerCase();

      if (allowedFields.includes(dbKey) && value !== undefined) {
        updateFields.push(`${dbKey} = $${paramIndex}`);
        values.push(value);
        paramIndex++;
      }
    }

    if (updateFields.length === 0) {
      return res.status(400).json({ error: 'No valid fields to update' });
    }

    updateFields.push(`updated_at = NOW()`);
    values.push(id, userId);

    const result = await pool.query(
      `UPDATE applications 
       SET ${updateFields.join(', ')}
       WHERE id = $${paramIndex} AND user_id = $${paramIndex + 1}
       RETURNING *`,
      values
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: 'Application not found',
        message: 'The requested application does not exist.',
      });
    }

    return res.json({
      message: 'Application updated successfully',
      application: result.rows[0],
    });
  } catch (error) {
    logger.error('Error updating application:', error);
    return res.status(500).json({
      error: 'Failed to update application',
      message: 'Unable to update application. Please try again.',
    });
  }
});

// Delete application
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;

    const result = await pool.query(
      'DELETE FROM applications WHERE id = $1 AND user_id = $2 RETURNING id',
      [id, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: 'Application not found',
        message: 'The requested application does not exist.',
      });
    }

    return res.json({
      message: 'Application deleted successfully',
    });
  } catch (error) {
    logger.error('Error deleting application:', error);
    return res.status(500).json({
      error: 'Failed to delete application',
      message: 'Unable to delete application. Please try again.',
    });
  }
});

// Helper function to calculate streak
function calculateStreaks(dates: Date[]): { current: number; longest: number } {
  if (dates.length === 0) return { current: 0, longest: 0 };

  // Sort dates in descending order
  const sortedDates = [...dates].sort((a, b) => b.getTime() - a.getTime());
  
  // Get unique dates (same day = one application day)
  const uniqueDates = Array.from(
    new Set(sortedDates.map(d => d.toISOString().split('T')[0]))
  ).map(d => new Date(d)).sort((a, b) => b.getTime() - a.getTime());

  let currentStreak = 0;
  let longestStreak = 0;
  let tempStreak = 1;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (let i = 0; i < uniqueDates.length; i++) {
    const currentDate = new Date(uniqueDates[i]);
    currentDate.setHours(0, 0, 0, 0);
    
    // Calculate days since this application date
    const daysDiff = Math.floor((today.getTime() - currentDate.getTime()) / (1000 * 60 * 60 * 24));

    // Current streak starts from today or yesterday
    if (i === 0 && (daysDiff === 0 || daysDiff === 1)) {
      currentStreak = 1;
      let j = 1;
      while (j < uniqueDates.length) {
        const nextDate = new Date(uniqueDates[j]);
        nextDate.setHours(0, 0, 0, 0);
        const diff = Math.floor((uniqueDates[j-1].getTime() - nextDate.getTime()) / (1000 * 60 * 60 * 24));
        if (diff === 1) {
          currentStreak++;
          j++;
        } else {
          break;
        }
      }
    }

    // Calculate longest streak
    if (i > 0) {
      const prevDate = new Date(uniqueDates[i - 1]);
      prevDate.setHours(0, 0, 0, 0);
      const diff = Math.floor((prevDate.getTime() - currentDate.getTime()) / (1000 * 60 * 60 * 24));
      if (diff === 1) {
        tempStreak++;
      } else {
        longestStreak = Math.max(longestStreak, tempStreak);
        tempStreak = 1;
      }
    }
  }
  longestStreak = Math.max(longestStreak, tempStreak, currentStreak);

  return { current: currentStreak, longest: longestStreak };
}

// Get application statistics with all metrics
router.get('/stats/summary', async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { period = '30' } = req.query;
    const days = parseInt(period as string);
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // Get all applications for the period
    const allAppsResult = await pool.query(
      `SELECT * FROM applications WHERE user_id = $1 AND applied_at >= $2 ORDER BY applied_at DESC`,
      [userId, startDate]
    );
    const allApps = allAppsResult.rows;

    // Get total applications
    const total = allApps.length;

    // Get applications by status
    const byStatus: Record<string, number> = {};
    allApps.forEach((app: any) => {
      byStatus[app.status || 'APPLIED'] = (byStatus[app.status || 'APPLIED'] || 0) + 1;
    });

    // Get average time per application with detailed metrics
    const appsWithTime = allApps.filter((app: any) => app.time_spent != null);
    const timeValues = appsWithTime.map((app: any) => app.time_spent || 0);
    
    let averageTimePerApplication = 0;
    let fastestTime = 0;
    let slowestTime = 0;
    let improvement = 0;
    let targetTime = 20; // Default target: 20 minutes
    
    if (timeValues.length > 0) {
      averageTimePerApplication = Math.round(timeValues.reduce((sum: number, time: number) => sum + time, 0) / timeValues.length);
      fastestTime = Math.min(...timeValues);
      slowestTime = Math.max(...timeValues);
      
      // Calculate improvement: compare with previous period
      const previousPeriodStart = new Date(startDate);
      previousPeriodStart.setDate(previousPeriodStart.getDate() - days);
      const previousAppsResult = await pool.query(
        `SELECT time_spent FROM applications 
         WHERE user_id = $1 AND applied_at >= $2 AND applied_at < $3 AND time_spent IS NOT NULL`,
        [userId, previousPeriodStart, startDate]
      );
      
      if (previousAppsResult.rows.length > 0) {
        const previousAvg = previousAppsResult.rows.reduce((sum: number, app: any) => sum + (app.time_spent || 0), 0) / previousAppsResult.rows.length;
        const improvementPercent = previousAvg > 0 
          ? Math.round(((previousAvg - averageTimePerApplication) / previousAvg) * 100)
          : 0;
        improvement = improvementPercent;
      }
    }

    // Get applications with response
    const appsWithResponse = allApps.filter((app: any) => app.response_date != null);
    const responseRate = total > 0 ? Math.round((appsWithResponse.length / total) * 100 * 100) / 100 : 0;

    // Calculate average response time (in days)
    const responseTimes: number[] = [];
    appsWithResponse.forEach((app: any) => {
      if (app.applied_at && app.response_date) {
        const applied = new Date(app.applied_at);
        const responded = new Date(app.response_date);
        const daysDiff = (responded.getTime() - applied.getTime()) / (1000 * 60 * 60 * 24);
        if (daysDiff >= 0) {
          responseTimes.push(daysDiff);
        }
      }
    });
    const averageResponseTime = responseTimes.length > 0
      ? Math.round((responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length) * 100) / 100
      : 0;

    // Calculate streaks
    const applicationDates = allApps.map((app: any) => new Date(app.applied_at || app.created_at));
    const { current: currentStreak, longest: longestStreak } = calculateStreaks(applicationDates);

    // Get weekly applications
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    const weeklyApplications = allApps.filter((app: any) => {
      const appDate = new Date(app.applied_at || app.created_at);
      return appDate >= weekAgo;
    }).length;

    // Get last week applications (week before current week)
    const twoWeeksAgo = new Date();
    twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);
    const lastWeekApplications = allApps.filter((app: any) => {
      const appDate = new Date(app.applied_at || app.created_at);
      return appDate >= twoWeeksAgo && appDate < weekAgo;
    }).length;

    // Get monthly applications (last 30 days)
    const monthAgo = new Date();
    monthAgo.setDate(monthAgo.getDate() - 30);
    const monthlyApplications = allApps.filter((app: any) => {
      const appDate = new Date(app.applied_at || app.created_at);
      return appDate >= monthAgo;
    }).length;

    // Calculate average applications per day
    const avgApplicationsPerDay = days > 0 ? Math.round((total / days) * 10) / 10 : 0;

    // Get daily application counts for the period
    const dailyCounts: Record<string, number> = {};
    allApps.forEach((app: any) => {
      const appDate = new Date(app.applied_at || app.created_at);
      const dateKey = appDate.toISOString().split('T')[0]; // YYYY-MM-DD format
      dailyCounts[dateKey] = (dailyCounts[dateKey] || 0) + 1;
    });

    // Get total time spent across all applications
    const totalTimeSpent = timeValues.reduce((sum: number, time: number) => sum + time, 0);
    const totalTimeInHours = Math.round((totalTimeSpent / 60) * 10) / 10; // Convert minutes to hours

    // Count applications by specific statuses
    const interviews = allApps.filter((app: any) => 
      app.status === 'INTERVIEW_SCHEDULED' || 
      app.status === 'INTERVIEWED' ||
      app.status === 'INTERVIEWING'
    ).length;
    
    const offers = allApps.filter((app: any) => 
      app.status === 'OFFER_RECEIVED' || 
      app.status === 'ACCEPTED'
    ).length;
    
    const pending = allApps.filter((app: any) => 
      app.status === 'APPLIED' || 
      app.status === 'SCREENING' ||
      app.status === 'UNDER_REVIEW'
    ).length;

    // Calculate best day of week
    const dayCounts: Record<number, number> = {};
    allApps.forEach((app: any) => {
      const date = new Date(app.applied_at || app.created_at);
      const day = date.getDay(); // 0 = Sunday, 6 = Saturday
      dayCounts[day] = (dayCounts[day] || 0) + 1;
    });
    const bestDayNum = Object.keys(dayCounts).reduce((a, b) => 
      dayCounts[parseInt(a)] > dayCounts[parseInt(b)] ? a : b, '0');
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const bestDayOfWeek = total > 0 ? dayNames[parseInt(bestDayNum)] : 'N/A';

    // Calculate best time of day
    const hourCounts: Record<number, number> = {};
    allApps.forEach((app: any) => {
      const date = new Date(app.applied_at || app.created_at);
      const hour = date.getHours();
      hourCounts[hour] = (hourCounts[hour] || 0) + 1;
    });
    const bestHour = Object.keys(hourCounts).reduce((a, b) => 
      hourCounts[parseInt(a)] > hourCounts[parseInt(b)] ? a : b, '0');
    // Format better
    const formatTime = (hour: number) => {
      const period = hour >= 12 ? 'PM' : 'AM';
      const displayHour = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
      return `${displayHour}:00 ${period}`;
    };
    const formattedBestTime = total > 0 ? formatTime(parseInt(bestHour)) : 'N/A';

    // Get job board performance
    const sourcePerformance: Record<string, { count: number; responses: number; avgResponseTime: number }> = {};
    allApps.forEach((app: any) => {
      const source = app.job_board_source || 'Unknown';
      if (!sourcePerformance[source]) {
        sourcePerformance[source] = { count: 0, responses: 0, avgResponseTime: 0 };
      }
      sourcePerformance[source].count++;
      if (app.response_date) {
        sourcePerformance[source].responses++;
        if (app.applied_at && app.response_date) {
          const applied = new Date(app.applied_at);
          const responded = new Date(app.response_date);
          const daysDiff = (responded.getTime() - applied.getTime()) / (1000 * 60 * 60 * 24);
          sourcePerformance[source].avgResponseTime += daysDiff;
        }
      }
    });

    // Calculate conversion rates for each source
    const sourceStats = Object.entries(sourcePerformance).map(([source, data]) => ({
      source,
      count: data.count,
      responses: data.responses,
      conversionRate: data.count > 0 ? Math.round((data.responses / data.count) * 100 * 100) / 100 : 0,
      avgResponseTime: data.responses > 0 
        ? Math.round((data.avgResponseTime / data.responses) * 100) / 100 
        : 0,
    }));

    // Get weekly goal from user settings
    const userResult = await pool.query(
      'SELECT weekly_target, monthly_target FROM users WHERE id = $1',
      [userId]
    );
    const weeklyGoal = userResult.rows[0]?.weekly_target || 10;
    const weeklyAchievement = weeklyGoal > 0 
      ? Math.round((weeklyApplications / weeklyGoal) * 100 * 100) / 100 
      : 0;

    // Get cold email stats
    const coldEmailResult = await pool.query(
      `SELECT COUNT(*) as total, 
       SUM(CASE WHEN responded = true THEN 1 ELSE 0 END) as responses
       FROM cold_emails WHERE user_id = $1 AND sent_at >= $2`,
      [userId, startDate]
    );
    const coldEmailsSent = parseInt(coldEmailResult.rows[0].total || '0');
    const coldEmailResponses = parseInt(coldEmailResult.rows[0].responses || '0');
    const coldEmailConversionRate = coldEmailsSent > 0
      ? Math.round((coldEmailResponses / coldEmailsSent) * 100 * 100) / 100
      : 0;

    return res.json({
      period: days,
      total,
      weeklyApplications,
      lastWeekApplications,
      monthlyApplications,
      avgApplicationsPerDay,
      dailyCounts, // New: Daily application counts
      totalTimeSpent: totalTimeInHours, // New: Total time in hours
      byStatus,
      interviews,
      offers,
      pending,
      averageTimePerApplication,
      fastestTime,
      slowestTime,
      targetTime,
      improvement,
      responseRate,
      responsesReceived: appsWithResponse.length,
      averageResponseTime,
      currentStreak,
      longestStreak,
      weeklyGoal,
      weeklyAchievement,
      bestDayOfWeek,
      bestTimeOfDay: formattedBestTime,
      sourcePerformance: sourceStats,
      coldEmailsSent,
      coldEmailResponses,
      coldEmailConversionRate,
    });
  } catch (error) {
    logger.error('Error fetching application stats:', error);
    return res.status(500).json({
      error: 'Failed to fetch statistics',
      message: 'Unable to retrieve application statistics.',
    });
  }
});

export default router;
