import { Router, Request, Response } from 'express';
import { pool } from '../database/client';
import { asyncHandler, AppError } from '../middleware/error.middleware';
import { logger } from '../utils/logger';

const router = Router();

// ─── Shared helper ───────────────────────────────────────────────────────────

function calcStreak(dates: Date[]): number {
  if (dates.length === 0) return 0;

  const unique = Array.from(
    new Set(dates.map(d => d.toISOString().split('T')[0]))
  ).sort().reverse();

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const mostRecent = new Date(unique[0]);
  const daysSince = Math.floor((today.getTime() - mostRecent.getTime()) / 86400000);

  // Streak is dead if last app was >1 day ago
  if (daysSince > 1) return 0;

  let streak = 1;
  for (let i = 1; i < unique.length; i++) {
    const prev = new Date(unique[i - 1]);
    const curr = new Date(unique[i]);
    const diff = Math.floor((prev.getTime() - curr.getTime()) / 86400000);
    if (diff === 1) {
      streak++;
    } else {
      break;
    }
  }
  return streak;
}

async function getCvPerformance(userId: string, startDate: Date) {
  const result = await pool.query(
    `SELECT
       cv.id,
       cv.name,
       COUNT(a.id) AS applications,
       COUNT(*) FILTER (WHERE a.response_date IS NOT NULL OR a.status NOT IN ('APPLIED','GHOSTED')) AS responses,
       COUNT(*) FILTER (WHERE a.status IN ('INTERVIEW_SCHEDULED','INTERVIEWED')) AS interviews,
       COUNT(*) FILTER (WHERE a.status IN ('OFFERED','ACCEPTED')) AS offers,
       COUNT(*) FILTER (WHERE a.status = 'REJECTED') AS rejections,
       PERCENTILE_CONT(0.5) WITHIN GROUP (
         ORDER BY EXTRACT(EPOCH FROM (a.response_date - a.applied_at)) / 86400.0
       ) FILTER (WHERE a.response_date IS NOT NULL AND a.applied_at IS NOT NULL) AS median_response_days
     FROM cv_versions cv
     LEFT JOIN applications a
       ON a.cv_version_id = cv.id
      AND a.user_id = cv.user_id
      AND a.applied_at >= $2
     WHERE cv.user_id = $1
     GROUP BY cv.id, cv.name
     ORDER BY applications DESC, cv.name ASC`,
    [userId, startDate]
  );

  return result.rows.map((r: any) => {
    const apps = parseInt(r.applications || 0);
    const interviews = parseInt(r.interviews || 0);
    const offers = parseInt(r.offers || 0);
    const responses = parseInt(r.responses || 0);
    const rejections = parseInt(r.rejections || 0);
    return {
      id: r.id,
      name: r.name,
      applications: apps,
      responses,
      interviews,
      offers,
      rejections,
      responseRate: apps > 0 ? Math.round((responses / apps) * 10000) / 100 : 0,
      interviewRate: apps > 0 ? Math.round((interviews / apps) * 10000) / 100 : 0,
      offerRate: apps > 0 ? Math.round((offers / apps) * 10000) / 100 : 0,
      rejectionRate: apps > 0 ? Math.round((rejections / apps) * 10000) / 100 : 0,
      medianResponseDays: r.median_response_days ? Math.round(parseFloat(r.median_response_days) * 100) / 100 : null,
      weightedScore:
        apps > 0
          ? Math.round(
              (
                (interviews / apps) * 0.35 +
                (offers / apps) * 0.45 +
                (responses / apps) * 0.15 +
                (1 - rejections / apps) * 0.05
              ) * 10000
            ) / 100
          : 0,
    };
  });
}

async function getCvPerformanceHistory(userId: string, startDate: Date) {
  const result = await pool.query(
    `SELECT
       cv.id AS cv_id,
       cv.name AS cv_name,
       DATE_TRUNC('week', a.applied_at)::date AS week_start,
       COUNT(a.id) AS applications,
       COUNT(*) FILTER (WHERE a.status IN ('INTERVIEW_SCHEDULED','INTERVIEWED')) AS interviews,
       COUNT(*) FILTER (WHERE a.status IN ('OFFERED','ACCEPTED')) AS offers,
       COUNT(*) FILTER (WHERE a.status = 'REJECTED') AS rejections,
       COUNT(*) FILTER (WHERE a.response_date IS NOT NULL OR a.status NOT IN ('APPLIED','GHOSTED')) AS responses
     FROM cv_versions cv
     JOIN applications a
       ON a.cv_version_id = cv.id
      AND a.user_id = cv.user_id
      AND a.applied_at >= $2
     WHERE cv.user_id = $1
     GROUP BY cv.id, cv.name, DATE_TRUNC('week', a.applied_at)::date
     ORDER BY week_start ASC, cv_name ASC`,
    [userId, startDate]
  );

  const rows = result.rows.map((r: any) => {
    const apps = parseInt(r.applications || 0);
    const interviews = parseInt(r.interviews || 0);
    const offers = parseInt(r.offers || 0);
    const responses = parseInt(r.responses || 0);
    const rejections = parseInt(r.rejections || 0);
    const weightedScore =
      apps > 0
        ? Math.round(
            (
              (interviews / apps) * 0.35 +
              (offers / apps) * 0.45 +
              (responses / apps) * 0.15 +
              (1 - rejections / apps) * 0.05
            ) * 10000
          ) / 100
        : 0;

    return {
      cvId: r.cv_id,
      cvName: r.cv_name,
      weekStart: r.week_start instanceof Date ? r.week_start.toISOString().split('T')[0] : r.week_start,
      applications: apps,
      interviews,
      offers,
      rejections,
      responses,
      weightedScore,
    };
  });

  const grouped = new Map<string, any[]>();
  for (const row of rows) {
    if (!grouped.has(row.cvId)) grouped.set(row.cvId, []);
    grouped.get(row.cvId)!.push(row);
  }

  const byCv = Array.from(grouped.entries()).map(([cvId, points]) => {
    const ordered = points.sort((a, b) => a.weekStart.localeCompare(b.weekStart));
    const latest = ordered[ordered.length - 1];
    const previous = ordered.length > 1 ? ordered[ordered.length - 2] : null;
    const weeklyDelta = previous ? Math.round((latest.weightedScore - previous.weightedScore) * 100) / 100 : null;
    return {
      cvId,
      cvName: latest.cvName,
      points: ordered,
      latestWeightedScore: latest.weightedScore,
      previousWeightedScore: previous?.weightedScore ?? null,
      weeklyDelta,
    };
  });

  const sorted = byCv.sort((a, b) => (b.latestWeightedScore || 0) - (a.latestWeightedScore || 0));
  return sorted;
}

/**
 * Auto-fire recommendation events when a CV's score drops by ≥10 points WoW
 * or falls below an absolute floor of 25 (indicating underperformance).
 * These events are written async — they never block the API response.
 */
async function autoFireRecommendations(userId: string, history: any[]): Promise<void> {
  const SCORE_DROP_THRESHOLD = 10;
  const ABSOLUTE_FLOOR = 25;

  const candidates = history.filter((cv) => {
    if (cv.latestWeightedScore === null) return false;
    const dropTriggered =
      cv.weeklyDelta !== null && cv.weeklyDelta <= -SCORE_DROP_THRESHOLD;
    const floorTriggered = cv.latestWeightedScore < ABSOLUTE_FLOOR && (cv.points?.length ?? 0) >= 3;
    return dropTriggered || floorTriggered;
  });

  for (const cv of candidates) {
    try {
      const reason = cv.weeklyDelta !== null && cv.weeklyDelta <= -SCORE_DROP_THRESHOLD
        ? `Score dropped ${Math.abs(cv.weeklyDelta)} points this week`
        : `Score (${cv.latestWeightedScore}) is below minimum threshold`;

      // Only insert if there is no recent (7-day) recommendation for this CV
      const existing = await pool.query(
        `SELECT id FROM recommendation_events
         WHERE user_id = $1
           AND recommended_cv_version_id = $2
           AND recommendation_type = 'cv_underperforming'
           AND created_at > NOW() - INTERVAL '7 days'
         LIMIT 1`,
        [userId, cv.cvId]
      );
      if (existing.rows.length > 0) continue;

      await pool.query(
        `INSERT INTO recommendation_events
           (user_id, recommendation_type, recommendation_id, recommended_cv_version_id, event_type, reason_payload)
         VALUES ($1, 'cv_underperforming', $2, $3, 'auto_triggered', $4)`,
        [
          userId,
          `auto_${cv.cvId}_${Date.now()}`,
          cv.cvId,
          JSON.stringify({ reason, latestScore: cv.latestWeightedScore, weeklyDelta: cv.weeklyDelta }),
        ]
      );
      logger.info(`🔔 Auto recommendation fired for CV "${cv.cvName}" (user ${userId}): ${reason}`);
    } catch (err) {
      logger.error('Failed to auto-fire recommendation:', err);
    }
  }
}

// ─── GET /api/analytics/dashboard ────────────────────────────────────────────

router.get('/dashboard', asyncHandler(async (req: Request, res: Response) => {
    const userId = (req as any).user?.id;
  if (!userId) throw new AppError('Unauthorized', 401, 'UNAUTHORIZED');

    const period = parseInt(req.query.period as string) || 30;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - period);

  const [
    statsResult,
    userResult,
    statusResult,
    sourcesResult,
    dailyResult,
    peakResult,
    streakResult,
    cvPerformance,
  ] = await Promise.all([
    pool.query(
      `SELECT 
         COUNT(*) as total,
         COUNT(*) FILTER (WHERE applied_at >= NOW() - INTERVAL '7 days') as weekly,
         COUNT(*) FILTER (WHERE applied_at >= NOW() - INTERVAL '30 days') as monthly,
         AVG(time_spent) FILTER (WHERE time_spent > 0) as avg_time,
         COUNT(*) FILTER (WHERE response_date IS NOT NULL) as with_response,
         COUNT(*) FILTER (WHERE status IN ('INTERVIEW_SCHEDULED','INTERVIEWED')) as interviews,
         COUNT(*) FILTER (WHERE status IN ('INTERVIEW_SCHEDULED','INTERVIEWED','OFFERED','ACCEPTED')) as successful
       FROM applications WHERE user_id = $1 AND applied_at >= $2`,
      [userId, startDate]
    ),
    pool.query('SELECT weekly_target, monthly_target FROM users WHERE id = $1', [userId]),
    pool.query(
      `SELECT status, COUNT(*) as count FROM applications
       WHERE user_id = $1 AND applied_at >= $2 GROUP BY status`,
      [userId, startDate]
    ),
    pool.query(
      `SELECT job_board_source,
         COUNT(*) as total,
         COUNT(*) FILTER (WHERE status IN ('INTERVIEW_SCHEDULED','INTERVIEWED','OFFERED','ACCEPTED')) as successful
       FROM applications WHERE user_id = $1 AND applied_at >= $2 AND job_board_source IS NOT NULL
       GROUP BY job_board_source ORDER BY total DESC LIMIT 5`,
      [userId, startDate]
    ),
    pool.query(
      `SELECT DATE(applied_at) as date, COUNT(*) as count
       FROM applications WHERE user_id = $1 AND applied_at >= $2
       GROUP BY DATE(applied_at) ORDER BY date ASC`,
      [userId, startDate]
    ),
    pool.query(
      `SELECT EXTRACT(HOUR FROM applied_at) as hour, COUNT(*) as count
       FROM applications WHERE user_id = $1 AND applied_at >= $2
       GROUP BY hour ORDER BY count DESC LIMIT 1`,
      [userId, startDate]
    ),
    // Fetch applied_at dates for all-time streak calculation
    pool.query(
      `SELECT applied_at FROM applications WHERE user_id = $1 AND applied_at IS NOT NULL ORDER BY applied_at DESC`,
      [userId]
    ),
    getCvPerformance(userId, startDate),
  ]);

  const s = statsResult.rows[0];
  const total = parseInt(s.total || 0);
  const weekly = parseInt(s.weekly || 0);
  const monthly = parseInt(s.monthly || 0);
  const avgTime = Math.round(parseFloat(s.avg_time || 0) / 60);
  const withResponse = parseInt(s.with_response || 0);
  const interviews = parseInt(s.interviews || 0);

  const user = userResult.rows[0] || {};
  const responseRate = total > 0 ? (withResponse / total) * 100 : 0;
  const interviewRate = total > 0 ? (interviews / total) * 100 : 0;
  const targetAchievement = user.weekly_target ? (weekly / user.weekly_target) * 100 : 0;

  const applicationsByStatus: Record<string, number> = {};
  statusResult.rows.forEach((r: any) => { applicationsByStatus[r.status] = parseInt(r.count); });

  const topSources = sourcesResult.rows.map((r: any) => ({
    source: r.job_board_source,
    count: parseInt(r.total),
    successRate: parseInt(r.total) > 0 ? (parseInt(r.successful) / parseInt(r.total)) * 100 : 0,
  }));

  const dailyActivity = dailyResult.rows.map((r: any) => ({
    date: r.date instanceof Date ? r.date.toISOString().split('T')[0] : r.date,
    count: parseInt(r.count),
  }));

    const peakApplicationTime = peakResult.rows.length > 0 ? parseInt(peakResult.rows[0].hour) : 9;

  const streakDates: Date[] = streakResult.rows.map((r: any) => new Date(r.applied_at));
  const currentStreak = calcStreak(streakDates);

    return res.json({
    totalApplications: total,
    weeklyApplications: weekly,
    monthlyApplications: monthly,
    averageTimePerApp: avgTime,
      responseRate: Math.round(responseRate * 100) / 100,
      interviewRate: Math.round(interviewRate * 100) / 100,
      targetAchievement: Math.round(targetAchievement * 100) / 100,
    currentStreak,
      topSources,
      applicationsByStatus,
      dailyActivity,
      peakApplicationTime,
    cvVersionPerformance: cvPerformance,
    });
}));

// ─── GET /api/analytics/detailed ─────────────────────────────────────────────

router.get('/detailed', asyncHandler(async (req: Request, res: Response) => {
    const userId = (req as any).user?.id;
  if (!userId) throw new AppError('Unauthorized', 401, 'UNAUTHORIZED');

    const { startDate, endDate, groupBy = 'day' } = req.query;
  const start = startDate ? new Date(startDate as string) : new Date(Date.now() - 30 * 86400000);
    const end = endDate ? new Date(endDate as string) : new Date();

  const dateFormats: Record<string, string> = {
    hour:  'YYYY-MM-DD HH24',
    week:  'IYYY-IW',
    month: 'YYYY-MM',
    day:   'YYYY-MM-DD',
  };
  const dateFormat = dateFormats[groupBy as string] ?? 'YYYY-MM-DD';

    const result = await pool.query(
    `SELECT TO_CHAR(applied_at, '${dateFormat}') as period,
         COUNT(*) as count,
         AVG(time_spent) as avg_time,
         COUNT(*) FILTER (WHERE response_date IS NOT NULL) as responses,
       COUNT(*) FILTER (WHERE status IN ('INTERVIEW_SCHEDULED','INTERVIEWED')) as interviews
     FROM applications WHERE user_id = $1 AND applied_at BETWEEN $2 AND $3
     GROUP BY period ORDER BY period ASC`,
      [userId, start, end]
    );

  const data = result.rows.map((r: any) => ({
    period: r.period,
    count: parseInt(r.count),
    avgTime: Math.round(parseFloat(r.avg_time || 0)),
    responses: parseInt(r.responses),
    interviews: parseInt(r.interviews),
    responseRate: parseInt(r.count) > 0 ? (parseInt(r.responses) / parseInt(r.count)) * 100 : 0,
    interviewRate: parseInt(r.count) > 0 ? (parseInt(r.interviews) / parseInt(r.count)) * 100 : 0,
  }));

  return res.json({ period: { start, end }, groupBy, data });
}));

// ─── GET /api/analytics/funnel ────────────────────────────────────────────────

router.get('/funnel', asyncHandler(async (req: Request, res: Response) => {
    const userId = (req as any).user?.id;
  if (!userId) throw new AppError('Unauthorized', 401, 'UNAUTHORIZED');

    const period = parseInt(req.query.period as string) || 30;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - period);

    const result = await pool.query(
      `SELECT 
         COUNT(*) as applied,
       COUNT(*) FILTER (WHERE status IN ('VIEWED','SHORTLISTED','INTERVIEW_SCHEDULED','INTERVIEWED','OFFERED','ACCEPTED')) as viewed,
       COUNT(*) FILTER (WHERE status IN ('SHORTLISTED','INTERVIEW_SCHEDULED','INTERVIEWED','OFFERED','ACCEPTED')) as shortlisted,
       COUNT(*) FILTER (WHERE status IN ('INTERVIEWED','OFFERED','ACCEPTED')) as interviewed,
       COUNT(*) FILTER (WHERE status IN ('OFFERED','ACCEPTED')) as offered,
         COUNT(*) FILTER (WHERE status = 'ACCEPTED') as accepted
     FROM applications WHERE user_id = $1 AND applied_at >= $2`,
      [userId, startDate]
    );

    const row = result.rows[0];
    const applied = parseInt(row.applied || 0);
  const pct = (n: number) => applied > 0 ? Math.round((n / applied) * 10000) / 100 : 0;

  return res.json([
    { stage: 'Applied',     count: applied,                       percentage: 100 },
    { stage: 'Viewed',      count: parseInt(row.viewed || 0),     percentage: pct(parseInt(row.viewed || 0)) },
    { stage: 'Shortlisted', count: parseInt(row.shortlisted || 0),percentage: pct(parseInt(row.shortlisted || 0)) },
    { stage: 'Interviewed', count: parseInt(row.interviewed || 0),percentage: pct(parseInt(row.interviewed || 0)) },
    { stage: 'Offered',     count: parseInt(row.offered || 0),    percentage: pct(parseInt(row.offered || 0)) },
    { stage: 'Accepted',    count: parseInt(row.accepted || 0),   percentage: pct(parseInt(row.accepted || 0)) },
  ]);
}));

// ─── GET /api/analytics/trends ───────────────────────────────────────────────

router.get('/trends', asyncHandler(async (req: Request, res: Response) => {
  const userId = (req as any).user?.id;
  if (!userId) throw new AppError('Unauthorized', 401, 'UNAUTHORIZED');

  const period = parseInt(req.query.period as string) || 30;
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - period);

  const result = await pool.query(
    `SELECT DATE(applied_at) as date, COUNT(*) as count
     FROM applications WHERE user_id = $1 AND applied_at >= $2
     GROUP BY DATE(applied_at) ORDER BY date ASC`,
    [userId, startDate]
  );

  // Fill in every day in the range (including zeros)
  const countByDate: Record<string, number> = {};
  result.rows.forEach((r: any) => {
    const key = r.date instanceof Date ? r.date.toISOString().split('T')[0] : r.date;
    countByDate[key] = parseInt(r.count);
  });

  const filled: { date: string; count: number }[] = [];
  for (let d = new Date(startDate); d <= new Date(); d.setDate(d.getDate() + 1)) {
    const key = d.toISOString().split('T')[0];
    filled.push({ date: key, count: countByDate[key] ?? 0 });
  }

  return res.json({ period, trends: filled });
}));

// ─── GET /api/analytics/source-performance ───────────────────────────────────

router.get('/source-performance', asyncHandler(async (req: Request, res: Response) => {
  const userId = (req as any).user?.id;
  if (!userId) throw new AppError('Unauthorized', 401, 'UNAUTHORIZED');

  const period = parseInt(req.query.period as string) || 90;
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - period);

  const result = await pool.query(
    `SELECT
       COALESCE(job_board_source, 'Direct') as source,
       COUNT(*) as total,
       COUNT(*) FILTER (WHERE response_date IS NOT NULL OR status NOT IN ('APPLIED','GHOSTED')) as responses,
       COUNT(*) FILTER (WHERE status IN ('INTERVIEW_SCHEDULED','INTERVIEWED','OFFERED','ACCEPTED')) as interviews,
       COUNT(*) FILTER (WHERE status IN ('OFFERED','ACCEPTED')) as offers,
       AVG(
         CASE WHEN response_date IS NOT NULL
         THEN EXTRACT(EPOCH FROM (response_date - applied_at)) / 3600.0
         END
       ) as avg_response_hours
     FROM applications
     WHERE user_id = $1 AND applied_at >= $2
     GROUP BY source ORDER BY total DESC`,
    [userId, startDate]
  );

  const data = result.rows.map((r: any) => ({
    source: r.source,
    total: parseInt(r.total),
    responses: parseInt(r.responses),
    interviews: parseInt(r.interviews),
    offers: parseInt(r.offers),
    responseRate: parseInt(r.total) > 0 ? Math.round((parseInt(r.responses) / parseInt(r.total)) * 10000) / 100 : 0,
    interviewRate: parseInt(r.total) > 0 ? Math.round((parseInt(r.interviews) / parseInt(r.total)) * 10000) / 100 : 0,
    avgResponseHours: r.avg_response_hours ? Math.round(parseFloat(r.avg_response_hours)) : null,
  }));

  return res.json({ period, sourcePerformance: data });
}));

// ─── GET /api/analytics/cv-performance ───────────────────────────────────────

router.get('/cv-performance', asyncHandler(async (req: Request, res: Response) => {
  const userId = (req as any).user?.id;
  if (!userId) throw new AppError('Unauthorized', 401, 'UNAUTHORIZED');

  const period = parseInt(req.query.period as string) || 90;
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - period);

  const data = await getCvPerformance(userId, startDate);
  return res.json({ period, cvVersionPerformance: data });
}));

router.get('/cv-performance/history', asyncHandler(async (req: Request, res: Response) => {
  const userId = (req as any).user?.id;
  if (!userId) throw new AppError('Unauthorized', 401, 'UNAUTHORIZED');

  const weeks = Math.max(2, Math.min(parseInt(req.query.weeks as string) || 12, 52));
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - weeks * 7);

  const history = await getCvPerformanceHistory(userId, startDate);

  // Fire auto-recommendations async without blocking the response
  autoFireRecommendations(userId, history).catch(() => {});

  return res.json({ weeks, history });
}));

// ─── GET /api/analytics/ai-status-kpi ────────────────────────────────────────

router.get('/ai-status-kpi', asyncHandler(async (req: Request, res: Response) => {
  const userId = (req as any).user?.id;
  if (!userId) throw new AppError('Unauthorized', 401, 'UNAUTHORIZED');

  const period = parseInt(req.query.period as string) || 30;
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - period);

  const result = await pool.query(
    `SELECT
       COUNT(*) FILTER (WHERE review_action = 'CONFIRM') AS confirmed,
       COUNT(*) FILTER (WHERE review_action = 'CORRECT') AS corrected,
       COUNT(*) FILTER (WHERE queue_state = 'PENDING_REVIEW') AS pending
     FROM email_status_review_queue
     WHERE user_id = $1 AND queued_at >= $2`,
    [userId, startDate]
  );

  const confirmed = parseInt(result.rows[0]?.confirmed || 0);
  const corrected = parseInt(result.rows[0]?.corrected || 0);
  const pending = parseInt(result.rows[0]?.pending || 0);
  const reviewed = confirmed + corrected;
  const precision = reviewed > 0 ? Math.round((confirmed / reviewed) * 10000) / 100 : null;

  return res.json({
    period,
    reviewed,
    pending,
    confirmed,
    corrected,
    precision,
  });
}));

// ─── GET /api/analytics/recommendations/adoption ─────────────────────────────

router.get('/recommendations/adoption', asyncHandler(async (req: Request, res: Response) => {
  const userId = (req as any).user?.id;
  if (!userId) throw new AppError('Unauthorized', 401, 'UNAUTHORIZED');

  const period = parseInt(req.query.period as string) || 30;
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - period);

  const result = await pool.query(
    `SELECT
       recommendation_type,
       surface,
       COUNT(*) FILTER (WHERE event_type = 'exposed') AS exposed,
       COUNT(*) FILTER (WHERE event_type = 'clicked') AS clicked,
       COUNT(*) FILTER (WHERE event_type = 'adopted') AS adopted
     FROM recommendation_events
     WHERE user_id = $1 AND created_at >= $2
     GROUP BY recommendation_type, surface
     ORDER BY exposed DESC`,
    [userId, startDate]
  );

  let totalExposed = 0;
  let totalClicked = 0;
  let totalAdopted = 0;
  const breakdown = result.rows.map((r: any) => {
    const exposed = parseInt(r.exposed || 0);
    const clicked = parseInt(r.clicked || 0);
    const adopted = parseInt(r.adopted || 0);
    totalExposed += exposed;
    totalClicked += clicked;
    totalAdopted += adopted;
    return {
      recommendationType: r.recommendation_type,
      surface: r.surface,
      exposed,
      clicked,
      adopted,
      clickThroughRate: exposed > 0 ? Math.round((clicked / exposed) * 10000) / 100 : 0,
      adoptionRate: exposed > 0 ? Math.round((adopted / exposed) * 10000) / 100 : 0,
    };
  });

  return res.json({
    period,
    totalExposed,
    totalClicked,
    totalAdopted,
    clickThroughRate: totalExposed > 0 ? Math.round((totalClicked / totalExposed) * 10000) / 100 : 0,
    adoptionRate: totalExposed > 0 ? Math.round((totalAdopted / totalExposed) * 10000) / 100 : 0,
    breakdown,
  });
}));

// ─── GET /api/analytics/recommendations/cv ───────────────────────────────────

router.get('/recommendations/cv', asyncHandler(async (req: Request, res: Response) => {
  const userId = (req as any).user?.id;
  if (!userId) throw new AppError('Unauthorized', 401, 'UNAUTHORIZED');

  const period = parseInt(req.query.period as string) || 90;
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - period);

  const cvData = await getCvPerformance(userId, startDate);
  const ranked = [...cvData]
    .filter((row: any) => (row.applications || 0) >= 3)
    .sort((a: any, b: any) => (b.weightedScore || 0) - (a.weightedScore || 0));

  if (ranked.length < 2) {
    return res.json({
      triggered: false,
      reason: 'Not enough CV-attributed volume (need at least 2 CVs with 3+ applications)',
      period,
      recommendation: null,
    });
  }

  const best = ranked[0];
  const under = ranked[ranked.length - 1];
  const scoreDelta = Math.round(((best.weightedScore || 0) - (under.weightedScore || 0)) * 100) / 100;
  const shouldTrigger = scoreDelta >= 5 || (best.offerRate || 0) - (under.offerRate || 0) >= 3;

  return res.json({
    triggered: shouldTrigger,
    period,
    recommendation: shouldTrigger
      ? {
          type: 'switch_cv_version',
          recommendationId: `cv_swap_${under.id}_to_${best.id}`,
          fromCv: under,
          toCv: best,
          scoreDelta,
          rationale: `Switch upcoming applications from ${under.name} to ${best.name} based on weighted score and conversion outcomes.`,
        }
      : null,
  });
}));

// ─── POST /api/analytics/event ───────────────────────────────────────────────

router.post('/event', asyncHandler(async (req: Request, res: Response) => {
  const userId = (req as any).user?.id;
  if (!userId) throw new AppError('Unauthorized', 401, 'UNAUTHORIZED');

  const { eventType, eventData } = req.body;
  if (!eventType) throw new AppError('eventType is required', 400, 'VALIDATION_ERROR');

  if (['exposed', 'clicked', 'dismissed', 'adopted'].includes(eventType)) {
    await pool.query(
      `INSERT INTO recommendation_events
       (user_id, application_id, session_id, recommendation_type, recommendation_id, recommended_cv_version_id, selected_cv_version_id, surface, event_type, model_name, model_version, score, reason_payload, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,NOW())`,
      [
        userId,
        eventData?.applicationId || null,
        eventData?.sessionId || null,
        eventData?.recommendationType || 'cv_version',
        eventData?.recommendationId || `rec_${Date.now()}`,
        eventData?.recommendedCvVersionId || null,
        eventData?.selectedCvVersionId || null,
        eventData?.surface || 'dashboard',
        eventType,
        eventData?.modelName || null,
        eventData?.modelVersion || null,
        eventData?.score ?? null,
        eventData ? JSON.stringify(eventData) : null,
      ]
    );

    // Update cv_versions.last_used_at when adoption is recorded
    if (eventType === 'adopted' && eventData?.selectedCvVersionId) {
      await pool.query(
        `UPDATE cv_versions
         SET last_used_at = NOW(), updated_at = NOW()
         WHERE id = $1 AND user_id = $2`,
        [eventData.selectedCvVersionId, userId]
      );
    }
  }

  return res.json({ success: true, recorded: true });
}));

export default router;
