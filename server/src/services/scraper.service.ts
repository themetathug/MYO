import puppeteer, { Browser, Page } from 'puppeteer';
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
    const page = await browser.newPage();
    const jobs: ScrapedJob[] = [];

    try {
      logger.info('🔍 Starting LinkedIn scraping...');

      // Build LinkedIn search URL
      const keywords = searchParams.keywords || 'developer';
      const location = searchParams.location || 'United Kingdom';
      const limit = searchParams.limit || 25;

      // LinkedIn jobs search URL
      const searchUrl = `https://www.linkedin.com/jobs/search/?keywords=${encodeURIComponent(keywords)}&location=${encodeURIComponent(location)}&f_TPR=r86400&position=1&pageNum=0`;

      logger.info(`📋 Navigating to LinkedIn: ${searchUrl}`);

      await page.goto(searchUrl, {
        waitUntil: 'networkidle2',
        timeout: 30000,
      });

      // Wait for job cards to load
      await page.waitForSelector('.jobs-search__results-list', { timeout: 10000 }).catch(() => {
        logger.warn('Job list selector not found, trying alternative...');
      });

      // Scroll to load more jobs
      for (let i = 0; i < 3; i++) {
        await page.evaluate(() => {
          window.scrollTo(0, document.body.scrollHeight);
        });
        await new Promise(resolve => setTimeout(resolve, 2000));
      }

      // Extract job listings with enhanced selectors
      const jobCards = await page.evaluate(() => {
        // Enhanced selectors for LinkedIn (2025)
        const cards = Array.from(document.querySelectorAll(
          '.jobs-search-results__list-item, .job-card-container, [data-testid="job-card"], [data-occludable-job-id], li[class*="job-card"], div[class*="job-card"]'
        ));
        
        return cards.map((card) => {
          try {
            // Multiple selector strategies for each field
            const titleEl = card.querySelector(
              'a.job-card-list__title, a[data-control-name*="job_title"], h3.base-search-card__title, h3[class*="title"], a[href*="/jobs/view/"]'
            ) as HTMLElement;
            const companyEl = card.querySelector(
              'h4.base-search-card__subtitle, a[data-control-name*="job_company_link"], .job-card-container__company-name, a[href*="/company/"], [class*="company-name"]'
            ) as HTMLElement;
            const locationEl = card.querySelector(
              '.job-search-card__location, .job-card-container__metadata-item, [class*="location"], [class*="job-location"]'
            ) as HTMLElement;
            const linkEl = card.querySelector(
              'a.job-card-list__title, a[href*="/jobs/view/"], h3 a, [data-control-name*="job_title"]'
            ) as HTMLAnchorElement;

            const title = titleEl?.textContent?.trim() || '';
            const company = companyEl?.textContent?.trim() || '';
            const location = locationEl?.textContent?.trim() || '';
            const link = linkEl?.href || '';

            if (title && company && link) {
              return {
                position: title,
                company,
                location,
                jobUrl: link.split('?')[0], // Remove tracking params
              };
            }
          } catch (err) {
            console.error('Error parsing job card:', err);
          }
          return null;
        }).filter(Boolean);
      });

      logger.info(`✅ Found ${jobCards.length} LinkedIn jobs`);

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
            const salaryEl = document.querySelector('.salary-main-rail-card__salary-range, [data-testid="salary-range"]') as HTMLElement;
            const descEl = document.querySelector('.jobs-description__content, .description__text') as HTMLElement;

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
    const jobs: ScrapedJob[] = [];

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
      } catch (e) {
        logger.warn('Indeed: Primary selector not found, continuing anyway...');
        await new Promise(resolve => setTimeout(resolve, 3000)); // Wait for content to load
      }

      // Scroll to load more
      for (let i = 0; i < 3; i++) {
        await page.evaluate(() => {
          window.scrollTo(0, document.body.scrollHeight);
        });
        await new Promise(resolve => setTimeout(resolve, 2000));
      }

      const jobCards = await page.evaluate(() => {
        // Enhanced selectors for Indeed (2025)
        const cards = Array.from(document.querySelectorAll(
          '[data-jk], .job_seen_beacon, .slider_container .jobCard, [data-testid="slider_item"], .jobCard, .result'
        ));
        
        return cards.map((card) => {
          try {
            // Enhanced selectors with multiple fallbacks
            const titleEl = card.querySelector('h2.jobTitle a, h2 a, a[data-jk], [data-testid="job-title"]') as HTMLElement;
            const companyEl = card.querySelector(
              '[data-testid="company-name"], .companyName, [data-testid="company-link"], span[data-testid="company-name"]'
            ) as HTMLElement;
            const locationEl = card.querySelector(
              '[data-testid="text-location"], .companyLocation, [data-testid="job-location"], [data-testid="job-metadata-location"]'
            ) as HTMLElement;
            const salaryEl = card.querySelector(
              '[data-testid="attribute_snippet_testid"], .salaryText, [data-testid="job-salary"], [data-testid="job-metadata-salary"]'
            ) as HTMLElement;
            const linkEl = card.querySelector('a.jobTitle, a[data-jk], h2.jobTitle a, [data-testid="job-title"]') as HTMLAnchorElement;

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
    const jobs: ScrapedJob[] = [];

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
      } catch (e) {
        logger.warn('Monster: Primary selector not found, continuing anyway...');
        await new Promise(resolve => setTimeout(resolve, 3000));
      }

      // Scroll to load more
      for (let i = 0; i < 3; i++) {
        await page.evaluate(() => {
          window.scrollTo(0, document.body.scrollHeight);
        });
        await new Promise(resolve => setTimeout(resolve, 2000));
      }

      const jobCards = await page.evaluate(() => {
        // Enhanced selectors for Monster (2025)
        const cards = Array.from(document.querySelectorAll(
          '[data-testid="job-card"], .card-content, .search-result, .job-card, article.card, .job-tile'
        ));
        
        return cards.map((card) => {
          try {
            // Enhanced selectors with multiple fallbacks
            const titleEl = card.querySelector(
              'h2 a, .title a, [data-testid="job-title"], h3 a, a[href*="/job/"]'
            ) as HTMLElement;
            const companyEl = card.querySelector(
              '.company, .employer, [data-testid="company-name"], [class*="company"], [class*="employer"]'
            ) as HTMLElement;
            const locationEl = card.querySelector(
              '.location, .job-location, [data-testid="job-location"], [class*="location"]'
            ) as HTMLElement;
            const linkEl = card.querySelector('h2 a, .title a, h3 a, a[href*="/job/"]') as HTMLAnchorElement;

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
  ): Promise<{ total: number; saved: number; bySource: Record<string, number> }> {
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
        saved: totalSaved,
        bySource: results,
      };
    } finally {
      // Keep browser open for potential reuse
      // await this.closeBrowser();
    }
  }
}

// Export singleton instance
export const scraperService = new ScraperService();

