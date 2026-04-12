import { getApiBaseUrl } from './getApiBaseUrl';

// API service for backend communication

function apiDisplayBase(): string {
  const b = getApiBaseUrl();
  if (b) return b;
  if (typeof window !== 'undefined') return window.location.origin;
  return process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
}
let refreshInFlight: Promise<unknown> | null = null;

function getAuthToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('token');
}

async function fetchWithAuth(endpoint: string, options: RequestInit = {}, allowRetry: boolean = true) {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {}),
  };

  const token = getAuthToken();
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const url = `${getApiBaseUrl()}${endpoint}`;
  let response: Response;
  try {
    response = await fetch(url, { ...options, headers, credentials: 'include' });
  } catch (err: any) {
    const msg = err?.message || String(err);
    if (msg === 'Failed to fetch' || msg.includes('NetworkError') || err?.name === 'TypeError') {
      throw new Error(
        `Cannot reach the API (tried ${apiDisplayBase()}). On Vercel, set NEXT_PUBLIC_API_URL to your Render URL at build time and redeploy.`
      );
    }
    throw err;
  }

  if (!response.ok) {
    if (response.status === 401) {
      if (allowRetry) {
        if (!refreshInFlight) {
          refreshInFlight = fetchPublic('/api/auth/refresh', { method: 'POST' })
            .then((data: { token?: string }) => {
              if (data?.token && typeof window !== 'undefined') {
                localStorage.setItem('token', data.token);
              }
              return data;
            })
            .finally(() => {
              refreshInFlight = null;
            });
        }
        try {
          await refreshInFlight;
          return fetchWithAuth(endpoint, options, false);
        } catch {
          // fall through to redirect
        }
      }

      if (typeof window !== 'undefined') {
        localStorage.removeItem('user');
        localStorage.removeItem('token');
        if (window.location.pathname !== '/login' && window.location.pathname !== '/register') {
          window.location.href = '/login?expired=true';
          return new Promise(() => {});
        }
      }
      const errorData = await response.json().catch(() => ({ message: 'Session expired. Please login again.' }));
      throw new Error(errorData.message || 'Session expired. Please login again.');
    }

    if (response.status === 429) {
      throw new Error('Too many requests. Please wait a moment and try again.');
    }

    let errorMessage = `HTTP ${response.status}`;
    try {
      const errorData = await response.json();
      errorMessage = errorData.message || errorData.error || errorMessage;
    } catch {
      try {
        const text = await response.text();
        if (text) errorMessage = text.substring(0, 200);
      } catch {
        errorMessage = response.statusText || `HTTP ${response.status}`;
      }
    }

    throw new Error(errorMessage);
  }

  return response.json();
}

async function fetchPublic(endpoint: string, options: RequestInit = {}) {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> | undefined),
  };

  const token = getAuthToken();
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const url = `${getApiBaseUrl()}${endpoint}`;
  let response: Response;
  try {
    response = await fetch(url, { ...options, headers, credentials: 'include' });
  } catch (err: any) {
    const msg = err?.message || String(err);
    if (msg === 'Failed to fetch' || msg.includes('NetworkError') || err?.name === 'TypeError') {
      throw new Error(
        `Cannot reach the API (tried ${apiDisplayBase()}). On Vercel, set NEXT_PUBLIC_API_URL to your Render URL at build time and redeploy.`
      );
    }
    throw err;
  }

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ message: 'Request failed' }));
    throw new Error(errorData.message || `HTTP ${response.status}`);
  }

  return response.json();
}

// ─── Auth ───────────────────────────────────────────────────────────────────

export const authAPI = {
  register: (data: { email: string; password: string; firstName?: string; lastName?: string }) =>
    fetchPublic('/api/auth/register', { method: 'POST', body: JSON.stringify(data) }),

  login: (data: { email: string; password: string }) =>
    fetchPublic('/api/auth/login', { method: 'POST', body: JSON.stringify(data) }),

  logout: () => fetchWithAuth('/api/auth/logout', { method: 'POST' }),

  refresh: () => fetchPublic('/api/auth/refresh', { method: 'POST' }),
};

// ─── Applications ────────────────────────────────────────────────────────────

export const applicationsAPI = {
  getAll: (params?: { page?: number; limit?: number; status?: string; startDate?: string; endDate?: string }) => {
    const queryString = params ? '?' + new URLSearchParams(params as any).toString() : '';
    return fetchWithAuth(`/api/applications${queryString}`);
  },

  getById: (id: string) => fetchWithAuth(`/api/applications/${id}`),

  create: (data: any) =>
    fetchWithAuth('/api/applications', { method: 'POST', body: JSON.stringify(data) }),

  // Server uses PUT /:id
  update: (id: string, data: any) =>
    fetchWithAuth(`/api/applications/${id}`, { method: 'PUT', body: JSON.stringify(data) }),

  delete: (id: string) =>
    fetchWithAuth(`/api/applications/${id}`, { method: 'DELETE' }),

  getStats: (period: number = 30) =>
    fetchWithAuth(`/api/applications/stats/summary?period=${period}`),

  getActiveSessions: () => fetchWithAuth('/api/applications/active-sessions'),

  getStatusHistory: (id: string) =>
    fetchWithAuth(`/api/applications/${id}/status-history`),

  // Server uses PATCH /:id/auto-status
  enableAutoStatus: (id: string, enabled: boolean) =>
    fetchWithAuth(`/api/applications/${id}/auto-status`, {
      method: 'PATCH',
      body: JSON.stringify({ enabled }),
    }),

  // Server uses PATCH /:id/ghosting-threshold
  setGhostingThreshold: (id: string, days: number) =>
    fetchWithAuth(`/api/applications/${id}/ghosting-threshold`, {
      method: 'PATCH',
      body: JSON.stringify({ thresholdDays: days }),
    }),

  getStatusReviewQueue: (params?: { state?: string; limit?: number }) => {
    const queryString = params ? '?' + new URLSearchParams(params as any).toString() : '';
    return fetchWithAuth(`/api/applications/status-review-queue${queryString}`);
  },

  confirmReviewQueueItem: (queueId: string) =>
    fetchWithAuth(`/api/applications/status-review-queue/${queueId}/confirm`, { method: 'POST', body: JSON.stringify({}) }),

  correctReviewQueueItem: (queueId: string, correctedStatus: string, note?: string) =>
    fetchWithAuth(`/api/applications/status-review-queue/${queueId}/correct`, {
      method: 'POST',
      body: JSON.stringify({ correctedStatus, note }),
    }),

  dismissReviewQueueItem: (queueId: string, note?: string) =>
    fetchWithAuth(`/api/applications/status-review-queue/${queueId}/dismiss`, {
      method: 'POST',
      body: JSON.stringify({ note }),
    }),

  correctStatus: (applicationId: string, data: { detectedStatus: string; correctedStatus: string; emailSubject?: string; emailBody?: string }) =>
    fetchWithAuth(`/api/applications/${applicationId}/correct-status`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
};

// ─── Cold Emails ─────────────────────────────────────────────────────────────

export const coldEmailsAPI = {
  getAll: () => fetchWithAuth('/api/cold-emails'),

  create: (data: {
    recipientEmail: string;
    recipientName?: string;
    company?: string;
    subject?: string;
    message?: string;
  }) => fetchWithAuth('/api/cold-emails', { method: 'POST', body: JSON.stringify(data) }),

  update: (id: string, data: {
    responseDate?: string;
    responded?: boolean;
    conversionStatus?: 'NO_RESPONSE' | 'INTERESTED' | 'NOT_INTERESTED' | 'FOLLOW_UP';
  }) => fetchWithAuth(`/api/cold-emails/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),

  delete: (id: string) => fetchWithAuth(`/api/cold-emails/${id}`, { method: 'DELETE' }),
};

// ─── Analytics ───────────────────────────────────────────────────────────────

export const analyticsAPI = {
  getDashboard: (period: number = 30) =>
    fetchWithAuth(`/api/analytics/dashboard?period=${period}`),

  // Uses the /detailed endpoint with daily grouping as the trend source
  getTrends: (period: number = 30) =>
    fetchWithAuth(`/api/analytics/trends?period=${period}`),

  getSourcePerformance: () =>
    fetchWithAuth('/api/analytics/source-performance'),

  getCvPerformance: (period: number = 90) =>
    fetchWithAuth(`/api/analytics/cv-performance?period=${period}`),

  getCvPerformanceHistory: (weeks: number = 12) =>
    fetchWithAuth(`/api/analytics/cv-performance/history?weeks=${weeks}`),

  getRecommendationAdoption: (period: number = 30) =>
    fetchWithAuth(`/api/analytics/recommendations/adoption?period=${period}`),

  getCvRecommendation: (period: number = 90) =>
    fetchWithAuth(`/api/analytics/recommendations/cv?period=${period}`),

  getAiStatusKpi: (period: number = 30) =>
    fetchWithAuth(`/api/analytics/ai-status-kpi?period=${period}`),

  trackEvent: (eventType: string, eventData: Record<string, any>) =>
    fetchWithAuth('/api/analytics/event', {
      method: 'POST',
      body: JSON.stringify({ eventType, eventData }),
    }),
};

// ─── Users / CV Versions ─────────────────────────────────────────────────────

export const usersAPI = {
  getProfile: () => fetchWithAuth('/api/users/profile'),
  getCVVersions: () => fetchWithAuth('/api/users/cv-versions'),
};

// ─── Scraper ─────────────────────────────────────────────────────────────────

export const scraperAPI = {
  scrapeAll: (params: { keywords?: string; location?: string; sources?: string[]; limitPerSource?: number }) =>
    fetchWithAuth('/api/scraper/scrape', { method: 'POST', body: JSON.stringify(params) }),

  scrapeSource: (source: string, params: { keywords?: string; location?: string; limitPerSource?: number }) =>
    fetchWithAuth(`/api/scraper/scrape/${source}`, { method: 'POST', body: JSON.stringify(params) }),

  getStatus: () => fetchWithAuth('/api/scraper/scrape/status'),
};

// ─── Email Parser ─────────────────────────────────────────────────────────────

export const emailParserAPI = {
  testConnection: (config: { email: string; password: string; host: string; port: number; tls?: boolean }) =>
    fetchWithAuth('/api/email-parser/test-connection', { method: 'POST', body: JSON.stringify(config) }),

  parse: (config: { email: string; password: string; host: string; port: number; tls?: boolean; days?: number }) =>
    fetchWithAuth('/api/email-parser/parse', { method: 'POST', body: JSON.stringify(config) }),

  getGmailConfig: () => fetchWithAuth('/api/email-parser/gmail-config'),

  getOutlookConfig: () => fetchWithAuth('/api/email-parser/outlook-config'),
};

// ─── Company Contacts ─────────────────────────────────────────────────────────

export const companyContactsAPI = {
  getAll: () => fetchWithAuth('/api/company-contacts'),

  // Server expects: { company, domain, emailAddresses[], notes }
  create: (data: {
    company: string;
    domain: string;
    emailAddresses?: string[];
    notes?: string;
  }) => fetchWithAuth('/api/company-contacts', { method: 'POST', body: JSON.stringify(data) }),

  // Server uses PATCH /:id
  update: (id: string, data: {
    company?: string;
    domain?: string;
    emailAddresses?: string[];
    isVerified?: boolean;
    notes?: string;
  }) => fetchWithAuth(`/api/company-contacts/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),

  delete: (id: string) => fetchWithAuth(`/api/company-contacts/${id}`, { method: 'DELETE' }),

  // Server: POST /api/company-contacts/:id/verify
  verify: (id: string) =>
    fetchWithAuth(`/api/company-contacts/${id}/verify`, { method: 'POST' }),
};

// ─── Email Settings ───────────────────────────────────────────────────────────

export const emailSettingsAPI = {
  get: () => fetchWithAuth('/api/email-settings'),

  // Server upsert endpoint uses POST
  update: (data: {
    emailSyncEnabled?: boolean;
    notificationEnabled?: boolean;
    ghostingNotificationEnabled?: boolean;
    syncFrequencyMinutes?: number;
  }) => fetchWithAuth('/api/email-settings', { method: 'POST', body: JSON.stringify(data) }),

  // Sets IMAP credentials — maps to POST /api/email-settings/credentials
  setCredentials: (data: {
    email: string;
    password: string;
    host: string;
    port: number;
    tls?: boolean;
    provider?: 'gmail' | 'outlook' | 'imap';
  }) => fetchWithAuth('/api/email-settings/credentials', { method: 'POST', body: JSON.stringify(data) }),

  // Clears stored IMAP credentials
  deleteCredentials: () =>
    fetchWithAuth('/api/email-settings/credentials', { method: 'DELETE' }),

  testConnection: () =>
    fetchWithAuth('/api/email-settings/test-connection', { method: 'POST' }),

  // Triggers an immediate on-demand email sync using the full status-update pipeline
  syncNow: () =>
    fetchWithAuth('/api/email-settings/sync-now', { method: 'POST' }),
};

// ─── Notifications ─────────────────────────────────────────────────────────────

export const notificationsAPI = {
  getAll: (params?: { unreadOnly?: boolean; limit?: number }) => {
    const queryString = params ? '?' + new URLSearchParams(params as any).toString() : '';
    return fetchWithAuth(`/api/notifications${queryString}`);
  },

  markAsRead: (id: string) =>
    fetchWithAuth(`/api/notifications/${id}/read`, { method: 'POST' }),

  markAllAsRead: () =>
    fetchWithAuth('/api/notifications/read-all', { method: 'POST' }),

  delete: (id: string) =>
    fetchWithAuth(`/api/notifications/${id}`, { method: 'DELETE' }),
};

export default {
  auth: authAPI,
  applications: applicationsAPI,
  coldEmails: coldEmailsAPI,
  analytics: analyticsAPI,
  scraper: scraperAPI,
  emailParser: emailParserAPI,
  companyContacts: companyContactsAPI,
  emailSettings: emailSettingsAPI,
  notifications: notificationsAPI,
  users: usersAPI,
};
