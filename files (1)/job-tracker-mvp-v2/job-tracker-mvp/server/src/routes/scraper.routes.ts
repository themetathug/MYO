import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { scraperService } from '../services/scraper.service';
import { pool } from '../database/client';
import { logger } from '../utils/logger';
import { validateRequest } from '../middleware/validation.middleware';
import { asyncHandler, AppError } from '../middleware/error.middleware';

const router = Router();

const scrapeRequestSchema = z.object({
  keywords: z.string().optional(),
  location: z.string().optional(),
  sources: z.array(z.enum(['linkedin', 'indeed', 'monster'])).optional(),
  limitPerSource: z.number().min(1).max(50).optional(),
});

/**
 * Creates a scraper_jobs row, runs the scrape in the background, and updates
 * the row with real progress (jobs_found, jobs_saved, status, error).
 * The client can poll GET /scrape/status/:jobId for live progress.
 */
async function runScraperWithTracking(
  userId: string,
  jobId: string,
  opts: { keywords?: string; location?: string; sources?: string[]; limitPerSource?: number }
) {
  try {
    await pool.query(
      `UPDATE scraper_jobs SET status = 'RUNNING', started_at = NOW() WHERE id = $1`,
      [jobId]
    );

    const result = await scraperService.scrapeAll(userId, opts);

    await pool.query(
      `UPDATE scraper_jobs
       SET status = 'DONE', jobs_found = $2, jobs_saved = $3, finished_at = NOW()
       WHERE id = $1`,
      [jobId, result.found ?? result.saved, result.saved]
    );
    logger.info(`✅ Scrape job ${jobId} complete — ${result.saved} saved`);
  } catch (error: any) {
    await pool.query(
      `UPDATE scraper_jobs
       SET status = 'FAILED', error_msg = $2, finished_at = NOW()
       WHERE id = $1`,
      [jobId, error?.message?.slice(0, 500) || 'Unknown error']
    );
    logger.error(`❌ Scrape job ${jobId} failed:`, error);
  }
}

// POST /scrape — start a durable scrape job
router.post('/scrape', validateRequest(scrapeRequestSchema), asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user?.id;
  if (!userId) throw new AppError('Unauthorized', 401, 'UNAUTHORIZED');

  const { keywords, location, sources, limitPerSource } = req.body;

  const jobResult = await pool.query(
    `INSERT INTO scraper_jobs (user_id, status, sources, keywords, location)
     VALUES ($1, 'QUEUED', $2, $3, $4)
     RETURNING id`,
    [userId, sources || ['linkedin', 'indeed', 'monster'], keywords || null, location || null]
  );
  const jobId: string = jobResult.rows[0].id;

  // Fire-and-forget but track state in DB
  runScraperWithTracking(userId, jobId, { keywords, location, sources, limitPerSource }).catch(() => {});

  return res.json({
    message: 'Job scraping started',
    jobId,
    status: 'QUEUED',
    statusUrl: `/api/jobs/scrape/status/${jobId}`,
  });
}));

// GET /scrape/status/:jobId — real-time job progress
router.get('/scrape/status/:jobId', asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user?.id;
  if (!userId) throw new AppError('Unauthorized', 401, 'UNAUTHORIZED');

  const { jobId } = req.params;
  const result = await pool.query(
    `SELECT id, status, jobs_found, jobs_saved, error_msg, started_at, finished_at, created_at
     FROM scraper_jobs WHERE id = $1 AND user_id = $2`,
    [jobId, userId]
  );
  if (result.rows.length === 0) throw new AppError('Job not found', 404, 'NOT_FOUND');

  return res.json(result.rows[0]);
}));

// GET /scrape/status — list recent scrape jobs for the user
router.get('/scrape/status', asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user?.id;
  if (!userId) throw new AppError('Unauthorized', 401, 'UNAUTHORIZED');

  const result = await pool.query(
    `SELECT id, status, jobs_found, jobs_saved, error_msg, sources, keywords, location, started_at, finished_at, created_at
     FROM scraper_jobs
     WHERE user_id = $1
     ORDER BY created_at DESC
     LIMIT 10`,
    [userId]
  );
  return res.json({ jobs: result.rows });
}));

// POST /scrape/:source — scrape a single source synchronously (used for previews)
router.post('/scrape/:source', validateRequest(scrapeRequestSchema), asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user?.id;
  if (!userId) throw new AppError('Unauthorized', 401, 'UNAUTHORIZED');

  const { source } = req.params;
  const { keywords, location, limitPerSource } = req.body;
  const limit = limitPerSource || 10;

  let jobs: any[] = [];
  switch (source.toLowerCase()) {
    case 'linkedin':
      jobs = await scraperService.scrapeLinkedIn({ keywords, location, limit });
      break;
    case 'indeed':
      jobs = await scraperService.scrapeIndeed({ keywords, location, limit });
      break;
    case 'monster':
      jobs = await scraperService.scrapeMonster({ keywords, location, limit });
      break;
    default:
      throw new AppError('Source must be one of: linkedin, indeed, monster', 400, 'INVALID_SOURCE');
  }

  const saved = await scraperService.saveJobsToDatabase(userId, jobs);
  return res.json({ scraped: jobs.length, saved, jobs: jobs.slice(0, 5) });
}));

export default router;
