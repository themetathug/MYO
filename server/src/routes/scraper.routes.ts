import { Router } from 'express';
import { z } from 'zod';
import { scraperService } from '../services/scraper.service';
import { logger } from '../utils/logger';
import { validateRequest } from '../middleware/validation.middleware';

const router = Router();

// Validation schema
const scrapeRequestSchema = z.object({
  keywords: z.string().optional(),
  location: z.string().optional(),
  sources: z.array(z.enum(['linkedin', 'indeed', 'monster'])).optional(),
  limitPerSource: z.number().min(1).max(50).optional(),
});

// Scrape jobs from all sources
router.post('/scrape', validateRequest(scrapeRequestSchema), async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'You must be logged in to scrape jobs.',
      });
    }

    const { keywords, location, sources, limitPerSource } = req.body;

    logger.info(`🔍 Starting job scraping for user ${userId}`);
    logger.info(`   Keywords: ${keywords || 'N/A'}`);
    logger.info(`   Location: ${location || 'N/A'}`);
    logger.info(`   Sources: ${sources?.join(', ') || 'all'}`);

    // Start scraping (async, but wait for initial response)
    scraperService
      .scrapeAll(userId, {
        keywords,
        location,
        sources,
        limitPerSource,
      })
      .then((result) => {
        logger.info(`✅ Scraping completed: ${result.saved} jobs saved`);
      })
      .catch((error) => {
        logger.error('❌ Scraping failed:', error);
      });

    // Return immediately (scraping happens in background)
    return res.json({
      message: 'Job scraping started successfully',
      status: 'processing',
      note: 'Jobs will be saved to your dashboard as they are scraped. This may take a few minutes.',
    });
  } catch (error) {
    logger.error('Error starting scraping:', error);
    return res.status(500).json({
      error: 'Failed to start scraping',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Scrape from specific source
router.post('/scrape/:source', validateRequest(scrapeRequestSchema), async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'You must be logged in to scrape jobs.',
      });
    }

    const { source } = req.params;
    const { keywords, location, limitPerSource } = req.body;
    const limit = limitPerSource || 10;

    logger.info(`🔍 Starting ${source} scraping for user ${userId}`);

    let jobs: any[] = [];
    let saved = 0;

    switch (source.toLowerCase()) {
      case 'linkedin':
        jobs = await scraperService.scrapeLinkedIn({ keywords, location, limit });
        saved = await scraperService.saveJobsToDatabase(userId, jobs);
        break;
      case 'indeed':
        jobs = await scraperService.scrapeIndeed({ keywords, location, limit });
        saved = await scraperService.saveJobsToDatabase(userId, jobs);
        break;
      case 'monster':
        jobs = await scraperService.scrapeMonster({ keywords, location, limit });
        saved = await scraperService.saveJobsToDatabase(userId, jobs);
        break;
      default:
        return res.status(400).json({
          error: 'Invalid source',
          message: `Source must be one of: linkedin, indeed, monster`,
        });
    }

    return res.json({
      message: `Successfully scraped ${source}`,
      scraped: jobs.length,
      saved,
      jobs: jobs.slice(0, 5), // Return first 5 as preview
    });
  } catch (error) {
    logger.error(`Error scraping ${req.params.source}:`, error);
    return res.status(500).json({
      error: 'Scraping failed',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Get scraping status (future: implement job queue status)
router.get('/scrape/status', async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({
        error: 'Unauthorized',
      });
    }

    // For now, just return basic status
    return res.json({
      status: 'ready',
      message: 'Scraper service is ready',
    });
  } catch (error) {
    logger.error('Error getting scraping status:', error);
    return res.status(500).json({
      error: 'Failed to get status',
    });
  }
});

export default router;

