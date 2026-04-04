/**
 * ML Analytics Routes
 * AI-powered features using Python ML service
 */

import { Router, Request, Response } from 'express';
import { pool } from '../database/client';
import { PythonMLService } from '../services/python-ml.service';
import { asyncHandler, AppError } from '../middleware/error.middleware';

const router = Router();

/**
 * POST /api/ml/match-jobs
 * Match a CV against a job description
 */
router.post('/match-jobs', asyncHandler(async (req: Request, res: Response) => {
  const { user_cv, job_description } = req.body;

  if (!user_cv || !job_description) {
    throw new AppError('Both user_cv and job_description are required', 400);
  }

  const result = await PythonMLService.matchJobs({
    user_cv,
    job_description,
  });

  res.json(result);
}));

/**
 * POST /api/ml/analyze-cv
 * Analyze CV and provide optimization insights
 */
router.post('/analyze-cv', asyncHandler(async (req: Request, res: Response) => {
  const { cv_text, target_job } = req.body;

  if (!cv_text) {
    throw new AppError('cv_text is required', 400);
  }

  const result = await PythonMLService.analyzeCV({
    cv_text,
    target_job,
  });

  res.json(result);
}));

/**
 * POST /api/ml/predict-success
 * Predict application success probability
 */
router.post('/predict-success', asyncHandler(async (req: Request, res: Response) => {
  const userId = (req as any).user?.id;
  const {
    days_since_posted,
    cv_version_score,
    time_spent,
    previous_success_rate,
    job_board,
  } = req.body;

  // If previous_success_rate not provided, calculate from history
  let successRate = previous_success_rate;
  if (successRate === undefined && userId) {
    try {
      const historyResult = await pool.query(
        `SELECT 
           COUNT(*) FILTER (WHERE status IN ('INTERVIEW_SCHEDULED', 'INTERVIEWED', 'OFFERED', 'ACCEPTED'))::float / NULLIF(COUNT(*), 0) as rate
         FROM applications WHERE user_id = $1`,
        [userId]
      );
      successRate = parseFloat(historyResult.rows[0]?.rate || 0.2);
    } catch {
      successRate = 0.2;
    }
  }

  const result = await PythonMLService.predictSuccess({
    days_since_posted: days_since_posted || 1,
    cv_version_score: cv_version_score || 0.5,
    time_spent: time_spent || 0,
    previous_success_rate: successRate || 0.2,
    job_board: job_board || 'Other',
  });

  res.json(result);
}));

/**
 * POST /api/ml/recommend-cv-version
 * Recommend the best CV version for a job description
 */
router.post('/recommend-cv-version', asyncHandler(async (req: Request, res: Response) => {
  const { jobDescription, cvVersions } = req.body;

  if (!jobDescription) {
    throw new AppError('jobDescription is required', 400);
  }

  if (!cvVersions || !Array.isArray(cvVersions) || cvVersions.length === 0) {
    return res.json({
      recommendation: null,
      message: 'No CV versions provided.',
    });
  }

  const bestMatch = await PythonMLService.recommendCVVersion(
    jobDescription,
    cvVersions
  );

  if (bestMatch) {
    const recommended = cvVersions.find((cv: any) => cv.id === bestMatch.cvVersionId);
    return res.json({
      recommendation: {
        cvVersionId: bestMatch.cvVersionId,
        cvName: recommended?.name || '',
        matchScore: bestMatch.score,
      },
      message: `AI recommends using "${recommended?.name}" for this application`,
    });
  }

  return res.json({
    recommendation: null,
    message: 'No suitable CV version found for this job',
  });
}));

/**
 * GET /api/ml/health
 * Check Python ML service health
 */
router.get('/health', asyncHandler(async (_req: Request, res: Response) => {
  const isHealthy = await PythonMLService.healthCheck();

  res.json({
    service: 'python-ml',
    status: isHealthy ? 'healthy' : 'unavailable',
    connected: isHealthy,
  });
}));

/**
 * GET /api/ml/insights
 * Get AI-powered insights for user dashboard
 */
router.get('/insights', asyncHandler(async (req: Request, res: Response) => {
  const userId = (req as any).user?.id;
  if (!userId) {
    throw new AppError('Unauthorized', 401);
  }

  const period = parseInt(req.query.period as string) || 30;

  // Get user's applications
  const appsResult = await pool.query(
    `SELECT 
       status, time_spent, job_board_source, applied_at
     FROM applications
     WHERE user_id = $1
       AND applied_at >= NOW() - INTERVAL '1 day' * $2`,
    [userId, period]
  );

  const applications = appsResult.rows;

  // Calculate insights
  const totalApplications = applications.length;
  const avgTimePerApp = totalApplications > 0
    ? applications.reduce((sum: number, app: any) => sum + (parseInt(app.time_spent) || 0), 0) / totalApplications
    : 0;

  // Count by status
  const statusCounts: Record<string, number> = {};
  applications.forEach((app: any) => {
    const status = app.status || 'APPLIED';
    statusCounts[status] = (statusCounts[status] || 0) + 1;
  });

  // Count by source
  const sourceCounts: Record<string, number> = {};
  applications.forEach((app: any) => {
    const source = app.job_board_source || 'Unknown';
    sourceCounts[source] = (sourceCounts[source] || 0) + 1;
  });

  // Generate recommendation
  let recommendation = '';
  if (totalApplications === 0) {
    recommendation = '📝 Start applying to jobs to get personalized insights';
  } else if (totalApplications < 10) {
    recommendation = '📈 Increase application volume to improve success chances';
  } else if (avgTimePerApp < 300) {
    recommendation = '⏱️ Spend more time tailoring each application';
  } else {
    recommendation = '✅ Good application effort. Keep tracking and optimize!';
  }

  res.json({
    totalApplications,
    averageTimePerApp: Math.round(avgTimePerApp),
    statusBreakdown: statusCounts,
    sourceBreakdown: sourceCounts,
    recommendation,
    period,
  });
}));

export default router;
