import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { pool } from '../database/client';
import { logger } from '../utils/logger';
import { validateRequest } from '../middleware/validation.middleware';
import { asyncHandler, AppError } from '../middleware/error.middleware';
import { appEvents } from '../utils/event-bus';

// Push a SSE refresh event to the user's connected dashboard tabs.
// Uses the event bus to avoid any circular dependency with index.ts.
function pushRefresh(userId: string) {
  appEvents.emit('user:refresh', userId);
}

const router = Router();

// Validation schemas
const createApplicationSchema = z.object({
  company: z.string().min(1).max(255),
  position: z.string().min(1).max(255),
  location: z.string().optional(),
  jobBoardSource: z.string().optional(),
  jobUrl: z.string().url().optional(),
  salary: z.string().optional(),
  status: z.enum(['APPLIED', 'UNDER_REVIEW', 'VIEWED', 'SHORTLISTED', 'INTERVIEW_SCHEDULED', 'INTERVIEWED', 'OFFERED', 'REJECTED', 'WITHDRAWN', 'ACCEPTED', 'GHOSTED']).default('APPLIED'),
  notes: z.string().optional(),
  timeSpent: z.number().optional(),
  timeSpentSeconds: z.number().optional(),
  timeQuality: z.enum(['MANUAL', 'AUTO_HIGH', 'AUTO_PARTIAL', 'UNKNOWN']).optional(),
  captureMethod: z.enum(['MANUAL', 'EXTENSION', 'EXTENSION_AUTO', 'EMAIL_SYNC', 'API']).default('MANUAL'),
  metadata: z.object({
    activeTime: z.number().optional(),
    pausedTime: z.number().optional(),
    trigger: z.string().optional(),
    sessionId: z.string().optional(),
  }).optional(),
  cvVersionId: z.string().uuid().optional(),
});

const queueActionSchema = z.object({
  correctedStatus: z.string().optional(),
  note: z.string().max(1000).optional(),
});

// Get all applications for user
router.get('/', asyncHandler(async (req: Request, res: Response) => {
  const userId = (req as any).user?.id;
  if (!userId) {
    throw new AppError('Unauthorized', 401, 'UNAUTHORIZED');
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
  })
);

// Get active sessions (MUST be before /:id route to avoid route conflict)
router.get('/active-sessions', asyncHandler(async (req: Request, res: Response) => {
  const userId = (req as any).user?.id;
  if (!userId) {
    throw new AppError('Unauthorized', 401, 'UNAUTHORIZED');
  }

  try {
    // Get applications tracked in the last hour (potential active sessions)
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    
    const result = await pool.query(
      `SELECT 
        id,
        company,
        position,
        job_url,
        capture_method,
        metadata,
        applied_at,
        created_at,
        time_spent
       FROM applications 
       WHERE user_id = $1 
         AND capture_method = 'EXTENSION_AUTO'
         AND created_at >= $2
       ORDER BY created_at DESC
       LIMIT 10`,
      [userId, oneHourAgo]
    );

    // Calculate applications per hour from recent sessions
    const last24Hours = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const recentAppsResult = await pool.query(
      `SELECT 
        COUNT(*) as count,
        SUM(COALESCE(time_spent_seconds, time_spent * 60)) as total_time_seconds
       FROM applications 
       WHERE user_id = $1 
         AND capture_method = 'EXTENSION_AUTO'
         AND created_at >= $2`,
      [userId, last24Hours]
    );

    const recentCount = parseInt(recentAppsResult.rows[0]?.count || '0');
    const totalTimeSeconds = parseFloat(recentAppsResult.rows[0]?.total_time_seconds || '0');
    const totalTimeHours = totalTimeSeconds / 3600;
    
    // Calculate applications per hour
    const applicationsPerHour = totalTimeHours > 0 
      ? Math.round((recentCount / totalTimeHours) * 10) / 10 
      : recentCount; // If no time data, just return count

    // Format sessions
    const sessions = result.rows.map((row: any) => ({
      id: row.id,
      company: row.company,
      position: row.position,
      url: row.job_url,
      appliedAt: row.applied_at,
      metadata: row.metadata ? (typeof row.metadata === 'string' ? JSON.parse(row.metadata) : row.metadata) : null,
    }));

    return res.json({
      activeSessions: sessions.length,
      sessions,
      applicationsPerHour: applicationsPerHour || 0,
      recentApplications: recentCount || 0,
      totalTimeHours: Math.round(totalTimeHours * 10) / 10 || 0,
    });
  } catch (error) {
    logger.error('Error fetching active sessions:', error);
    // Return safe defaults on error
    return res.json({ 
      activeSessions: 0,
      sessions: [],
      applicationsPerHour: 0,
      recentApplications: 0,
      totalTimeHours: 0,
    });
  }
}));

// List AI review queue items
router.get('/status-review-queue', asyncHandler(async (req: Request, res: Response) => {
  const userId = (req as any).user?.id;
  if (!userId) throw new AppError('Unauthorized', 401, 'UNAUTHORIZED');

  const state = (req.query.state as string) || 'PENDING_REVIEW';
  const limit = Math.min(parseInt((req.query.limit as string) || '50', 10), 200);
  const allowedStates = ['PENDING_REVIEW', 'CONFIRMED', 'CORRECTED', 'DISMISSED', 'EXPIRED'];
  const queueState = allowedStates.includes(state) ? state : 'PENDING_REVIEW';

  const result = await pool.query(
    `SELECT
       q.id, q.queue_state, q.detected_status, q.detected_confidence, q.corrected_status, q.review_action,
       q.queued_at, q.reviewed_at, q.expires_at, q.review_notes,
       q.application_id, a.company, a.position, a.status as current_status,
       e.email_subject, e.email_from, e.email_body_snippet, e.email_date
     FROM email_status_review_queue q
     JOIN applications a ON a.id = q.application_id
     JOIN email_status_updates e ON e.id = q.email_status_update_id
     WHERE q.user_id = $1 AND q.queue_state = $2
     ORDER BY q.queued_at DESC
     LIMIT $3`,
    [userId, queueState, limit]
  );

  const pendingCountResult = await pool.query(
    `SELECT COUNT(*) FROM email_status_review_queue WHERE user_id = $1 AND queue_state = 'PENDING_REVIEW'`,
    [userId]
  );

  return res.json({
    state: queueState,
    count: result.rows.length,
    pendingCount: parseInt(pendingCountResult.rows[0]?.count || '0', 10),
    items: result.rows,
  });
}));

// Confirm queue item and apply detected status
router.post('/status-review-queue/:queueId/confirm', validateRequest(queueActionSchema), asyncHandler(async (req: Request, res: Response) => {
  const userId = (req as any).user?.id;
  if (!userId) throw new AppError('Unauthorized', 401, 'UNAUTHORIZED');
  const { queueId } = req.params;

  const queueItem = await pool.query(
    `SELECT id, application_id, detected_status, queue_state
     FROM email_status_review_queue WHERE id = $1 AND user_id = $2`,
    [queueId, userId]
  );
  if (queueItem.rows.length === 0) throw new AppError('Queue item not found', 404, 'NOT_FOUND');
  if (queueItem.rows[0].queue_state !== 'PENDING_REVIEW') {
    throw new AppError('Queue item is already reviewed', 400, 'INVALID_STATE');
  }

  await pool.query(
    `UPDATE applications SET status = $1, updated_at = NOW() WHERE id = $2 AND user_id = $3`,
    [queueItem.rows[0].detected_status, queueItem.rows[0].application_id, userId]
  );

  await pool.query(
    `UPDATE email_status_review_queue
     SET queue_state = 'CONFIRMED', review_action = 'CONFIRM', reviewed_by = $1, reviewed_at = NOW(), updated_at = NOW()
     WHERE id = $2`,
    [userId, queueId]
  );

  return res.json({ success: true, message: 'AI status confirmed and applied' });
}));

// Correct queue item and apply corrected status
router.post('/status-review-queue/:queueId/correct', validateRequest(queueActionSchema), asyncHandler(async (req: Request, res: Response) => {
  const userId = (req as any).user?.id;
  if (!userId) throw new AppError('Unauthorized', 401, 'UNAUTHORIZED');
  const { queueId } = req.params;
  const { correctedStatus, note } = req.body;
  if (!correctedStatus) throw new AppError('correctedStatus is required', 400, 'VALIDATION_ERROR');

  const queueItem = await pool.query(
    `SELECT q.id, q.application_id, q.detected_status, q.queue_state, q.email_status_update_id, e.email_subject, e.email_body_snippet
     FROM email_status_review_queue q
     JOIN email_status_updates e ON e.id = q.email_status_update_id
     WHERE q.id = $1 AND q.user_id = $2`,
    [queueId, userId]
  );
  if (queueItem.rows.length === 0) throw new AppError('Queue item not found', 404, 'NOT_FOUND');
  if (queueItem.rows[0].queue_state !== 'PENDING_REVIEW') {
    throw new AppError('Queue item is already reviewed', 400, 'INVALID_STATE');
  }

  await pool.query(
    `UPDATE applications SET status = $1, updated_at = NOW() WHERE id = $2 AND user_id = $3`,
    [correctedStatus, queueItem.rows[0].application_id, userId]
  );

  await pool.query(
    `UPDATE email_status_review_queue
     SET queue_state = 'CORRECTED', review_action = 'CORRECT', corrected_status = $1, review_notes = $2,
         reviewed_by = $3, reviewed_at = NOW(), updated_at = NOW()
     WHERE id = $4`,
    [correctedStatus, note || null, userId, queueId]
  );

  await pool.query(
    `INSERT INTO status_corrections
     (user_id, application_id, detected_status, corrected_status, email_subject, email_body_snippet, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
    [
      userId,
      queueItem.rows[0].application_id,
      queueItem.rows[0].detected_status,
      correctedStatus,
      queueItem.rows[0].email_subject || null,
      queueItem.rows[0].email_body_snippet || null,
    ]
  );

  return res.json({ success: true, message: 'Correction applied and recorded' });
}));

// Dismiss queue item (no status change)
router.post('/status-review-queue/:queueId/dismiss', validateRequest(queueActionSchema), asyncHandler(async (req: Request, res: Response) => {
  const userId = (req as any).user?.id;
  if (!userId) throw new AppError('Unauthorized', 401, 'UNAUTHORIZED');
  const { queueId } = req.params;
  const { note } = req.body;

  const result = await pool.query(
    `UPDATE email_status_review_queue
     SET queue_state = 'DISMISSED', review_action = 'DISMISS', review_notes = $1,
         reviewed_by = $2, reviewed_at = NOW(), updated_at = NOW()
     WHERE id = $3 AND user_id = $4 AND queue_state = 'PENDING_REVIEW'
     RETURNING id`,
    [note || null, userId, queueId, userId]
  );

  if (result.rows.length === 0) throw new AppError('Queue item not found or already reviewed', 404, 'NOT_FOUND');
  return res.json({ success: true, message: 'Queue item dismissed' });
}));

// Get single application
router.get('/:id', asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const userId = (req as any).user?.id;

  if (!userId) {
    throw new AppError('Unauthorized', 401, 'UNAUTHORIZED');
  }

  const result = await pool.query(
    'SELECT * FROM applications WHERE id = $1 AND user_id = $2',
    [id, userId]
  );

  if (result.rows.length === 0) {
    throw new AppError('Application not found', 404, 'NOT_FOUND');
  }

  return res.json(result.rows[0]);
}));

// Create new application
router.post('/', validateRequest(createApplicationSchema), asyncHandler(async (req: Request, res: Response) => {
  const userId = (req as any).user?.id;
  if (!userId) {
    throw new AppError('Unauthorized', 401, 'UNAUTHORIZED');
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
      timeSpentSeconds,
      timeQuality,
      captureMethod = 'MANUAL',
      cvVersionId,
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
       (user_id, company, position, location, job_board_source, job_url, salary, status, notes, time_spent, time_spent_seconds, time_quality, capture_method, cv_version_id, applied_at, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, NOW(), NOW(), NOW())
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
        timeSpentSeconds || (timeSpent ? Math.round(timeSpent * 60) : null),
        timeQuality || (timeSpent || timeSpentSeconds ? 'MANUAL' : null),
        captureMethod,
        cvVersionId || null,
      ]
    );

    logger.info(`Application created: ${result.rows[0].id} for user ${userId}`);
    pushRefresh(userId);

    return res.status(201).json({
      message: 'Application created successfully',
      application: result.rows[0],
    });
  })
);

// Update application
router.put('/:id', asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const userId = (req as any).user?.id;
    const updates = req.body;

    // Build update query dynamically
    const allowedFields = ['company', 'position', 'location', 'salary', 'status', 'notes', 'time_spent', 'time_spent_seconds', 'time_quality', 'response_date', 'interview_date', 'job_board_source', 'job_url', 'cv_version_id'];
    const updateFields: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    for (const [key, value] of Object.entries(updates)) {
      const dbKey = key === 'jobBoardSource' ? 'job_board_source' :
                    key === 'jobUrl' ? 'job_url' :
                    key === 'timeSpent' ? 'time_spent' :
                    key === 'timeSpentSeconds' ? 'time_spent_seconds' :
                    key === 'timeQuality' ? 'time_quality' :
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
      throw new AppError('No valid fields to update', 400, 'VALIDATION_ERROR');
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
      throw new AppError('Application not found', 404, 'NOT_FOUND');
    }

    return res.json({
      message: 'Application updated successfully',
      application: result.rows[0],
    });
}));

// Delete application
router.delete('/:id', asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const userId = (req as any).user?.id;

    const result = await pool.query(
      'DELETE FROM applications WHERE id = $1 AND user_id = $2 RETURNING id',
      [id, userId]
    );

    if (result.rows.length === 0) {
      throw new AppError('Application not found', 404, 'NOT_FOUND');
    }

    return res.json({
      message: 'Application deleted successfully',
    });
}));

// Track session - Real-time application tracking from extension
// Validation schema for track-session endpoint
const trackSessionSchema = z.object({
  url: z.string().url(),
  startTime: z.number(),
  endTime: z.number(),
  totalTimeSeconds: z.number().optional(), // Full elapsed time from start -> submit
  activeTime: z.number().optional(), // Active time in seconds
  jobData: z.object({
    company: z.string().nullable().optional(),
    position: z.string().nullable().optional(),
    location: z.string().nullable().optional(),
    salary: z.string().nullable().optional(),
    jobBoardSource: z.string().nullable().optional(),
  }),
  trigger: z.enum(['form_submit', 'api_call', 'xhr', 'success_page', 'tab_closed', 'navigation', 'manual', 'queued']),
  sessionId: z.string().optional(),
});

router.post('/track-session', validateRequest(trackSessionSchema), asyncHandler(async (req: Request, res: Response) => {
    const userId = (req as any).user?.id;
    if (!userId) {
      throw new AppError('Unauthorized', 401, 'UNAUTHORIZED');
    }

    const { url, startTime, endTime, totalTimeSeconds: incomingTotalTimeSeconds, activeTime = 0, jobData, trigger, sessionId } = req.body;

    // Calculate full elapsed application time (start -> submit), not just click activity.
    // Cap at 8h to prevent clearly invalid outliers from polluting analytics.
    const calculatedTotalTimeSeconds = Math.max(1, Math.round((endTime - startTime) / 1000));
    const totalTimeSeconds = Math.min(8 * 60 * 60, Math.max(1, Math.round(incomingTotalTimeSeconds || calculatedTotalTimeSeconds)));
    const normalizedActiveTime = Math.max(0, Math.min(totalTimeSeconds, Math.round(activeTime || 0)));
    const timeSpentMinutes = Math.max(1, Math.ceil(totalTimeSeconds / 60));

    // Normalize URL for duplicate checking
    const normalizedUrl = url.split('?')[0].replace(/\/+$/, '').toLowerCase();

    // Check for existing application by URL
    let existingCheck = await pool.query(
      `SELECT id, time_spent FROM applications 
       WHERE user_id = $1 AND job_url = $2`,
      [userId, url]
    );

    // If no exact match, check normalized version
    if (existingCheck.rows.length === 0) {
      existingCheck = await pool.query(
        `SELECT id, time_spent FROM applications 
         WHERE user_id = $1 
         AND job_url IS NOT NULL
         AND LOWER(RTRIM(SPLIT_PART(job_url, '?', 1), '/')) = $2`,
        [userId, normalizedUrl]
      );
    }

    const resolvedSessionId = sessionId || `session_${Date.now()}`;
    const timeQuality = computeTimeQuality(totalTimeSeconds, normalizedActiveTime);

    // Prepare metadata
    const metadata = {
      totalTimeSeconds,
      activeTime: normalizedActiveTime,
      pausedTime: Math.max(0, totalTimeSeconds - normalizedActiveTime),
      trigger,
      sessionId: resolvedSessionId,
      timeQuality,
      startTime: new Date(startTime).toISOString(),
      endTime: new Date(endTime).toISOString(),
    };

    let applicationId: string;
    let isUpdate = false;

    if (existingCheck.rows.length > 0) {
      // Update existing application with new time data
      applicationId = existingCheck.rows[0].id;
      isUpdate = true;
    } else {
      // Create new application
      const company = jobData.company || extractCompanyFromUrl(url);
      const position = jobData.position || 'Unknown Position';
      const jobBoardSource = jobData.jobBoardSource || extractSourceFromUrl(url);

      const result = await pool.query(
        `INSERT INTO applications 
         (user_id, company, position, location, job_board_source, job_url, salary, status, time_spent, time_spent_seconds, time_quality, capture_method, metadata, applied_at, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, 'APPLIED', $8, $9, $10, 'EXTENSION_AUTO', $11, NOW(), NOW(), NOW())
         RETURNING *`,
        [
          userId,
          company,
          position,
          jobData.location || null,
          jobBoardSource,
          url,
          jobData.salary || null,
          timeSpentMinutes,
          totalTimeSeconds,
          timeQuality,
          JSON.stringify(metadata),
        ]
      );
      applicationId = result.rows[0].id;
    }

    // Upsert session-level tracking row for auditability and accurate aggregation.
    await pool.query(
      `INSERT INTO application_tracking_sessions
       (user_id, application_id, session_id, normalized_url, job_url, capture_method, trigger, started_at, ended_at,
        total_time_seconds, active_time_seconds, paused_time_seconds, time_quality, metadata, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,'EXTENSION_AUTO',$6,to_timestamp($7 / 1000.0),to_timestamp($8 / 1000.0),$9,$10,$11,$12,$13::jsonb,NOW(),NOW())
       ON CONFLICT (user_id, session_id, normalized_url)
       DO UPDATE SET
         application_id = EXCLUDED.application_id,
         job_url = EXCLUDED.job_url,
         trigger = EXCLUDED.trigger,
         started_at = LEAST(application_tracking_sessions.started_at, EXCLUDED.started_at),
         ended_at = GREATEST(application_tracking_sessions.ended_at, EXCLUDED.ended_at),
         total_time_seconds = GREATEST(application_tracking_sessions.total_time_seconds, EXCLUDED.total_time_seconds),
         active_time_seconds = GREATEST(COALESCE(application_tracking_sessions.active_time_seconds, 0), COALESCE(EXCLUDED.active_time_seconds, 0)),
         paused_time_seconds = GREATEST(COALESCE(application_tracking_sessions.paused_time_seconds, 0), COALESCE(EXCLUDED.paused_time_seconds, 0)),
         time_quality = EXCLUDED.time_quality,
         metadata = EXCLUDED.metadata,
         updated_at = NOW()`,
      [
        userId,
        applicationId,
        resolvedSessionId,
        normalizedUrl,
        url,
        trigger,
        startTime,
        endTime,
        totalTimeSeconds,
        normalizedActiveTime,
        Math.max(0, totalTimeSeconds - normalizedActiveTime),
        timeQuality,
        JSON.stringify(metadata),
      ]
    );

    // Recompute application time rollup from all tracking sessions for this application.
    const aggregate = await pool.query(
      `SELECT
         COALESCE(SUM(total_time_seconds), 0) AS total_seconds,
         COALESCE(SUM(active_time_seconds), 0) AS active_seconds,
         COUNT(*) AS session_count,
         MAX(CASE time_quality WHEN 'AUTO_HIGH' THEN 3 WHEN 'AUTO_PARTIAL' THEN 2 WHEN 'MANUAL' THEN 1 ELSE 0 END) AS quality_rank
       FROM application_tracking_sessions
       WHERE application_id = $1`,
      [applicationId]
    );

    const totalSeconds = parseInt(aggregate.rows[0]?.total_seconds || '0', 10);
    const activeSeconds = parseInt(aggregate.rows[0]?.active_seconds || '0', 10);
    const sessionCount = parseInt(aggregate.rows[0]?.session_count || '0', 10);
    const qualityRank = parseInt(aggregate.rows[0]?.quality_rank || '0', 10);
    const rollupQuality = qualityRank >= 3 ? 'AUTO_HIGH' : qualityRank >= 2 ? 'AUTO_PARTIAL' : 'UNKNOWN';

    const updated = await pool.query(
      `UPDATE applications
       SET
         time_spent_seconds = $1,
         time_spent = $2,
         time_quality = $3,
         metadata = jsonb_set(
           COALESCE(metadata, '{}'::jsonb),
           '{trackingSummary}',
           $4::jsonb,
           true
         ),
         updated_at = NOW()
       WHERE id = $5
       RETURNING *`,
      [
        totalSeconds,
        Math.max(1, Math.ceil(totalSeconds / 60)),
        rollupQuality,
        JSON.stringify({
          totalTimeSeconds: totalSeconds,
          activeTimeSeconds: activeSeconds,
          pausedTimeSeconds: Math.max(0, totalSeconds - activeSeconds),
          sessionCount,
          lastSessionId: resolvedSessionId,
          lastTrigger: trigger,
          timeQuality: rollupQuality,
        }),
        applicationId,
      ]
    );

    logger.info(`Application ${isUpdate ? 'updated' : 'created'} via auto-tracking: ${applicationId} (${trigger})`);
    return res.status(isUpdate ? 200 : 201).json({
      success: true,
      message: isUpdate ? 'Application updated with tracking data' : 'Application tracked successfully',
      application: updated.rows[0],
      isUpdate,
    });
}));

// Helper function to extract company name from URL
function extractCompanyFromUrl(url: string): string {
  try {
    const hostname = new URL(url).hostname;
    // Remove common prefixes/suffixes
    let company = hostname
      .replace(/^(www\.|jobs\.|careers\.|apply\.)/i, '')
      .replace(/\.(com|co\.uk|org|io|net)$/i, '')
      .replace(/\.(workday|greenhouse|lever|taleo)$/i, '')
      .split('.')[0];
    
    // Capitalize first letter
    return company.charAt(0).toUpperCase() + company.slice(1);
  } catch {
    return 'Unknown Company';
  }
}

// Helper function to extract job board source from URL
function extractSourceFromUrl(url: string): string {
  const urlLower = url.toLowerCase();
  if (urlLower.includes('linkedin.com')) return 'LinkedIn';
  if (urlLower.includes('indeed.com') || urlLower.includes('indeed.co.uk')) return 'Indeed';
  if (urlLower.includes('reed.co.uk')) return 'Reed';
  if (urlLower.includes('totaljobs.com')) return 'Totaljobs';
  if (urlLower.includes('glassdoor')) return 'Glassdoor';
  if (urlLower.includes('monster.com')) return 'Monster';
  if (urlLower.includes('cv-library')) return 'CV-Library';
  if (urlLower.includes('workday.com')) return 'Workday';
  if (urlLower.includes('greenhouse.io')) return 'Greenhouse';
  if (urlLower.includes('lever.co')) return 'Lever';
  if (urlLower.includes('taleo')) return 'Taleo';
  return 'Direct';
}

function computeTimeQuality(totalTimeSeconds: number, activeTimeSeconds: number): 'AUTO_HIGH' | 'AUTO_PARTIAL' {
  const ratio = totalTimeSeconds > 0 ? activeTimeSeconds / totalTimeSeconds : 0;
  return ratio >= 0.5 ? 'AUTO_HIGH' : 'AUTO_PARTIAL';
}

function getAppTimeSeconds(app: any): number | null {
  const seconds = Number(app.time_spent_seconds);
  if (Number.isFinite(seconds) && seconds > 0) return Math.round(seconds);

  const minutes = Number(app.time_spent);
  if (Number.isFinite(minutes) && minutes > 0) return Math.round(minutes * 60);

  return null;
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const rank = (p / 100) * (sorted.length - 1);
  const low = Math.floor(rank);
  const high = Math.ceil(rank);
  if (low === high) return sorted[low];
  return sorted[low] + (sorted[high] - sorted[low]) * (rank - low);
}

function trimmedMean(values: number[], trimRatio: number = 0.1): number {
  if (values.length === 0) return 0;
  if (values.length < 5) return values.reduce((a, b) => a + b, 0) / values.length;
  const sorted = [...values].sort((a, b) => a - b);
  const trim = Math.floor(sorted.length * trimRatio);
  const trimmed = sorted.slice(trim, sorted.length - trim);
  if (trimmed.length === 0) return sorted.reduce((a, b) => a + b, 0) / sorted.length;
  return trimmed.reduce((a, b) => a + b, 0) / trimmed.length;
}

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
router.get('/stats/summary', asyncHandler(async (req: Request, res: Response) => {
    const userId = (req as any).user?.id;
    if (!userId) {
      throw new AppError('Unauthorized', 401, 'UNAUTHORIZED');
    }

    const { period = '30' } = req.query;
    const days = parseInt(period as string);
    
    // If period is 0, negative, or >= 10000, get ALL data (no date filter)
    let allAppsResult;
    let startDate: Date | null = null;
    
    if (days > 0 && days < 10000) {
      startDate = new Date();
      startDate.setDate(startDate.getDate() - days);
      
      // Get all applications for the period (check both applied_at and created_at)
      allAppsResult = await pool.query(
        `SELECT * FROM applications 
         WHERE user_id = $1 
         AND (applied_at >= $2 OR (applied_at IS NULL AND created_at >= $2) OR created_at >= $2)
         ORDER BY COALESCE(applied_at, created_at) DESC`,
        [userId, startDate]
      );
    } else {
      // Get ALL applications (no date filter)
      allAppsResult = await pool.query(
        `SELECT * FROM applications 
         WHERE user_id = $1 
         ORDER BY COALESCE(applied_at, created_at) DESC`,
        [userId]
      );
    }
    const allApps = allAppsResult.rows;
    
    logger.info(`Stats query for user ${userId}: period=${days} days, found ${allApps.length} applications`);
    
    // If no applications found, log warning
    if (allApps.length === 0) {
      logger.warn(`No applications found for user ${userId} in period ${days} days. Checking total count...`);
      const totalCheck = await pool.query(
        'SELECT COUNT(*) as total FROM applications WHERE user_id = $1',
        [userId]
      );
      const totalCount = parseInt(totalCheck.rows[0]?.total || '0');
      logger.info(`Total applications for user ${userId}: ${totalCount}`);
    }

    // Get total applications
    const total = allApps.length;

    // Get applications by status
    const byStatus: Record<string, number> = {};
    allApps.forEach((app: any) => {
      byStatus[app.status || 'APPLIED'] = (byStatus[app.status || 'APPLIED'] || 0) + 1;
    });

    // Time metrics from second-level data (fallback to legacy minute-level where needed)
    const appsWithTime = allApps.filter((app: any) => getAppTimeSeconds(app) !== null);
    const timeValuesSeconds = appsWithTime
      .map((app: any) => getAppTimeSeconds(app))
      .filter((x: number | null): x is number => x !== null)
      .sort((a: number, b: number) => a - b);
    
    let averageTimePerApplication = 0;
    let fastestTime = 0;
    let slowestTime = 0;
    let medianTimePerApplication = 0;
    let p90TimePerApplication = 0;
    let trimmedAverageTimePerApplication = 0;
    let improvement = 0;
    let targetTime = 20; // Default target: 20 minutes
    
    if (timeValuesSeconds.length > 0) {
      const averageSeconds = timeValuesSeconds.reduce((sum: number, time: number) => sum + time, 0) / timeValuesSeconds.length;
      averageTimePerApplication = Math.round(averageSeconds / 60);
      fastestTime = Math.round(timeValuesSeconds[0] / 60);
      slowestTime = Math.round(timeValuesSeconds[timeValuesSeconds.length - 1] / 60);
      medianTimePerApplication = Math.round(percentile(timeValuesSeconds, 50) / 60);
      p90TimePerApplication = Math.round(percentile(timeValuesSeconds, 90) / 60);
      trimmedAverageTimePerApplication = Math.round(trimmedMean(timeValuesSeconds, 0.1) / 60);
      
      // Calculate improvement: compare with previous period (only if we have a date filter)
      if (startDate) {
        const previousPeriodStart = new Date(startDate);
        previousPeriodStart.setDate(previousPeriodStart.getDate() - days);
        const previousAppsResult = await pool.query(
          `SELECT COALESCE(time_spent_seconds, time_spent * 60) AS time_spent_seconds
           FROM applications 
           WHERE user_id = $1 AND applied_at >= $2 AND applied_at < $3
             AND (time_spent_seconds IS NOT NULL OR time_spent IS NOT NULL)`,
          [userId, previousPeriodStart, startDate]
        );
        
        if (previousAppsResult.rows.length > 0) {
          const previousAvgSeconds = previousAppsResult.rows.reduce((sum: number, app: any) => sum + (parseInt(app.time_spent_seconds || 0, 10) || 0), 0) / previousAppsResult.rows.length;
          const previousAvg = previousAvgSeconds / 60;
          const improvementPercent = previousAvg > 0 
            ? Math.round(((previousAvg - averageTimePerApplication) / previousAvg) * 100)
            : 0;
          improvement = improvementPercent;
        }
      }
      
    }

    // Get applications with response (either has response_date OR progressed beyond APPLIED status)
    const appsWithResponse = allApps.filter((app: any) => {
      // Has explicit response date
      if (app.response_date != null) return true;
      
      // Or has progressed beyond initial application (these are implicit responses)
      const progressedStatuses = ['VIEWED', 'SHORTLISTED', 'INTERVIEW_SCHEDULED', 'INTERVIEWED', 'OFFERED', 'ACCEPTED'];
      if (progressedStatuses.includes(app.status)) return true;
      
      return false;
    });
    const responseRate = total > 0 ? Math.round((appsWithResponse.length / total) * 100 * 100) / 100 : 0;
    
    // Calculate previous period response rate (for trend comparison) - only if we have a date filter
    let previousPeriodApps: any[] = [];
    if (startDate) {
      const previousPeriodEnd = new Date(startDate);
      const previousPeriodStart = new Date(startDate);
      previousPeriodStart.setDate(previousPeriodStart.getDate() - days);
      
      previousPeriodApps = allApps.filter((app: any) => {
        const appDate = new Date(app.applied_at || app.created_at);
        return appDate >= previousPeriodStart && appDate < previousPeriodEnd;
      });
    }
    
    const previousAppsWithResponse = previousPeriodApps.filter((app: any) => {
      if (app.response_date != null) return true;
      const progressedStatuses = ['VIEWED', 'SHORTLISTED', 'INTERVIEW_SCHEDULED', 'INTERVIEWED', 'OFFERED', 'ACCEPTED'];
      if (progressedStatuses.includes(app.status)) return true;
      return false;
    });
    
    const previousResponseRate = previousPeriodApps.length > 0 
      ? Math.round((previousAppsWithResponse.length / previousPeriodApps.length) * 100 * 100) / 100 
      : 0;
    
    logger.info(`Response stats for user ${userId}: total=${total}, responses=${appsWithResponse.length}, rate=${responseRate}%, previousRate=${previousResponseRate}%`);

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
    
    // Calculate previous streak (for trend - get streak from 7 days ago)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const previousApplicationDates = allApps
      .filter((app: any) => new Date(app.applied_at || app.created_at) <= sevenDaysAgo)
      .map((app: any) => new Date(app.applied_at || app.created_at));
    const { current: previousStreak } = calculateStreaks(previousApplicationDates);

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

    // Get total time spent across all applications (hours)
    const totalTimeSpentSeconds = timeValuesSeconds.reduce((sum: number, time: number) => sum + time, 0);
    const totalTimeInHours = Math.round((totalTimeSpentSeconds / 3600) * 10) / 10;

    const timeQualityBreakdown = appsWithTime.reduce((acc: Record<string, number>, app: any) => {
      const q = app.time_quality || 'UNKNOWN';
      acc[q] = (acc[q] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    const trackedCount = appsWithTime.length;
    const highQualityRatio = trackedCount > 0
      ? Math.round((((timeQualityBreakdown.AUTO_HIGH || 0) / trackedCount) * 100) * 100) / 100
      : 0;

    // Count applications by specific statuses
    const interviews = allApps.filter((app: any) => 
      app.status === 'INTERVIEW_SCHEDULED' || 
      app.status === 'INTERVIEWED' ||
      app.status === 'INTERVIEWING'
    ).length;
    
    const offers = allApps.filter((app: any) => 
      app.status === 'OFFERED' ||          // User marks as OFFERED
      app.status === 'OFFER_RECEIVED' ||   // Alternative status
      app.status === 'ACCEPTED'            // Final acceptance
    ).length;
    
    const pending = allApps.filter((app: any) => 
      app.status === 'APPLIED' || 
      app.status === 'SCREENING' ||
      app.status === 'UNDER_REVIEW'
    ).length;
    
    logger.info(`Status counts for user ${userId}: interviews=${interviews}, offers=${offers}, pending=${pending}`);

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

    // Get cold email stats - get ALL cold emails (not period-filtered)
    const coldEmailResult = await pool.query(
      `SELECT COUNT(*) as total, 
       SUM(CASE WHEN responded = true THEN 1 ELSE 0 END) as responses
       FROM cold_emails WHERE user_id = $1`,
      [userId]
    );
    const coldEmailsSent = parseInt(coldEmailResult.rows[0]?.total || '0');
    const coldEmailResponses = parseInt(coldEmailResult.rows[0]?.responses || '0');
    const coldEmailConversionRate = coldEmailsSent > 0
      ? Math.round((coldEmailResponses / coldEmailsSent) * 100 * 100) / 100
      : 0;
    
    logger.info(`Cold emails stats for user ${userId}: sent=${coldEmailsSent}, responses=${coldEmailResponses}, rate=${coldEmailConversionRate}%`);

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
      medianTimePerApplication,
      p90TimePerApplication,
      trimmedAverageTimePerApplication,
      targetTime,
      improvement,
      timeQualityBreakdown,
      timeDataQualityScore: highQualityRatio,
      responseRate,
      previousResponseRate,
      responsesReceived: appsWithResponse.length,
      averageResponseTime,
      currentStreak,
      previousStreak,
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
}));

// DUPLICATE ROUTE REMOVED - active-sessions is now defined before /:id route (line 77)

// Manual email check trigger
router.post('/check-emails', async (req, res) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { triggerGhosting } = req.body;

    // Import here to avoid circular dependencies
    const { triggerEmailMonitoring, triggerGhostingDetection } = require('../jobs/email-monitor.job');

    // Trigger email monitoring
    const emailResult = await triggerEmailMonitoring(userId);

    let ghostingResult = null;
    if (triggerGhosting) {
      ghostingResult = await triggerGhostingDetection(userId);
    }

    return res.json({
      success: true,
      emailMonitoring: {
        emailsProcessed: emailResult.emailsProcessed,
        statusUpdates: emailResult.statusUpdates,
        applicationsUpdated: emailResult.applicationsUpdated,
      },
      ghostingDetection: ghostingResult ? {
        ghostedCount: ghostingResult.ghostedCount,
      } : null,
    });
  } catch (error) {
    logger.error('Error triggering email check:', error);
    return res.status(500).json({
      error: 'Failed to check emails',
      message: error instanceof Error ? error.message : 'Unable to check emails.',
    });
  }
});

// Get status update history for an application
router.get('/:id/status-history', async (req, res) => {
  try {
    const userId = (req as any).user?.id;
    const { id } = req.params;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Verify application belongs to user
    const appCheck = await pool.query(
      'SELECT id FROM applications WHERE id = $1 AND user_id = $2',
      [id, userId]
    );

    if (appCheck.rows.length === 0) {
      return res.status(404).json({
        error: 'Application not found',
        message: 'The requested application does not exist.',
      });
    }

    // Get status update history
    const result = await pool.query(
      `SELECT 
        id,
        email_subject,
        email_from,
        email_domain,
        detected_status,
        confidence_score,
        email_date,
        email_body_snippet,
        created_at
      FROM email_status_updates
      WHERE application_id = $1
      ORDER BY email_date DESC, created_at DESC`,
      [id]
    );

    return res.json({
      applicationId: id,
      statusHistory: result.rows,
      history: result.rows, // backward compatibility with current frontend modal
      count: result.rows.length,
    });
  } catch (error) {
    logger.error('Error fetching status history:', error);
    return res.status(500).json({
      error: 'Failed to fetch status history',
      message: 'Unable to retrieve status history.',
    });
  }
});

// Enable/disable auto status tracking for an application
router.patch('/:id/auto-status', async (req, res) => {
  try {
    const userId = (req as any).user?.id;
    const { id } = req.params;
    const { enabled } = req.body;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    if (typeof enabled !== 'boolean') {
      return res.status(400).json({
        error: 'Invalid request',
        message: 'enabled must be a boolean value',
      });
    }

    // Verify application belongs to user and update
    const result = await pool.query(
      `UPDATE applications 
       SET auto_status_enabled = $1, updated_at = NOW()
       WHERE id = $2 AND user_id = $3
       RETURNING id, auto_status_enabled`,
      [enabled, id, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: 'Application not found',
        message: 'The requested application does not exist.',
      });
    }

    return res.json({
      success: true,
      message: `Auto status tracking ${enabled ? 'enabled' : 'disabled'}`,
      application: result.rows[0],
    });
  } catch (error) {
    logger.error('Error updating auto status setting:', error);
    return res.status(500).json({
      error: 'Failed to update auto status setting',
      message: 'Unable to update setting.',
    });
  }
});

// Set custom ghosting threshold for an application
router.patch('/:id/ghosting-threshold', async (req, res) => {
  try {
    const userId = (req as any).user?.id;
    const { id } = req.params;
    const { thresholdDays } = req.body;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    if (typeof thresholdDays !== 'number' || thresholdDays < 1 || thresholdDays > 90) {
      return res.status(400).json({
        error: 'Invalid request',
        message: 'thresholdDays must be a number between 1 and 90',
      });
    }

    // Verify application belongs to user and update
    const result = await pool.query(
      `UPDATE applications 
       SET ghosting_threshold_days = $1, updated_at = NOW()
       WHERE id = $2 AND user_id = $3
       RETURNING id, ghosting_threshold_days`,
      [thresholdDays, id, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: 'Application not found',
        message: 'The requested application does not exist.',
      });
    }

    return res.json({
      success: true,
      message: `Ghosting threshold set to ${thresholdDays} days`,
      application: result.rows[0],
    });
  } catch (error) {
    logger.error('Error updating ghosting threshold:', error);
    return res.status(500).json({
      error: 'Failed to update ghosting threshold',
      message: 'Unable to update threshold.',
    });
  }
});

/**
 * POST /api/applications/:id/correct-status
 * Learn from user corrections
 */
router.post('/:id/correct-status', asyncHandler(async (req: Request, res: Response) => {
    const userId = (req as any).user?.id;
    if (!userId) {
      throw new AppError('Unauthorized', 401, 'UNAUTHORIZED');
    }

    const { id } = req.params;
    const { detectedStatus, correctedStatus, emailSubject, emailBody } = req.body;

    // Verify application belongs to user
    const appCheck = await pool.query(
      'SELECT id FROM applications WHERE id = $1 AND user_id = $2',
      [id, userId]
    );

    if (appCheck.rows.length === 0) {
      throw new AppError('Application not found', 404, 'NOT_FOUND');
    }

    // Record correction for learning
    const { AIStatusAgent } = require('../services/ai-status-agent.service');
    const aiAgent = new AIStatusAgent();
    await aiAgent.learnFromCorrection(
      userId,
      id,
      detectedStatus,
      correctedStatus,
      emailSubject || '',
      emailBody || ''
    );

    return res.json({ success: true, message: 'Correction recorded for learning' });
}));

export default router;