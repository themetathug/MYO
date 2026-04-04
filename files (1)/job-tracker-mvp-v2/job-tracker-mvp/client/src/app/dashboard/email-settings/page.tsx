'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import { emailSettingsAPI, emailParserAPI } from '../../../lib/api';
import { CustomCursor } from '../../../components/CustomCursor';
import { ParticleBackground } from '../../../components/ParticleBackground';
import { GlassCard } from '../../../components/GlassCard';

export default function EmailSettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [settings, setSettings] = useState({
    emailSyncEnabled: false,
    ghostingThresholdDays: 25,
    notificationPreferences: {
      statusUpdates: true,
      ghostingAlerts: true,
      interviewReminders: true,
    },
  });
  const [credentials, setCredentials] = useState({
    email: '',
    password: '',
    host: '',
    port: 993,
    tls: true,
    provider: 'gmail' as 'gmail' | 'outlook' | 'imap',
  });
  const [showCredentials, setShowCredentials] = useState(false);
  const [lastSync, setLastSync] = useState<string | null>(null);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const data = await emailSettingsAPI.get();
      if (data.settings) {
        setSettings({
          emailSyncEnabled: data.settings.emailSyncEnabled || false,
          ghostingThresholdDays: data.settings.ghostingThresholdDays || 25,
          notificationPreferences: data.settings.notificationPreferences || {
            statusUpdates: true,
            ghostingAlerts: true,
            interviewReminders: true,
          },
        });
      }
      if (data.lastSync) {
        setLastSync(data.lastSync);
      }
    } catch (error: any) {
      console.error('Failed to fetch settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleProviderChange = (provider: 'gmail' | 'outlook' | 'imap') => {
    setCredentials({ ...credentials, provider });
    if (provider === 'gmail') {
      emailParserAPI.getGmailConfig().then((config) => {
        setCredentials({
          ...credentials,
          provider: 'gmail',
          host: config.host,
          port: config.port,
          tls: config.tls,
        });
      });
    } else if (provider === 'outlook') {
      emailParserAPI.getOutlookConfig().then((config) => {
        setCredentials({
          ...credentials,
          provider: 'outlook',
          host: config.host,
          port: config.port,
          tls: config.tls,
        });
      });
    }
  };

  const handleSaveSettings = async () => {
    try {
      setSaving(true);
      await emailSettingsAPI.update(settings);
      toast.success('Settings saved successfully!');
    } catch (error: any) {
      toast.error(error.message || 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveCredentials = async () => {
    try {
      setSaving(true);
      await emailSettingsAPI.setCredentials(credentials);
      toast.success('Email credentials saved securely!');
      setShowCredentials(false);
      setCredentials({ ...credentials, password: '' });
    } catch (error: any) {
      toast.error(error.message || 'Failed to save credentials');
    } finally {
      setSaving(false);
    }
  };

  const handleTestConnection = async () => {
    try {
      setTesting(true);
      await emailSettingsAPI.testConnection();
      toast.success('Connection test successful! ✅');
    } catch (error: any) {
      toast.error(error.message || 'Connection test failed');
    } finally {
      setTesting(false);
    }
  };

  const [syncing, setSyncing] = useState(false);

  const handleSyncNow = async () => {
    try {
      setSyncing(true);
      const result = await emailSettingsAPI.syncNow();
      toast.success(
        `Sync complete: ${result.emailsProcessed} emails processed, ${result.statusUpdates} status updates applied.`
      );
      setLastSync(new Date().toISOString());
    } catch (error: any) {
      toast.error(error.message || 'Sync failed. Make sure email is configured.');
    } finally {
      setSyncing(false);
    }
  };

  if (loading) {
    return (
      <>
        <CustomCursor />
        <ParticleBackground />
        <div className="min-h-screen bg-white flex items-center justify-center">
          <div className="text-center">
            <div className="w-16 h-16 border-4 border-black border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-xl font-semibold text-black">Loading settings...</p>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <CustomCursor />
      <ParticleBackground />
      
      <div className="min-h-screen bg-white dark:bg-gray-900 transition-colors">
        {/* Navigation */}
        <nav className="bg-white dark:bg-gray-800 border-b-2 border-gray-200 dark:border-gray-700 px-6 py-4 transition-colors">
          <div className="max-w-7xl mx-auto flex items-center justify-between">
            <div className="flex items-center space-x-8">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-black dark:bg-white rounded-lg flex items-center justify-center transition-colors">
                  <svg className="w-6 h-6 text-white dark:text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                </div>
                <span className="text-2xl font-bold text-black dark:text-white transition-colors">MYATS</span>
              </div>
              
              <div className="flex space-x-6">
                <button 
                  onClick={() => window.location.href = '/dashboard'}
                  className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:text-black dark:hover:text-white font-medium transition"
                >
                  Dashboard
                </button>
                <button 
                  onClick={() => window.location.href = '/dashboard/applications'}
                  className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:text-black dark:hover:text-white font-medium transition"
                >
                  Applications
                </button>
                <button className="px-4 py-2 text-black dark:text-white font-medium border-b-2 border-black dark:border-white">
                  Email Settings
                </button>
              </div>
            </div>
          </div>
        </nav>

        <div className="max-w-4xl mx-auto px-6 py-8">
          <div className="mb-8">
            <h1 className="text-4xl font-bold text-black dark:text-white mb-2 transition-colors">
              Email Sync Settings
            </h1>
            <p className="text-gray-600 dark:text-gray-400 transition-colors">
              Configure automatic status tracking from your email
            </p>
          </div>

          {/* Email Sync Toggle */}
          <GlassCard className="p-6 mb-6" depth="medium">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-2xl font-bold text-black dark:text-white mb-2 transition-colors">
                  Enable Email Sync
                </h2>
                <p className="text-gray-600 dark:text-gray-400 transition-colors">
                  Automatically track application status from emails
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.emailSyncEnabled}
                  onChange={(e) => setSettings({ ...settings, emailSyncEnabled: e.target.checked })}
                  className="sr-only peer"
                />
                <div className="w-14 h-7 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-black/20 dark:peer-focus:ring-white/20 dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all dark:border-gray-600 peer-checked:bg-black dark:peer-checked:bg-white"></div>
              </label>
            </div>

            {lastSync && (
              <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4">
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Last sync: {new Date(lastSync).toLocaleString()}
                </p>
              </div>
            )}
          </GlassCard>

          {/* Email Credentials */}
          <GlassCard className="p-6 mb-6" depth="medium">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-2xl font-bold text-black dark:text-white mb-2 transition-colors">
                  Email Account
                </h2>
                <p className="text-gray-600 dark:text-gray-400 transition-colors">
                  Connect your email account for automatic status tracking
                </p>
              </div>
              <button
                onClick={() => setShowCredentials(!showCredentials)}
                className="px-4 py-2 bg-black dark:bg-white text-white dark:text-black rounded-lg font-semibold hover:bg-gray-800 dark:hover:bg-gray-200 transition"
              >
                {showCredentials ? 'Hide' : 'Configure'}
              </button>
            </div>

            {showCredentials && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="space-y-4"
              >
                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 transition-colors">
                    Email Provider
                  </label>
                  <select
                    value={credentials.provider}
                    onChange={(e) => handleProviderChange(e.target.value as 'gmail' | 'outlook' | 'imap')}
                    className="w-full px-4 py-3 border-2 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-black dark:text-white rounded-lg focus:border-black dark:focus:border-white focus:outline-none transition-colors"
                  >
                    <option value="gmail">Gmail</option>
                    <option value="outlook">Outlook</option>
                    <option value="imap">Custom IMAP</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 transition-colors">
                    Email Address
                  </label>
                  <input
                    type="email"
                    value={credentials.email}
                    onChange={(e) => setCredentials({ ...credentials, email: e.target.value })}
                    className="w-full px-4 py-3 border-2 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-black dark:text-white rounded-lg focus:border-black dark:focus:border-white focus:outline-none transition-colors"
                    placeholder="your.email@example.com"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 transition-colors">
                    Password / App Password
                  </label>
                  <input
                    type="password"
                    value={credentials.password}
                    onChange={(e) => setCredentials({ ...credentials, password: e.target.value })}
                    className="w-full px-4 py-3 border-2 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-black dark:text-white rounded-lg focus:border-black dark:focus:border-white focus:outline-none transition-colors"
                    placeholder="Enter your password or app password"
                  />
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    For Gmail, use an App Password. For Outlook, use your account password or app password.
                  </p>
                </div>

                {credentials.provider === 'imap' && (
                  <>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 transition-colors">
                          IMAP Host
                        </label>
                        <input
                          type="text"
                          value={credentials.host}
                          onChange={(e) => setCredentials({ ...credentials, host: e.target.value })}
                          className="w-full px-4 py-3 border-2 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-black dark:text-white rounded-lg focus:border-black dark:focus:border-white focus:outline-none transition-colors"
                          placeholder="imap.example.com"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 transition-colors">
                          Port
                        </label>
                        <input
                          type="number"
                          value={credentials.port}
                          onChange={(e) => setCredentials({ ...credentials, port: parseInt(e.target.value) || 993 })}
                          className="w-full px-4 py-3 border-2 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-black dark:text-white rounded-lg focus:border-black dark:focus:border-white focus:outline-none transition-colors"
                          placeholder="993"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          checked={credentials.tls}
                          onChange={(e) => setCredentials({ ...credentials, tls: e.target.checked })}
                          className="w-4 h-4"
                        />
                        <span className="text-sm text-gray-700 dark:text-gray-300">Use TLS/SSL</span>
                      </label>
                    </div>
                  </>
                )}

                <div className="flex space-x-4">
                  <button
                    onClick={handleSaveCredentials}
                    disabled={saving || !credentials.email || !credentials.password}
                    className="flex-1 px-6 py-3 bg-black dark:bg-white text-white dark:text-black rounded-lg font-semibold hover:bg-gray-800 dark:hover:bg-gray-200 transition disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {saving ? 'Saving...' : 'Save Credentials'}
                  </button>
                  <button
                    onClick={handleTestConnection}
                    disabled={testing || !credentials.email || !credentials.password}
                    className="px-6 py-3 border-2 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg font-semibold hover:border-black dark:hover:border-white transition disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {testing ? 'Testing...' : 'Test Connection'}
                  </button>
                </div>
              </motion.div>
            )}
          </GlassCard>

          {/* Manual Sync */}
          <GlassCard className="p-6 mb-6" depth="medium">
            <h2 className="text-2xl font-bold text-black dark:text-white mb-2 transition-colors">
              Manual Sync
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              Trigger an immediate email scan to update application statuses now, without waiting for the next scheduled cron run.
              {lastSync && (
                <span className="block mt-1 text-xs text-gray-400">
                  Last sync: {new Date(lastSync).toLocaleString()}
                </span>
              )}
            </p>
            <button
              onClick={handleSyncNow}
              disabled={syncing}
              className="px-6 py-3 bg-black dark:bg-white text-white dark:text-black rounded-lg font-semibold hover:bg-gray-800 dark:hover:bg-gray-100 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {syncing ? '⏳ Syncing...' : '🔄 Sync Emails Now'}
            </button>
          </GlassCard>

          {/* Notification Preferences */}
          <GlassCard className="p-6 mb-6" depth="medium">
            <h2 className="text-2xl font-bold text-black dark:text-white mb-6 transition-colors">
              Notification Preferences
            </h2>
            <div className="space-y-4">
              <label className="flex items-center justify-between p-4 border-2 border-gray-200 dark:border-gray-700 rounded-lg hover:border-black dark:hover:border-white transition-colors cursor-pointer">
                <div>
                  <div className="font-semibold text-black dark:text-white transition-colors">
                    Status Updates
                  </div>
                  <div className="text-sm text-gray-600 dark:text-gray-400 transition-colors">
                    Notify when application status changes
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={settings.notificationPreferences.statusUpdates}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      notificationPreferences: {
                        ...settings.notificationPreferences,
                        statusUpdates: e.target.checked,
                      },
                    })
                  }
                  className="w-5 h-5"
                />
              </label>

              <label className="flex items-center justify-between p-4 border-2 border-gray-200 dark:border-gray-700 rounded-lg hover:border-black dark:hover:border-white transition-colors cursor-pointer">
                <div>
                  <div className="font-semibold text-black dark:text-white transition-colors">
                    Ghosting Alerts
                  </div>
                  <div className="text-sm text-gray-600 dark:text-gray-400 transition-colors">
                    Alert when applications are marked as ghosted
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={settings.notificationPreferences.ghostingAlerts}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      notificationPreferences: {
                        ...settings.notificationPreferences,
                        ghostingAlerts: e.target.checked,
                      },
                    })
                  }
                  className="w-5 h-5"
                />
              </label>

              <label className="flex items-center justify-between p-4 border-2 border-gray-200 dark:border-gray-700 rounded-lg hover:border-black dark:hover:border-white transition-colors cursor-pointer">
                <div>
                  <div className="font-semibold text-black dark:text-white transition-colors">
                    Interview Reminders
                  </div>
                  <div className="text-sm text-gray-600 dark:text-gray-400 transition-colors">
                    Remind about upcoming interviews
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={settings.notificationPreferences.interviewReminders}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      notificationPreferences: {
                        ...settings.notificationPreferences,
                        interviewReminders: e.target.checked,
                      },
                    })
                  }
                  className="w-5 h-5"
                />
              </label>
            </div>
          </GlassCard>

          {/* Ghosting Threshold */}
          <GlassCard className="p-6 mb-6" depth="medium">
            <h2 className="text-2xl font-bold text-black dark:text-white mb-4 transition-colors">
              Default Ghosting Threshold
            </h2>
            <p className="text-gray-600 dark:text-gray-400 mb-4 transition-colors">
              Days without response before marking as "Ghosted" (default for new applications)
            </p>
            <div className="mb-4">
              <input
                type="range"
                min="15"
                max="45"
                value={settings.ghostingThresholdDays}
                onChange={(e) => setSettings({ ...settings, ghostingThresholdDays: parseInt(e.target.value) })}
                className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-black dark:accent-white"
              />
              <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mt-1">
                <span>15 days</span>
                <span className="text-lg font-bold text-black dark:text-white">
                  {settings.ghostingThresholdDays} days
                </span>
                <span>45 days</span>
              </div>
            </div>
          </GlassCard>

          {/* Save Button */}
          <div className="flex justify-end">
            <button
              onClick={handleSaveSettings}
              disabled={saving}
              className="px-8 py-3 bg-black dark:bg-white text-white dark:text-black rounded-lg font-semibold hover:bg-gray-800 dark:hover:bg-gray-200 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? 'Saving...' : 'Save All Settings'}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
