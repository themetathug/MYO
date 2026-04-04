'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import { scraperAPI } from '../lib/api';

interface JobScrapingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onJobsScraped?: () => void;
}

export function JobScrapingModal({ isOpen, onClose, onJobsScraped }: JobScrapingModalProps) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    keywords: '',
    location: 'United Kingdom',
    sources: ['linkedin', 'indeed'] as string[],
    limitPerSource: 10,
  });

  const handleScrape = async () => {
    try {
      setLoading(true);
      const result = await scraperAPI.scrapeAll({
        keywords: formData.keywords,
        location: formData.location,
        sources: formData.sources,
        limitPerSource: formData.limitPerSource,
      });

      toast.success(`Job scraping started! Jobs will appear in your dashboard shortly.`, {
        duration: 5000,
      });
      
      onJobsScraped?.();
      onClose();
    } catch (error: any) {
      toast.error(error.message || 'Failed to start scraping');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          className="bg-white dark:bg-gray-800 rounded-2xl p-8 max-w-2xl w-full max-h-[90vh] overflow-y-auto transition-colors"
        >
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-3xl font-bold text-black dark:text-white transition-colors">
                🤖 AI Job Scraping
              </h2>
              <p className="text-gray-600 dark:text-gray-400 mt-1 transition-colors">
                Automatically find and save relevant jobs
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-black dark:hover:text-white transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 transition-colors">
                Job Keywords *
              </label>
              <input
                type="text"
                required
                value={formData.keywords}
                onChange={(e) => setFormData({ ...formData, keywords: e.target.value })}
                className="w-full px-4 py-3 border-2 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-black dark:text-white rounded-lg focus:border-black dark:focus:border-white focus:outline-none transition-colors"
                placeholder="e.g., Software Engineer, Data Scientist"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 transition-colors">
                Location
              </label>
              <input
                type="text"
                value={formData.location}
                onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                className="w-full px-4 py-3 border-2 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-black dark:text-white rounded-lg focus:border-black dark:focus:border-white focus:outline-none transition-colors"
                placeholder="United Kingdom"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 transition-colors">
                Job Boards
              </label>
              <div className="space-y-2">
                {['linkedin', 'indeed', 'monster'].map((source) => (
                  <label key={source} className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.sources.includes(source)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setFormData({
                            ...formData,
                            sources: [...formData.sources, source],
                          });
                        } else {
                          setFormData({
                            ...formData,
                            sources: formData.sources.filter((s) => s !== source),
                          });
                        }
                      }}
                      className="w-4 h-4"
                    />
                    <span className="text-gray-700 dark:text-gray-300 capitalize">{source}</span>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 transition-colors">
                Jobs per Source
              </label>
              <input
                type="number"
                min="1"
                max="50"
                value={formData.limitPerSource}
                onChange={(e) => setFormData({ ...formData, limitPerSource: parseInt(e.target.value) || 10 })}
                className="w-full px-4 py-3 border-2 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-black dark:text-white rounded-lg focus:border-black dark:focus:border-white focus:outline-none transition-colors"
              />
            </div>

            <div className="bg-blue-50 dark:bg-blue-900/20 border-2 border-blue-200 dark:border-blue-800 rounded-lg p-4">
              <p className="text-sm text-blue-800 dark:text-blue-200">
                <strong>Note:</strong> Scraping runs in the background. Jobs will be saved to your dashboard automatically. This may take a few minutes.
              </p>
            </div>

            <div className="flex space-x-4 pt-4">
              <button
                onClick={handleScrape}
                disabled={loading || !formData.keywords || formData.sources.length === 0}
                className="flex-1 px-6 py-3 bg-black dark:bg-white text-white dark:text-black rounded-lg font-semibold hover:bg-gray-800 dark:hover:bg-gray-200 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Starting...' : '🚀 Start Scraping'}
              </button>
              <button
                onClick={onClose}
                className="px-6 py-3 border-2 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg font-semibold hover:border-black dark:hover:border-white transition"
              >
                Cancel
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
