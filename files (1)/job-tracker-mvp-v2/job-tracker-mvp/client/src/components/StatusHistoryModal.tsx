'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { applicationsAPI } from '../lib/api';
import toast from 'react-hot-toast';

interface StatusUpdate {
  id: string;
  detected_status: string;
  confidence_score: number;
  email_subject: string;
  email_from: string;
  email_body_snippet: string;
  created_at: string;
}

interface StatusHistoryModalProps {
  applicationId: string;
  applicationCompany: string;
  isOpen: boolean;
  onClose: () => void;
  onStatusUpdate?: () => void;
}

export function StatusHistoryModal({
  applicationId,
  applicationCompany,
  isOpen,
  onClose,
  onStatusUpdate,
}: StatusHistoryModalProps) {
  const [history, setHistory] = useState<StatusUpdate[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isOpen && applicationId) {
      fetchHistory();
    }
  }, [isOpen, applicationId]);

  const fetchHistory = async () => {
    try {
      setLoading(true);
      const data = await applicationsAPI.getStatusHistory(applicationId);
      setHistory(data.history || data.statusHistory || []);
    } catch (error: any) {
      toast.error('Failed to load status history');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const submitCorrection = async (update: StatusUpdate) => {
    const correctedStatus = window.prompt(
      'Enter corrected status (e.g. APPLIED, UNDER_REVIEW, INTERVIEW_SCHEDULED, OFFERED, REJECTED):',
      update.detected_status
    );
    if (!correctedStatus || correctedStatus.trim() === '') return;

    try {
      await applicationsAPI.correctStatus(applicationId, {
        detectedStatus: update.detected_status,
        correctedStatus: correctedStatus.trim().toUpperCase(),
        emailSubject: update.email_subject,
        emailBody: update.email_body_snippet,
      });
      toast.success('Correction recorded');
      if (onStatusUpdate) onStatusUpdate();
    } catch (error: any) {
      toast.error(error?.message || 'Failed to save correction');
    }
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      REJECTED: 'bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200',
      INTERVIEW_SCHEDULED: 'bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200',
      OFFERED: 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200',
      ACCEPTED: 'bg-emerald-100 dark:bg-emerald-900 text-emerald-800 dark:text-emerald-200',
      PENDING_RESPONSE: 'bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200',
      UNDER_REVIEW: 'bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-200',
      GHOSTED: 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200',
    };
    return colors[status] || 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200';
  };

  const getStatusLabel = (status: string) => {
    return status.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());
  };

  const getConfidenceColor = (score: number) => {
    if (score >= 0.8) return 'text-green-600 dark:text-green-400';
    if (score >= 0.6) return 'text-yellow-600 dark:text-yellow-400';
    return 'text-red-600 dark:text-red-400';
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          className="bg-white dark:bg-gray-800 rounded-2xl p-8 max-w-3xl w-full max-h-[90vh] overflow-y-auto transition-colors"
        >
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-3xl font-bold text-black dark:text-white transition-colors">
                Status Update History
              </h2>
              <p className="text-gray-600 dark:text-gray-400 mt-1 transition-colors">
                {applicationCompany}
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

          {loading ? (
            <div className="text-center py-12">
              <div className="w-12 h-12 border-4 border-black border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
              <p className="text-gray-600 dark:text-gray-400">Loading history...</p>
            </div>
          ) : history.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-6xl mb-4">📧</div>
              <h3 className="text-xl font-semibold text-black dark:text-white mb-2 transition-colors">
                No Status Updates Yet
              </h3>
              <p className="text-gray-600 dark:text-gray-400 transition-colors">
                Status updates from emails will appear here once email sync is enabled
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {history.map((update, idx) => (
                <motion.div
                  key={update.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.1 }}
                  className="border-2 border-gray-200 dark:border-gray-700 rounded-xl p-6 hover:border-black dark:hover:border-white transition-colors"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center space-x-3">
                      <span className={`px-3 py-1 rounded-full text-sm font-semibold ${getStatusColor(update.detected_status)}`}>
                        {getStatusLabel(update.detected_status)}
                      </span>
                      <span className={`text-sm font-medium ${getConfidenceColor(update.confidence_score)}`}>
                        {Math.round(update.confidence_score * 100)}% confidence
                      </span>
                    </div>
                    <span className="text-sm text-gray-600 dark:text-gray-400">
                      {new Date(update.created_at).toLocaleString()}
                    </span>
                  </div>

                  <div className="mb-3">
                    <div className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">
                      From: {update.email_from}
                    </div>
                    <div className="text-sm font-medium text-black dark:text-white mb-2">
                      Subject: {update.email_subject}
                    </div>
                  </div>

                  {update.email_body_snippet && (
                    <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4 mb-3">
                      <p className="text-sm text-gray-700 dark:text-gray-300 line-clamp-3">
                        {update.email_body_snippet}
                      </p>
                    </div>
                  )}

                  <div className="mt-3 flex justify-end">
                    <button
                      onClick={() => submitCorrection(update)}
                      className="px-3 py-1 text-xs font-semibold rounded-lg border border-gray-300 dark:border-gray-600 hover:border-black dark:hover:border-white transition-colors"
                    >
                      Report Incorrect Status
                    </button>
                  </div>

                  <div className="flex items-center space-x-2">
                    <div className="flex-1 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                      <div
                        className={`h-full ${
                          update.confidence_score >= 0.8
                            ? 'bg-green-500'
                            : update.confidence_score >= 0.6
                            ? 'bg-yellow-500'
                            : 'bg-red-500'
                        }`}
                        style={{ width: `${update.confidence_score * 100}%` }}
                      />
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          )}

          <div className="mt-6 flex justify-end">
            <button
              onClick={onClose}
              className="px-6 py-3 border-2 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg font-semibold hover:border-black dark:hover:border-white transition"
            >
              Close
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
