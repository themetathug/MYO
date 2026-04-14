// Background Service Worker for UK Jobs Insider Job Tracker Extension
// Handles extension lifecycle and cross-tab communication

function isLikelyJwt(token) {
  return (
    typeof token === 'string' &&
    token !== 'mock-token' &&
    token.length >= 20 &&
    token.split('.').length === 3
  );
}

const UKJT_STORAGE_API_BASE = 'ukjt_apiBaseUrl';

function normalizeExtensionApiUrl(raw) {
  if (typeof raw === 'string' && /^https?:\/\//i.test(raw)) {
    return raw.replace(/\/$/, '');
  }
  return null;
}

/** Copy JWT + API origin from an open Job Tracker tab into extension storage — works from LinkedIn. */
async function pullTokenFromOpenDashboardTabs() {
  const tabs = await chrome.tabs.query({});
  const candidates = tabs.filter(
    (t) =>
      t.id &&
      t.url &&
      (/\/\/localhost:(3000|3001|3002|3003)\b/.test(t.url) ||
        /\/\/127\.0\.0\.1:(3000|3001|3002|3003)\b/.test(t.url) ||
        /\.vercel\.app\//.test(t.url))
  );

  for (const tab of candidates) {
    try {
      const results = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: (storageKey) => {
          try {
            return {
              token: localStorage.getItem('token'),
              apiBaseUrl: localStorage.getItem(storageKey),
            };
          } catch {
            return { token: null, apiBaseUrl: null };
          }
        },
        args: [UKJT_STORAGE_API_BASE],
      });
      const payload = results?.[0]?.result;
      const token = payload?.token;
      const fromPage = normalizeExtensionApiUrl(payload?.apiBaseUrl);
      if (isLikelyJwt(token)) {
        const apiUrl = fromPage || 'http://localhost:3001';
        await chrome.storage.local.set({ token, apiUrl });
        return token;
      }
    } catch {
      /* tab may forbid injection */
    }
  }
  return null;
}

chrome.runtime.onInstalled.addListener(() => {
  console.log('UK Jobs Insider Job Tracker installed');
  
  chrome.storage.local.set({
    enabled: true,
    autoCapture: true,
    syncEnabled: false,
  });
  
  injectTimerOnAllTabs();
  console.log('Extension installed successfully');
});

// Re-inject when service worker starts
injectTimerOnAllTabs();

async function injectTimerOnAllTabs() {
  try {
    const tabs = await chrome.tabs.query({});
    for (const tab of tabs) {
      if (!tab.id || !tab.url) continue;
      if (tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://') ||
          tab.url.startsWith('about:') || tab.url.startsWith('edge://') ||
          tab.url.startsWith('https://chrome.google.com')) continue;
      try {
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: ['timer.js'],
        });
      } catch (e) {}
    }
  } catch (e) {}
}

// Listen for messages from content scripts
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'syncTokenFromDashboard') {
    pullTokenFromOpenDashboardTabs()
      .then((token) => sendResponse({ ok: !!token, token: token || null }))
      .catch((err) => sendResponse({ ok: false, token: null, error: String(err?.message || err) }));
    return true;
  }

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
});

async function saveApplication(data) {
  try {
    let { token, apiUrl } = await chrome.storage.local.get(['token', 'apiUrl']);
    if (!isLikelyJwt(token)) {
      token = await pullTokenFromOpenDashboardTabs();
    }
    if (!token) {
      throw new Error('Not authenticated');
    }
    const base = (apiUrl || 'http://localhost:3001').replace(/\/$/, '');

    const response = await fetch(`${base}/api/applications`, {
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
});

// Create alarm for periodic sync
chrome.alarms.create('syncJobs', { periodInMinutes: 5 });

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

console.log('Background service worker loaded');
console.log('Extension ready for job tracking!');

