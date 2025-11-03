'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';
import { Line, Bar, Doughnut } from 'react-chartjs-2';
import toast from 'react-hot-toast';
import { CustomCursor } from '../../components/CustomCursor';
import { ParticleBackground } from '../../components/ParticleBackground';
import { GlassCard } from '../../components/GlassCard';

// Register ChartJS components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

// Mock data with all 11 metrics
const MOCK_DATA = {
  // 1. Time per Application
  averageTimePerApp: 15, // minutes
  totalTimeSpent: 675, // minutes

  // 2. Applications Sent
  totalApplications: 45,
  weeklyApplications: 12,
  monthlyApplications: 45,
  dailyApplications: 3,

  // 3. Target Achievement
  weeklyGoal: 10,
  monthlyGoal: 40,
  weeklyAchievement: 120, // 12/10 = 120%
  monthlyAchievement: 112.5, // 45/40

  // 4. CV Conversion Rate
  cvConversionRate: 28.9,
  responsesReceived: 13,
  
  // 5. Cold Emails Sent
  coldEmailsSent: 8,
  
  // 6. Cold Email Conversion Rate
  coldEmailResponses: 3,
  coldEmailConversionRate: 37.5, // 3/8

  // 7. Response Time from Employers
  averageResponseTime: 5.2, // days
  fastestResponse: 1,
  slowestResponse: 14,

  // 8. Source Channel Performance
  topSources: [
    { source: 'LinkedIn', count: 20, successRate: 35, avgResponseTime: 4.5 },
    { source: 'Indeed', count: 15, successRate: 20, avgResponseTime: 6.2 },
    { source: 'Dice', count: 8, successRate: 25, avgResponseTime: 5.8 },
    { source: 'Direct', count: 2, successRate: 50, avgResponseTime: 3.0 },
  ],

  // 9. CV Version Effectiveness
  cvVersionPerformance: [
    { name: 'Tech CV v2', conversionRate: 35.5, applications: 20, interviews: 7 },
    { name: 'General CV v1', conversionRate: 22.3, applications: 15, interviews: 3 },
    { name: 'Startup CV v3', conversionRate: 41.2, applications: 10, interviews: 4 },
  ],

  // 10. Application Timing Trends
  bestDayOfWeek: 'Tuesday',
  bestTimeOfDay: '10:00 AM',
  timingAnalysis: {
    monday: 0.22,
    tuesday: 0.35,
    wednesday: 0.28,
    thursday: 0.25,
    friday: 0.18,
  },

  // 11. Streak Tracking
  currentStreak: 5,
  longestStreak: 12,
  totalActiveDays: 28,

  // Additional UI data
  responseRate: 28.9,
  interviewRate: 11.1,
  applicationsByStatus: {
    APPLIED: 30,
    VIEWED: 8,
    SHORTLISTED: 3,
    INTERVIEWED: 2,
    OFFERED: 1,
    REJECTED: 1,
  },
  dailyActivity: [
    { date: '2024-01-20', count: 3 },
    { date: '2024-01-21', count: 5 },
    { date: '2024-01-22', count: 2 },
    { date: '2024-01-23', count: 4 },
    { date: '2024-01-24', count: 6 },
    { date: '2024-01-25', count: 3 },
    { date: '2024-01-26', count: 7 },
  ],
};

export default function DashboardPage() {
  const router = useRouter();
  const [timeRange, setTimeRange] = useState('30');
  const [isLoading, setIsLoading] = useState(true);
  const [stats, setStats] = useState<any>(null);

  useEffect(() => {
    // Check authentication
    const token = localStorage.getItem('token');
    if (!token) {
      router.push('/login');
      return;
    }

    // Load dashboard data
    loadDashboardData();
  }, [router, timeRange]);

  const loadDashboardData = async () => {
    setIsLoading(true);
    try {
      // For now, use mock data
      setStats(MOCK_DATA);
    } catch (error) {
      setStats(MOCK_DATA);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <motion.div 
          className="text-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          <motion.div 
            className="w-16 h-16 border-4 border-black border-t-transparent rounded-full mx-auto"
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          />
          <p className="mt-4 text-gray-600">Loading dashboard...</p>
        </motion.div>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="text-center">
          <p className="text-gray-600">No data available</p>
        </div>
      </div>
    );
  }

  // Prepare chart data
  const lineChartData = {
    labels: stats.dailyActivity.map((d: any) => {
      const date = new Date(d.date);
      return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
    }),
    datasets: [
      {
        label: 'Applications',
        data: stats.dailyActivity.map((d: any) => d.count),
        borderColor: 'rgb(0, 0, 0)',
        backgroundColor: 'rgba(0, 0, 0, 0.1)',
        fill: true,
        tension: 0.4,
        borderWidth: 2,
      }
    ]
  };

  const statusChartData = {
    labels: Object.keys(stats.applicationsByStatus),
    datasets: [
      {
        data: Object.values(stats.applicationsByStatus),
        backgroundColor: [
          '#000000', // Applied
          '#404040', // Viewed
          '#606060', // Shortlisted
          '#808080', // Interviewed
          '#A0A0A0', // Offered
          '#C0C0C0', // Rejected
        ],
        borderWidth: 2,
        borderColor: '#ffffff',
      }
    ]
  };

  const sourceBarData = {
    labels: stats.topSources.map((s: any) => s.source),
    datasets: [
      {
        label: 'Applications',
        data: stats.topSources.map((s: any) => s.count),
        backgroundColor: '#000000',
        borderWidth: 2,
        borderColor: '#ffffff',
      },
    ]
  };

  return (
    <>
      <CustomCursor />
      <ParticleBackground />
      
      <div className="min-h-screen bg-white relative" style={{ cursor: 'none' }}>
        {/* Navigation */}
        <motion.nav 
          className="bg-white/90 backdrop-blur-lg border-b border-gray-200 sticky top-0 z-50"
          initial={{ y: -100 }}
          animate={{ y: 0 }}
        >
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center h-16">
              <div className="flex items-center space-x-2">
                <div className="bg-black p-2 rounded">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                </div>
                <h1 className="text-xl font-bold text-black">MYATS</h1>
              </div>
              <div className="flex items-center space-x-4">
                <button
                  onClick={() => router.push('/services')}
                  className="px-4 py-2 text-gray-700 hover:text-black font-medium transition"
                >
                  Services
                </button>
                <button
                  onClick={() => toast.info('Applications page coming soon')}
                  className="px-4 py-2 text-gray-700 hover:text-black font-medium transition"
                >
                  Applications
                </button>
                <motion.button
                  onClick={() => {
                    localStorage.removeItem('token');
                    router.push('/');
                  }}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className="px-4 py-2 bg-black text-white rounded-lg transition font-medium"
                >
                  Logout
                </motion.button>
              </div>
            </div>
          </div>
        </motion.nav>

        <div className="max-w-7xl mx-auto p-6 relative z-10" style={{ perspective: '1000px' }}>
          {/* Header */}
          <motion.div 
            className="mb-8"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-5xl font-bold text-black mb-2">
                  Dashboard
                </h1>
                <p className="text-gray-600 text-lg">Track, analyze, and optimize your job search journey</p>
              </div>
              <motion.div 
                className="bg-green-50 border-2 border-green-500 text-green-800 px-4 py-2 rounded-full text-sm font-semibold"
                animate={{ scale: [1, 1.05, 1] }}
                transition={{ duration: 2, repeat: Infinity }}
              >
                ✓ All Systems Active
              </motion.div>
            </div>
          </motion.div>

          {/* Time Range Selector */}
          <div className="flex gap-2 mb-6">
            {['7', '30', '90'].map((days, index) => (
              <motion.button
                key={days}
                onClick={() => setTimeRange(days)}
                whileHover={{ scale: 1.05, y: -2 }}
                whileTap={{ scale: 0.95 }}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.1 }}
                className={`px-6 py-3 rounded-lg font-semibold transition-all ${
                  timeRange === days 
                    ? 'bg-black text-white shadow-lg' 
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Last {days} days
              </motion.button>
            ))}
          </div>

          {/* Key Metrics - Grid */}
          <motion.div 
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8"
            variants={{
              hidden: {},
              visible: {
                transition: {
                  staggerChildren: 0.05
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
              trend={stats.weeklyApplications}
              trendPositive={true}
            />
            
            <MetricCard3D
              title="Avg. Time per App"
              value={`${stats.averageTimePerApp}m`}
              subtitle="Efficiency metric"
              icon="⏱️"
              trend={5}
              trendPositive={false}
            />
            
            <MetricCard3D
              title="Response Rate"
              value={`${stats.responseRate.toFixed(1)}%`}
              subtitle={`${stats.responsesReceived} responses`}
              icon="📧"
              trend={stats.responseRate > 15 ? 8 : -3}
              trendPositive={stats.responseRate > 15}
            />
            
            <MetricCard3D
              title="Current Streak"
              value={`${stats.currentStreak} days`}
              subtitle={`Best: ${stats.longestStreak} days`}
              icon="🔥"
              trend={stats.currentStreak}
              trendPositive={true}
            />
          </motion.div>

          {/* Charts Section */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
            {/* Application Trend */}
            <motion.div
              initial={{ opacity: 0, x: -50 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 }}
              className="lg:col-span-2"
            >
              <GlassCard className="p-6" depth="heavy">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-2xl font-bold text-black">Application Trend</h3>
                  <div className="flex items-center space-x-2">
                    <div className="w-3 h-3 bg-black rounded-full animate-pulse"></div>
                    <span className="text-sm text-gray-600 font-medium">Live Data</span>
                  </div>
                </div>
                <Line 
                  data={lineChartData}
                  options={{
                    responsive: true,
                    maintainAspectRatio: true,
                    plugins: {
                      legend: { display: false },
                      tooltip: {
                        backgroundColor: 'rgba(0, 0, 0, 0.9)',
                        padding: 16,
                        titleFont: { size: 14 },
                        bodyFont: { size: 13 },
                      },
                    },
                    scales: {
                      y: {
                        beginAtZero: true,
                        ticks: { precision: 0 },
                        grid: { color: 'rgba(0, 0, 0, 0.05)' }
                      },
                      x: {
                        grid: { display: false }
                      }
                    }
                  }}
                />
              </GlassCard>
            </motion.div>

            {/* Application Status */}
            <motion.div
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3 }}
            >
              <GlassCard className="p-6" depth="heavy">
                <h3 className="text-2xl font-bold text-black mb-4">Application Status</h3>
                <Doughnut 
                  data={statusChartData}
                  options={{
                    responsive: true,
                    plugins: {
                      legend: {
                        position: 'bottom',
                        labels: {
                          padding: 12,
                          font: { size: 11 },
                          color: '#000000',
                        }
                      },
                      tooltip: {
                        backgroundColor: 'rgba(0, 0, 0, 0.9)',
                        padding: 12,
                      }
                    }
                  }}
                />
              </GlassCard>
            </motion.div>
          </div>

          {/* Source Performance & Cold Email Stats */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            <GlassCard className="p-6" depth="medium">
              <h3 className="text-2xl font-bold text-black mb-4">Performance by Job Board</h3>
              <Bar 
                data={sourceBarData}
                options={{
                  responsive: true,
                  plugins: {
                    legend: { display: false },
                    tooltip: {
                      backgroundColor: 'rgba(0, 0, 0, 0.9)',
                      padding: 12,
                    }
                  },
                  scales: {
                    y: {
                      beginAtZero: true,
                      grid: { color: 'rgba(0, 0, 0, 0.05)' }
                    },
                    x: {
                      grid: { display: false }
                    }
                  }
                }}
              />
            </GlassCard>

            {/* Cold Email Metrics */}
            <GlassCard className="p-6" depth="medium">
              <h3 className="text-2xl font-bold text-black mb-6">Cold Email Performance</h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                  <span className="text-gray-700 font-medium">Emails Sent</span>
                  <span className="text-2xl font-bold">{stats.coldEmailsSent}</span>
                </div>
                <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                  <span className="text-gray-700 font-medium">Responses</span>
                  <span className="text-2xl font-bold">{stats.coldEmailResponses}</span>
                </div>
                <div className="flex items-center justify-between p-4 bg-black text-white rounded-xl">
                  <span className="font-medium">Conversion Rate</span>
                  <span className="text-2xl font-bold">{stats.coldEmailConversionRate}%</span>
                </div>
              </div>
            </GlassCard>
          </div>

          {/* CV Performance */}
          <GlassCard className="p-6 mb-8" depth="heavy">
            <h3 className="text-2xl font-bold text-black mb-6">CV Version Performance</h3>
            <div className="space-y-4">
              {stats.cvVersionPerformance.map((cv: any, index: number) => (
                <motion.div 
                  key={index}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.1 }}
                  whileHover={{ x: 10 }}
                  className="bg-gray-50 p-4 rounded-xl"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-lg font-bold text-black">{cv.name}</span>
                    <div className="text-right">
                      <span className="text-2xl font-bold text-black">{cv.conversionRate.toFixed(1)}%</span>
                      <p className="text-sm text-gray-600">{cv.interviews} interviews</p>
                    </div>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                    <motion.div 
                      className="bg-black h-3 rounded-full"
                      initial={{ width: 0 }}
                      animate={{ width: `${cv.conversionRate}%` }}
                      transition={{ duration: 1, delay: index * 0.2 }}
                    />
                  </div>
                  <span className="text-xs text-gray-500 mt-1">{cv.applications} applications</span>
                </motion.div>
              ))}
            </div>
          </GlassCard>

          {/* Goal Achievement & Timing Insights */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            {/* Goal Achievement */}
            <GlassCard className="p-8 bg-black text-white" depth="heavy">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-3xl font-bold">Weekly Goal</h3>
                  <p className="text-gray-300 mt-2">{stats.weeklyApplications}/{stats.weeklyGoal} applications</p>
                </div>
                <motion.div 
                  className="text-6xl font-bold"
                  animate={{ scale: [1, 1.1, 1] }}
                  transition={{ duration: 2, repeat: Infinity }}
                >
                  {stats.weeklyAchievement}%
                </motion.div>
              </div>
              <div className="mt-6 bg-white/20 rounded-full h-4 overflow-hidden">
                <motion.div 
                  className="bg-white h-4 rounded-full"
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.min(stats.weeklyAchievement, 100)}%` }}
                  transition={{ duration: 1.5 }}
                />
              </div>
            </GlassCard>

            {/* Best Timing */}
            <GlassCard className="p-8" depth="heavy">
              <h3 className="text-2xl font-bold text-black mb-6">Optimal Application Timing</h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                  <span className="text-gray-700 font-medium">Best Day</span>
                  <span className="text-xl font-bold text-black">{stats.bestDayOfWeek}</span>
                </div>
                <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                  <span className="text-gray-700 font-medium">Best Time</span>
                  <span className="text-xl font-bold text-black">{stats.bestTimeOfDay}</span>
                </div>
                <div className="flex items-center justify-between p-4 bg-black text-white rounded-xl">
                  <span className="font-medium">Avg. Response Time</span>
                  <span className="text-xl font-bold">{stats.averageResponseTime} days</span>
                </div>
              </div>
            </GlassCard>
          </div>

          {/* Add Application FAB */}
          <motion.button
            onClick={() => toast.success('Add application feature coming soon!')}
            whileHover={{ scale: 1.1, rotate: 90 }}
            whileTap={{ scale: 0.9 }}
            className="fixed bottom-8 right-8 bg-black text-white p-6 rounded-full shadow-2xl z-50"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
            </svg>
          </motion.button>
        </div>
      </div>
    </>
  );
}

// 3D Metric Card Component
function MetricCard3D({ title, value, subtitle, icon, trend, trendPositive }: any) {
  return (
    <motion.div
      variants={{
        hidden: { opacity: 0, y: 20 },
        visible: { opacity: 1, y: 0 }
      }}
    >
      <GlassCard className="p-6" depth="medium">
        <div className="flex items-center justify-between mb-4">
          <div className="text-4xl">{icon}</div>
          {typeof trend === 'number' && (
            <motion.div 
              className={`px-3 py-1 rounded-full text-sm font-bold ${trendPositive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}
              whileHover={{ scale: 1.1 }}
            >
              {trendPositive ? '↑' : '↓'} {Math.abs(trend)}%
            </motion.div>
          )}
        </div>
        <h3 className="text-4xl font-bold text-black mb-2">{value}</h3>
        <p className="text-sm font-semibold text-gray-700">{title}</p>
        {subtitle && (
          <p className="text-xs text-gray-500 mt-2">{subtitle}</p>
        )}
      </GlassCard>
    </motion.div>
  );
}

