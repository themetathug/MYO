import puppeteer, { Browser } from 'puppeteer';
import { logger } from '../utils/logger';
import { pool } from '../database/client';

interface ScrapedJob {
  company: string;
  position: string;
  location?: string;
  jobUrl: string;
  jobBoardSource: string;
  salary?: string;
  description?: string;
  status?: string;
}

export class ScraperService {
  private browser: Browser | null = null;

  async initializeBrowser(): Promise<Browser> {
    if (!this.browser) {
      this.browser = await puppeteer.launch({
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--no-first-run',
          '--no-zygote',
          '--disable-gpu',
        ],
      });
      logger.info('✅ Browser initialized for scraping');
    }
    return this.browser;
  }

  async closeBrowser() {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      logger.info('Browser closed');
    }
  }

  async scrapeLinkedIn(searchParams: {
    keywords?: string;
    location?: string;
    limit?: number;
  }): Promise<ScrapedJob[]> {
    const browser = await this.initializeBrowser();

    // Retry wrapper: up to 2 attempts before giving up on LinkedIn.
    // Each attempt gets a fresh page to avoid stale navigation state.
    const MAX_ATTEMPTS = 2;
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      const page = await browser.newPage();
      try {
        return await this._scrapeLinkedInAttempt(page, browser, searchParams);
      } catch (err: any) {
        lastError = err;
        logger.warn(`⚠️ LinkedIn scrape attempt ${attempt}/${MAX_ATTEMPTS} failed: ${err?.message}`);
        try { await page.close(); } catch { /* ignore */ }
        if (attempt < MAX_ATTEMPTS) {
          await new Promise(r => setTimeout(r, 3000 * attempt));
        }
      }
    }
    throw lastError;
  }

  private async _scrapeLinkedInAttempt(page: any, browser: any, searchParams: { keywords?: string; location?: string; limit?: number }): Promise<ScrapedJob[]> {
    try {
      logger.info('🔍 Starting LinkedIn scraping...');

      const keywords = searchParams.keywords || 'developer';
      const location = searchParams.location || 'United Kingdom';
      const limit = searchParams.limit || 25;

      const searchUrl = `https://www.linkedin.com/jobs/search/?keywords=${encodeURIComponent(keywords)}&location=${encodeURIComponent(location)}&f_TPR=r86400&position=1&pageNum=0`;

      logger.info(`📋 Navigating to LinkedIn: ${searchUrl}`);

      await page.goto(searchUrl, {
        waitUntil: 'networkidle2',
        timeout: 30000,
      });

      // Try multiple known container selectors — LinkedIn DOM changes frequently
      const CARD_CONTAINER_SELECTORS = [
        '.jobs-search__results-list',
        '.scaffold-layout__list',
        '[data-results-list-top-offset]',
        'ul.jobs-search-results__list',
        'div[class*="jobs-search-results"]',
      ];

      let containerFound = false;
      for (const sel of CARD_CONTAINER_SELECTORS) {
        containerFound = await page.waitForSelector(sel, { timeout: 5000 })
          .then(() => true)
          .catch(() => false);
        if (containerFound) {
          logger.info(`✅ LinkedIn container found with selector: ${sel}`);
          break;
        }
      }

      if (!containerFound) {
        logger.warn('⚠️ No known LinkedIn container found — page layout may have changed. Extracting all job-like links as fallback.');
      }

      // Scroll to load more jobs
      for (let i = 0; i < 3; i++) {
        await page.evaluate(() => {
          const w = globalThis as any;
          w.window?.scrollTo(0, w.document?.body?.scrollHeight || 0);
        });
        await new Promise(resolve => setTimeout(resolve, 2000));
      }

      // Extract job listings — ranked selector fallback strategy per field
      const jobCards = await page.evaluate(() => {
        const d = (globalThis as any).document;
        if (!d) return [];

        // Ranked card selectors: most specific first, generic last
        const CARD_SELECTORS = [
          '.jobs-search-results__list-item',
          '[data-occludable-job-id]',
          '.job-card-container',
          '[data-testid="job-card"]',
          'li[class*="job-card"]',
          'div[class*="job-card"]',
        ];

        let cards: any[] = [];
        for (const sel of CARD_SELECTORS) {
          cards = Array.from(d.querySelectorAll(sel));
          if (cards.length > 0) break;
        }

        return cards.map((card: any) => {
          try {
            // Ranked title selectors
            const titleEl = (
              card.querySelector('a.job-card-list__title') ||
              card.querySelector('a[data-control-name*="job_title"]') ||
              card.querySelector('h3.base-search-card__title') ||
              card.querySelector('h3[class*="title"]') ||
              card.querySelector('a[href*="/jobs/view/"]') ||
              card.querySelector('[class*="job-title"]')
            ) as any;

            // Ranked company selectors
            const companyEl = (
              card.querySelector('h4.base-search-card__subtitle') ||
              card.querySelector('.job-card-container__company-name') ||
              card.querySelector('a[data-control-name*="job_company_link"]') ||
              card.querySelector('a[href*="/company/"]') ||
              card.querySelector('[class*="company-name"]') ||
              card.querySelector('[class*="subtitle"]')
            ) as any;

            // Ranked location selectors
            const locationEl = (
              card.querySelector('.job-search-card__location') ||
              card.querySelector('.job-card-container__metadata-item') ||
              card.querySelector('[class*="job-location"]') ||
              card.querySelector('[class*="location"]')
            ) as any;

            // Ranked link selectors
            const linkEl = (
              card.querySelector('a[href*="/jobs/view/"]') ||
              card.querySelector('a.job-card-list__title') ||
              card.querySelector('h3 a') ||
              card.querySelector('a[data-control-name*="job_title"]')
            ) as any;

            const title = titleEl?.textContent?.trim() || '';
            const company = companyEl?.textContent?.trim() || '';
            const location = locationEl?.textContent?.trim() || '';
            const link = linkEl?.href || '';

            if (title && company && link) {
              return {
                position: title,
                company,
                location,
                jobUrl: link.split('?')[0],
              };
            }
          } catch (err) {
            console.error('Error parsing job card:', err);
          }
          return null;
        }).filter(Boolean);
      });

      logger.info(`✅ Found ${jobCards.length} LinkedIn jobs`);

      const jobs: any[] = [];

      // Get detailed info for each job
      for (let i = 0; i < Math.min(jobCards.length, limit); i++) {
        const jobCard = jobCards[i] as any;
        if (!jobCard) continue;

        try {
          const detailPage = await browser.newPage();
          await detailPage.goto(jobCard.jobUrl, {
            waitUntil: 'networkidle2',
            timeout: 15000,
          });

          const jobDetails = await detailPage.evaluate(() => {
            const d = (globalThis as any).document;
            const salaryEl = d?.querySelector('.salary-main-rail-card__salary-range, [data-testid="salary-range"]') as any;
            const descEl = d?.querySelector('.jobs-description__content, .description__text') as any;

            return {
              salary: salaryEl?.textContent?.trim() || undefined,
              description: descEl?.textContent?.trim()?.substring(0, 1000) || undefined,
            };
          });

          jobs.push({
            ...jobCard,
            jobBoardSource: 'LinkedIn',
            salary: jobDetails.salary,
            description: jobDetails.description,
            status: 'APPLIED',
          });

          await detailPage.close();
          await new Promise(resolve => setTimeout(resolve, 1000)); // Rate limiting
        } catch (err) {
          logger.warn(`Failed to get details for job ${i + 1}:`, err);
          // Still add the job with basic info
          jobs.push({
            ...jobCard,
            jobBoardSource: 'LinkedIn',
            status: 'APPLIED',
          });
        }
      }

      logger.info(`✅ Successfully scraped ${jobs.length} LinkedIn jobs`);
      return jobs;
    } catch (error) {
      logger.error('❌ LinkedIn scraping error:', error);
      throw error;
    } finally {
      await page.close();
    }
  }

  async scrapeIndeed(searchParams: {
    keywords?: string;
    location?: string;
    limit?: number;
  }): Promise<ScrapedJob[]> {
    const browser = await this.initializeBrowser();
    const page = await browser.newPage();

    try {
      logger.info('🔍 Starting Indeed scraping...');

      const keywords = searchParams.keywords || 'developer';
      const location = searchParams.location || 'United Kingdom';
      const limit = searchParams.limit || 25;

      const searchUrl = `https://uk.indeed.com/jobs?q=${encodeURIComponent(keywords)}&l=${encodeURIComponent(location)}&fromage=1`;

      logger.info(`📋 Navigating to Indeed: ${searchUrl}`);

      await page.goto(searchUrl, {
        waitUntil: 'networkidle2',
        timeout: 30000,
      });

      // Wait for page to load - try multiple selectors
      try {
        await page.waitForSelector('#mosaic-provider-jobcards, [data-testid="slider_item"], .job_seen_beacon, [data-jk]', { timeout: 15000 });
      } catch (_e) {
        logger.warn('Indeed: Primary selector not found, continuing anyway...');
        await new Promise(resolve => setTimeout(resolve, 3000)); // Wait for content to load
      }

      // Scroll to load more
      for (let i = 0; i < 3; i++) {
        await page.evaluate(() => {
          const w = globalThis as any;
          w.window?.scrollTo(0, w.document?.body?.scrollHeight || 0);
        });
        await new Promise(resolve => setTimeout(resolve, 2000));
      }

      const jobCards = await page.evaluate(() => {
        const d = (globalThis as any).document;
        if (!d) return [];
        // Enhanced selectors for Indeed (2025)
        const cards: any[] = Array.from(d.querySelectorAll(
          '[data-jk], .job_seen_beacon, .slider_container .jobCard, [data-testid="slider_item"], .jobCard, .result'
        ));
        
        return cards.map((card) => {
          try {
            // Enhanced selectors with multiple fallbacks
            const titleEl = card.querySelector('h2.jobTitle a, h2 a, a[data-jk], [data-testid="job-title"]') as any;
            const companyEl = card.querySelector(
              '[data-testid="company-name"], .companyName, [data-testid="company-link"], span[data-testid="company-name"]'
            ) as any;
            const locationEl = card.querySelector(
              '[data-testid="text-location"], .companyLocation, [data-testid="job-location"], [data-testid="job-metadata-location"]'
            ) as any;
            const salaryEl = card.querySelector(
              '[data-testid="attribute_snippet_testid"], .salaryText, [data-testid="job-salary"], [data-testid="job-metadata-salary"]'
            ) as any;
            const linkEl = card.querySelector('a.jobTitle, a[data-jk], h2.jobTitle a, [data-testid="job-title"]') as any;

            const title = titleEl?.textContent?.trim() || '';
            const company = companyEl?.textContent?.trim() || '';
            const location = locationEl?.textContent?.trim() || '';
            const salary = salaryEl?.textContent?.trim() || '';
            const link = linkEl?.href || '';

            if (title && company) {
              const fullUrl = link.startsWith('http') ? link : `https://uk.indeed.com${link}`;
              return {
                position: title,
                company,
                location,
                salary: salary || undefined,
                jobUrl: fullUrl.split('?')[0],
              };
            }
          } catch (err) {
            console.error('Error parsing Indeed job card:', err);
          }
          return null;
        }).filter(Boolean);
      });

      logger.info(`✅ Found ${jobCards.length} Indeed jobs`);

      // Limit results
      const limitedJobs = jobCards.slice(0, limit).map((job: any) => ({
        ...job,
        jobBoardSource: 'Indeed',
        status: 'APPLIED',
      }));

      return limitedJobs;
    } catch (error) {
      logger.error('❌ Indeed scraping error:', error);
      throw error;
    } finally {
      await page.close();
    }
  }

  async scrapeMonster(searchParams: {
    keywords?: string;
    location?: string;
    limit?: number;
  }): Promise<ScrapedJob[]> {
    const browser = await this.initializeBrowser();
    const page = await browser.newPage();

    try {
      logger.info('🔍 Starting Monster scraping...');

      const keywords = searchParams.keywords || 'developer';
      const location = searchParams.location || 'United Kingdom';
      const limit = searchParams.limit || 25;

      const searchUrl = `https://www.monster.co.uk/jobs/search/?q=${encodeURIComponent(keywords)}&where=${encodeURIComponent(location)}&tm=1`;

      logger.info(`📋 Navigating to Monster: ${searchUrl}`);

      await page.goto(searchUrl, {
        waitUntil: 'networkidle2',
        timeout: 30000,
      });

      // Wait for results - try multiple selectors
      try {
        await page.waitForSelector('[data-testid="job-card"], .card-content, .search-result, .job-card, article', { timeout: 15000 });
      } catch (_e) {
        logger.warn('Monster: Primary selector not found, continuing anyway...');
        await new Promise(resolve => setTimeout(resolve, 3000));
      }

      // Scroll to load more
      for (let i = 0; i < 3; i++) {
        await page.evaluate(() => {
          const w = globalThis as any;
          w.window?.scrollTo(0, w.document?.body?.scrollHeight || 0);
        });
        await new Promise(resolve => setTimeout(resolve, 2000));
      }

      const jobCards = await page.evaluate(() => {
        const d = (globalThis as any).document;
        if (!d) return [];
        // Enhanced selectors for Monster (2025)
        const cards: any[] = Array.from(d.querySelectorAll(
          '[data-testid="job-card"], .card-content, .search-result, .job-card, article.card, .job-tile'
        ));
        
        return cards.map((card) => {
          try {
            // Enhanced selectors with multiple fallbacks
            const titleEl = card.querySelector(
              'h2 a, .title a, [data-testid="job-title"], h3 a, a[href*="/job/"]'
            ) as any;
            const companyEl = card.querySelector(
              '.company, .employer, [data-testid="company-name"], [class*="company"], [class*="employer"]'
            ) as any;
            const locationEl = card.querySelector(
              '.location, .job-location, [data-testid="job-location"], [class*="location"]'
            ) as any;
            const linkEl = card.querySelector('h2 a, .title a, h3 a, a[href*="/job/"]') as any;

            const title = titleEl?.textContent?.trim() || '';
            const company = companyEl?.textContent?.trim() || '';
            const location = locationEl?.textContent?.trim() || '';
            const link = linkEl?.href || '';

            if (title && company) {
              const fullUrl = link.startsWith('http') ? link : `https://www.monster.co.uk${link}`;
              return {
                position: title,
                company,
                location,
                jobUrl: fullUrl.split('?')[0],
              };
            }
          } catch (err) {
            console.error('Error parsing Monster job card:', err);
          }
          return null;
        }).filter(Boolean);
      });

      logger.info(`✅ Found ${jobCards.length} Monster jobs`);

      const limitedJobs = jobCards.slice(0, limit).map((job: any) => ({
        ...job,
        jobBoardSource: 'Monster',
        status: 'APPLIED',
      }));

      return limitedJobs;
    } catch (error) {
      logger.error('❌ Monster scraping error:', error);
      throw error;
    } finally {
      await page.close();
    }
  }

  async saveJobsToDatabase(userId: string, jobs: ScrapedJob[]): Promise<number> {
    let savedCount = 0;

    for (const job of jobs) {
      try {
        // Check if job already exists (by URL)
        const existingCheck = await pool.query(
          'SELECT id FROM applications WHERE user_id = $1 AND job_url = $2',
          [userId, job.jobUrl]
        );

        if (existingCheck.rows.length > 0) {
          logger.info(`⏭️ Skipping duplicate job: ${job.position} at ${job.company}`);
          continue;
        }

        // Insert new job
        await pool.query(
          `INSERT INTO applications 
           (user_id, company, position, location, job_board_source, job_url, salary, status, capture_method, applied_at, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW(), NOW())`,
          [
            userId,
            job.company,
            job.position,
            job.location || null,
            job.jobBoardSource,
            job.jobUrl,
            job.salary || null,
            job.status || 'APPLIED',
            'API',
          ]
        );

        savedCount++;
      } catch (error) {
        logger.error(`Failed to save job ${job.position} at ${job.company}:`, error);
      }
    }

    logger.info(`✅ Saved ${savedCount} new jobs to database`);
    return savedCount;
  }

  async scrapeAll(
    userId: string,
    params: {
      keywords?: string;
      location?: string;
      sources?: string[];
      limitPerSource?: number;
    }
  ): Promise<{ total: number; found: number; saved: number; bySource: Record<string, number> }> {
    const sources = params.sources || ['linkedin', 'indeed', 'monster'];
    const limit = params.limitPerSource || 10;
    const keywords = params.keywords || '';
    const location = params.location || 'United Kingdom';

    const results: Record<string, number> = {};
    let totalScraped = 0;
    let totalSaved = 0;

    try {
      for (const source of sources) {
        try {
          let jobs: ScrapedJob[] = [];

          switch (source.toLowerCase()) {
            case 'linkedin':
              jobs = await this.scrapeLinkedIn({ keywords, location, limit });
              break;
            case 'indeed':
              jobs = await this.scrapeIndeed({ keywords, location, limit });
              break;
            case 'monster':
              jobs = await this.scrapeMonster({ keywords, location, limit });
              break;
            default:
              logger.warn(`Unknown source: ${source}`);
              continue;
          }

          totalScraped += jobs.length;
          const saved = await this.saveJobsToDatabase(userId, jobs);
          totalSaved += saved;
          results[source] = saved;

          logger.info(`✅ ${source}: Scraped ${jobs.length}, Saved ${saved}`);
        } catch (error) {
          logger.error(`Failed to scrape ${source}:`, error);
          results[source] = 0;
        }
      }

      return {
        total: totalScraped,
        found: totalScraped,
        saved: totalSaved,
        bySource: results,
      };
    } finally {
      // Always close the browser after scraping to prevent memory leaks
      await this.closeBrowser();
    }
  }
}

// Export singleton instance
export const scraperService = new ScraperService();

