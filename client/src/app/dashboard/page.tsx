'use client';

import { useState, useEffect } from 'react';
import { Line, Doughnut, Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
  BarElement,
} from 'chart.js';
import toast from 'react-hot-toast';
import { motion } from 'framer-motion';
import { CustomCursor } from '../../components/CustomCursor';
import { ParticleBackground } from '../../components/ParticleBackground';
import { GlassCard } from '../../components/GlassCard';
import { FlipCard } from '../../components/FlipCard';
import { applicationsAPI } from '../../lib/api';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
  BarElement
);

export default function Dashboard() {
  const [timeRange, setTimeRange] = useState('30');
  const [loading, setLoading] = useState(true);
  const [applications, setApplications] = useState<any[]>([]);
  const [showAIModal, setShowAIModal] = useState(false);
  const [userInfo, setUserInfo] = useState({ email: '', firstName: '', lastName: '' });
  const [activeMenuItem, setActiveMenuItem] = useState('dashboard');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [notificationCount, setNotificationCount] = useState(0);
  const [stats, setStats] = useState({
    totalApplications: 0,
    weeklyApplications: 0,
    lastWeekApplications: 0,
    monthlyApplications: 0,
    avgApplicationsPerDay: 0,
    interviews: 0,
    offers: 0,
    pending: 0,
    averageTimePerApp: 0,
    fastestTime: 0,
    slowestTime: 0,
    targetTime: 20,
    improvement: 0,
    responseRate: 0,
    previousResponseRate: 0,
    responsesReceived: 0,
    currentStreak: 0,
    previousStreak: 0,
    longestStreak: 0,
    weeklyGoal: 15,
    weeklyAchievement: 0,
    coldEmailsSent: 0,
    coldEmailResponses: 0,
    coldEmailConversionRate: 0,
    bestDayOfWeek: 'N/A',
    bestTimeOfDay: 'N/A',
    averageResponseTime: 0,
    totalTimeSpent: 0,
    dailyCounts: {} as Record<string, number>,
    cvVersionPerformance: [] as Array<{ name: string; conversionRate: number; interviews: number; applications: number }>
  });

  const [chartData, setChartData] = useState({
    lineChart: {
      labels: [] as string[],
      data: [] as number[],
    },
    statusChart: {} as Record<string, number>,
    sourceChart: {} as Record<string, number>,
  });

  const [sourcePerformance, setSourcePerformance] = useState<Array<{
    source: string;
    count: number;
    conversionRate: number;
    avgResponseTime: number;
  }>>([]);

  // Fetch real data from backend
  const fetchData = async () => {
      try {
        setLoading(true);
        
        // Fetch applications and stats
        const [applicationsData, statsData] = await Promise.all([
          applicationsAPI.getAll({ limit: 100 }),
          applicationsAPI.getStats(parseInt(timeRange)),
        ]);

        setApplications(applicationsData.applications || []);
        
        // Process stats
        const apps = applicationsData.applications || [];
        const byStatus = statsData.byStatus || {};
        
        // Group applications by date for trend chart
        const dateGroups = apps.reduce((acc: any, app: any) => {
          const date = new Date(app.applied_at || app.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
          acc[date] = (acc[date] || 0) + 1;
          return acc;
        }, {});

        // Group by source
        const sourceGroups = apps.reduce((acc: any, app: any) => {
          const source = app.job_board_source || 'Unknown';
          acc[source] = (acc[source] || 0) + 1;
          return acc;
        }, {});

        // Enhanced source chart with performance data from backend
        const sourcePerf = (statsData.sourcePerformance || []).map((source: any) => ({
          source: source.source,
          count: source.count,
          conversionRate: source.conversionRate,
          avgResponseTime: source.avgResponseTime,
        }));

        const sourceChartEnhanced = sourcePerf.reduce((acc: any, source: any) => {
          acc[source.source] = source.count;
          return acc;
        }, {});

        setSourcePerformance(sourcePerf);

        setChartData({
          lineChart: {
            labels: Object.keys(dateGroups).slice(-7),
            data: Object.values(dateGroups).slice(-7) as number[],
          },
          statusChart: byStatus,
          sourceChart: Object.keys(sourceChartEnhanced).length > 0 ? sourceChartEnhanced : sourceGroups,
        });

        setStats({
          totalApplications: statsData.total || 0,
          weeklyApplications: statsData.weeklyApplications || 0,
          lastWeekApplications: statsData.lastWeekApplications || 0,
          monthlyApplications: statsData.monthlyApplications || 0,
          avgApplicationsPerDay: statsData.avgApplicationsPerDay || 0,
          interviews: statsData.interviews || 0,
          offers: statsData.offers || 0,
          pending: statsData.pending || 0,
          averageTimePerApp: Math.round(statsData.averageTimePerApplication || 0),
          fastestTime: Math.round(statsData.fastestTime || 0),
          slowestTime: Math.round(statsData.slowestTime || 0),
          targetTime: statsData.targetTime || 20,
          improvement: statsData.improvement || 0,
          responseRate: Math.round(statsData.responseRate || 0),
          previousResponseRate: Math.round(statsData.previousResponseRate || 0),
          responsesReceived: statsData.responsesReceived || 0,
          currentStreak: statsData.currentStreak || 0,
          previousStreak: statsData.previousStreak || 0,
          longestStreak: statsData.longestStreak || 0,
          weeklyGoal: statsData.weeklyGoal || 15,
          weeklyAchievement: Math.round(statsData.weeklyAchievement || 0),
          coldEmailsSent: statsData.coldEmailsSent || 0,
          coldEmailResponses: statsData.coldEmailResponses || 0,
          coldEmailConversionRate: Math.round(statsData.coldEmailConversionRate || 0),
          bestDayOfWeek: statsData.bestDayOfWeek || 'N/A',
          bestTimeOfDay: statsData.bestTimeOfDay || 'N/A',
          averageResponseTime: Math.round(statsData.averageResponseTime || 0),
          totalTimeSpent: statsData.totalTimeSpent || 0,
          dailyCounts: statsData.dailyCounts || {},
          cvVersionPerformance: [],
        });

        toast.success('Dashboard data loaded!');
      } catch (error: any) {
        console.error('Error fetching dashboard data:', error);
        const errorMessage = error.message || 'Unknown error';
        
        // Check if it's an auth error
        if (errorMessage.includes('authentication') || errorMessage.includes('session expired') || errorMessage.includes('401')) {
          toast.error('Your session expired. Please login again.', { duration: 5000 });
          setTimeout(() => {
            localStorage.removeItem('token');
            window.location.href = '/login?expired=true';
          }, 2000);
        } else if (errorMessage.includes('Failed to fetch') || errorMessage.includes('NetworkError')) {
          toast.error('Cannot connect to server. Make sure backend is running on port 3001.', { duration: 7000 });
        } else {
          toast.error('Failed to load dashboard data: ' + errorMessage);
        }
      } finally {
        setLoading(false);
      }
    };

  useEffect(() => {
    fetchData();
  }, [timeRange]);

  // Fetch user info from token
  useEffect(() => {
    const fetchUserInfo = async () => {
      const token = localStorage.getItem('token');
      if (token) {
        try {
          // Try to decode JWT token
          const payload = JSON.parse(atob(token.split('.')[1]));
          console.log('🔍 Token payload:', payload); // Debug log
          
          // Try multiple possible field names for email
          const email = payload.email || payload.username || payload.userEmail || payload.user?.email || payload.sub || '';
          
          // If email exists in token, use it
          if (email) {
            console.log('✅ Found email in token:', email); // Debug log
            const firstName = payload.firstName || payload.first_name || payload.name?.split(' ')[0] || email.split('@')[0] || 'User';
            const lastName = payload.lastName || payload.last_name || payload.name?.split(' ').slice(1).join(' ') || '';
            
            setUserInfo({
              email: email,
              firstName: firstName,
              lastName: lastName,
            });
            
            // Also store in localStorage for future use
            localStorage.setItem('userEmail', email);
          } else {
            // Fallback: try to get from localStorage
            const storedEmail = localStorage.getItem('userEmail');
            if (storedEmail) {
              console.log('✅ Found email in localStorage:', storedEmail); // Debug log
              setUserInfo({
                email: storedEmail,
                firstName: storedEmail.split('@')[0] || 'User',
                lastName: '',
              });
            } else {
              console.warn('⚠️ No email found in token or localStorage'); // Debug log
              // Set a default so it doesn't show "Loading..."
              setUserInfo({
                email: 'user@example.com',
                firstName: 'User',
                lastName: '',
              });
            }
          }
        } catch (e) {
          console.error('❌ Error decoding token:', e); // Debug log
          // If token decode fails, try localStorage
          const storedEmail = localStorage.getItem('userEmail');
          if (storedEmail) {
            console.log('✅ Using email from localStorage after error:', storedEmail);
            setUserInfo({
              email: storedEmail,
              firstName: storedEmail.split('@')[0] || 'User',
              lastName: '',
            });
          } else {
            // Set default
            setUserInfo({
              email: 'user@example.com',
              firstName: 'User',
              lastName: '',
            });
          }
        }
      } else {
        console.warn('⚠️ No token found in localStorage'); // Debug log
        // Try to get email from localStorage anyway
        const storedEmail = localStorage.getItem('userEmail');
        if (storedEmail) {
          setUserInfo({
            email: storedEmail,
            firstName: storedEmail.split('@')[0] || 'User',
            lastName: '',
          });
        }
      }
    };
    
    fetchUserInfo();
  }, []);

  // Chart data using real data
  const lineChartData = {
    labels: chartData.lineChart.labels.length > 0 ? chartData.lineChart.labels : ['No data yet'],
    datasets: [{
      label: 'Applications',
      data: chartData.lineChart.data.length > 0 ? chartData.lineChart.data : [0],
      borderColor: '#000000',
      backgroundColor: 'rgba(0, 0, 0, 0.1)',
      tension: 0.4,
    }]
  };

  const statusChartData = {
    labels: Object.keys(chartData.statusChart).length > 0 ? Object.keys(chartData.statusChart) : ['No data'],
    datasets: [{
      data: Object.keys(chartData.statusChart).length > 0 ? Object.values(chartData.statusChart) : [1],
      backgroundColor: ['#000000', '#333333', '#666666', '#999999', '#cccccc', '#e5e5e5'],
    }]
  };

  const sourceBarData = {
    labels: Object.keys(chartData.sourceChart).length > 0 ? Object.keys(chartData.sourceChart) : ['No data'],
    datasets: [{
      label: 'Applications',
      data: Object.keys(chartData.sourceChart).length > 0 ? Object.values(chartData.sourceChart) : [1],
      backgroundColor: '#000000',
    }]
  };

  if (loading) {
    return (
      <>
        <CustomCursor />
        <ParticleBackground />
        <div className="min-h-screen bg-white dark:bg-gray-900 flex items-center justify-center transition-colors">
          <div className="text-center">
            <div className="w-16 h-16 border-4 border-black dark:border-white border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-xl font-semibold text-black dark:text-white transition-colors">Loading your dashboard...</p>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <CustomCursor />
      <ParticleBackground />
      
      <div className="min-h-screen bg-white dark:bg-gray-900 flex transition-colors">
        {/* Left Sidebar */}
        <motion.aside 
          className={`bg-white dark:bg-gray-800 border-r-2 border-gray-200 dark:border-gray-700 flex flex-col transition-all duration-300 ${
            sidebarCollapsed ? 'w-20' : 'w-64'
          }`}
          initial={false}
          animate={{ width: sidebarCollapsed ? 80 : 256 }}
          style={{
            transformStyle: 'preserve-3d',
            perspective: '1000px',
            boxShadow: '10px 0 30px rgba(0, 0, 0, 0.1), inset -5px 0 20px rgba(0, 0, 0, 0.05)',
          }}
        >
          {/* Logo & Toggle */}
          <div className="p-6 border-b-2 border-gray-200 dark:border-gray-700 flex items-center justify-between transition-colors">
            {!sidebarCollapsed && (
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-black dark:bg-white rounded-lg flex items-center justify-center transition-colors">
                  <svg className="w-6 h-6 text-white dark:text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                </div>
                <span className="text-xl font-bold text-black dark:text-white transition-colors">MYATS</span>
              </div>
            )}
            <button
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              <svg className="w-5 h-5 text-gray-700 dark:text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                {sidebarCollapsed ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                )}
              </svg>
            </button>
          </div>

          {/* Menu */}
          <nav className="flex-1 p-4 space-y-1 overflow-y-auto" style={{ transformStyle: 'preserve-3d' }}>
            <div className="mb-6">
              {!sidebarCollapsed && (
                <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3 px-3 transition-colors">MENU</p>
              )}
              <motion.button
                onClick={() => setActiveMenuItem('dashboard')}
                whileHover={{ x: 5, scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className={`w-full flex items-center ${sidebarCollapsed ? 'justify-center' : 'space-x-3'} px-3 py-3 rounded-lg transition-all ${
                  activeMenuItem === 'dashboard'
                    ? 'bg-gray-100 dark:bg-gray-700 text-black dark:text-white border-l-4 border-black dark:border-white shadow-lg'
                    : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                }`}
                style={{
                  transformStyle: 'preserve-3d',
                  boxShadow: activeMenuItem === 'dashboard' 
                    ? '5px 5px 15px rgba(0, 0, 0, 0.1), inset 0 1px 0 rgba(255, 255, 255, 0.5)' 
                    : 'none'
                }}
                title="Dashboard"
              >
                <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                </svg>
                {!sidebarCollapsed && <span className="font-medium">Dashboard</span>}
              </motion.button>
              <motion.button
                onClick={() => window.location.href = '/dashboard/applications'}
                whileHover={{ x: 5, scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className={`w-full flex items-center ${sidebarCollapsed ? 'justify-center' : 'space-x-3'} px-3 py-3 rounded-lg transition-all ${
                  activeMenuItem === 'applications'
                    ? 'bg-gray-100 dark:bg-gray-700 text-black dark:text-white border-l-4 border-black dark:border-white shadow-lg'
                    : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                }`}
                style={{
                  transformStyle: 'preserve-3d',
                  boxShadow: activeMenuItem === 'applications' 
                    ? '5px 5px 15px rgba(0, 0, 0, 0.1), inset 0 1px 0 rgba(255, 255, 255, 0.5)' 
                    : 'none'
                }}
                title="Applications"
              >
                <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
                {!sidebarCollapsed && <span className="font-medium">Applications</span>}
              </motion.button>
              <motion.button
                onClick={() => window.location.href = '/dashboard/cold-emails'}
                whileHover={{ x: 5, scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className={`w-full flex items-center ${sidebarCollapsed ? 'justify-center' : 'space-x-3'} px-3 py-3 rounded-lg transition-all ${
                  activeMenuItem === 'cold-emails'
                    ? 'bg-gray-100 dark:bg-gray-700 text-black dark:text-white border-l-4 border-black dark:border-white shadow-lg'
                    : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                }`}
                style={{
                  transformStyle: 'preserve-3d',
                  boxShadow: activeMenuItem === 'cold-emails' 
                    ? '5px 5px 15px rgba(0, 0, 0, 0.1), inset 0 1px 0 rgba(255, 255, 255, 0.5)' 
                    : 'none'
                }}
                title="Cold Emails"
              >
                <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                {!sidebarCollapsed && <span className="font-medium">Cold Emails</span>}
              </motion.button>
              
              {/* Add Application Button in Sidebar */}
              <motion.button
                onClick={() => setShowAIModal(true)}
                whileHover={{ x: 5, scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className={`w-full flex items-center ${sidebarCollapsed ? 'justify-center' : 'space-x-3'} px-3 py-2 mt-2 rounded-lg bg-black dark:bg-white text-white dark:text-black hover:bg-gray-800 dark:hover:bg-gray-200 transition-all`}
                style={{ 
                  transformStyle: 'preserve-3d',
                  boxShadow: '0 4px 15px rgba(0, 0, 0, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.1)'
                }}
                title="Upcoming Features"
              >
                <svg className={`${sidebarCollapsed ? 'w-4 h-4' : 'w-4 h-4'} flex-shrink-0`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
                </svg>
                {!sidebarCollapsed && <span className="font-medium text-sm">Upcoming Features</span>}
              </motion.button>
            </div>

            {/* General Section */}
            <div className="mt-8">
              {!sidebarCollapsed && (
                <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3 px-3 transition-colors">GENERAL</p>
              )}
              <motion.button 
                onClick={() => {
                  toast.success('No new notifications');
                  setNotificationCount(0);
                }}
                whileHover={{ x: 5, scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className={`w-full flex items-center ${sidebarCollapsed ? 'justify-center' : 'space-x-3'} px-3 py-3 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-all relative`}
                style={{ transformStyle: 'preserve-3d' }}
                title="Notifications"
              >
                <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
                {!sidebarCollapsed && <span className="font-medium">Notifications</span>}
                {notificationCount > 0 && (
                  <span className="absolute top-2 right-2 w-2 h-2 bg-black dark:bg-white rounded-full animate-pulse"></span>
                )}
              </motion.button>
              <motion.button 
                onClick={() => window.location.href = '/dashboard/settings'}
                whileHover={{ x: 5, scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className={`w-full flex items-center ${sidebarCollapsed ? 'justify-center' : 'space-x-3'} px-3 py-3 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-all`}
                style={{ transformStyle: 'preserve-3d' }}
                title="Settings"
              >
                <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                {!sidebarCollapsed && <span className="font-medium">Settings</span>}
              </motion.button>
              <motion.button 
                whileHover={{ x: 5, scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className={`w-full flex items-center ${sidebarCollapsed ? 'justify-center' : 'space-x-3'} px-3 py-3 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-all`}
                style={{ transformStyle: 'preserve-3d' }}
                title="Help"
              >
                <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {!sidebarCollapsed && <span className="font-medium">Help</span>}
              </motion.button>
              <motion.button
                onClick={() => {
                  localStorage.removeItem('token');
                  window.location.href = '/login';
                }}
                whileHover={{ x: 5, scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className={`w-full flex items-center ${sidebarCollapsed ? 'justify-center' : 'space-x-3'} px-3 py-3 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-all`}
                style={{ transformStyle: 'preserve-3d' }}
                title="Logout"
              >
                <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
                {!sidebarCollapsed && <span className="font-medium">Logout</span>}
              </motion.button>
            </div>
          </nav>

          {/* User Profile at Bottom */}
          <div className="p-4 border-t-2 border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 transition-colors">
            <div className={`flex items-center ${sidebarCollapsed ? 'justify-center' : 'space-x-3'}`}>
              <div className="w-10 h-10 bg-black dark:bg-white rounded-full flex items-center justify-center flex-shrink-0 ring-2 ring-gray-200 dark:ring-gray-600 transition-colors">
                <span className="text-white dark:text-black font-semibold text-sm">
                  {userInfo.firstName?.[0]?.toUpperCase() || userInfo.email?.[0]?.toUpperCase() || 'U'}
                </span>
              </div>
              {!sidebarCollapsed && (
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-black dark:text-white truncate transition-colors">
                    {userInfo.firstName && userInfo.lastName 
                      ? `${userInfo.firstName} ${userInfo.lastName}`
                      : userInfo.firstName || userInfo.email?.split('@')[0] || 'User'}
                  </p>
                  <p className="text-xs text-gray-600 dark:text-gray-400 truncate transition-colors" title={userInfo.email}>
                    {userInfo.email || 'Loading email...'}
                  </p>
                </div>
              )}
            </div>
          </div>
        </motion.aside>

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col">
          {/* Main Content */}
          <div className="flex-1 overflow-y-auto bg-white dark:bg-gray-900 p-6 space-y-8 transition-colors">
          {/* Header */}
          <div>
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-5xl font-bold text-black dark:text-white mb-2 transition-colors">Dashboard</h1>
                <p className="text-gray-600 dark:text-gray-400 text-lg transition-colors">Agentic job tracker, analyze, and optimize your job search journey</p>
              </div>
              
              {/* Action Buttons */}
              <div className="flex items-center gap-3">
                <motion.button
                  onClick={() => {
                    window.open('https://www.linkedin.com/my-items/saved-jobs/', '_blank');
                    toast.success('📋 Go to LinkedIn → Switch to "Applied" tab → Click Extension → Click "Capture My Applied Jobs"', { 
                      duration: 6000,
                      style: {
                        background: '#000',
                        color: '#fff',
                        fontWeight: 'bold',
                      },
                    });
                  }}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className="px-6 py-3 bg-black dark:bg-gray-700 text-white rounded-lg font-semibold shadow-lg hover:shadow-xl hover:bg-gray-800 dark:hover:bg-gray-600 transition-all flex items-center gap-2 border-2 border-gray-200 dark:border-gray-600"
                >
                  <span className="text-xl">📥</span>
                  Import from LinkedIn
                </motion.button>
              </div>
            </div>
          </div>

          {/* Quick Start Info Banner */}
          {applications.length === 0 && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white dark:bg-gray-800 border-4 border-black dark:border-white rounded-xl p-6 shadow-lg transition-colors"
            >
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0 w-14 h-14 bg-black dark:bg-white rounded-lg flex items-center justify-center transition-colors">
                  <span className="text-3xl">🚀</span>
                </div>
                <div className="flex-1">
                  <h3 className="text-xl font-bold text-black dark:text-white mb-2 transition-colors">Import Your LinkedIn Jobs in 3 Clicks!</h3>
                  <div className="space-y-2 text-gray-700 dark:text-gray-300 transition-colors">
                    <p><strong className="text-black dark:text-white transition-colors">1.</strong> Click the "Import from LinkedIn" button above</p>
                    <p><strong className="text-black dark:text-white transition-colors">2.</strong> On LinkedIn, click the Chrome extension icon</p>
                    <p><strong className="text-black dark:text-white transition-colors">3.</strong> Click "📥 Capture My Applied Jobs" and done! All jobs sync here automatically</p>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {/* Time Range Selector */}
          <div className="flex gap-2">
            {['7', '30', '90'].map((days) => (
              <motion.button
                key={days}
                onClick={() => setTimeRange(days)}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className={`px-6 py-3 rounded-lg font-semibold transition-all ${
                  timeRange === days 
                    ? 'bg-black dark:bg-white text-white dark:text-black shadow-lg' 
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}
              >
                Last {days} days
              </motion.button>
            ))}
          </div>

          {/* Key Metrics - 3D Flip Cards with FIXED HEIGHT */}
          <motion.div 
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-16"
            style={{ minHeight: '220px' }}
            variants={{
              hidden: {},
              visible: {
                transition: {
                  staggerChildren: 0.1
                }
              }
            }}
            initial="hidden"
            animate="visible"
          >
            <MetricCard3D
              title="Total Applications"
              value={stats.totalApplications}
              subtitle={`${stats.weeklyApplications} this week`}
              icon="📊"
              trend={(() => {
                // Calculate week-over-week percentage change
                const thisWeek = stats.weeklyApplications || 0;
                const lastWeek = stats.lastWeekApplications || 0;
                
                if (lastWeek === 0) {
                  // If last week was 0, show percentage based on current week
                  if (thisWeek > 0) {
                    return 100; // New applications = 100% increase
                  }
                  return 0; // No change if both are 0
                }
                
                // Calculate percentage change
                const percentageChange = ((thisWeek - lastWeek) / lastWeek) * 100;
                return Math.round(percentageChange);
              })()}
              trendPositive={stats.weeklyApplications >= stats.lastWeekApplications}
              detailedStats={{
                thisWeek: stats.weeklyApplications,
                lastWeek: stats.lastWeekApplications,
                thisMonth: stats.monthlyApplications,
                avgPerDay: stats.avgApplicationsPerDay
              }}
            />
            
            <MetricCard3D
              title="Avg. Time per App"
              value={`${stats.averageTimePerApp}m`}
              subtitle="Efficiency metric"
              icon="⏱️"
              trend={(() => {
                // Calculate improvement percentage
                const avgTime = stats.averageTimePerApp || 0;
                const targetTime = stats.targetTime || 20;
                const improvement = stats.improvement || 0;
                
                // If we have improvement data from backend (period-over-period comparison)
                if (improvement !== 0 && !isNaN(improvement)) {
                  return Math.round(Math.abs(improvement));
                }
                
                // Otherwise, calculate based on target time
                if (avgTime > 0 && targetTime > 0) {
                  // Calculate how close we are to target (as percentage)
                  if (avgTime <= targetTime) {
                    // We're at or below target (good!) - show percentage under target
                    const underTarget = ((targetTime - avgTime) / targetTime) * 100;
                    return Math.round(Math.max(0, underTarget));
                  } else {
                    // We're over target - show percentage over target (negative, but display as positive)
                    const overTarget = ((avgTime - targetTime) / targetTime) * 100;
                    return Math.round(overTarget);
                  }
                }
                
                return 0; // No data available
              })()}
              trendPositive={(() => {
                // Positive if improving (lower time) or meeting target
                const avgTime = stats.averageTimePerApp || 0;
                const targetTime = stats.targetTime || 20;
                const improvement = stats.improvement || 0;
                
                if (improvement > 0) return true; // Time decreased = improvement
                if (avgTime > 0 && avgTime <= targetTime) return true; // Meeting target
                return false;
              })()}
              detailedStats={{
                fastest: stats.fastestTime > 0 ? `${stats.fastestTime}m` : 'N/A',
                slowest: stats.slowestTime > 0 ? `${stats.slowestTime}m` : 'N/A',
                target: `${stats.targetTime}m`,
                improvement: stats.improvement !== 0 ? `${stats.improvement > 0 ? '+' : ''}${stats.improvement}%` : '0%'
              }}
            />
            
            <MetricCard3D
              title="Response Rate"
              value={`${stats.responseRate.toFixed(1)}%`}
              subtitle={`${stats.responsesReceived} responses`}
              icon="📧"
              trend={(() => {
                // Calculate percentage point change from previous period
                const currentRate = stats.responseRate || 0;
                const previousRate = stats.previousResponseRate || 0;
                
                // Show absolute percentage point difference
                const change = Math.round(Math.abs(currentRate - previousRate) * 10) / 10;
                return change > 0 ? change : currentRate; // If no change, show current rate
              })()}
              trendPositive={stats.responseRate >= stats.previousResponseRate}
              detailedStats={{
                'Current Rate': `${stats.responseRate}%`,
                'Responses': stats.responsesReceived,
                'Interviews': stats.interviews,
                'Offers': stats.offers
              }}
            />
            
            <MetricCard3D
              title="Current Streak"
              value={`${stats.currentStreak} days`}
              subtitle={`Best: ${stats.longestStreak} days`}
              icon="🔥"
              trend={(() => {
                // Calculate change from previous week's streak
                const currentStreak = stats.currentStreak || 0;
                const previousStreak = stats.previousStreak || 0;
                
                // Show absolute change in days
                const change = Math.abs(currentStreak - previousStreak);
                return change > 0 ? change : currentStreak; // If no change, show current streak
              })()}
              trendPositive={stats.currentStreak >= stats.previousStreak}
              detailedStats={{
                'Current': `${stats.currentStreak} days`,
                'Previous': `${stats.previousStreak} days`,
                'Longest': `${stats.longestStreak} days`,
                'This Month': stats.monthlyApplications
              }}
            />
          </motion.div>

          {/* Time & Daily Stats Section */}
          {stats.totalTimeSpent > 0 && (
            <motion.div 
              className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <GlassCard className="p-6" depth="medium">
                <h3 className="text-2xl font-bold text-black dark:text-white mb-4 transition-colors">⏱️ Total Time Investment</h3>
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 bg-black dark:bg-gray-800 text-white rounded-xl shadow-md transition-colors">
                    <span className="text-lg font-medium">Total Time Spent</span>
                    <span className="text-3xl font-bold">{stats.totalTimeSpent} hours</span>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 transition-colors">
                      <div className="text-xs text-gray-600 dark:text-gray-400 mb-1 transition-colors">Average per App</div>
                      <div className="text-xl font-bold text-gray-900 dark:text-white transition-colors">{stats.averageTimePerApp} min</div>
                    </div>
                    <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 transition-colors">
                      <div className="text-xs text-gray-600 dark:text-gray-400 mb-1 transition-colors">Total Applications</div>
                      <div className="text-xl font-bold text-gray-900 dark:text-white transition-colors">{stats.totalApplications}</div>
                    </div>
                  </div>
                </div>
              </GlassCard>

              <GlassCard className="p-6" depth="medium">
                <h3 className="text-2xl font-bold text-black dark:text-white mb-4 transition-colors">📅 Daily Application Counts</h3>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {Object.entries(stats.dailyCounts || {})
                    .sort(([a], [b]) => b.localeCompare(a))
                    .slice(0, 10)
                    .map(([date, count]) => {
                      const formattedDate = new Date(date).toLocaleDateString('en-US', { 
                        month: 'short', 
                        day: 'numeric',
                        year: date !== new Date().toISOString().split('T')[0] ? 'numeric' : undefined
                      });
                      return (
                        <motion.div
                          key={date}
                          className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 transition-colors"
                          whileHover={{ scale: 1.02, x: 5 }}
                        >
                          <span className="font-medium text-black dark:text-white transition-colors">{formattedDate}</span>
                          <div className="flex items-center gap-2">
                            <span className="text-xl font-bold text-black dark:text-white transition-colors">{count}</span>
                            <span className="text-sm text-gray-600 dark:text-gray-400 transition-colors">
                              {count === 1 ? 'application' : 'applications'}
                            </span>
                          </div>
                        </motion.div>
                      );
                    })}
                  {Object.keys(stats.dailyCounts || {}).length === 0 && (
                    <div className="text-center text-gray-500 dark:text-gray-400 py-8 transition-colors">
                      No daily data available yet
                    </div>
                  )}
                </div>
              </GlassCard>
            </motion.div>
          )}

          {/* Charts Section - 3D Glass Cards - ALL SAME HEIGHT */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8" style={{ minHeight: '350px' }}>
            {/* Application Trend */}
            <motion.div
              initial={{ opacity: 0, x: -50 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 }}
              className="h-full"
            >
              <GlassCard className="p-6 h-full" depth="heavy">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-2xl font-bold text-black dark:text-white transition-colors">Application Trend</h3>
                  <motion.div 
                    className="flex items-center space-x-2"
                    animate={{ scale: [1, 1.05, 1] }}
                    transition={{ duration: 2, repeat: Infinity }}
                  >
                    <div className="w-3 h-3 bg-black dark:bg-white rounded-full animate-pulse shadow-lg transition-colors"></div>
                    <span className="text-sm text-gray-600 dark:text-gray-400 font-medium transition-colors">Live Data</span>
                  </motion.div>
                </div>
                <div style={{ height: '250px' }}>
                  <Line 
                    data={lineChartData}
                    options={{
                      responsive: true,
                      maintainAspectRatio: false,
                      plugins: {
                        legend: { display: false },
                        tooltip: {
                          backgroundColor: 'rgba(0, 0, 0, 0.9)',
                          padding: 16,
                          titleFont: { size: 14 },
                          bodyFont: { size: 13 },
                          borderColor: '#000000',
                          borderWidth: 1,
                        },
                      },
                      scales: {
                        y: {
                          beginAtZero: true,
                          ticks: { precision: 0, color: document.documentElement.classList.contains('dark') ? '#9ca3af' : '#666666' },
                          grid: { color: document.documentElement.classList.contains('dark') ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)' }
                        },
                        x: {
                          ticks: { color: document.documentElement.classList.contains('dark') ? '#9ca3af' : '#666666' },
                          grid: { display: false }
                        }
                      }
                    }}
                  />
                </div>
              </GlassCard>
            </motion.div>

            {/* Application Status */}
            <motion.div
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3 }}
              className="h-full"
            >
              <GlassCard className="p-6 h-full" depth="heavy">
                <h3 className="text-2xl font-bold text-black dark:text-white mb-4 transition-colors">Application Status</h3>
                <div style={{ height: '250px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Doughnut 
                    data={statusChartData}
                    options={{
                      responsive: true,
                      maintainAspectRatio: false,
                      plugins: {
                        legend: {
                          position: 'bottom',
                          labels: {
                            padding: 15,
                            font: { size: 12, weight: 'bold' },
                            color: document.documentElement.classList.contains('dark') ? '#ffffff' : '#000000',
                            usePointStyle: true,
                          }
                        },
                        tooltip: {
                          backgroundColor: document.documentElement.classList.contains('dark') ? 'rgba(31, 41, 55, 0.95)' : 'rgba(0, 0, 0, 0.9)',
                          padding: 15,
                          titleFont: { size: 14 },
                          bodyFont: { size: 13 },
                          borderColor: document.documentElement.classList.contains('dark') ? '#ffffff' : '#000000',
                          borderWidth: 1,
                        }
                      }
                    }}
                  />
                </div>
              </GlassCard>
            </motion.div>
          </div>

          {/* Source Performance & Cold Email Stats - SAME HEIGHT AS CHARTS */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8" style={{ minHeight: '350px' }}>
            <GlassCard className="p-6 h-full" depth="medium">
              <h3 className="text-2xl font-bold text-black dark:text-white mb-4 transition-colors">Performance by Job Board</h3>
              <div style={{ height: '300px' }}>
                {sourcePerformance.length > 0 ? (
                  <Bar 
                    data={{
                      labels: sourcePerformance.map(s => s.source),
                      datasets: [
                        {
                          label: 'Applications',
                          data: sourcePerformance.map(s => s.count),
                          backgroundColor: sourcePerformance.map((_, i) => 
                            ['#000000', '#333333', '#666666', '#999999', '#cccccc'][i % 5]
                          ),
                          borderRadius: 8,
                        }
                      ]
                    }}
                    options={{
                      responsive: true,
                      maintainAspectRatio: false,
                      plugins: {
                        legend: { 
                          display: false
                        },
                        tooltip: {
                          backgroundColor: 'rgba(0, 0, 0, 0.9)',
                          padding: 12,
                          titleFont: { size: 14 },
                          bodyFont: { size: 13 },
                          borderColor: '#000000',
                          borderWidth: 1,
                          callbacks: {
                            afterLabel: (context: any) => {
                              const source = sourcePerformance[context.dataIndex];
                              if (source) {
                                return [
                                  `Total: ${source.count} applications`,
                                  `Conversion Rate: ${source.conversionRate.toFixed(1)}%`,
                                  source.avgResponseTime > 0 
                                    ? `Avg Response Time: ${source.avgResponseTime.toFixed(1)} days`
                                    : 'Avg Response Time: N/A'
                                ];
                              }
                              return [];
                            }
                          }
                        }
                      },
                      scales: {
                        y: {
                          beginAtZero: true,
                          grid: { color: document.documentElement.classList.contains('dark') ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)' },
                          ticks: { 
                            color: document.documentElement.classList.contains('dark') ? '#9ca3af' : '#666666', 
                            precision: 0,
                            stepSize: 1
                          }
                        },
                        x: {
                          grid: { display: false },
                          ticks: { 
                            color: document.documentElement.classList.contains('dark') ? '#9ca3af' : '#666666',
                            maxRotation: 45,
                            minRotation: 45
                          }
                        }
                      }
                    }}
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center" style={{ 
                    height: '250px',
                    color: document.documentElement.classList.contains('dark') ? '#9ca3af' : '#666666'
                  }}>
                    <div style={{ fontSize: '48px', marginBottom: '16px' }}>📊</div>
                    <p className="font-bold" style={{ fontSize: '16px' }}>No job board data yet</p>
                    <p style={{ fontSize: '14px', marginTop: '8px' }}>Apply to jobs to see performance metrics</p>
                  </div>
                )}
              </div>
            </GlassCard>

            {/* Cold Email Metrics */}
            <GlassCard className="p-6 h-full" depth="medium">
              <h3 className="text-2xl font-bold text-black dark:text-white mb-6 transition-colors">Cold Email Performance</h3>
              <div className="space-y-4">
                <motion.div 
                  className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 transition-colors"
                  whileHover={{ scale: 1.02 }}
                >
                  <span className="text-gray-700 dark:text-gray-300 font-medium transition-colors">Emails Sent</span>
                  <span className="text-2xl font-bold text-gray-900 dark:text-white transition-colors">{stats.coldEmailsSent}</span>
                </motion.div>
                <motion.div 
                  className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 transition-colors"
                  whileHover={{ scale: 1.02 }}
                >
                  <span className="text-gray-700 dark:text-gray-300 font-medium transition-colors">Responses</span>
                  <span className="text-2xl font-bold text-gray-900 dark:text-white transition-colors">{stats.coldEmailResponses}</span>
                </motion.div>
                <motion.div 
                  className="flex items-center justify-between p-4 bg-black text-white rounded-xl"
                  whileHover={{ scale: 1.02, boxShadow: "0 10px 20px rgba(0,0,0,0.2)" }}
                >
                  <span className="font-medium">Conversion Rate</span>
                  <span className="text-2xl font-bold">{stats.coldEmailConversionRate}%</span>
                </motion.div>
              </div>
            </GlassCard>
          </div>

          {/* CV Performance - SMALLER SIZE */}
          <GlassCard className="p-5 mb-8" depth="medium">
            <h3 className="text-xl font-bold text-black dark:text-white mb-4 transition-colors">CV Version Performance</h3>
            <div className="space-y-3">
              {stats.cvVersionPerformance && stats.cvVersionPerformance.length > 0 ? (
                stats.cvVersionPerformance.map((cv, index) => (
                  <motion.div 
                    key={index} 
                    className="bg-gray-50 dark:bg-gray-800 p-3 rounded-xl transition-colors"
                    whileHover={{ scale: 1.01, x: 5 }}
                    transition={{ type: "spring", stiffness: 300 }}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-base font-bold text-black dark:text-white transition-colors">{cv.name}</span>
                      <div className="text-right">
                        <span className="text-xl font-bold text-black dark:text-white transition-colors">{cv.conversionRate.toFixed(1)}%</span>
                        <p className="text-xs text-gray-600 dark:text-gray-400 transition-colors">{cv.interviews} interviews</p>
                      </div>
                    </div>
                    <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 overflow-hidden transition-colors">
                      <motion.div 
                        className="bg-black dark:bg-white h-2 rounded-full transition-colors"
                        initial={{ width: 0 }}
                        animate={{ width: `${cv.conversionRate}%` }}
                        transition={{ duration: 1, delay: index * 0.2 }}
                      />
                    </div>
                    <span className="text-xs text-gray-500 dark:text-gray-400 mt-1 transition-colors">{cv.applications} applications</span>
                  </motion.div>
                ))
              ) : (
                <div className="text-center text-gray-500 dark:text-gray-400 py-8 transition-colors">
                  <p className="mb-2">📄 No CV versions tracked yet</p>
                  <p className="text-sm">Add applications with different CV versions to see performance metrics</p>
                </div>
              )}
            </div>
          </GlassCard>

          {/* Goal Achievement & Timing Insights */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            {/* Goal Achievement */}
            <motion.div 
              className="bg-black dark:bg-gray-800 text-white rounded-xl p-8 shadow-sm transition-colors"
              whileHover={{ 
                y: -3, 
                boxShadow: "0 15px 30px rgba(0,0,0,0.1)"
              }}
              transition={{ type: "spring", stiffness: 300 }}
            >
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-3xl font-bold text-white">Weekly Goal</h3>
                  <p className="text-gray-300 dark:text-gray-400 mt-2 transition-colors">{stats.weeklyApplications}/{stats.weeklyGoal} applications</p>
                </div>
                <div className="text-6xl font-bold text-white">
                  {stats.weeklyAchievement}%
                </div>
              </div>
              <div className="mt-6 bg-white/20 dark:bg-white/10 rounded-full h-4 overflow-hidden transition-colors">
                <motion.div 
                  className="bg-white h-4 rounded-full"
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.min(stats.weeklyAchievement, 100)}%` }}
                  transition={{ duration: 1.5 }}
                />
              </div>
            </motion.div>

            {/* Best Timing */}
            <motion.div 
              className="bg-black dark:bg-gray-800 text-white rounded-xl p-8 shadow-sm transition-colors"
              whileHover={{ 
                y: -3, 
                boxShadow: "0 15px 30px rgba(0,0,0,0.1)"
              }}
              transition={{ type: "spring", stiffness: 300 }}
            >
              <h3 className="text-2xl font-bold mb-6 text-white">Optimal Application Timing</h3>
              <div className="space-y-4">
                <motion.div 
                  className="flex items-center justify-between p-4 bg-white/10 dark:bg-white/5 rounded-xl transition-colors"
                  whileHover={{ scale: 1.02 }}
                >
                  <span className="font-medium text-white">Best Day</span>
                  <span className="text-xl font-bold text-white">{stats.bestDayOfWeek}</span>
                </motion.div>
                <motion.div 
                  className="flex items-center justify-between p-4 bg-white/10 dark:bg-white/5 rounded-xl transition-colors"
                  whileHover={{ scale: 1.02 }}
                >
                  <span className="font-medium text-white">Best Time</span>
                  <span className="text-xl font-bold text-white">{stats.bestTimeOfDay}</span>
                </motion.div>
                <motion.div 
                  className="flex items-center justify-between p-4 bg-white/20 dark:bg-white/10 rounded-xl transition-colors"
                  whileHover={{ scale: 1.02, boxShadow: "0 10px 20px rgba(0,0,0,0.2)" }}
                >
                  <span className="font-medium text-white">Avg. Response Time</span>
                  <span className="text-xl font-bold text-white">{stats.averageResponseTime} days</span>
                </motion.div>
              </div>
            </motion.div>
          </div>
          </div>
        </div>


        {/* AI Features Modal */}
        {showAIModal && (
          <div 
            className="fixed inset-0 bg-black/70 backdrop-blur-md z-[60] flex items-center justify-center p-4"
            onClick={() => setShowAIModal(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ type: "spring", stiffness: 300, damping: 25 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-2xl shadow-2xl overflow-hidden max-w-4xl w-full relative border-4 border-black"
            >
              {/* Close button */}
              <button
                onClick={() => setShowAIModal(false)}
                className="absolute top-6 right-6 text-gray-400 hover:text-black transition z-10"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>

              {/* Header - Black background */}
              <div className="bg-black text-white px-8 py-10 border-b-4 border-gray-200">
                <motion.div
                  initial={{ y: -20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.1 }}
                >
                  <h2 className="text-4xl font-bold mb-2">AI-Powered Features</h2>
                  <p className="text-gray-300 text-lg">Enterprise-grade AI tools for your job search</p>
                </motion.div>
              </div>

              {/* AI Features Grid */}
              <div className="p-8 grid grid-cols-1 md:grid-cols-2 gap-5">
                {/* AI Agentic Scraping */}
                <GlassCard className="p-6 cursor-pointer" depth="medium">
                  <motion.button
                    whileHover={{ y: -3, boxShadow: "0 15px 30px rgba(0,0,0,0.15)" }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => {
                      setShowAIModal(false);
                      toast.success('AI Agentic Scraping - Coming Soon!', { 
                        duration: 4000,
                        icon: '🤖',
                        style: {
                          background: '#000',
                          color: '#fff',
                          fontWeight: 'bold',
                        },
                      });
                    }}
                    className="w-full text-left"
                  >
                    <div className="flex items-start space-x-4">
                      <div className="flex-shrink-0 w-12 h-12 bg-black rounded-lg flex items-center justify-center">
                        <span className="text-2xl">🤖</span>
                      </div>
                      <div className="flex-1">
                        <h3 className="text-xl font-bold text-gray-900 mb-2">AI AGENTIC SCRAPING</h3>
                        <p className="text-sm text-gray-600 leading-relaxed">
                          Autonomous AI agents that automatically find, scrape, and apply to relevant jobs 24/7
                        </p>
                      </div>
                    </div>
                  </motion.button>
                </GlassCard>

                {/* Connect to GPTs */}
                <GlassCard className="p-6 cursor-pointer" depth="medium">
                  <motion.button
                    whileHover={{ y: -3, boxShadow: "0 15px 30px rgba(0,0,0,0.15)" }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => {
                      setShowAIModal(false);
                      toast.success('Connect to Your GPTs - Coming Soon!', { 
                        duration: 4000,
                        icon: '🔗',
                        style: {
                          background: '#000',
                          color: '#fff',
                          fontWeight: 'bold',
                        },
                      });
                    }}
                    className="w-full text-left"
                  >
                    <div className="flex items-start space-x-4">
                      <div className="flex-shrink-0 w-12 h-12 bg-black rounded-lg flex items-center justify-center">
                        <span className="text-2xl">🔗</span>
                      </div>
                      <div className="flex-1">
                        <h3 className="text-xl font-bold text-gray-900 mb-2">CONNECT TO YOUR GPTS</h3>
                        <p className="text-sm text-gray-600 leading-relaxed">
                          Seamless integration with ChatGPT and custom GPTs for enhanced AI assistance
                        </p>
                      </div>
                    </div>
                  </motion.button>
                </GlassCard>

                {/* AI Assistant */}
                <GlassCard className="p-6 cursor-pointer" depth="medium">
                  <motion.button
                    whileHover={{ y: -3, boxShadow: "0 15px 30px rgba(0,0,0,0.15)" }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => {
                      setShowAIModal(false);
                      toast.success('AI Assistant - Coming Soon!', { 
                        duration: 4000,
                        icon: '🧠',
                        style: {
                          background: '#000',
                          color: '#fff',
                          fontWeight: 'bold',
                        },
                      });
                    }}
                    className="w-full text-left"
                  >
                    <div className="flex items-start space-x-4">
                      <div className="flex-shrink-0 w-12 h-12 bg-black rounded-lg flex items-center justify-center">
                        <span className="text-2xl">🧠</span>
                      </div>
                      <div className="flex-1">
                        <h3 className="text-xl font-bold text-gray-900 mb-2">AI ASSISTANT</h3>
                        <p className="text-sm text-gray-600 leading-relaxed">
                          Personalized job recommendations, CV optimization, and strategic career insights
                        </p>
                      </div>
                    </div>
                  </motion.button>
                </GlassCard>

                {/* AI Chatbot */}
                <GlassCard className="p-6 cursor-pointer" depth="medium">
                  <motion.button
                    whileHover={{ y: -3, boxShadow: "0 15px 30px rgba(0,0,0,0.15)" }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => {
                      setShowAIModal(false);
                      toast.success('AI Support Chatbots - Coming Soon!', { 
                        duration: 4000,
                        icon: '💬',
                        style: {
                          background: '#000',
                          color: '#fff',
                          fontWeight: 'bold',
                        },
                      });
                    }}
                    className="w-full text-left"
                  >
                    <div className="flex items-start space-x-4">
                      <div className="flex-shrink-0 w-12 h-12 bg-black rounded-lg flex items-center justify-center">
                        <span className="text-2xl">💬</span>
                      </div>
                      <div className="flex-1">
                        <h3 className="text-xl font-bold text-gray-900 mb-2">AI SUPPORT CHATBOTS</h3>
                        <p className="text-sm text-gray-600 leading-relaxed">
                          Intelligent conversational AI to optimize your applications and interview prep
                        </p>
                      </div>
                    </div>
                  </motion.button>
                </GlassCard>
              </div>

              {/* Footer */}
              <div className="bg-gray-50 px-8 py-4 border-t-2 border-gray-200">
                <p className="text-sm text-gray-600 text-center">
                  <span className="font-semibold text-black">⚡ Coming Soon:</span> These enterprise-grade AI features are currently in development
                </p>
              </div>
            </motion.div>
          </div>
        )}
      </div>
    </>
  );
}

// 3D Metric Card Component with Flip Card - FIXED HEIGHT
function MetricCard3D({ title, value, subtitle, icon, trend, trendPositive, detailedStats }: any) {
  const front = (
    <GlassCard className="p-4 h-full overflow-hidden flex flex-col" depth="medium">
      <div className="flex items-center justify-between mb-3">
        <motion.div 
          className="text-3xl"
          animate={{ 
            rotateY: [0, 10, 0, -10, 0],
            scale: [1, 1.1, 1]
          }}
          transition={{ 
            duration: 4,
            repeat: Infinity,
            ease: "easeInOut"
          }}
        >
          {icon}
        </motion.div>
        {typeof trend === 'number' && trend > 0 && (
          <motion.div 
            className={`px-2 py-1 rounded-full text-xs font-bold transition-colors ${
              trendPositive 
                ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 border border-green-300 dark:border-green-600' 
                : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 border border-red-300 dark:border-red-600'
            }`}
            whileHover={{ scale: 1.1 }}
            animate={{ 
              y: [0, -2, 0],
            }}
            transition={{ 
              duration: 2,
              repeat: Infinity,
              ease: "easeInOut"
            }}
          >
            {trendPositive ? '↑' : '↓'} {Math.abs(trend)}%
          </motion.div>
        )}
      </div>
      <motion.h3 
        className="text-2xl font-bold text-black dark:text-white mb-1 transition-colors"
        animate={{ 
          scale: [1, 1.02, 1]
        }}
        transition={{ 
          duration: 3,
          repeat: Infinity,
          ease: "easeInOut"
        }}
      >
        {value}
      </motion.h3>
      <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 transition-colors">{title}</p>
      {subtitle && (
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 transition-colors">{subtitle}</p>
      )}
      <motion.div 
        className="mt-auto pt-2 text-xs text-gray-400 dark:text-gray-500 text-center transition-colors"
        animate={{ opacity: [0.5, 1, 0.5] }}
        transition={{ duration: 2, repeat: Infinity }}
      >
        👆 Click to see details
      </motion.div>
    </GlassCard>
  );

  const back = (
    <GlassCard className="p-4 h-full bg-gradient-to-br from-black to-gray-800 text-white overflow-hidden flex flex-col" depth="heavy">
      <div className="flex items-center justify-between mb-2">
        <motion.div 
          className="text-3xl"
          animate={{ rotateZ: 360 }}
          transition={{ duration: 2, ease: "easeInOut" }}
        >
          {icon}
        </motion.div>
      </div>
      <h3 className="text-lg font-bold mb-2 text-white">{title} Details</h3>
      
      <div className="flex-1 overflow-y-auto">
        {detailedStats ? (
          <div className="space-y-1 text-sm">
            {Object.entries(detailedStats).map(([key, val]: [string, any], index) => (
              <motion.div 
                key={key} 
                className="flex justify-between items-center py-1 border-b border-white/10"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.1 }}
              >
                <span className="text-white/70 capitalize text-xs">{key.replace(/([A-Z])/g, ' $1').trim()}</span>
                <span className="text-white font-bold text-xs">{typeof val === 'number' ? val.toLocaleString() : val}</span>
              </motion.div>
            ))}
          </div>
        ) : (
          <div className="space-y-1 text-sm">
            <div className="flex justify-between items-center py-1 border-b border-white/10">
              <span className="text-white/70 text-xs">Weekly Growth</span>
              <span className="text-white font-bold text-xs">{trend}%</span>
            </div>
            <div className="flex justify-between items-center py-1 border-b border-white/10">
              <span className="text-white/70 text-xs">Target</span>
              <span className="text-white font-bold text-xs">On Track</span>
            </div>
            <div className="flex justify-between items-center py-1">
              <span className="text-white/70 text-xs">Status</span>
              <span className="text-white font-bold text-xs">✓ Active</span>
            </div>
          </div>
        )}
      </div>
      
      <motion.div 
        className="mt-1 text-xs text-white/50 text-center"
        animate={{ opacity: [0.5, 1, 0.5] }}
        transition={{ duration: 2, repeat: Infinity }}
      >
        👆 Click to flip back
      </motion.div>
    </GlassCard>
  );

  return (
    <motion.div
      variants={{
        hidden: { opacity: 0, y: 20, scale: 0.9 },
        visible: { opacity: 1, y: 0, scale: 1 }
      }}
      className="w-full"
      style={{ height: '200px' }} // FIXED HEIGHT FOR ALL CARDS
      whileHover={{ y: -3 }}
      transition={{ type: "spring", stiffness: 300, damping: 20 }}
    >
      <div className="h-full w-full">
        <FlipCard 
          front={front} 
          back={back}
          flipOnClick={true}
          animationDuration={0.6}
        />
      </div>
    </motion.div>
  );
}