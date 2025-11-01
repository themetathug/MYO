// API service for backend communication

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

// Helper to get auth token
const getAuthToken = (): string | null => {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('token');
};

// Helper to make authenticated requests
async function fetchWithAuth(endpoint: string, options: RequestInit = {}) {
  const token = getAuthToken();
  
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    // Handle 401 Unauthorized - token is invalid/expired
    if (response.status === 401) {
      // Clear invalid token
      if (typeof window !== 'undefined') {
        localStorage.removeItem('token');
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

// Auth APIs
export const authAPI = {
  register: async (data: { email: string; password: string; firstName?: string; lastName?: string }) => {
    return fetchWithAuth('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  login: async (data: { email: string; password: string }) => {
    return fetchWithAuth('/api/auth/login', {
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

// Scraper APIs
export const scraperAPI = {
  scrapeAll: async (params: {
    keywords?: string;
    location?: string;
    sources?: string[];
    limitPerSource?: number;
  }) => {
    return fetchWithAuth('/api/scraper/scrape', {
      method: 'POST',
      body: JSON.stringify(params),
    });
  },

  scrapeSource: async (source: string, params: {
    keywords?: string;
    location?: string;
    limitPerSource?: number;
  }) => {
    return fetchWithAuth(`/api/scraper/scrape/${source}`, {
      method: 'POST',
      body: JSON.stringify(params),
    });
  },

  getStatus: async () => {
    return fetchWithAuth('/api/scraper/scrape/status');
  },
};

export default {
  auth: authAPI,
  applications: applicationsAPI,
  coldEmails: coldEmailsAPI,
  analytics: analyticsAPI,
  scraper: scraperAPI,
};
