// API service for backend communication

/** localStorage key: backend origin used for login (so the Chrome extension calls the same API). */
export const UKJT_STORAGE_API_BASE = 'ukjt_apiBaseUrl';

/**
 * In the browser, when `NEXT_PUBLIC_API_URL` is unset, use same-origin `/api` so
 * `app/api/[[...path]]/route.ts` proxies to Render (must set BACKEND_URL or NEXT_PUBLIC_API_URL on Vercel).
 */
export function getApiBaseUrl(): string {
  const fromEnv = process.env.NEXT_PUBLIC_API_URL?.trim().replace(/\/$/, '');
  if (typeof window !== 'undefined') {
    return fromEnv || '';
  }
  return fromEnv || 'http://localhost:3001';
}

/**
 * Absolute base the SPA uses for `/api/*` (no trailing slash). Extension must match this
 * or JWT validates against one server while POSTs go to another → 401 User not found.
 */
export function getResolvedApiOriginForExtension(): string {
  const base = getApiBaseUrl();
  if (base && /^https?:\/\//i.test(base)) {
    return base.replace(/\/$/, '');
  }
  if (typeof window !== 'undefined') {
    return window.location.origin;
  }
  return 'http://localhost:3001';
}

export function persistApiBaseForExtension(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(UKJT_STORAGE_API_BASE, getResolvedApiOriginForExtension());
  } catch {
    /* ignore */
  }
}

export function clearApiBaseForExtension(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(UKJT_STORAGE_API_BASE);
  } catch {
    /* ignore */
  }
}

// Helper to get auth token
const getAuthToken = (): string | null => {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('token');
};

// Helper to make authenticated requests
async function fetchWithAuth(endpoint: string, options: RequestInit = {}) {
  const token = getAuthToken();

  const headers = new Headers(options.headers as HeadersInit | undefined);
  if (!headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const response = await fetch(`${getApiBaseUrl()}${endpoint}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    // Handle 401 Unauthorized - token is invalid/expired
    if (response.status === 401) {
      // Clear invalid token
      if (typeof window !== 'undefined') {
        localStorage.removeItem('token');
        clearApiBaseForExtension();
        // Redirect to login page if not already there
        if (window.location.pathname !== '/login' && window.location.pathname !== '/register') {
          window.location.href = '/login?expired=true';
        }
      }
      const errorData = await response.json().catch(() => ({ message: 'Your session expired. Please login again.' }));
      throw new Error(errorData.message || 'Your session expired. Please login again.');
    }
    
    const errorData = await response.json().catch(() => ({ message: 'Request failed' }));
    throw new Error(errorData.message || `HTTP ${response.status}`);
  }

  return response.json();
}

/** Login/register must not send a stored token (avoids odd 401 handling and stale Bearer headers). */
async function fetchPublicJson(endpoint: string, options: RequestInit = {}) {
  const response = await fetch(`${getApiBaseUrl()}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ message: 'Request failed' }));
    const msg = errorData.message || `HTTP ${response.status}`;
    const hint = typeof errorData.hint === 'string' ? errorData.hint : '';
    const details = typeof errorData.details === 'string' ? errorData.details : '';
    const combined = [msg, hint, details].filter(Boolean).join(' ');
    throw new Error(combined || 'Request failed');
  }

  return response.json();
}

// Auth APIs
export const authAPI = {
  register: async (data: {
    email: string;
    password: string;
    firstName?: string;
    lastName?: string;
    consentTracking?: boolean;
    consentAnalytics?: boolean;
  }) => {
    return fetchPublicJson('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  login: async (data: { email: string; password: string }) => {
    return fetchPublicJson('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  logout: async () => {
    return fetchWithAuth('/api/auth/logout', {
      method: 'POST',
    });
  },
};

// Applications APIs
export const applicationsAPI = {
  getAll: async (params?: { page?: number; limit?: number; status?: string; startDate?: string; endDate?: string }) => {
    const queryString = params ? '?' + new URLSearchParams(params as any).toString() : '';
    return fetchWithAuth(`/api/applications${queryString}`);
  },

  getById: async (id: string) => {
    return fetchWithAuth(`/api/applications/${id}`);
  },

  create: async (data: any) => {
    return fetchWithAuth('/api/applications', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  update: async (id: string, data: any) => {
    return fetchWithAuth(`/api/applications/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  delete: async (id: string) => {
    return fetchWithAuth(`/api/applications/${id}`, {
      method: 'DELETE',
    });
  },

  getStats: async (period: number = 30) => {
    return fetchWithAuth(`/api/applications/stats/summary?period=${period}`);
  },
};

// Cold Emails APIs
export const coldEmailsAPI = {
  getAll: async () => {
    return fetchWithAuth('/api/cold-emails');
  },

  create: async (data: {
    recipientEmail: string;
    recipientName?: string;
    company?: string;
    subject?: string;
    message?: string;
  }) => {
    return fetchWithAuth('/api/cold-emails', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  update: async (id: string, data: {
    responseDate?: string;
    responded?: boolean;
    conversionStatus?: 'NO_RESPONSE' | 'INTERESTED' | 'NOT_INTERESTED' | 'FOLLOW_UP';
  }) => {
    return fetchWithAuth(`/api/cold-emails/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  },

  delete: async (id: string) => {
    return fetchWithAuth(`/api/cold-emails/${id}`, {
      method: 'DELETE',
    });
  },
};

// Analytics APIs
export const analyticsAPI = {
  getDashboard: async (period: number = 30) => {
    return fetchWithAuth(`/api/analytics/dashboard?period=${period}`);
  },

  getTrends: async (period: number = 30) => {
    return fetchWithAuth(`/api/analytics/trends?period=${period}`);
  },

  getSourcePerformance: async () => {
    return fetchWithAuth('/api/analytics/source-performance');
  },
};

// Scraper APIs - DISABLED FOR MVP
export const scraperAPI = {
  scrapeAll: async (params: {
    keywords?: string;
    location?: string;
    sources?: string[];
    limitPerSource?: number;
  }) => {
    console.warn('🚫 Scraping feature is disabled for MVP. Feature coming soon!');
    throw new Error('Feature Coming Soon - Scraping is disabled for MVP');
  },

  scrapeSource: async (source: string, params: {
    keywords?: string;
    location?: string;
    limitPerSource?: number;
  }) => {
    console.warn('🚫 Scraping feature is disabled for MVP. Feature coming soon!');
    throw new Error('Feature Coming Soon - Scraping is disabled for MVP');
  },

  getStatus: async () => {
    console.warn('🚫 Scraping feature is disabled for MVP. Feature coming soon!');
    return { status: 'disabled', message: 'Feature Coming Soon' };
  },
};

// Email Parser APIs
export const emailParserAPI = {
  testConnection: async (config: {
    email: string;
    password: string;
    host: string;
    port: number;
    tls?: boolean;
  }) => {
    return fetchWithAuth('/api/email-parser/test-connection', {
      method: 'POST',
      body: JSON.stringify(config),
    });
  },

  parse: async (config: {
    email: string;
    password: string;
    host: string;
    port: number;
    tls?: boolean;
    days?: number;
  }) => {
    return fetchWithAuth('/api/email-parser/parse', {
      method: 'POST',
      body: JSON.stringify(config),
    });
  },

  getGmailConfig: async () => {
    return fetchWithAuth('/api/email-parser/gmail-config');
  },

  getOutlookConfig: async () => {
    return fetchWithAuth('/api/email-parser/outlook-config');
  },
};

export default {
  auth: authAPI,
  applications: applicationsAPI,
  coldEmails: coldEmailsAPI,
  analytics: analyticsAPI,
  scraper: scraperAPI,
  emailParser: emailParserAPI,
};
