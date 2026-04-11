// Extension Popup Script
// Handles user interaction in the extension popup

document.addEventListener('DOMContentLoaded', async () => {
  const jobForm = document.getElementById('job-form');
  const loading = document.getElementById('loading');
  const errorMessage = document.getElementById('error-message');
  const successMessage = document.getElementById('success-message');
  const notOnJobPage = document.getElementById('not-on-job-page');
  
  const companyInput = document.getElementById('company');
  const positionInput = document.getElementById('position');
  const locationInput = document.getElementById('location');
  const salaryInput = document.getElementById('salary');
  const sourceInput = document.getElementById('source');
  const urlInput = document.getElementById('url');
  const notesInput = document.getElementById('notes');
  
  const timeDisplay = document.getElementById('time-display');
  const startTimerBtn = document.getElementById('start-timer');
  const stopTimerBtn = document.getElementById('stop-timer');
  const saveButton = document.getElementById('save-button');
  const resetButton = document.getElementById('reset-button');

  // Guard against partial/failed popup DOM rendering.
  if (
    !jobForm || !loading || !errorMessage || !successMessage || !notOnJobPage ||
    !companyInput || !positionInput || !locationInput || !salaryInput || !sourceInput || !urlInput || !notesInput ||
    !timeDisplay || !startTimerBtn || !stopTimerBtn || !saveButton || !resetButton
  ) {
    console.error('Popup initialization failed: required DOM elements are missing.');
    return;
  }
  
  let currentJob = null;
  let timeSpent = 0;
  let timerInterval = null;
  let startTime = null;
  
  // Sync auth token from frontend
  async function syncAuthToken() {
    try {
      const { apiUrl: storedApiUrl } = await chrome.storage.local.get(['apiUrl']);
      const apiUrl = storedApiUrl || 'http://localhost:3001';

      const allTabs = await chrome.tabs.query({});
      const tabs = allTabs
        .filter(tab =>
          tab.url && (
            tab.url.includes('localhost:3000') ||
            tab.url.includes('localhost:3001') ||
            tab.url.includes('127.0.0.1:3000') ||
            tab.url.includes('127.0.0.1:3001') ||
            tab.url.includes('localhost:3002') ||
            tab.url.includes('localhost:3003')
          )
        )
        .sort((a, b) => {
          const score = (url = '') =>
            (url.includes('/dashboard') ? 3 : 0) +
            (url.includes('/login') ? 2 : 0) +
            (url.includes('localhost:3000') ? 1 : 0);
          return score(b.url || '') - score(a.url || '');
        });

      if (tabs.length === 0) {
        console.log('⚠️ No dashboard tabs found');
        return false;
      }

      // Method 1: Read token from localStorage from any candidate tab
      for (const tab of tabs) {
        try {
          const results = await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            func: () => {
              try {
                return localStorage.getItem('token');
              } catch {
                return null;
              }
            }
          });
          const token = results?.[0]?.result;
          if (token && token !== 'null' && token !== 'undefined' && token.length > 10) {
            await chrome.storage.local.set({ token });
            console.log('✅ Token synced from localStorage');
            return true;
          }
        } catch (e) {
          console.log('⚠️ Could not read localStorage on tab:', tab.id, e?.message || e);
        }
      }

      // Method 2: Refresh from any candidate tab context (uses HTTP-only cookies)
      for (const tab of tabs) {
        try {
          const results = await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            func: (apiBase) => {
              return fetch(`${apiBase}/api/auth/refresh`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
              })
                .then(r => (r.ok ? r.json() : null))
                .then(data => {
                  if (data && data.token) {
                    try {
                      localStorage.setItem('token', data.token);
                    } catch {
                      // Ignore storage errors in page context.
                    }
                    return data.token;
                  }
                  return null;
                })
                .catch(() => null);
            },
            args: [apiUrl]
          });
          const token = results?.[0]?.result;
          if (token && token.length > 10) {
            await chrome.storage.local.set({ token });
            console.log('✅ Token synced via refresh endpoint');
            return true;
          }
        } catch (e) {
          console.log('⚠️ Refresh sync failed on tab:', tab.id, e?.message || e);
        }
      }

      // Method 3: Message content script in any candidate tab
      for (const tab of tabs) {
        try {
          const response = await new Promise((resolve) => {
            chrome.tabs.sendMessage(tab.id, { action: 'getToken' }, (res) => {
              resolve(res);
            });
          });
          if (response?.token && response.token !== 'null' && response.token.length > 10) {
            await chrome.storage.local.set({ token: response.token });
            console.log('✅ Token synced via content script message');
            return true;
          }
        } catch {
          // Move to next tab.
        }
      }

      // Method 4: Ask background worker to sync too
      try {
        const bgResponse = await new Promise((resolve) => {
          chrome.runtime.sendMessage({ action: 'syncAuthToken' }, (res) => resolve(res));
        });
        if (bgResponse?.success) {
          const { token } = await chrome.storage.local.get(['token']);
          if (token && token.length > 10) {
            console.log('✅ Token synced via background worker');
            return true;
          }
        }
      } catch {
        // Ignore and fall through.
      }

      return false;
    } catch (error) {
      console.log('⚠️ Could not sync token:', error?.message || error);
      return false;
    }
  }

  // Show token status
  async function showTokenStatus() {
    const tokenStatus = document.getElementById('token-status');
    const { token } = await chrome.storage.local.get(['token']);
    
    if (token && token !== 'null' && token.length > 10) {
      tokenStatus.textContent = '✅ Authenticated - Ready to save jobs!';
      tokenStatus.className = 'status success';
      tokenStatus.classList.remove('hidden');
    } else {
      tokenStatus.textContent = '⚠️ Not authenticated - attempting auto sync...';
      tokenStatus.className = 'status error';
      tokenStatus.classList.remove('hidden');
    }
  }

  // Fetch (or reuse) a dedicated, long-lived extension token from the API.
  // This is deterministic across environments — does not depend on browser localStorage.
  async function fetchExtensionToken(apiUrl) {
    try {
      const response = await fetch(`${apiUrl}/api/auth/extension-token`, {
        method: 'POST',
        credentials: 'include', // sends the HTTP-only access_token cookie
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ label: 'Chrome Extension' }),
      });
      if (!response.ok) return null;
      const data = await response.json();
      return data.token || null;
    } catch (err) {
      console.warn('⚠️ Could not fetch extension token:', err.message);
      return null;
    }
  }

  // Manual token sync button handler
  async function handleSyncToken() {
    const tokenStatus = document.getElementById('token-status');
    const successMessage = document.getElementById('success-message');
    
    tokenStatus.textContent = '🔄 Connecting to dashboard...';
    tokenStatus.className = 'status info';
    tokenStatus.classList.remove('hidden');

    // Primary method: sync from dashboard tab (localStorage or refresh cookie)
    const synced = await syncAuthToken();
    if (synced) {
      tokenStatus.textContent = '✅ Authenticated - Ready to save jobs!';
      tokenStatus.className = 'status success';
      if (successMessage) {
        successMessage.textContent = '✅ Token synced from dashboard!';
        successMessage.classList.remove('hidden');
        setTimeout(() => successMessage.classList.add('hidden'), 3000);
      }
      return;
    }

    // Fallback: try the extension-token endpoint
    const { apiUrl: storedApiUrl } = await chrome.storage.local.get(['apiUrl']);
    const apiUrl = storedApiUrl || 'http://localhost:3001';
    const extensionToken = await fetchExtensionToken(apiUrl);
    if (extensionToken) {
      await chrome.storage.local.set({ token: extensionToken, tokenType: 'extension' });
      tokenStatus.textContent = '✅ Authenticated - Ready to save jobs!';
      tokenStatus.className = 'status success';
      if (successMessage) {
        successMessage.textContent = '✅ Extension token issued!';
        successMessage.classList.remove('hidden');
        setTimeout(() => successMessage.classList.add('hidden'), 3000);
      }
      return;
    }

    // All methods failed
    tokenStatus.textContent = '❌ Please open your dashboard (localhost:3000), log in, then click Sync again.';
    tokenStatus.className = 'status error';
    tokenStatus.classList.remove('hidden');
    if (successMessage) {
      successMessage.textContent = '';
      successMessage.classList.add('hidden');
    }
    // Open dashboard login tab so user can log in
    try {
      const dashboardUrl = (apiUrl).replace(':3001', ':3000') + '/login';
      await chrome.tabs.create({ url: dashboardUrl, active: true });
    } catch { /* tabs API unavailable */ }
  }

  // Load current tab and try to capture job
  async function initialize() {
    try {
      // Sync token first so we do not show stale "Not authenticated" status.
      await syncAuthToken();
      await showTokenStatus();
      
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      
      if (!tab) {
        showError('Unable to access current tab');
        return;
      }
      
      const url = tab.url || '';
      
      // Check if on LinkedIn "My Jobs" page - show bulk import option
      if (url.includes('linkedin.com/my-items/saved-jobs') || url.includes('linkedin.com/my-items')) {
        notOnJobPage.classList.remove('hidden');
        return;
      }
      
      // Check if on a known job board - try to capture
      const isJobBoard = url.includes('linkedin.com/jobs') || 
                        url.includes('indeed.com') || 
                        url.includes('reed.co.uk') ||
                        url.includes('totaljobs.com') ||
                        url.includes('monster.com') ||
                        url.includes('cv-library') ||
                        url.includes('glassdoor');
      
      if (isJobBoard) {
        loading.classList.remove('hidden');
        
        try {
          // Request job data from content script
          const response = await chrome.tabs.sendMessage(tab.id, { action: 'captureJob' });
          
          loading.classList.add('hidden');
          
          if (response && response.success && response.data) {
            currentJob = response.data;
            populateForm(response.data);
            jobForm.classList.remove('hidden');
            
            // Update source if not provided
            if (!sourceInput.value && tab.url) {
              sourceInput.value = getSourceFromUrl(tab.url);
            }
            
            if (!urlInput.value) {
              urlInput.value = tab.url;
            }
            return;
          }
        } catch (msgError) {
          // Content script might not be loaded - show form anyway
          console.log('Content script not ready, showing manual form');
          loading.classList.add('hidden');
          jobForm.classList.remove('hidden');
          
          if (tab.url) {
            sourceInput.value = getSourceFromUrl(tab.url);
            urlInput.value = tab.url;
          }
          return;
        }
      }
      
      // Show manual form by default (user can always fill it manually)
      jobForm.classList.remove('hidden');
      
      if (tab.url) {
        sourceInput.value = getSourceFromUrl(tab.url);
        urlInput.value = tab.url;
        
        // Pre-fill company/position from URL if possible
        if (url.includes('linkedin.com/jobs/view')) {
          // Try to extract from URL
          const urlParts = url.split('/');
          const jobIndex = urlParts.findIndex(p => p === 'view');
          if (jobIndex !== -1 && urlParts[jobIndex + 1]) {
            // Could parse more from URL if needed
          }
        }
      }
      
    } catch (error) {
      console.error('Error initializing popup:', error);
      loading.classList.add('hidden');
      // Show manual form as fallback
      jobForm.classList.remove('hidden');
    }
  }
  
  function populateForm(data) {
    if (data.company) companyInput.value = data.company;
    if (data.position) positionInput.value = data.position;
    if (data.location) locationInput.value = data.location;
    if (data.salary) salaryInput.value = data.salary;
    if (data.jobBoardSource) sourceInput.value = data.jobBoardSource;
    if (data.jobUrl) urlInput.value = data.jobUrl;
  }
  
  function getSourceFromUrl(url) {
    if (url.includes('linkedin.com')) return 'LinkedIn';
    if (url.includes('indeed.com') || url.includes('indeed.co.uk')) return 'Indeed';
    if (url.includes('reed.co.uk')) return 'Reed';
    if (url.includes('totaljobs.com')) return 'Totaljobs';
    if (url.includes('cv-library')) return 'CV-Library';
    if (url.includes('monster.com')) return 'Monster';
    if (url.includes('glassdoor')) return 'Glassdoor';
    return 'Other';
  }
  
  function showError(message) {
    errorMessage.textContent = message;
    errorMessage.classList.remove('hidden');
    setTimeout(() => {
      errorMessage.classList.add('hidden');
    }, 5000);
  }
  
  function showSuccess(message) {
    successMessage.textContent = message;
    successMessage.classList.remove('hidden');
    setTimeout(() => {
      successMessage.classList.add('hidden');
    }, 5000);
  }
  
  // Timer functionality
  startTimerBtn.addEventListener('click', () => {
    startTime = Date.now();
    startTimerBtn.disabled = true;
    stopTimerBtn.disabled = false;
    
    timerInterval = setInterval(() => {
      timeSpent = Math.floor((Date.now() - startTime) / 1000);
      updateTimeDisplay(timeSpent);
    }, 1000);
  });
  
  stopTimerBtn.addEventListener('click', () => {
    if (timerInterval) {
      clearInterval(timerInterval);
      timerInterval = null;
    }
    startTimerBtn.disabled = false;
    stopTimerBtn.disabled = true;
  });
  
  function updateTimeDisplay(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    timeDisplay.textContent = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }
  
  // Save application
  saveButton.addEventListener('click', async () => {
    if (!companyInput.value || !positionInput.value) {
      showError('Please fill in at least Company and Position');
      return;
    }
    
    saveButton.disabled = true;
    saveButton.textContent = 'Saving...';
    
    // timeSpent is in seconds (from the setInterval timer)
    const timeSpentSeconds = timeSpent > 0 ? timeSpent : undefined;
    const timeSpentMinutes = timeSpentSeconds ? Math.max(1, Math.round(timeSpentSeconds / 60)) : undefined;

    const applicationData = {
      company: companyInput.value,
      position: positionInput.value,
      location: locationInput.value || undefined,
      salary: salaryInput.value || undefined,
      jobBoardSource: sourceInput.value || undefined,
      jobUrl: urlInput.value || undefined,
      notes: notesInput.value || undefined,
      timeSpent: timeSpentMinutes,         // backend expects minutes
      timeSpentSeconds: timeSpentSeconds,  // also send raw seconds for precision
      captureMethod: 'EXTENSION',
      appliedAt: new Date().toISOString(),
    };
    
    try {
      // Get auth token from storage
      const result = await chrome.storage.local.get(['token', 'userId']);
      
      if (!result.token) {
        showError('Please login on the dashboard first');
        saveButton.disabled = false;
        saveButton.textContent = '💾 Save Application';
        return;
      }
      
      // Send to API
      const { apiUrl } = await chrome.storage.local.get(['apiUrl']);
      const baseUrl = apiUrl || 'http://localhost:3001';
      const response = await fetch(`${baseUrl}/api/applications`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${result.token}`,
        },
        body: JSON.stringify(applicationData),
      });
      
      if (response.ok) {
        showSuccess('Application saved successfully!');
        setTimeout(() => {
          window.close();
        }, 1500);
      } else {
        const error = await response.json();
        showError(error.message || 'Failed to save application');
      }
    } catch (error) {
      console.error('Error saving application:', error);
      showError('Unable to connect to server. Please check if the API is running.');
    } finally {
      saveButton.disabled = false;
      saveButton.textContent = '💾 Save Application';
    }
  });
  
  resetButton.addEventListener('click', () => {
    companyInput.value = '';
    positionInput.value = '';
    locationInput.value = '';
    salaryInput.value = '';
    sourceInput.value = '';
    urlInput.value = '';
    notesInput.value = '';
    timeSpent = 0;
    timeDisplay.textContent = '00:00';
    
    if (timerInterval) {
      clearInterval(timerInterval);
      timerInterval = null;
    }
    startTimerBtn.disabled = false;
    stopTimerBtn.disabled = true;
  });

  // Sync token button (if it exists)
  const syncTokenBtn = document.getElementById('sync-token-btn');
  if (syncTokenBtn) {
    syncTokenBtn.addEventListener('click', handleSyncToken);
  }
  
  // Capture My Applied Jobs button
  const captureMyJobsBtn = document.getElementById('capture-my-jobs-btn');
  if (captureMyJobsBtn) {
    captureMyJobsBtn.addEventListener('click', async () => {
      try {
        captureMyJobsBtn.disabled = true;
        captureMyJobsBtn.textContent = '⏳ Capturing...';
        
        // Get current tab
        const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tabs.length === 0) {
          showError('No active tab found');
          return;
        }
        
        const tab = tabs[0];
        const url = tab.url || '';
        
        // Check if on LinkedIn Applied Jobs page (new format)
        if (!url.includes('linkedin.com') || !url.includes('my-items/saved-jobs') || !url.includes('cardType=APPLIED')) {
          showError('⚠️ Please navigate to:\nhttps://www.linkedin.com/my-items/saved-jobs/?cardType=APPLIED\n\nThen click this button again!');
          captureMyJobsBtn.disabled = false;
          captureMyJobsBtn.textContent = '📥 Capture My Applied Jobs';
          return;
        }
        
        console.log('✅ On LinkedIn page:', url);
        
        // Try to inject content script if not already loaded
        try {
          await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            files: ['content.js']
          });
          console.log('✅ Content script injected');
          await new Promise(resolve => setTimeout(resolve, 500)); // Wait for script to initialize
        } catch (injectError) {
          console.log('⚠️ Could not inject script (may already be loaded):', injectError.message);
        }
        
        // Send message to content script
        let response;
        try {
          response = await chrome.tabs.sendMessage(tab.id, { action: 'captureMyJobs' });
        } catch (msgError) {
          // If message fails, content script might not be ready - try again
          console.log('⚠️ Message failed, waiting and retrying...');
          await new Promise(resolve => setTimeout(resolve, 2000));
          response = await chrome.tabs.sendMessage(tab.id, { action: 'captureMyJobs' });
        }
        
        if (response && response.success) {
          showSuccess(`✅ Successfully imported ${response.count} jobs!`);
          setTimeout(() => {
            window.close();
          }, 2000);
        } else {
          const errorMsg = response?.error || 'Failed to capture jobs. Check console (F12) for details.';
          showError(errorMsg);
          console.error('❌ Capture failed:', response);
        }
      } catch (error) {
        console.error('❌ Error capturing My Jobs:', error);
        showError('Error: ' + error.message + '\n\nCheck console (F12) on LinkedIn page for details.');
      } finally {
        captureMyJobsBtn.disabled = false;
        captureMyJobsBtn.textContent = '📥 Capture My Applied Jobs';
      }
    });
  }
  
  // Initialize popup
  initialize();
});

