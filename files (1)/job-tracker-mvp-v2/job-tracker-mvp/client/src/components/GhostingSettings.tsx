'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { applicationsAPI } from '../lib/api';
import toast from 'react-hot-toast';

interface GhostingSettingsProps {
  applicationId: string;
  currentThreshold?: number;
  autoStatusEnabled?: boolean;
  appliedAt?: string;
  onUpdate?: () => void;
}

export function GhostingSettings({
  applicationId,
  currentThreshold = 25,
  autoStatusEnabled = true,
  appliedAt,
  onUpdate,
}: GhostingSettingsProps) {
  const [threshold, setThreshold] = useState(currentThreshold);
  const [autoStatus, setAutoStatus] = useState(autoStatusEnabled);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setThreshold(currentThreshold);
    setAutoStatus(autoStatusEnabled);
  }, [currentThreshold, autoStatusEnabled]);

  const daysSinceApplication = appliedAt
    ? Math.floor((Date.now() - new Date(appliedAt).getTime()) / (1000 * 60 * 60 * 24))
    : 0;

  const daysUntilGhosting = Math.max(0, threshold - daysSinceApplication);
  const isWarning = daysUntilGhosting <= 5 && daysUntilGhosting > 0;
  const isGhosted = daysSinceApplication >= threshold;

  const handleSaveThreshold = async () => {
    try {
      setSaving(true);
      await applicationsAPI.setGhostingThreshold(applicationId, threshold);
      toast.success('Ghosting threshold updated!');
      onUpdate?.();
    } catch (error: any) {
      toast.error('Failed to update threshold');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleAutoStatus = async (enabled: boolean) => {
    try {
      setSaving(true);
      await applicationsAPI.enableAutoStatus(applicationId, enabled);
      setAutoStatus(enabled);
      toast.success(`Auto-status tracking ${enabled ? 'enabled' : 'disabled'}`);
      onUpdate?.();
    } catch (error: any) {
      toast.error('Failed to update setting');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-black dark:text-white transition-colors">
            Auto-Status Tracking
          </h3>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={autoStatus}
              onChange={(e) => handleToggleAutoStatus(e.target.checked)}
              disabled={saving}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-black/20 dark:peer-focus:ring-white/20 dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-black dark:peer-checked:bg-white"></div>
          </label>
        </div>
        <p className="text-sm text-gray-600 dark:text-gray-400 transition-colors">
          Automatically update application status based on emails from companies
        </p>
      </div>

      <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold text-black dark:text-white transition-colors mb-1">
              Ghosting Threshold
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 transition-colors">
              Days without response before marking as "Ghosted"
            </p>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold text-black dark:text-white transition-colors">
              {threshold} days
            </div>
          </div>
        </div>

        <div className="mb-4">
          <input
            type="range"
            min="15"
            max="45"
            value={threshold}
            onChange={(e) => setThreshold(parseInt(e.target.value))}
            className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-black dark:accent-white"
          />
          <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mt-1">
            <span>15 days</span>
            <span>30 days</span>
            <span>45 days</span>
          </div>
        </div>

        <button
          onClick={handleSaveThreshold}
          disabled={saving || threshold === currentThreshold}
          className="w-full px-4 py-2 bg-black dark:bg-white text-white dark:text-black rounded-lg font-semibold hover:bg-gray-800 dark:hover:bg-gray-200 transition disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {saving ? 'Saving...' : 'Save Threshold'}
        </button>
      </div>

      {appliedAt && (
        <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Days since application:
              </span>
              <span className="text-lg font-semibold text-black dark:text-white">
                {daysSinceApplication} days
              </span>
            </div>

            {isGhosted ? (
              <div className="bg-red-50 dark:bg-red-900/20 border-2 border-red-200 dark:border-red-800 rounded-lg p-4">
                <div className="flex items-center space-x-2">
                  <span className="text-2xl">👻</span>
                  <div>
                    <div className="font-semibold text-red-800 dark:text-red-200">
                      Application Ghosted
                    </div>
                    <div className="text-sm text-red-600 dark:text-red-400">
                      No response after {threshold} days
                    </div>
                  </div>
                </div>
              </div>
            ) : isWarning ? (
              <div className="bg-yellow-50 dark:bg-yellow-900/20 border-2 border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
                <div className="flex items-center space-x-2">
                  <span className="text-2xl">⚠️</span>
                  <div>
                    <div className="font-semibold text-yellow-800 dark:text-yellow-200">
                      Approaching Ghosting Threshold
                    </div>
                    <div className="text-sm text-yellow-600 dark:text-yellow-400">
                      {daysUntilGhosting} days until auto-marked as ghosted
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-green-50 dark:bg-green-900/20 border-2 border-green-200 dark:border-green-800 rounded-lg p-4">
                <div className="flex items-center space-x-2">
                  <span className="text-2xl">✅</span>
                  <div>
                    <div className="font-semibold text-green-800 dark:text-green-200">
                      Within Response Window
                    </div>
                    <div className="text-sm text-green-600 dark:text-green-400">
                      {daysUntilGhosting} days remaining before ghosting threshold
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
