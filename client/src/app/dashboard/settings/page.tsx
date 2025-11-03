'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import { CustomCursor } from '../../../components/CustomCursor';
import { ParticleBackground } from '../../../components/ParticleBackground';
import { GlassCard } from '../../../components/GlassCard';

export default function SettingsPage() {
  const [darkMode, setDarkMode] = useState(false);
  const [email, setEmail] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [isChangingEmail, setIsChangingEmail] = useState(false);

  useEffect(() => {
    // Get user info from localStorage
    const userStr = localStorage.getItem('user');
    if (userStr) {
      try {
        const user = JSON.parse(userStr);
        setEmail(user.email || '');
        setNewEmail(user.email || '');
      } catch (e) {
        console.error('Error parsing user data:', e);
      }
    }

    // Check for dark mode preference
    const savedDarkMode = localStorage.getItem('darkMode') === 'true';
    setDarkMode(savedDarkMode);
    if (savedDarkMode) {
      document.documentElement.classList.add('dark');
    }
  }, []);

  const handleDarkModeToggle = () => {
    const newDarkMode = !darkMode;
    setDarkMode(newDarkMode);
    localStorage.setItem('darkMode', newDarkMode.toString());
    
    if (newDarkMode) {
      document.documentElement.classList.add('dark');
      toast.success('🌙 Dark mode enabled', {
        style: {
          background: '#1f2937',
          color: '#fff',
        },
      });
    } else {
      document.documentElement.classList.remove('dark');
      toast.success('☀️ Light mode enabled', {
        style: {
          background: '#fff',
          color: '#000',
        },
      });
    }
  };

  const handleEmailChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsChangingEmail(true);
    
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Update localStorage
      const userStr = localStorage.getItem('user');
      if (userStr) {
        const user = JSON.parse(userStr);
        user.email = newEmail;
        localStorage.setItem('user', JSON.stringify(user));
      }
      
      setEmail(newEmail);
      toast.success('Email updated successfully!');
    } catch (error) {
      toast.error('Failed to update email');
    } finally {
      setIsChangingEmail(false);
    }
  };

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
                <div className="w-10 h-10 bg-black rounded-lg flex items-center justify-center">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                </div>
                <span className="text-2xl font-bold text-black dark:text-white">MYATS</span>
              </div>
              
              <div className="flex space-x-6">
                <button 
                  onClick={() => window.location.href = '/dashboard'}
                  className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:text-black dark:hover:text-white font-medium transition"
                >
                  Dashboard
                </button>
                <button className="px-4 py-2 text-black dark:text-white font-medium border-b-2 border-black dark:border-white">
                  Settings
                </button>
              </div>
            </div>
            
            <button
              onClick={() => {
                localStorage.removeItem('token');
                window.location.href = '/login';
              }}
              className="px-6 py-2 bg-black dark:bg-white text-white dark:text-black rounded-lg font-medium hover:bg-gray-800 dark:hover:bg-gray-200 transition"
            >
              Logout
            </button>
          </div>
        </nav>

        <div className="max-w-4xl mx-auto px-6 py-8">
          <h1 className="text-4xl font-bold text-black dark:text-white mb-2 transition-colors">Settings</h1>
          <p className="text-gray-600 dark:text-gray-400 mb-8 transition-colors">Manage your account preferences</p>

          <div className="space-y-6">
            {/* Appearance Settings */}
            <GlassCard className="p-6" depth="medium">
              <h2 className="text-2xl font-bold text-black dark:text-white mb-4 transition-colors">Appearance</h2>
              
              <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800 rounded-xl transition-colors">
                <div>
                  <h3 className="font-semibold text-black dark:text-white mb-1 transition-colors">Theme</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400 transition-colors">Switch between light and dark mode</p>
                </div>
                <button
                  onClick={handleDarkModeToggle}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white focus:ring-offset-2 ${
                    darkMode ? 'bg-black' : 'bg-gray-300'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform duration-200 ${
                      darkMode ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>
              
              <div className="mt-4 text-sm text-gray-600 dark:text-gray-400 transition-colors">
                Current mode: <span className="font-semibold text-black dark:text-white transition-colors">{darkMode ? 'Dark' : 'Light'}</span>
              </div>
            </GlassCard>

            {/* Account Settings */}
            <GlassCard className="p-6" depth="medium">
              <h2 className="text-2xl font-bold text-black dark:text-white mb-4 transition-colors">Account</h2>
              
              <form onSubmit={handleEmailChange} className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 transition-colors">
                    Current Email
                  </label>
                  <input
                    type="email"
                    value={email}
                    disabled
                    className="w-full px-4 py-3 border-2 border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-300 transition-colors"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 transition-colors">
                    New Email Address
                  </label>
                  <input
                    type="email"
                    required
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    className="w-full px-4 py-3 border-2 border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-black dark:text-white focus:border-black dark:focus:border-white focus:outline-none transition-colors"
                    placeholder="Enter new email address"
                  />
                </div>
                
                <button
                  type="submit"
                  disabled={isChangingEmail || newEmail === email}
                  className="px-6 py-3 bg-black dark:bg-white text-white dark:text-black rounded-lg font-semibold hover:bg-gray-800 dark:hover:bg-gray-200 transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isChangingEmail ? 'Updating...' : 'Update Email'}
                </button>
              </form>
            </GlassCard>

            {/* Other Settings */}
            <GlassCard className="p-6" depth="medium">
              <h2 className="text-2xl font-bold text-black dark:text-white mb-4 transition-colors">Preferences</h2>
              
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800 rounded-xl transition-colors">
                  <div>
                    <h3 className="font-semibold text-black dark:text-white mb-1 transition-colors">Email Notifications</h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400 transition-colors">Receive email updates about your applications</p>
                  </div>
                  <input type="checkbox" defaultChecked className="w-5 h-5 rounded border-gray-300 dark:border-gray-600 text-black dark:text-white focus:ring-black dark:focus:ring-white transition-colors" />
                </div>
                
                <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800 rounded-xl transition-colors">
                  <div>
                    <h3 className="font-semibold text-black dark:text-white mb-1 transition-colors">Weekly Reports</h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400 transition-colors">Get weekly summaries of your job search progress</p>
                  </div>
                  <input type="checkbox" defaultChecked className="w-5 h-5 rounded border-gray-300 dark:border-gray-600 text-black dark:text-white focus:ring-black dark:focus:ring-white transition-colors" />
                </div>
              </div>
            </GlassCard>
          </div>
        </div>
      </div>
    </>
  );
}

