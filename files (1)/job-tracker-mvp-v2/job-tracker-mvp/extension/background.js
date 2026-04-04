// Background Service Worker for UK Jobs Insider Job Tracker Extension
// Handles extension lifecycle and cross-tab communication

chrome.runtime.onInstalled.addListener(() => {
  console.log('UK Jobs Insider Job Tracker installed');
  
  // Set default settings
  chrome.storage.local.set({
    enabled: true,
    autoCapture: true,
    syncEnabled: false,
  });
  
  console.log('Extension installed successfully');
});

async function syncAuthTokenFromFrontendTab() {
  try {
    const { frontendUrl } = await chrome.storage.local.get(['frontendUrl']);
    const frontendHostHints = [
      'localhost:3000',
      'localhost:3001',
      'localhost:3002',
      'localhost:3003',
      'localhost:3004',
      'localhost:3005',
      '127.0.0.1:3000',
      '127.0.0.1:3001',
      '127.0.0.1:3002',
      '127.0.0.1:3003',
      '127.0.0.1:3004',
      '127.0.0.1:3005',
    ];
    if (frontendUrl) {
      try {
        const parsed = new URL(frontendUrl);
        frontendHostHints.unshift(parsed.host);
      } catch {
        // Ignore malformed stored URL.
      }
    }

    const isFrontendTab = (url) =>
      typeof url === 'string' &&
      frontendHostHints.some((hint) => url.includes(hint));

    const tabs = await chrome.tabs.query({});
    const frontendTabs = tabs
      .filter(tab => isFrontendTab(tab.url))
      .sort((a, b) => {
        const aScore = (a.url?.includes('/dashboard') ? 2 : 0) + (a.url?.includes('/login') ? 1 : 0);
        const bScore = (b.url?.includes('/dashboard') ? 2 : 0) + (b.url?.includes('/login') ? 1 : 0);
        return bScore - aScore;
      });

    if (frontendTabs.length === 0) return false;

    for (const tab of frontendTabs) {
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
        console.log('✅ Token synced from frontend tab');
        return true;
      }
    }
  } catch (error) {
    console.warn('⚠️ Token sync failed:', error);
  }

  return false;
}

// Listen for messages from content scripts
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'saveApplication') {
    // Handle application save
    (async () => {
      try {
        const result = await saveApplication(request.data);
        sendResponse({ success: true, result });
      } catch (error) {
        sendResponse({ success: false, error: error.message });
      }
    })();
    return true; // Keep channel open for async response
  }
  
  if (request.action === 'getSettings') {
    chrome.storage.local.get(['enabled', 'autoCapture'], (result) => {
      sendResponse(result);
    });
    return true;
  }
  
  if (request.action === 'updateSettings') {
    chrome.storage.local.set(request.data, () => {
      sendResponse({ success: true });
    });
    return true;
  }

  if (request.action === 'syncAuthToken') {
    (async () => {
      const success = await syncAuthTokenFromFrontendTab();
      sendResponse({ success });
    })();
    return true;
  }

  if (request.action === 'syncPendingApplicationsNow') {
    (async () => {
      await syncPendingApplications();
      sendResponse({ success: true });
    })();
    return true;
  }
});

async function saveApplication(data) {
  try {
    // Get auth token
    const { token } = await chrome.storage.local.get(['token']);
    
    if (!token) {
      throw new Error('Not authenticated');
    }
    
    // Get API URL from storage or default
    const { apiUrl } = await chrome.storage.local.get(['apiUrl']);
    const baseUrl = apiUrl || 'http://localhost:3001';
    
    // Send to API
    const response = await fetch(`${baseUrl}/api/applications`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify(data),
    });
    
    if (!response.ok) {
      throw new Error('Failed to save application');
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error saving application:', error);
    throw error;
  }
}

// Periodically sync captured jobs with API
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'syncJobs') {
    syncPendingJobs();
  }
  if (alarm.name === 'syncAuthToken') {
    syncAuthTokenFromFrontendTab();
  }
});

// Create alarm for periodic sync
chrome.alarms.create('syncJobs', { periodInMinutes: 5 });
chrome.alarms.create('syncAuthToken', { periodInMinutes: 1 });

async function syncPendingJobs() {
  const { capturedJobs } = await chrome.storage.local.get(['capturedJobs']);
  
  if (!capturedJobs || capturedJobs.length === 0) {
    return;
  }
  
  console.log(`Syncing ${capturedJobs.length} pending jobs...`);
  
  // Try to sync each job
  const { token } = await chrome.storage.local.get(['token']);
  
  if (!token) {
    console.log('No auth token, skipping sync');
    return;
  }
  
  const successfulJobs = [];
  const failedJobs = [];
  
  for (const job of capturedJobs) {
    try {
      await saveApplication(job);
      successfulJobs.push(job);
    } catch (error) {
      console.error('Failed to sync job:', error);
      failedJobs.push(job);
    }
  }
  
  // Remove successfully synced jobs
  await chrome.storage.local.set({ capturedJobs: failedJobs });
  
  console.log(`Synced ${successfulJobs.length} jobs successfully`);
}

// Handle badge updates
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete') {
    // Check if on a supported job board
    const isJobBoard = 
      tab.url?.includes('linkedin.com/jobs') ||
      tab.url?.includes('indeed.com') ||
      tab.url?.includes('indeed.co.uk') ||
      tab.url?.includes('reed.co.uk') ||
      tab.url?.includes('totaljobs.com');
    
    if (isJobBoard) {
      chrome.action.setBadgeText({ text: '✓', tabId });
      chrome.action.setBadgeBackgroundColor({ color: '#10b981' });
    }
  }
});

// ============================================================================
// Tab Activity Monitor for Application Tracking
// ============================================================================

const activeTabs = new Map(); // Track active application tabs

// Monitor tab updates for job application pages
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url) {
    handleTabUpdate(tabId, tab);
  }
});

// Monitor tab activation (user switches tabs)
chrome.tabs.onActivated.addListener((activeInfo) => {
  handleTabActivation(activeInfo.tabId);
});

// Monitor tab removal (user closes tab)
chrome.tabs.onRemoved.addListener((tabId) => {
  handleTabRemoval(tabId);
});

// Handle tab updates
async function handleTabUpdate(tabId, tab) {
  try {
    const url = tab.url;
    if (!url) return;
    
    // Check if this is a job application page
    const isJobApplicationPage = 
      /\/jobs?\/.*apply/i.test(url) ||
      /\/careers?\/.*apply/i.test(url) ||
      /\/apply/i.test(url) ||
      /\/application/i.test(url) ||
      /workday\.com\/.*\/job/i.test(url) ||
      /greenhouse\.io\/.*\/jobs/i.test(url) ||
      /lever\.co\/.*\/jobs/i.test(url) ||
      /lever\.co\/.*\/apply/i.test(url);
    
    if (isJobApplicationPage) {
      // Notify content script to start tracking
      try {
        await chrome.tabs.sendMessage(tabId, {
          action: 'startAutoTracking',
          url: url
        });
      } catch (error) {
        // Content script might not be loaded yet, that's okay
        console.log('Content script not ready for tab:', tabId);
      }
      
      // Track this tab
      activeTabs.set(tabId, {
        url,
        startTime: Date.now(),
        isActive: tab.active,
      });
      
      console.log('📊 Tracking job application tab:', tabId, url);
    } else {
      // Check if we were tracking this tab and user navigated away
      const trackedTab = activeTabs.get(tabId);
      if (trackedTab) {
        // User navigated away - might have submitted application
        console.log('🔄 Tab navigated away from application page:', tabId);
        // Content script will handle completion
      }
    }
  } catch (error) {
    console.error('Error handling tab update:', error);
  }
}

// Handle tab activation
async function handleTabActivation(tabId) {
  const trackedTab = activeTabs.get(tabId);
  if (!trackedTab) return;

  trackedTab.isActive = true;
  trackedTab.lastActive = Date.now();

  // Notify content script that tab is now active.
  // Ignore failures caused by tab lifecycle races.
  try {
    await chrome.tabs.sendMessage(tabId, {
      action: 'tabActivated'
    });
  } catch (_error) {}
}

// Handle tab removal
function handleTabRemoval(tabId) {
  const trackedTab = activeTabs.get(tabId);
  if (trackedTab) {
    console.log('🗑️ Tab closed:', tabId, trackedTab.url);
    activeTabs.delete(tabId);
  }
}

// Sync pending applications periodically
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'syncPendingApplications') {
    syncPendingApplications();
  }
});

// Create alarm for syncing pending applications
chrome.alarms.create('syncPendingApplications', { periodInMinutes: 2 });

// Sync pending applications from queue
async function syncPendingApplications() {
  try {
    const { pendingApplications = [] } = await chrome.storage.local.get(['pendingApplications']);
    
    if (pendingApplications.length === 0) {
      return;
    }
    
    let { token } = await chrome.storage.local.get(['token']);
    if (!token) {
      await syncAuthTokenFromFrontendTab();
      const refreshed = await chrome.storage.local.get(['token']);
      token = refreshed.token;
    }
    if (!token) {
      console.log('No auth token, skipping pending applications sync');
      return;
    }
    
    console.log(`Syncing ${pendingApplications.length} pending applications...`);
    
    const successful = [];
    const failed = [];
    
    for (const app of pendingApplications) {
      try {
        const { apiUrl } = await chrome.storage.local.get(['apiUrl']);
        const baseUrl = apiUrl || 'http://localhost:3001';
        const response = await fetch(`${baseUrl}/api/applications/track-session`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify({
            url: app.url,
            startTime: app.startTime,
            endTime: app.endTime || Date.now(),
            totalTimeSeconds: app.totalTimeSeconds || Math.max(1, Math.round(((app.endTime || Date.now()) - app.startTime) / 1000)),
            activeTime: app.activeTime || 0,
            jobData: app.jobData || {},
            trigger: app.trigger || 'queued',
            sessionId: app.sessionId,
          }),
        });
        
        if (response.ok) {
          successful.push(app);
        } else {
          failed.push(app);
        }
      } catch (error) {
        console.error('Failed to sync application:', error);
        failed.push(app);
      }
    }
    
    // Update queue with failed items only
    await chrome.storage.local.set({ pendingApplications: failed });
    
    if (successful.length > 0) {
      console.log(`✅ Synced ${successful.length} pending applications`);
    }
  } catch (error) {
    console.error('Error syncing pending applications:', error);
  }
}

// Handle messages for session tracking
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'getActiveSessions') {
    // Return active sessions for dashboard
    const sessions = Array.from(activeTabs.entries()).map(([tabId, data]) => ({
      tabId,
      url: data.url,
      startTime: data.startTime,
      isActive: data.isActive,
    }));
    sendResponse({ sessions });
    return true;
  }
  
  if (request.action === 'sessionCompleted') {
    // Remove from active tabs
    if (sender.tab?.id) {
      activeTabs.delete(sender.tab.id);
    }
    sendResponse({ success: true });
    return true;
  }
});

console.log('Background service worker loaded');
console.log('Extension ready for job tracking!');

