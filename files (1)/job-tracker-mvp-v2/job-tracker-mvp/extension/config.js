// Extension configuration
// This file can be customized per environment

const CONFIG = {
  // Default API base URL - can be overridden via chrome.storage.local
  DEFAULT_API_URL: 'http://localhost:3001',
  
  // Default Frontend URL - can be overridden via chrome.storage.local
  DEFAULT_FRONTEND_URL: 'http://localhost:3000',
  
  // Get API URL (async) - checks chrome.storage.local first
  async getApiUrl() {
    try {
      const { apiUrl } = await chrome.storage.local.get(['apiUrl']);
      return apiUrl || this.DEFAULT_API_URL;
    } catch (error) {
      return this.DEFAULT_API_URL;
    }
  },
  
  // Get Frontend URL (async) - checks chrome.storage.local first
  async getFrontendUrl() {
    try {
      const { frontendUrl } = await chrome.storage.local.get(['frontendUrl']);
      return frontendUrl || this.DEFAULT_FRONTEND_URL;
    } catch (error) {
      return this.DEFAULT_FRONTEND_URL;
    }
  },
  
  // Get full API endpoint
  async getApiEndpoint(path) {
    const baseUrl = await this.getApiUrl();
    return `${baseUrl}${path.startsWith('/') ? path : '/' + path}`;
  }
};

// Export for use in other files
if (typeof module !== 'undefined' && module.exports) {
  module.exports = CONFIG;
}

// Also make available globally for content scripts
if (typeof window !== 'undefined') {
  window.EXTENSION_CONFIG = CONFIG;
}
