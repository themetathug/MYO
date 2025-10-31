// Content script for UK Jobs Insider Job Tracker
// Plain JavaScript (no TypeScript syntax) for Chrome content scripts

// Site-specific selectors for job boards
const SITE_SELECTORS = {
  'linkedin.com': {
    company: '.job-details-jobs-unified-top-card__company-name a, .topcard__org-name-link, .jobs-details-top-card__company-name, [data-test-id="job-poster-name"]',
    position: '.job-details-jobs-unified-top-card__job-title h1, .topcard__title, .jobs-details-top-card__job-title, h1.job-details-jobs-unified-top-card__job-title',
    location: '.job-details-jobs-unified-top-card__bullet, .topcard__flavor--bullet, .jobs-details-top-card__bullet, .job-details-jobs-unified-top-card__primary-description-without-tagline',
    salary: '.salary-main-rail-card__salary-range, .compensation__salary, .job-details-jobs-unified-top-card__job-insight',
    description: '.jobs-description__content, .description__text, .jobs-description-content__text, .jobs-box__html-content',
  },
  'indeed.com': {
    company: '[data-testid="company-name"], .jobsearch-InlineCompanyRating > div:first-child',
    position: '.jobsearch-JobInfoHeader-title, h1[data-testid="job-title"]',
    location: '[data-testid="job-location"], .jobsearch-JobInfoHeader-subtitle > div:nth-child(2)',
    salary: '[data-testid="job-salary"], .attribute_snippet',
    description: '#jobDescriptionText, .jobsearch-JobComponent-description',
  },
  'indeed.co.uk': {
    company: '[data-testid="company-name"], .jobsearch-InlineCompanyRating > div:first-child',
    position: '.jobsearch-JobInfoHeader-title, h1[data-testid="job-title"]',
    location: '[data-testid="job-location"], .jobsearch-JobInfoHeader-subtitle > div:nth-child(2)',
    salary: '[data-testid="job-salary"], .attribute_snippet',
    description: '#jobDescriptionText, .jobsearch-JobComponent-description',
  },
  'reed.co.uk': {
    company: '[itemprop="hiringOrganization"] [itemprop="name"], .company-name',
    position: 'h1[itemprop="title"], .job-header h1',
    location: '[itemprop="jobLocation"] [itemprop="address"], .location',
    salary: '[itemprop="baseSalary"], .salary',
    description: '[itemprop="description"], .description',
  },
  'totaljobs.com': {
    company: '.company h2, [data-testid="job-company-name"]',
    position: '.job-title h1, [data-testid="job-title"]',
    location: '.location, [data-testid="job-location"]',
    salary: '.salary, [data-testid="job-salary"]',
    description: '.job-description, [data-testid="job-description"]',
  },
};

// Job capture class
class JobCapture {
  constructor() {
    this.startTime = Date.now();
    this.currentJob = null;
    this.observer = null;
    this.init();
  }

  init() {
    // Listen for messages from popup or background
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      if (request.action === 'captureJob') {
        this.captureCurrentJob().then(sendResponse);
        return true; // Keep message channel open for async response
      }
      
      if (request.action === 'getJobDetails') {
        sendResponse(this.currentJob);
      }

      if (request.action === 'fetchAppliedJobs') {
        this.fetchAppliedJobs().then(sendResponse);
        return true;
      }

      if (request.action === 'scrapeLinkedInAppliedJobs') {
        this.scrapeLinkedInAppliedJobs().then(sendResponse);
        return true;
      }

      if (request.action === 'getToken') {
        // Return token from localStorage if on frontend domain
        try {
          const token = localStorage.getItem('token');
          sendResponse({ token: token || null });
        } catch (e) {
          sendResponse({ token: null });
        }
        return true;
      }

      if (request.action === 'startTracking') {
        this.startTimeTracking();
        sendResponse({ success: true });
      }

      if (request.action === 'stopTracking') {
        const timeSpent = this.stopTimeTracking();
        sendResponse({ timeSpent });
      }

      if (request.action === 'captureMyJobs') {
        this.captureLinkedInMyJobs().then(sendResponse);
        return true; // Keep message channel open for async response
      }
    });

    // Auto-detect when on a job page
    this.detectJobPage();
    this.observePageChanges();
  }

  detectJobPage() {
    const url = window.location.href;
    
    // Check if on LinkedIn "My Jobs" page
    if (url.includes('linkedin.com/my-items/') || url.includes('linkedin.com/jobs/collections/')) {
      console.log('🎯 UK Job Tracker: LinkedIn My Jobs page detected!');
      this.showNotification('📋 Open extension popup and click "Capture My Applied Jobs" to import your job list!', 'info');
      return;
    }
    
    // Only capture on actual job detail pages, NOT listing pages
    const isJobDetailPage = 
      url.includes('/jobs/view/') ||  // LinkedIn: https://linkedin.com/jobs/view/123456
      url.match(/\/jobs\/collections\/.*\?currentJobId=\d+/) || // LinkedIn collections with job ID
      url.includes('/viewjob') ||  // Indeed old format
      url.match(/\/job\/\d+/) ||  // Indeed: /job/123456
      url.includes('/rc/clk') ||  // Indeed redirect
      url.match(/\/jobs\/search\/.*\?currentJobId=\d+/) || // LinkedIn search with job ID
      (url.includes('/job/') && !url.includes('/jobs/')); // Other sites: /job/123

    if (isJobDetailPage) {
      console.log('✅ UK Job Tracker: Detected job detail page:', url);
      // Wait for page to load then capture
      setTimeout(() => this.captureCurrentJob(), 2000);
    } else {
      // Check if we're on LinkedIn jobs listing
      if (url.includes('linkedin.com/jobs') && !url.includes('/view/') && !url.includes('currentJobId=')) {
        this.showNotification('📋 Tip: Click on any job to open details - extension will auto-capture!', 'info');
      }
      console.log('ℹ️ UK Job Tracker: On listing page. 💡 CLICK on a job to open detail page - extension will auto-capture!');
    }
  }

  observePageChanges() {
    // Observe URL changes for SPAs
    let lastUrl = location.href;
    this.observer = new MutationObserver(() => {
      const url = location.href;
      if (url !== lastUrl) {
        lastUrl = url;
        this.detectJobPage();
      }
    });

    this.observer.observe(document.body, {
      childList: true,
      subtree: true,
    });
  }

  async captureLinkedInMyJobs() {
    try {
      console.log('🎯 UK Job Tracker: Capturing LinkedIn My Jobs list...');
      this.showNotification('🔄 Scanning your applied jobs...', 'info');
      
      // Wait a moment for page to be fully loaded
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const jobs = [];
      
      // LinkedIn My Jobs selectors (as of 2025)
      const jobCards = document.querySelectorAll('[data-test-job-card], .jobs-search-results__list-item, .reusable-search__result-container, .scaffold-layout__list-item');
      
      console.log(`📋 Found ${jobCards.length} job cards on page`);
      
      if (jobCards.length === 0) {
        this.showNotification('⚠️ No job cards found. Make sure you clicked "Applied" tab.', 'error');
        return { success: false, error: 'No job cards found', count: 0 };
      }
      
      for (const card of jobCards) {
        try {
          const company = card.querySelector('.job-card-container__primary-description, .job-card-list__company-name, [data-test-job-card-company-name]')?.textContent?.trim();
          const position = card.querySelector('.job-card-list__title, .job-card-container__link, [data-test-job-card-title]')?.textContent?.trim();
          const location = card.querySelector('.job-card-container__metadata-item, .job-card-list__footer-item, [data-test-job-card-location]')?.textContent?.trim();
          
          // Parse applied date from "Applied 23h ago", "Applied 1d ago", etc.
          const appliedText = card.querySelector('[data-test-job-card-footer-time], .job-card-container__footer-time-badge, .job-card-list__footer-time-badge')?.textContent?.trim();
          const appliedDate = this.parseAppliedDate(appliedText);
          
          if (company && position) {
            jobs.push({
              company: company,
              position: position,
              location: location || 'Not specified',
              jobUrl: 'https://www.linkedin.com/jobs/', // Generic LinkedIn URL
              jobBoardSource: 'LinkedIn',
              status: 'APPLIED',
              captureMethod: 'EXTENSION',
              applied_at: appliedDate,
            });
          }
        } catch (err) {
          console.warn('⚠️ Error parsing job card:', err);
        }
      }
      
      if (jobs.length === 0) {
        this.showNotification('⚠️ Could not extract job details. LinkedIn may have changed their layout.', 'error');
        return { success: false, error: 'Could not extract job data', count: 0 };
      }
      
      console.log(`✅ Captured ${jobs.length} jobs, sending to backend...`);
      this.showNotification(`📤 Sending ${jobs.length} jobs to backend...`, 'info');
      
      // Send jobs in bulk to backend
      await this.sendJobsBulkToBackend(jobs);
      
      this.showNotification(`✅ Successfully imported ${jobs.length} jobs!`, 'success');
      return { success: true, count: jobs.length, jobs };
      
    } catch (error) {
      console.error('❌ Error capturing My Jobs:', error);
      this.showNotification(`❌ Error: ${error.message}`, 'error');
      return { success: false, error: error.message, count: 0 };
    }
  }

  parseAppliedDate(appliedText) {
    if (!appliedText) return new Date().toISOString();
    
    const now = new Date();
    
    // Match patterns like "23h ago", "1d ago", "2w ago"
    const match = appliedText.match(/(\d+)\s*(h|d|w|mo)/i);
    if (match) {
      const value = parseInt(match[1]);
      const unit = match[2].toLowerCase();
      
      if (unit === 'h') {
        now.setHours(now.getHours() - value);
      } else if (unit === 'd') {
        now.setDate(now.getDate() - value);
      } else if (unit === 'w') {
        now.setDate(now.getDate() - (value * 7));
      } else if (unit === 'mo') {
        now.setMonth(now.getMonth() - value);
      }
    }
    
    return now.toISOString();
  }

  async sendJobsBulkToBackend(jobs) {
    try {
      let token = null;
      
      // Get token from chrome storage
      const storageResult = await chrome.storage.local.get(['token']);
      token = storageResult.token;
      
      // If no token in storage, try page localStorage
      if (!token) {
        try {
          token = localStorage.getItem('token');
        } catch (e) {
          console.warn('Cannot access localStorage from content script');
        }
      }
      
      if (!token) {
        throw new Error('No auth token found. Please login and sync token via extension popup.');
      }
      
      console.log('🚀 Sending bulk jobs to backend...');
      
      // Send jobs one by one (or implement a bulk endpoint)
      let successCount = 0;
      let failCount = 0;
      
      for (const job of jobs) {
        try {
          const response = await fetch('http://localhost:3001/api/applications', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`,
            },
            body: JSON.stringify(job),
          });
          
          if (response.ok) {
            successCount++;
          } else {
            failCount++;
            console.warn(`Failed to save job: ${job.position} at ${job.company}`);
          }
        } catch (err) {
          failCount++;
          console.error(`Error saving job: ${job.position}`, err);
        }
      }
      
      console.log(`✅ Bulk import complete: ${successCount} successful, ${failCount} failed`);
      
      if (failCount > 0) {
        throw new Error(`${failCount} jobs failed to import`);
      }
      
    } catch (error) {
      console.error('❌ Bulk backend save error:', error);
      throw error;
    }
  }

  async captureCurrentJob() {
    try {
      console.log('🔍 UK Job Tracker: Starting job capture...', window.location.href);
      const hostname = window.location.hostname;
      const selectors = this.getSelectorsForSite(hostname);

      if (!selectors) {
        console.warn('⚠️ UK Job Tracker: No specific selectors found, using generic capture');
        return this.genericCapture();
      }

      console.log('✅ UK Job Tracker: Found selectors for:', hostname);

      const companyText = this.extractText(selectors.company);
      const positionText = this.extractText(selectors.position);
      const locationText = this.extractText(selectors.location);
      const salaryText = this.extractText(selectors.salary);

      // Detailed logging for LinkedIn selectors
      if (hostname.includes('linkedin.com')) {
        if (!companyText) console.error('❌ LinkedIn selector failed: company');
        if (!positionText) console.error('❌ LinkedIn selector failed: position');
        if (!locationText) console.error('❌ LinkedIn selector failed: location');
        if (!salaryText) console.error('❌ LinkedIn selector failed: salary');
      }

      console.log('📋 UK Job Tracker: Captured data:', {
        company: companyText || '(not found)',
        position: positionText || '(not found)',
        location: locationText || '(not found)',
        salary: salaryText || '(not found)'
      });

      const jobDetails = {
        company: companyText || '',
        position: positionText || '',
        location: locationText,
        salary: salaryText,
        jobUrl: window.location.href,
        jobBoardSource: this.getSourceName(hostname),
        description: this.extractText(selectors.description),
        captureMethod: 'EXTENSION',
        confidence: 0.95,
        timestamp: new Date(),
      };

      // Validate captured data
      if (hostname.includes('linkedin.com') && (!companyText || !positionText)) {
        this.showNotification('❌ LinkedIn scraping failed: selectors may be outdated. Please update extension or report this issue.', 'error');
        console.warn('⚠️ UK Job Tracker: LinkedIn selectors failed. company:', companyText, 'position:', positionText);
        return { success: false, error: 'LinkedIn selectors failed' };
      }

      if (!jobDetails.company || !jobDetails.position) {
        console.warn('⚠️ UK Job Tracker: Missing company or position, trying fallback...');
        return this.fallbackCapture(jobDetails);
      }

      this.currentJob = jobDetails;
      
      // Store in local storage
      await this.storeJobLocally(jobDetails);
      console.log('💾 UK Job Tracker: Job stored locally. Details:', jobDetails);

      // Show success notification
      this.showNotification('✅ Job details captured successfully!', 'success');

      // Try to send to backend
      this.sendToBackend(jobDetails).catch(err => {
        console.warn('⚠️ UK Job Tracker: Backend save failed (will sync later):', err);
      });

      return { success: true, data: jobDetails };

    } catch (error) {
      console.error('❌ UK Job Tracker: Error capturing job:', error);
      this.showNotification('❌ Error capturing job details. See console for details.', 'error');
      return { success: false, error: (error && error.message) || 'Unknown error' };
    }
  }

  getSelectorsForSite(hostname) {
    for (const [domain, selectors] of Object.entries(SITE_SELECTORS)) {
      if (hostname.includes(domain)) {
        return selectors;
      }
    }
    return null;
  }

  extractText(selector) {
    if (!selector) return undefined;

    const selectors = selector.split(', ');
    for (const sel of selectors) {
      const element = document.querySelector(sel);
      if (element) {
        const text = (element.textContent || '').trim();
        if (text) return text;
      }
    }
    return undefined;
  }

  getSourceName(hostname) {
    if (hostname.includes('linkedin')) return 'LinkedIn';
    if (hostname.includes('indeed')) return 'Indeed';
    if (hostname.includes('reed')) return 'Reed';
    if (hostname.includes('totaljobs')) return 'Totaljobs';
    if (hostname.includes('glassdoor')) return 'Glassdoor';
    if (hostname.includes('monster')) return 'Monster';
    return hostname;
  }

  async genericCapture() {
    // Use AI-like heuristics to find job details
    const jobDetails = {
      company: this.findByPatterns(['company', 'employer', 'organization']) || '',
      position: this.findByPatterns(['title', 'position', 'role', 'job']) || '',
      location: this.findByPatterns(['location', 'city', 'remote']),
      salary: this.findByPatterns(['salary', 'compensation', 'pay']),
      jobUrl: window.location.href,
      jobBoardSource: this.getSourceName(window.location.hostname),
      captureMethod: 'EXTENSION',
      confidence: 0.7,
      timestamp: new Date(),
    };

    if (jobDetails.company && jobDetails.position) {
      return { success: true, data: jobDetails };
    }

    return { success: false, error: 'Unable to capture job details from this page' };
  }

  findByPatterns(patterns) {
    for (const pattern of patterns) {
      // Search for elements containing these keywords
      const elements = document.querySelectorAll(`[class*="${pattern}"], [id*="${pattern}"], [data-*="${pattern}"]`);
      for (const element of elements) {
        const text = (element.textContent || '').trim();
        if (text && text.length > 2 && text.length < 200) {
          return text;
        }
      }

      // Search headings
      const headings = document.querySelectorAll('h1, h2, h3');
      for (const heading of headings) {
        if ((heading.textContent || '').toLowerCase().includes(pattern)) {
          const nextElement = heading.nextElementSibling;
          if (nextElement) {
            const text = (nextElement.textContent || '').trim();
            if (text) return text;
          }
        }
      }
    }
    return undefined;
  }

  async fallbackCapture(partialData) {
    // Try OpenGraph meta tags
    const ogTitleEl = document.querySelector('meta[property="og:title"]');
    const ogDescEl = document.querySelector('meta[property="og:description"]');
    const ogTitle = ogTitleEl ? ogTitleEl.getAttribute('content') : null;
    const ogDescription = ogDescEl ? ogDescEl.getAttribute('content') : null;

    if (ogTitle) {
      // Parse title which often contains "Position at Company"
      const titleParts = ogTitle.split(' at ');
      if (titleParts.length === 2) {
        partialData.position = partialData.position || titleParts[0].trim();
        partialData.company = partialData.company || titleParts[1].trim();
      }
    }

    partialData.description = partialData.description || ogDescription || undefined;
    partialData.confidence = 0.8;

    if (partialData.company && partialData.position) {
      return { success: true, data: partialData };
    }

    return { success: false, error: 'Insufficient job details captured' };
  }

  async storeJobLocally(jobDetails) {
    // Store in Chrome storage for offline sync
    const stored = await chrome.storage.local.get(['capturedJobs']) || {};
    const jobs = stored.capturedJobs || [];
    jobs.push(jobDetails);
    
    // Keep only last 50 jobs locally
    if (jobs.length > 50) {
      jobs.shift();
    }

    await chrome.storage.local.set({ capturedJobs: jobs });
    console.log('💾 UK Job Tracker: Saved to local storage. Total jobs:', jobs.length);
  }

  async sendToBackend(jobDetails) {
    try {
      // Get auth token from chrome storage
      let { token } = await chrome.storage.local.get(['token']);
      
      // If no token in chrome storage, try to get from page localStorage (for frontend domain)
      if (!token && window.location.hostname === 'localhost' && window.location.port === '3000') {
        try {
          token = localStorage.getItem('token');
          if (token) {
            await chrome.storage.local.set({ token });
            console.log('✅ UK Job Tracker: Token synced from page localStorage');
          }
        } catch (e) {
          // Can't access localStorage from content script in some contexts
        }
      }
      
      if (!token) {
        console.warn('⚠️ UK Job Tracker: No auth token found. Please:');
        console.warn('   1. Login at http://localhost:3000');
        console.warn('   2. Open extension popup to sync token');
        console.warn('   3. Jobs will sync to backend automatically');
        return;
      }

      console.log('🚀 UK Job Tracker: Sending to backend...');
      
      const response = await fetch('http://localhost:3001/api/applications', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          company: jobDetails.company,
          position: jobDetails.position,
          location: jobDetails.location,
          jobUrl: jobDetails.jobUrl,
          jobBoardSource: jobDetails.jobBoardSource,
          salary: jobDetails.salary,
          status: 'APPLIED',
          captureMethod: 'EXTENSION'
        }),
      });

      if (!response.ok) {
        return { success: false, error: `Backend returned ${response.status}` };
      }

      const result = await response.json();
      console.log('✅ UK Job Tracker: Successfully saved to backend!', result);
      this.showNotification('✅ Saved to database!', 'success');
    } catch (error) {
      console.error('❌ UK Job Tracker: Backend save error:', error);
      throw error;
    }
  }

      showNotification(message, type = 'info') {
        // Create and inject notification element
        const notification = document.createElement('div');
        notification.className = `ukji-notification ukji-notification-${type}`;
        notification.textContent = message;
        const bgColor = type === 'success' ? '#10b981' : 
                        type === 'error' ? '#ef4444' : 
                        type === 'info' ? '#3b82f6' : '#6366f1';
        notification.style.cssText = `
          position: fixed;
          top: 20px;
          right: 20px;
          padding: 14px 20px;
          background: ${bgColor};
          color: white;
          border-radius: 8px;
          box-shadow: 0 4px 12px rgba(0,0,0,0.15);
          z-index: 999999;
          font-family: system-ui, -apple-system, sans-serif;
          font-size: 14px;
          font-weight: 500;
          max-width: 400px;
          animation: slideIn 0.3s ease-out;
        `;

    document.body.appendChild(notification);

    // Auto remove after 3 seconds
    setTimeout(() => {
      notification.style.animation = 'slideOut 0.3s ease-in';
      setTimeout(() => notification.remove(), 300);
    }, 3000);
  }

  startTimeTracking() {
    this.startTime = Date.now();
    chrome.storage.local.set({ trackingStartTime: this.startTime });
  }

  stopTimeTracking() {
    const endTime = Date.now();
    const timeSpent = Math.floor((endTime - this.startTime) / 1000); // in seconds
    chrome.storage.local.remove(['trackingStartTime']);
    return timeSpent;
  }

  async fetchAppliedJobs() {
    try {
      // Get auth token from chrome storage
      let { token } = await chrome.storage.local.get(['token']);
      if (!token && window.location.hostname === 'localhost' && window.location.port === '3000') {
        try {
          token = localStorage.getItem('token');
          if (token) {
            await chrome.storage.local.set({ token });
            console.log('✅ UK Job Tracker: Token synced from page localStorage');
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
      console.error('❌ UK Job Tracker: Error fetching applied jobs:', error);
      this.showNotification('❌ Error fetching applied jobs. See console for details.', 'error');
      return { success: false, error: (error && error.message) || 'Unknown error' };
    }
  }

  async scrapeLinkedInAppliedJobs() {
    try {
      // Check if on LinkedIn "Applied Jobs" page
      const url = window.location.href;
      if (!url.includes('linkedin.com/my-items/applied-jobs')) {
        this.showNotification('❌ Not on LinkedIn Applied Jobs page.', 'error');
        return { success: false, error: 'Not on LinkedIn Applied Jobs page' };
      }
      // Scrape job cards
      const jobCards = document.querySelectorAll('[data-occludable-job-id], .job-card-list__item');
      const jobs = [];
      jobCards.forEach(card => {
        // Try to extract job title, company, link, and date applied
        const titleEl = card.querySelector('.job-card-list__title, .job-card-container__link, a[data-control-name="job_card_company_link"]');
        const companyEl = card.querySelector('.job-card-container__company-name, .job-card-list__company-name, .job-card-container__primary-description');
        const linkEl = card.querySelector('a.job-card-list__title, a.job-card-container__link');
        const dateEl = card.querySelector('.job-card-container__listed-time, .job-card-list__footer-wrapper time');
        jobs.push({
          title: titleEl ? titleEl.textContent.trim() : '',
          company: companyEl ? companyEl.textContent.trim() : '',
          link: linkEl ? linkEl.href : '',
          dateApplied: dateEl ? dateEl.textContent.trim() : '',
        });
      });
      if (jobs.length === 0) {
        this.showNotification('❌ No applied jobs found on this page.', 'error');
        return { success: false, error: 'No applied jobs found' };
      }
      this.showNotification(`✅ Found ${jobs.length} applied jobs!`, 'success');
      return { success: true, data: jobs };
    } catch (error) {
      console.error('❌ UK Job Tracker: Error scraping LinkedIn applied jobs:', error);
      this.showNotification('❌ Error scraping LinkedIn applied jobs. See console for details.', 'error');
      return { success: false, error: (error && error.message) || 'Unknown error' };
    }
  }

  destroy() {
    if (this.observer) {
      this.observer.disconnect();
    }
  }
}

// Initialize job capture
const jobCapture = new JobCapture();

// Add CSS animations
const style = document.createElement('style');
style.textContent = `
  @keyframes slideIn {
    from {
      transform: translateX(100%);
      opacity: 0;
    }
    to {
      transform: translateX(0);
      opacity: 1;
    }
  }
  
  @keyframes slideOut {
    from {
      transform: translateX(0);
      opacity: 1;
    }
    to {
      transform: translateX(100%);
      opacity: 0;
    }
  }
`;
document.head.appendChild(style);
