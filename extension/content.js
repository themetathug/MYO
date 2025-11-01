// UK Jobs Insider - Enhanced Content Script
// Improved LinkedIn scraping with 2025 selectors

// Prevent multiple injections
if (typeof window.ukJobTrackerLoaded !== 'undefined') {
  console.log('⚠️ UK Job Tracker: Script already loaded, skipping...');
} else {
  window.ukJobTrackerLoaded = true;

const SITE_SELECTORS = {
  'linkedin.com': {
    // Updated LinkedIn selectors for 2025 - comprehensive list
    company: [
      // Job detail page selectors
      '.job-details-jobs-unified-top-card__company-name a',
      '.jobs-unified-top-card__company-name a',
      '[data-test-id="job-details-company-link"]',
      '.jobs-company__box a',
      '.jobs-unified-top-card__subtitle-primary-grouping a',
      // Applied jobs list selectors
      '.entity-result__primary-subtitle',
      '.job-card-container__company-name',
      '.job-card-list__entity-lockup span.job-card-container__primary-description',
      // Fallback selectors
      'div[class*="company-name"] a',
      'span[class*="company-name"]',
      '[data-control-name="company_link"]'
    ],
    position: [
      // Job detail page selectors
      '.jobs-unified-top-card__job-title h1',
      '.t-24.t-bold.inline',
      '[data-test-id="job-details-title"]',
      '.jobs-unified-top-card__job-title a',
      // Applied jobs list selectors
      '.entity-result__title-text a span span:first-child',
      '.job-card-list__title',
      '.job-card-container__link span[aria-hidden="true"]',
      // Fallback selectors
      'h1[class*="job-title"]',
      'h2[class*="job-title"]',
      'a[class*="job-title"] span'
    ],
    location: [
      '.jobs-unified-top-card__bullet',
      '.jobs-unified-top-card__workplace-type',
      '[data-test-id="job-location"]',
      '.job-card-container__metadata-item',
      '.entity-result__primary-subtitle + .entity-result__secondary-subtitle',
      'span[class*="location"]'
    ],
    salary: [
      '.jobs-unified-top-card__job-insight span:contains("$")',
      '.jobs-unified-top-card__job-insight span:contains("£")',
      '.jobs-unified-top-card__job-insight span:contains("€")',
      '.compensation__salary',
      '[data-test-id="job-details-salary"]'
    ],
    appliedDate: [
      '.entity-result__simple-insight-text',
      '.job-card-container__footer-item time',
      'time[datetime]'
    ],
    status: [
      '.entity-result__simple-insight-text',
      '.job-card-container__footer-info'
    ]
  },
  'indeed.com': {
    company: '[data-testid="company-name"], .jobsearch-InlineCompanyRating > div:first-child',
    position: '.jobsearch-JobInfoHeader-title, h1[data-testid="job-title"], .jobTitle h2',
    location: '[data-testid="job-location"], .jobsearch-JobInfoHeader-subtitle > div:nth-child(2)',
    salary: '[data-testid="job-salary"], .attribute_snippet, .salary-snippet',
    description: '#jobDescriptionText, .jobsearch-JobComponent-description'
  },
  'indeed.co.uk': {
    company: '[data-testid="company-name"], .jobsearch-InlineCompanyRating > div:first-child',
    position: '.jobsearch-JobInfoHeader-title, h1[data-testid="job-title"], .jobTitle h2',
    location: '[data-testid="job-location"], .jobsearch-JobInfoHeader-subtitle > div:nth-child(2)',
    salary: '[data-testid="job-salary"], .attribute_snippet, .salary-snippet',
    description: '#jobDescriptionText, .jobsearch-JobComponent-description'
  },
  'reed.co.uk': {
    company: '[itemprop="hiringOrganization"] [itemprop="name"], .company-name, .gtmJobListingPostedBy',
    position: 'h1[itemprop="title"], .job-header h1, h1.job-title',
    location: '[itemprop="jobLocation"] [itemprop="address"], .location, .job-location',
    salary: '[itemprop="baseSalary"], .salary, .job-salary',
    description: '[itemprop="description"], .description, .job-description'
  },
  'totaljobs.com': {
    company: '.company h2, [data-testid="job-company-name"], .job-company',
    position: '.job-title h1, [data-testid="job-title"], h1.brand-font',
    location: '.location, [data-testid="job-location"], .job-location',
    salary: '.salary, [data-testid="job-salary"], .job-salary',
    description: '.job-description, [data-testid="job-description"]'
  }
};

class JobCapture {
  constructor() {
    this.startTime = Date.now();
    this.currentJob = null;
    this.observer = null;
    this.applicationStartTime = null;
    this.isTracking = false;
    this.applicationDetected = false;
    this.trackingInterval = null;
    this.init();
  }

  init() {
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      console.log('📨 UK Job Tracker: Received message:', request.action);
      
      switch(request.action) {
        case 'captureJob':
          this.captureCurrentJob().then(sendResponse);
          return true;
        
        case 'captureMyJobs':
          this.captureLinkedInMyJobs().then(sendResponse);
          return true;
          
        case 'getToken':
          try {
            const token = localStorage.getItem('token');
            sendResponse({ token: token || null });
          } catch (e) {
            sendResponse({ token: null });
          }
          return true;

        case 'fetchAppliedJobs':
          this.fetchAppliedJobs().then(sendResponse);
          return true;

        case 'getJobDetails':
          sendResponse(this.currentJob);
          return true;

        case 'startTracking':
          this.startTimeTracking();
          sendResponse({ success: true });
          return true;

        case 'stopTracking':
          const timeSpent = this.stopTimeTracking();
          sendResponse({ timeSpent });
          return true;
          
        default:
          sendResponse({ success: false, error: 'Unknown action' });
      }
    });

    this.detectJobPage();
    this.observePageChanges();
    this.setupApplicationTracking();
  }

  // Enhanced text extraction with multiple selector support
  extractText(selectors, silent = false) {
    if (!selectors) return null;
    
    // Handle array of selectors (for LinkedIn)
    const selectorList = Array.isArray(selectors) ? selectors : [selectors];
    
    for (const selector of selectorList) {
      try {
        const element = document.querySelector(selector);
        if (element) {
          const text = element.textContent?.trim();
          if (text) {
            // Only log success if not in silent mode
            if (!silent) {
              console.log(`✅ Found text with selector "${selector}": ${text.substring(0, 50)}...`);
            }
            return text;
          }
        }
      } catch (e) {
        // Selector might be invalid, continue to next
        continue;
      }
    }
    
    // Only log warning if not in silent mode (suppress errors on "My Jobs" page)
    if (!silent) {
      console.log(`⚠️ No text found for selectors:`, selectorList);
    }
    return null;
  }

  // LinkedIn-specific job capture for "My Jobs" applied section
  async captureLinkedInMyJobs() {
    console.log('🔍 UK Job Tracker: Starting LinkedIn My Jobs capture...');
    console.log('📍 Current URL:', window.location.href);
    
    try {
      // Check if on correct page
      const url = window.location.href;
      if (!url.includes('linkedin.com/my-items/saved-jobs') || !url.includes('cardType=APPLIED')) {
        this.showNotification('❌ Please navigate to: linkedin.com/my-items/saved-jobs/?cardType=APPLIED', 'error');
        return { success: false, error: 'Not on applied jobs page', count: 0 };
      }
      
      // Wait for content to load with retry
      const contentLoaded = await this.waitForContentWithRetry(10000, 500);
      if (!contentLoaded) {
        console.warn('⚠️ Content may not be fully loaded, continuing anyway...');
      }
      
      // Scroll to load all jobs
      this.showNotification('📜 Scrolling to load all jobs...', 'info');
      await this.scrollToLoadAll();
      
      // Wait a bit more after scrolling
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const jobs = [];
      
      // Enhanced selector strategy - try multiple patterns
      console.log('🔍 Trying to find job cards with multiple selectors...');
      
      // Debug: Check what's actually on the page
      console.log('📊 Page structure debug:');
      const allLinks = document.querySelectorAll('a');
      const jobLinks = document.querySelectorAll('a[href*="/jobs/view/"]');
      const allLists = document.querySelectorAll('ul, ol');
      const listItems = document.querySelectorAll('li');
      
      console.log('  - All links:', allLinks.length);
      console.log('  - Job links:', jobLinks.length);
      console.log('  - Lists:', allLists.length);
      console.log('  - List items:', listItems.length);
      
      // If we have job links, prioritize link-based extraction (most reliable)
      if (jobLinks.length > 0) {
        console.log(`✅ Found ${jobLinks.length} job links - filtering and using link-based extraction`);
        
        // Filter out navigation links - only get actual job posting links
        const validJobLinks = Array.from(jobLinks).filter(link => {
          const href = link.href || '';
          const text = link.textContent?.trim() || '';
          const ariaLabel = link.getAttribute('aria-label') || '';
          
          // Skip navigation links
          if (text.toLowerCase().includes('skip to') || 
              text.toLowerCase().includes('my items') ||
              text.toLowerCase() === 'linkedin' ||
              text.length < 3 ||
              ariaLabel.toLowerCase().includes('skip')) {
            return false;
          }
          
          // Must have /jobs/view/ with a numeric ID
          if (!href.includes('/jobs/view/')) return false;
          const jobIdMatch = href.match(/\/jobs\/view\/(\d+)/);
          if (!jobIdMatch || !jobIdMatch[1]) return false;
          
          // Link should have meaningful text (not just navigation)
          if (text.length < 5 || text.length > 200) return false;
          
          return true;
        });
        
        console.log(`📋 Filtered to ${validJobLinks.length} valid job links (removed ${jobLinks.length - validJobLinks.length} nav links)`);
        
        if (validJobLinks.length === 0) {
          console.warn('⚠️ No valid job links after filtering - all were navigation links');
        } else {
          // Extract directly from valid job links
          const seenUrls = new Set();
          validJobLinks.forEach((link, linkIndex) => {
            try {
              const jobUrl = link.href.split('?')[0];
              const jobIdMatch = jobUrl.match(/\/jobs\/view\/(\d+)/);
              if (!jobIdMatch) return; // Shouldn't happen after filtering, but double-check
              
              if (seenUrls.has(jobUrl)) return;
              seenUrls.add(jobUrl);
            
            // Walk up DOM to find the card container (up to 15 levels)
            let container = link;
            let bestContainer = link.parentElement;
            
            for (let i = 0; i < 15; i++) {
              container = container?.parentElement;
              if (!container || container === document.body) break;
              
              if (container.tagName === 'LI' || 
                  container.tagName === 'DIV' ||
                  container.classList.length > 0 ||
                  container.querySelectorAll('span, div').length > 2) {
                bestContainer = container;
              }
            }
            
            // Extract position - be more selective
            let position = '';
            
            // Method 1: Get text from link (but filter out navigation text)
            const linkText = link.textContent?.trim() || '';
            const linkAriaLabel = link.getAttribute('aria-label')?.trim() || '';
            
            // Only use link text if it looks like a job title
            if (linkText && 
                linkText.length >= 5 && 
                linkText.length <= 200 &&
                !linkText.toLowerCase().includes('skip') &&
                !linkText.toLowerCase().includes('my items') &&
                !linkText.match(/^\d+$/) &&
                linkText.match(/[a-zA-Z]{3,}/)) { // Has at least 3 letters
              position = linkText;
            }
            
            // Method 2: Get from aria-label if link text is invalid
            if ((!position || position.length < 5) && linkAriaLabel && 
                linkAriaLabel.length >= 5 && 
                linkAriaLabel.length <= 200 &&
                !linkAriaLabel.toLowerCase().includes('skip')) {
              position = linkAriaLabel;
            }
            
            // Method 3: Find in nested spans of the link
            if ((!position || position.length < 5)) {
              const nestedSpans = link.querySelectorAll('span');
              for (const span of nestedSpans) {
                const spanText = span.textContent?.trim();
                if (spanText && 
                    spanText.length >= 5 && 
                    spanText.length <= 200 &&
                    !spanText.toLowerCase().includes('skip') &&
                    spanText.match(/[a-zA-Z]{3,}/)) {
                  position = spanText;
                  break;
                }
              }
            }
            
            // Method 4: Try finding in container (but be selective)
            if (!position || position.length < 5) {
              const titleElements = bestContainer?.querySelectorAll('h1, h2, h3, h4, h5, strong, [class*="title"], [class*="job-title"]');
              for (const titleEl of titleElements || []) {
                const text = titleEl.textContent?.trim();
                if (text && 
                    text.length >= 5 && 
                    text.length <= 200 &&
                    !text.toLowerCase().includes('skip') &&
                    !text.toLowerCase().includes('my items') &&
                    text.match(/[a-zA-Z]{3,}/)) {
                  position = text;
                  break;
                }
              }
            }
            
            // Method 5: Extract from URL if all else fails (rare)
            if (!position || position.length < 5) {
              // Sometimes LinkedIn URLs have job title in them
              const urlParts = jobUrl.split('/');
              const lastPart = urlParts[urlParts.length - 1];
              if (lastPart && lastPart.length > 5 && lastPart.match(/[a-zA-Z]/)) {
                position = decodeURIComponent(lastPart).replace(/-/g, ' ');
              }
            }
            
            // Extract company
            let company = '';
            const companyLink = bestContainer?.querySelector('a[href*="/company/"]');
            if (companyLink) {
              company = companyLink.textContent?.trim();
            }
            
            if (!company) {
              const allTexts = Array.from(bestContainer?.querySelectorAll('span, div, p, a') || [])
                .map(el => el.textContent?.trim())
                .filter(text => {
                  return text && 
                         text.length > 2 && 
                         text.length < 100 && 
                         text !== position &&
                         !text.match(/^\d+\s*(day|week|month|hour|minute)/i) &&
                         !text.includes('Applied') &&
                         !text.includes('View') &&
                         !text.includes('Save') &&
                         !text.includes('Skip') &&
                         !text.includes('My items') &&
                         !text.match(/^\d+$/) &&
                         !text.toLowerCase().includes('linkedin') &&
                         text.match(/^[A-Z]/); // Company names usually start with capital
                });
              
              // Company is usually the first or second meaningful text after position
              if (allTexts.length > 0) {
                // Prefer shorter text (company names are usually 2-50 chars)
                const companyCandidates = allTexts.filter(t => t.length >= 2 && t.length <= 50);
                company = companyCandidates[0] || allTexts[0] || '';
                company = company.replace(/^at\s+/i, '').replace(/^company:\s*/i, '').trim();
              }
            }
            
            // Extract location
            let location = '';
            const locationPattern = /(Remote|Hybrid|On-site|London|Manchester|Birmingham|United Kingdom|UK|England|Scotland|Wales)/i;
            const containerText = bestContainer?.textContent || '';
            const locationMatch = containerText.match(locationPattern);
            if (locationMatch) {
              location = locationMatch[0];
            } else {
              const locationEl = bestContainer?.querySelector('[class*="location"], [class*="place"], [aria-label*="location"]');
              location = locationEl?.textContent?.trim() || '';
            }
            
            // Extract applied date
            const dateText = bestContainer?.textContent?.match(/(\d+\s*(day|week|month|hour|minute)s?\s*ago)/i);
            const appliedDate = dateText ? this.parseAppliedDate(dateText[0]) : new Date().toISOString();
            
            // Validate extracted data before adding
            if (position && 
                position.length >= 5 && 
                position.length <= 255 &&
                !position.toLowerCase().includes('skip') &&
                !position.toLowerCase().includes('my items') &&
                jobUrl && 
                jobUrl.includes('/jobs/view/')) {
              
              // Ensure jobUrl is a valid URL (backend validation requires this)
              let validJobUrl = jobUrl;
              if (!jobUrl.startsWith('http://') && !jobUrl.startsWith('https://')) {
                validJobUrl = `https://${jobUrl.replace(/^\/+/, '')}`;
              }
              
              // Backend schema expects:
              // - company: string (required, 1-255 chars)
              // - position: string (required, 1-255 chars)
              // - location: string (optional)
              // - jobBoardSource: string (optional)
              // - jobUrl: string.url() (optional, but must be valid URL if provided)
              // - status: enum (defaults to 'APPLIED')
              // - captureMethod: enum ('MANUAL', 'EXTENSION', 'EMAIL_SYNC', 'API') - NOT 'EXTENSION_LINK_BASED'
              // - applied_at: NOT in schema (backend sets it automatically)
              // - timestamp: NOT in schema
              const jobData = {
                position: position.substring(0, 255),
                company: (company && company !== 'Unknown Company' && company.length > 0) ? company.substring(0, 255) : 'Unknown Company',
                location: location && location !== 'Not specified' ? location.substring(0, 255) : undefined, // Use undefined instead of 'Not specified'
                jobBoardSource: 'LinkedIn',
                jobUrl: validJobUrl, // Must be valid URL format
                status: 'APPLIED',
                captureMethod: 'EXTENSION' // Backend only accepts: 'MANUAL', 'EXTENSION', 'EMAIL_SYNC', 'API'
                // Removed: applied_at, timestamp (not in backend schema)
              };
              
              jobs.push(jobData);
              console.log(`✅ [Link-based] Extracted job ${linkIndex + 1}/${validJobLinks.length}: "${jobData.position}" at ${jobData.company}`);
            } else {
              console.warn(`⚠️ Skipped invalid job link ${linkIndex + 1}:`, {
                position: position?.substring(0, 50),
                hasValidUrl: !!jobUrl,
                positionLength: position?.length
              });
            }
          } catch (err) {
            console.error(`❌ Error processing job link ${linkIndex + 1}:`, err);
          }
          });
          
          console.log(`📊 Extracted ${jobs.length} valid jobs from ${validJobLinks.length} job links`);
        }
        
        // If we successfully extracted from links, skip card-based methods
        if (jobs.length > 0) {
          console.log('✅ Successfully extracted jobs from links - skipping card-based extraction');
          // Continue to save to backend below
        }
      }
      
      // Method 1: Try entity-result cards (only if link extraction didn't work)
      if (jobs.length === 0) {
        let entityCards = document.querySelectorAll('.entity-result');
        console.log(`📋 Found ${entityCards.length} .entity-result cards`);
        
        // Method 1b: Try alternative entity selectors
        if (entityCards.length === 0) {
          entityCards = document.querySelectorAll('[class*="entity-result"], [class*="entityResult"], .artdeco-list__item');
          console.log(`📋 Found ${entityCards.length} alternative entity cards`);
        }
        
        if (entityCards.length > 0) {
        entityCards.forEach((card, index) => {
          try {
            // Extract job details from each card
            const titleElement = card.querySelector('.entity-result__title-text a span span:first-child') ||
                                card.querySelector('.entity-result__title-text');
            const companyElement = card.querySelector('.entity-result__primary-subtitle');
            const locationElement = card.querySelector('.entity-result__secondary-subtitle');
            const appliedElement = card.querySelector('.entity-result__simple-insight-text');
            const linkElement = card.querySelector('.entity-result__title-text a');
            
            const position = titleElement?.textContent?.trim();
            const company = companyElement?.textContent?.trim();
            const location = locationElement?.textContent?.trim();
            const appliedText = appliedElement?.textContent?.trim();
            const jobUrl = linkElement?.href;
            
            if (position && company) {
              // Ensure jobUrl is valid URL format
              let validJobUrl = jobUrl ? jobUrl.split('?')[0] : window.location.href;
              if (!validJobUrl.startsWith('http://') && !validJobUrl.startsWith('https://')) {
                validJobUrl = `https://${validJobUrl.replace(/^\/+/, '')}`;
              }
              
              const jobData = {
                position: position.substring(0, 255),
                company: company.replace(/^at\s+/, '').substring(0, 255), // Remove "at " prefix
                location: location && location !== 'Not specified' ? location.substring(0, 255) : undefined,
                jobUrl: validJobUrl,
                jobBoardSource: 'LinkedIn',
                status: this.parseApplicationStatus(appliedText),
                captureMethod: 'EXTENSION'
                // Removed: applied_at, timestamp (not in backend schema)
              };
              
              jobs.push(jobData);
              console.log(`✅ Captured job ${index + 1}:`, jobData.position, 'at', jobData.company);
            }
          } catch (err) {
            console.error(`Error parsing entity card ${index}:`, err);
          }
        });
        }
        
        // Method 2: Try job-card format (alternative LinkedIn format)
        let jobCards = document.querySelectorAll('.job-card-container, .jobs-search-results__list-item');
        console.log(`📋 Found ${jobCards.length} .job-card-container cards`);
        
        // Method 2b: Try more job card selectors
        if (jobCards.length === 0) {
          jobCards = document.querySelectorAll(
            '[class*="job-card"], [class*="jobCard"], [data-occludable-job-id], [data-chameleon-result-urn*="jobPosting"], li[class*="job"], div[class*="job-card"]'
          );
          console.log(`📋 Found ${jobCards.length} alternative job cards`);
        }
        
        // Combine all found cards
        const allCards = Array.from(entityCards || []).concat(Array.from(jobCards || []));
        console.log(`📊 Total unique cards found: ${allCards.length}`);
        
        if (allCards.length > 0) {
          // Process all found cards with enhanced extraction
          allCards.forEach((card, index) => {
            try {
            // Try multiple extraction strategies
            let titleElement, companyElement, locationElement, linkElement;
            
            // Strategy 1: Try entity-result format
            titleElement = card.querySelector('.entity-result__title-text a span span:first-child') ||
                          card.querySelector('.entity-result__title-text');
            companyElement = card.querySelector('.entity-result__primary-subtitle');
            locationElement = card.querySelector('.entity-result__secondary-subtitle');
            linkElement = card.querySelector('.entity-result__title-text a');
            
            // Strategy 2: Try job-card format
            if (!titleElement || !companyElement) {
              titleElement = card.querySelector('.job-card-list__title, .job-card-container__link span[aria-hidden="true"], h3 a, h2 a');
              companyElement = card.querySelector('.job-card-container__company-name, .job-card-container__primary-description, [class*="company"]');
              locationElement = card.querySelector('.job-card-container__metadata-item, [class*="location"]');
              linkElement = card.querySelector('a[href*="/jobs/view/"]');
            }
            
            // Strategy 3: Aggressive extraction from any links and text
            if (!linkElement) {
              linkElement = card.querySelector('a[href*="/jobs/view/"], a[href*="/jobs/"]');
            }
            if (!titleElement && linkElement) {
              titleElement = linkElement.querySelector('span, h2, h3') || linkElement;
            }
            if (!companyElement) {
              // Look for company name near the link
              const siblings = Array.from(card.children || []);
              for (const sibling of siblings) {
                const text = sibling.textContent?.trim();
                if (text && text.length > 2 && text.length < 100 && text !== titleElement?.textContent?.trim()) {
                  companyElement = sibling;
                  break;
                }
              }
            }
            
            const position = titleElement?.textContent?.trim() || 
                           linkElement?.textContent?.trim() || 
                           linkElement?.getAttribute('aria-label') || '';
            const company = companyElement?.textContent?.trim()?.replace(/^at\s+/, '') || '';
            const location = locationElement?.textContent?.trim() || '';
            const jobUrl = linkElement?.href;
            
            if (position && company && jobUrl) {
              // Ensure jobUrl is valid URL format
              let validJobUrl = jobUrl.split('?')[0];
              if (!validJobUrl.startsWith('http://') && !validJobUrl.startsWith('https://')) {
                validJobUrl = `https://${validJobUrl.replace(/^\/+/, '')}`;
              }
              
              const jobData = {
                position: position.substring(0, 255),
                company: company.substring(0, 255),
                location: location && location !== 'Not specified' ? location.substring(0, 255) : undefined,
                jobUrl: validJobUrl,
                jobBoardSource: 'LinkedIn',
                status: 'APPLIED',
                captureMethod: 'EXTENSION'
                // Removed: applied_at, timestamp (not in backend schema)
              };
              
              jobs.push(jobData);
              console.log(`✅ Captured job ${index + 1}/${allCards.length}:`, jobData.position, 'at', jobData.company);
            } else {
              console.warn(`⚠️ Skipped card ${index + 1}: Missing data`, { position: !!position, company: !!company, jobUrl: !!jobUrl });
            }
          } catch (err) {
            console.error(`❌ Error parsing job card ${index}:`, err);
          }
          });
        }
        
        // If still no jobs after all methods, show detailed error
        if (jobs.length === 0) {
          // Enhanced debugging - show what we actually found
          const allLinksFinal = document.querySelectorAll('a');
          const jobLinksFinal = document.querySelectorAll('a[href*="/jobs/view/"]');
          const jobLinksAny = document.querySelectorAll('a[href*="/jobs/"]');
          const allLists = document.querySelectorAll('ul, ol');
          const allDivs = document.querySelectorAll('div');
          
          console.error('❌ DEBUG: No jobs extracted after all methods. Page structure:');
          console.error('  - All links found:', allLinksFinal.length);
          console.error('  - Job view links:', jobLinksFinal.length);
          console.error('  - Any job links:', jobLinksAny.length);
          console.error('  - Lists found:', allLists.length);
          console.error('  - Divs found:', allDivs.length);
          
          // Try to find any elements that might be job containers
          const possibleContainers = document.querySelectorAll('[class*="result"], [class*="card"], [class*="item"], [class*="listing"], [class*="job"]');
          console.error('  - Possible job containers:', possibleContainers.length);
          
          // Sample a few job links to see their structure
          if (jobLinksFinal.length > 0) {
            const sampleLink = jobLinksFinal[0];
            let parent = sampleLink.parentElement;
            let grandparent = parent?.parentElement;
            let greatGrandparent = grandparent?.parentElement;
            
            console.error('  - Sample job link #1 structure:', {
              href: sampleLink.href,
              text: sampleLink.textContent?.substring(0, 80),
              linkClass: sampleLink.className,
              parentTag: parent?.tagName,
              parentClass: parent?.className?.substring(0, 100),
              grandparentTag: grandparent?.tagName,
              grandparentClass: grandparent?.className?.substring(0, 100),
              greatGrandparentClass: greatGrandparent?.className?.substring(0, 100)
            });
            
            // Try manual extraction from first link as example
            console.error('  - Manual extraction test:', {
              position: sampleLink.textContent?.trim() || sampleLink.getAttribute('aria-label'),
              containerText: parent?.textContent?.substring(0, 200)
            });
          }
          
          // Show page title and URL to confirm we're on the right page
          console.error('  - Page URL:', window.location.href);
          console.error('  - Page title:', document.title);
          console.error('  - URL contains "cardType=APPLIED":', window.location.href.includes('cardType=APPLIED'));
          
          this.showNotification('⚠️ No jobs found. Make sure you are on LinkedIn "My Jobs → Applied" page and jobs are visible. Check console (F12) for detailed debugging info.', 'error');
          return { success: false, error: 'No jobs found on page', count: 0 };
        }
      }
      
      console.log(`📊 Total jobs captured: ${jobs.length}`);
      this.showNotification(`✅ Found ${jobs.length} applied jobs! Sending to dashboard...`, 'success');
      
      // Save to backend
      await this.bulkSaveToBackend(jobs);
      
      return {
        success: true,
        count: jobs.length,
        jobs: jobs
      };
      
    } catch (error) {
      console.error('❌ Error capturing LinkedIn jobs:', error);
      this.showNotification(`❌ Error: ${error.message}`, 'error');
      return {
        success: false,
        error: error.message,
        count: 0
      };
    }
  }

  // Scroll to load all jobs
  async scrollToLoadAll() {
    let previousHeight = 0;
    let scrollAttempts = 0;
    const maxScrollAttempts = 20;
    
    while (scrollAttempts < maxScrollAttempts) {
      window.scrollTo(0, document.body.scrollHeight);
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const currentHeight = document.body.scrollHeight;
      if (currentHeight === previousHeight) {
        break;
      }
      previousHeight = currentHeight;
      scrollAttempts++;
    }
    
    // Scroll back to top
    window.scrollTo(0, 0);
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  // Helper to parse LinkedIn's applied date format
  parseAppliedDate(text) {
    if (!text) return new Date().toISOString();
    
    const now = new Date();
    
    if (text.includes('hour') || text.includes('minute')) {
      return now.toISOString();
    }
    
    const daysMatch = text.match(/(\d+)\s*day/);
    if (daysMatch) {
      const days = parseInt(daysMatch[1]);
      now.setDate(now.getDate() - days);
      return now.toISOString();
    }
    
    const weeksMatch = text.match(/(\d+)\s*week/);
    if (weeksMatch) {
      const weeks = parseInt(weeksMatch[1]);
      now.setDate(now.getDate() - (weeks * 7));
      return now.toISOString();
    }
    
    const monthsMatch = text.match(/(\d+)\s*month/);
    if (monthsMatch) {
      const months = parseInt(monthsMatch[1]);
      now.setMonth(now.getMonth() - months);
      return now.toISOString();
    }
    
    return now.toISOString();
  }

  // Parse application status from LinkedIn text
  parseApplicationStatus(text) {
    if (!text) return 'APPLIED';
    
    const lowerText = text.toLowerCase();
    if (lowerText.includes('viewed')) return 'VIEWED';
    if (lowerText.includes('in progress')) return 'IN_PROGRESS';
    if (lowerText.includes('not selected')) return 'REJECTED';
    if (lowerText.includes('interview')) return 'INTERVIEW';
    
    return 'APPLIED';
  }

  // Wait for content to load with retry
  async waitForContentWithRetry(timeout = 10000, interval = 500) {
    const startTime = Date.now();
    let attempts = 0;
    
    while (Date.now() - startTime < timeout) {
      attempts++;
      
      // Check multiple indicators that content is loaded
      const hasEntityCards = document.querySelector('.entity-result');
      const hasJobCards = document.querySelector('.job-card-container, [class*="job-card"]');
      const hasJobLinks = document.querySelectorAll('a[href*="/jobs/view/"]').length > 0;
      const hasLists = document.querySelectorAll('ul, ol').length > 0;
      const hasMainContent = document.querySelector('main, [role="main"]');
      
      console.log(`⏳ Waiting for content (attempt ${attempts})...`, {
        entityCards: !!hasEntityCards,
        jobCards: !!hasJobCards,
        jobLinks: hasJobLinks,
        lists: hasLists > 0,
        mainContent: !!hasMainContent
      });
      
      if (hasEntityCards || hasJobCards || hasJobLinks) {
        console.log('✅ Content loaded after', attempts, 'attempts');
        return true;
      }
      
      await new Promise(resolve => setTimeout(resolve, interval));
    }
    
    console.log('⚠️ Timeout waiting for content after', attempts, 'attempts');
    return false;
  }

  // Wait for content to load (backward compatibility)
  async waitForContent(timeout = 5000) {
    return this.waitForContentWithRetry(timeout, 500);
  }

  // Bulk save jobs to backend
  async bulkSaveToBackend(jobs) {
    try {
      let token = null;
      
      // Get token from chrome storage
      const storageResult = await chrome.storage.local.get(['token']);
      token = storageResult.token;
      
      // If no token in storage, try page localStorage
      if (!token) {
        try {
          token = localStorage.getItem('token');
          if (token) {
            await chrome.storage.local.set({ token });
          }
        } catch (e) {
          console.warn('Cannot access localStorage from content script');
        }
      }
      
      if (!token) {
        throw new Error('No auth token found. Please login at http://localhost:3000 and sync token via extension popup.');
      }
      
      console.log(`📤 Sending ${jobs.length} jobs to backend...`);
      
      let successCount = 0;
      let failCount = 0;
      
      const failedJobsDetails = [];
      
      for (const job of jobs) {
        try {
          // Log what we're sending (first job only, to avoid spam)
          if (successCount + failCount === 0) {
            console.log('📤 Sample job data being sent:', {
              position: job.position,
              company: job.company,
              location: job.location,
              jobUrl: job.jobUrl,
              jobBoardSource: job.jobBoardSource,
              status: job.status,
              applied_at: job.applied_at
            });
          }
          
          const response = await fetch('http://localhost:3001/api/applications', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(job)
          });
          
          if (response.ok) {
            successCount++;
            const result = await response.json().catch(() => ({}));
            if (successCount === 1) {
              console.log('✅ First job saved successfully:', result);
            }
          } else {
            failCount++;
            
            // Try to get detailed error from backend
            let errorData = {};
            let errorText = '';
            try {
              const contentType = response.headers.get('content-type');
              if (contentType && contentType.includes('application/json')) {
                errorData = await response.json();
              } else {
                errorText = await response.text();
              }
            } catch (e) {
              errorText = `Failed to parse error response: ${e.message}`;
            }
            
            const errorDetails = {
              position: job.position,
              company: job.company,
              status: response.status,
              statusText: response.statusText,
              error: errorData.message || errorData.error || errorText || 'Unknown error',
              validationErrors: errorData.errors || errorData.details || null,
              fullError: errorData,
              jobData: {
                position: job.position,
                company: job.company,
                location: job.location,
                jobUrl: job.jobUrl,
                status: job.status,
                applied_at: job.applied_at
              }
            };
            
            failedJobsDetails.push(errorDetails);
            
            console.error(`❌ Failed to save job #${failCount}:`, errorDetails);
            console.error(`   Full job data:`, JSON.stringify(job, null, 2));
          }
        } catch (err) {
          failCount++;
          const errorDetails = {
            position: job.position,
            company: job.company,
            error: err.message,
            stack: err.stack,
            jobData: job
          };
          failedJobsDetails.push(errorDetails);
          console.error(`❌ Network/Exception error saving job "${job.position}":`, err);
          console.error(`   Full error:`, err);
          console.error(`   Job data:`, JSON.stringify(job, null, 2));
        }
      }
      
      console.log(`✅ Bulk import complete: ${successCount} successful, ${failCount} failed`);
      
      if (failCount > 0) {
        // Show detailed failure summary
        console.error(`\n❌ ========== FAILED JOBS SUMMARY ==========`);
        failedJobsDetails.forEach((detail, index) => {
          console.error(`\n${index + 1}. "${detail.position}" at "${detail.company}"`);
          console.error(`   Status: ${detail.status} ${detail.statusText || ''}`);
          console.error(`   Error: ${detail.error}`);
          if (detail.validationErrors) {
            console.error(`   Validation Errors:`, detail.validationErrors);
          }
          if (detail.error && detail.error.includes('duplicate')) {
            console.error(`   ⚠️ This job may already exist in your dashboard`);
          }
        });
        console.error(`\n==========================================\n`);
        
        const errorMsg = `${failCount} jobs failed to import. See detailed errors above.`;
        this.showNotification(`⚠️ Imported ${successCount} jobs, but ${failCount} failed. Check console (F12) for details.`, 'error');
        throw new Error(errorMsg);
      } else {
        this.showNotification(`✅ Successfully imported ${successCount} jobs to dashboard!`, 'success');
      }
    } catch (error) {
      console.error('❌ Bulk backend save error:', error);
      this.showNotification(`❌ Error: ${error.message}`, 'error');
      throw error;
    }
  }

  // Enhanced job capture for regular job detail pages
  async captureCurrentJob() {
    try {
      const currentUrl = window.location.href;
      
      // If on LinkedIn "My Jobs" page, redirect to bulk capture instead
      if (currentUrl.includes('/my-items/saved-jobs')) {
        console.log('📋 Detected LinkedIn "My Jobs" page - redirecting to bulk capture...');
        return this.captureLinkedInMyJobs();
      }
      
      // Only proceed if we're on an actual job detail page
      const isJobDetailPage = currentUrl.includes('/jobs/view/') || 
                              currentUrl.includes('/jobs/search/');
      
      if (!isJobDetailPage) {
        // Silently return if not on a job page - don't show errors
        console.log('ℹ️ Not on a job detail page. Use "Capture My Applied Jobs" button for bulk import.');
        return {
          success: false,
          message: 'Please navigate to a job detail page or use "Capture My Applied Jobs" for bulk import.',
          count: 0
        };
      }
      
      console.log('🔍 UK Job Tracker: Starting job capture...', currentUrl);
      const hostname = window.location.hostname;
      const selectors = this.getSelectorsForSite(hostname);
      
      if (!selectors) {
        console.warn('⚠️ No specific selectors found, using generic capture');
        return this.genericCapture();
      }
      
      console.log('✅ Found selectors for:', hostname);
      
      // Use silent mode to suppress error messages for selectors
      const company = this.extractText(selectors.company, true);
      const position = this.extractText(selectors.position, true);
      const location = this.extractText(selectors.location, true);
      const salary = this.extractText(selectors.salary, true);
      
      // Only log if we're on a job detail page and found data
      if (company || position) {
        console.log('📋 Captured data:', {
          company: company || '(not found)',
          position: position || '(not found)',
          location: location || '(not found)',
          salary: salary || '(not found)'
        });
      }
      
      const jobDetails = {
        company: company || '',
        position: position || '',
        location: location || '',
        salary: salary || '',
        jobUrl: window.location.href,
        jobBoardSource: this.getSourceName(hostname),
        captureMethod: 'EXTENSION',
        timestamp: new Date().toISOString()
      };
      
      // Validate captured data
      if (!jobDetails.company || !jobDetails.position) {
        // If on "My Jobs" page, don't try fallback - just return silently
        if (currentUrl.includes('/my-items/saved-jobs')) {
          return {
            success: false,
            message: 'Use "Capture My Applied Jobs" button for bulk import.',
            count: 0
          };
        }
        console.warn('⚠️ Missing critical data, trying fallback capture...');
        return this.fallbackCapture(jobDetails);
      }
      
      this.currentJob = jobDetails;
      
      // Show success notification
      this.showNotification('✅ Job details captured successfully!', 'success');
      
      // Send to backend
      this.sendToBackend(jobDetails).catch(err => {
        console.warn('⚠️ Backend save failed (will sync later):', err);
      });
      
      return { success: true, data: jobDetails };
      
    } catch (error) {
      console.error('❌ Error capturing job:', error);
      this.showNotification(`❌ Error: ${error.message}`, 'error');
      return { success: false, error: error.message };
    }
  }

  // Fallback capture using more aggressive methods
  async fallbackCapture(partialData = {}) {
    console.log('🔄 Attempting fallback capture...');
    
    // Try to get company from meta tags
    if (!partialData.company) {
      const orgMeta = document.querySelector('meta[property="og:site_name"]');
      const authorMeta = document.querySelector('meta[name="author"]');
      partialData.company = orgMeta?.content || authorMeta?.content || '';
    }
    
    // Try to get position from title or h1
    if (!partialData.position) {
      const pageTitle = document.title;
      const h1 = document.querySelector('h1');
      partialData.position = h1?.textContent?.trim() || pageTitle.split('|')[0]?.trim() || '';
    }
    
    return {
      success: true,
      data: partialData
    };
  }

  // Generic capture for unknown sites
  genericCapture() {
    const title = document.title;
    const h1 = document.querySelector('h1')?.textContent?.trim();
    const h2 = document.querySelector('h2')?.textContent?.trim();
    
    return {
      success: true,
      data: {
        company: '',
        position: h1 || title.split('|')[0]?.trim() || '',
        location: '',
        salary: '',
        jobUrl: window.location.href,
        jobBoardSource: 'Other',
        notes: `Auto-captured from: ${window.location.hostname}`,
        captureMethod: 'GENERIC'
      }
    };
  }

  // Send job data to backend
  async sendToBackend(jobData) {
    let token = null;
    
    // Get token from chrome storage
    const storageResult = await chrome.storage.local.get(['token']);
    token = storageResult.token;
    
    // If no token in storage, try page localStorage
    if (!token) {
      try {
        token = localStorage.getItem('token');
        if (token) {
          await chrome.storage.local.set({ token });
        }
      } catch (e) {
        console.warn('Cannot access localStorage from content script');
      }
    }
    
    if (!token) {
      console.warn('⚠️ No auth token, storing locally');
      await this.storeJobsLocally([jobData]);
      return;
    }
    
    const response = await fetch('http://localhost:3001/api/applications', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(jobData)
    });
    
    if (!response.ok) {
      throw new Error('Failed to save to backend');
    }
    
    return response.json();
  }

  // Store jobs locally for later sync
  async storeJobsLocally(jobs) {
    const { capturedJobs = [] } = await chrome.storage.local.get(['capturedJobs']);
    const updatedJobs = [...capturedJobs, ...jobs];
    await chrome.storage.local.set({ capturedJobs: updatedJobs });
    console.log(`💾 Stored ${jobs.length} jobs locally for later sync`);
  }

  // Fetch applied jobs from backend
  async fetchAppliedJobs() {
    try {
      let token = null;
      const storageResult = await chrome.storage.local.get(['token']);
      token = storageResult.token;
      
      if (!token && window.location.hostname === 'localhost' && window.location.port === '3000') {
        try {
          token = localStorage.getItem('token');
          if (token) {
            await chrome.storage.local.set({ token });
          }
        } catch (e) {}
      }
      
      if (!token) {
        this.showNotification('❌ No auth token found. Please login and sync token.', 'error');
        return { success: false, error: 'No auth token found' };
      }
      
      const response = await fetch('http://localhost:3001/api/applications', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      
      if (!response.ok) {
        return { success: false, error: `Backend returned ${response.status}` };
      }
      
      const jobs = await response.json();
      return { success: true, data: jobs };
    } catch (error) {
      console.error('❌ Error fetching applied jobs:', error);
      this.showNotification('❌ Error fetching applied jobs. See console for details.', 'error');
      return { success: false, error: (error && error.message) || 'Unknown error' };
    }
  }

  // Show notification
  showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `uk-jobs-notification uk-jobs-notification-${type}`;
    notification.textContent = message;
    
    const bgColor = type === 'success' ? '#10b981' : 
                    type === 'error' ? '#ef4444' : 
                    '#3b82f6';
    
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      padding: 12px 20px;
      border-radius: 8px;
      font-size: 14px;
      font-weight: 500;
      z-index: 10000;
      animation: slideIn 0.3s ease;
      max-width: 300px;
      box-shadow: 0 4px 6px rgba(0,0,0,0.1);
      background: ${bgColor};
      color: white;
      font-family: system-ui, -apple-system, sans-serif;
    `;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
      notification.style.animation = 'slideOut 0.3s ease';
      setTimeout(() => notification.remove(), 300);
    }, 3000);
  }

  // Get site-specific selectors
  getSelectorsForSite(hostname) {
    for (const [site, selectors] of Object.entries(SITE_SELECTORS)) {
      if (hostname.includes(site)) {
        return selectors;
      }
    }
    return null;
  }

  // Get source name from hostname
  getSourceName(hostname) {
    if (hostname.includes('linkedin.com')) return 'LinkedIn';
    if (hostname.includes('indeed.com')) return 'Indeed';
    if (hostname.includes('indeed.co.uk')) return 'Indeed UK';
    if (hostname.includes('reed.co.uk')) return 'Reed';
    if (hostname.includes('totaljobs.com')) return 'TotalJobs';
    if (hostname.includes('glassdoor')) return 'Glassdoor';
    if (hostname.includes('monster')) return 'Monster';
    return 'Other';
  }

  // Detect if on a job page
  detectJobPage() {
    const url = window.location.href;
    
    // Check for LinkedIn My Jobs page
    if (url.includes('linkedin.com/my-items/saved-jobs') && url.includes('cardType=APPLIED')) {
      console.log('🎯 LinkedIn Applied Jobs page detected!');
      this.showNotification('📋 Click extension icon to import all your applied jobs!', 'info');
      return;
    }
    
    // Check for job detail pages
    const isJobDetailPage = 
      url.includes('/jobs/view/') ||
      url.includes('/viewjob') ||
      url.match(/\/job\/\d+/) ||
      url.includes('currentJobId=');
    
    if (isJobDetailPage) {
      console.log('✅ Job detail page detected');
      setTimeout(() => this.captureCurrentJob(), 2000);
    }
  }

  // Observe page changes for SPAs
  observePageChanges() {
    let lastUrl = window.location.href;
    
    const observer = new MutationObserver(() => {
      const currentUrl = window.location.href;
      if (currentUrl !== lastUrl) {
        lastUrl = currentUrl;
        this.detectJobPage();
      }
    });
    
    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  }

  // Time tracking methods
  startTimeTracking() {
    this.startTime = Date.now();
    chrome.storage.local.set({ trackingStartTime: this.startTime });
  }

  stopTimeTracking() {
    const endTime = Date.now();
    const timeSpent = Math.floor((endTime - this.startTime) / 1000);
    chrome.storage.local.remove(['trackingStartTime']);
    return timeSpent;
  }

  // Application tracking setup
  setupApplicationTracking() {
    document.addEventListener('click', (e) => {
      const target = e.target;
      const buttonText = (target.textContent || '').toLowerCase();
      const isApplyButton = 
        buttonText.includes('apply') ||
        buttonText.includes('submit application');
      
      if (isApplyButton && !this.isTracking) {
        this.startApplicationTracking();
      }
    });
  }

  startApplicationTracking() {
    if (this.isTracking) return;
    this.applicationStartTime = Date.now();
    this.isTracking = true;
    this.applicationDetected = false;
    this.showNotification('⏱️ Tracking application time...', 'info');
  }
}

// Add CSS animation
const style = document.createElement('style');
style.textContent = `
  @keyframes slideIn {
    from { transform: translateX(100%); opacity: 0; }
    to { transform: translateX(0); opacity: 1; }
  }
  @keyframes slideOut {
    from { transform: translateX(0); opacity: 1; }
    to { transform: translateX(100%); opacity: 0; }
  }
`;
document.head.appendChild(style);

// Initialize job capture
const jobCapture = new JobCapture();
console.log('✅ UK Jobs Insider content script loaded successfully');

} // End of window.ukJobTrackerLoaded guard
