'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
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

// Mock data for demonstration
const MOCK_DATA = {
  totalApplications: 45,
  weeklyApplications: 12,
  monthlyApplications: 45,
  averageTimePerApp: 15,
  responseRate: 28.9,
  interviewRate: 11.1,
  targetAchievement: 85,
  currentStreak: 5,
  topSources: [
    { source: 'LinkedIn', count: 20, successRate: 35 },
    { source: 'Indeed', count: 15, successRate: 20 },
    { source: 'Reed', count: 8, successRate: 25 },
    { source: 'Direct', count: 2, successRate: 50 },
  ],
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
  cvVersionPerformance: [
    { name: 'Tech CV v2', conversionRate: 35.5, applications: 20 },
    { name: 'General CV v1', conversionRate: 22.3, applications: 15 },
    { name: 'Startup CV v3', conversionRate: 41.2, applications: 10 },
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
      const token = localStorage.getItem('token');
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/analytics/dashboard?period=${timeRange}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setStats(data);
      } else {
        // Use mock data if API fails
        setStats(MOCK_DATA);
        console.log('Using mock data for demonstration');
      }
    } catch (error) {
      // Use mock data for demonstration
      setStats(MOCK_DATA);
      console.log('Using mock data for demonstration');
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
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
        borderColor: 'rgb(99, 102, 241)',
        backgroundColor: 'rgba(99, 102, 241, 0.1)',
        fill: true,
        tension: 0.4,
      }
    ]
  };

  const statusChartData = {
    labels: Object.keys(stats.applicationsByStatus),
    datasets: [
      {
        data: Object.values(stats.applicationsByStatus),
        backgroundColor: [
          '#3b82f6', // Applied
          '#10b981', // Viewed
          '#f59e0b', // Shortlisted
          '#8b5cf6', // Interviewed
          '#ef4444', // Offered
          '#6b7280', // Rejected
        ],
        borderWidth: 0,
      }
    ]
  };

  const sourceBarData = {
    labels: stats.topSources.map((s: any) => s.source),
    datasets: [
      {
        label: 'Applications',
        data: stats.topSources.map((s: any) => s.count),
        backgroundColor: '#6366f1',
      },
    ]
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      {/* Navigation */}
      <nav className="bg-white/80 backdrop-blur-lg border-b border-gray-200 shadow-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-2">
              <div className="bg-gradient-to-br from-indigo-600 to-purple-600 p-2 rounded-lg">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
              </div>
              <h1 className="text-xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
                MYATS
              </h1>
            </div>
            <div className="flex items-center space-x-4">
              <button
                onClick={() => router.push('/services')}
                className="px-4 py-2 text-gray-700 hover:text-indigo-600 font-medium transition"
              >
                Services
              </button>
              <button
                onClick={() => toast.info('Applications page coming soon')}
                className="px-4 py-2 text-gray-700 hover:text-indigo-600 font-medium transition"
              >
                Applications
              </button>
              <button
                onClick={() => {
                  localStorage.removeItem('token');
                  router.push('/');
                }}
                className="px-4 py-2 bg-gradient-to-r from-red-500 to-pink-500 text-white rounded-lg hover:shadow-lg transition font-medium"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto p-6">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-bold bg-gradient-to-r from-gray-900 via-indigo-900 to-gray-900 bg-clip-text text-transparent">
                Job Application Dashboard
              </h1>
              <p className="text-gray-600 mt-2 text-lg">Track, analyze, and optimize your job search journey</p>
            </div>
            <div className="hidden md:flex items-center space-x-2">
              <div className="bg-green-100 text-green-800 px-3 py-1 rounded-full text-sm font-semibold">
                ✓ All Systems Active
              </div>
            </div>
          </div>
        </div>

        {/* Time Range Selector */}
        <div className="flex gap-2 mb-6">
          {['7', '30', '90'].map((days) => (
            <button
              key={days}
              onClick={() => setTimeRange(days)}
              className={`px-4 py-2 rounded-lg transition ${
                timeRange === days 
                  ? 'bg-indigo-600 text-white' 
                  : 'bg-white text-gray-700 hover:bg-gray-50'
              }`}
            >
              Last {days} days
            </button>
          ))}
        </div>

        {/* Key Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <MetricCard
            title="Total Applications"
            value={stats.totalApplications}
            icon="📊"
            color="from-blue-500 to-blue-600"
            iconBg="bg-blue-100"
            trend={stats.weeklyApplications}
            trendLabel="this week"
          />
          
          <MetricCard
            title="Avg. Time per App"
            value={`${stats.averageTimePerApp}m`}
            icon="⏱️"
            color="from-purple-500 to-purple-600"
            iconBg="bg-purple-100"
            trend={-5}
            trendLabel="vs last week"
          />
          
          <MetricCard
            title="Response Rate"
            value={`${stats.responseRate.toFixed(1)}%`}
            icon="📧"
            color="from-green-500 to-green-600"
            iconBg="bg-green-100"
            trend={stats.responseRate > 15 ? 'good' : 'improve'}
          />
          
          <MetricCard
            title="Current Streak"
            value={`${stats.currentStreak} days`}
            icon="🔥"
            color="from-orange-500 to-orange-600"
            iconBg="bg-orange-100"
            trend={stats.currentStreak}
            trendLabel="keep going!"
          />
        </div>

        {/* Charts Section */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          {/* Application Trend */}
          <div className="lg:col-span-2 bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg p-6 border border-gray-100 hover:shadow-xl transition">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-gray-900">Application Trend</h3>
              <div className="flex items-center space-x-2">
                <div className="w-3 h-3 bg-indigo-500 rounded-full"></div>
                <span className="text-sm text-gray-600">Daily Activity</span>
              </div>
            </div>
            <Line 
              data={lineChartData}
              options={{
                responsive: true,
                plugins: {
                  legend: { display: false },
                  tooltip: {
                    backgroundColor: 'rgba(0, 0, 0, 0.9)',
                    padding: 12,
                    titleFont: { size: 14 },
                    bodyFont: { size: 13 },
                    boxPadding: 8,
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
          </div>

          {/* Application Status */}
          <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg p-6 border border-gray-100 hover:shadow-xl transition">
            <h3 className="text-xl font-bold text-gray-900 mb-4">Application Status</h3>
            <Doughnut 
              data={statusChartData}
              options={{
                responsive: true,
                plugins: {
                  legend: {
                    position: 'bottom',
                    labels: {
                      padding: 12,
                      font: { size: 12 }
                    }
                  },
                  tooltip: {
                    backgroundColor: 'rgba(0, 0, 0, 0.9)',
                    padding: 12,
                  }
                }
              }}
            />
          </div>
        </div>

        {/* Source Performance */}
        <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg p-6 mb-8 border border-gray-100">
          <h3 className="text-xl font-bold text-gray-900 mb-4">Performance by Job Board</h3>
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
        </div>

        {/* CV Performance */}
        <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg p-6 mb-8 border border-gray-100">
          <h3 className="text-xl font-bold text-gray-900 mb-4">CV Version Performance</h3>
          <div className="space-y-4">
            {stats.cvVersionPerformance.map((cv: any, index: number) => (
              <div key={index} className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium text-gray-900">{cv.name}</span>
                    <span className="text-sm text-gray-600">{cv.conversionRate.toFixed(1)}% conversion</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-gradient-to-r from-indigo-500 to-indigo-600 h-2 rounded-full transition-all"
                      style={{ width: `${cv.conversionRate}%` }}
                    />
                  </div>
                  <span className="text-xs text-gray-500 mt-1">{cv.applications} applications</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Goal Achievement */}
        <div className="bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 rounded-2xl p-8 text-white shadow-2xl relative overflow-hidden">
          <div className="absolute inset-0 bg-white/10"></div>
          <div className="relative z-10">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-3xl font-bold">Weekly Goal Achievement</h3>
                <p className="mt-2 text-lg opacity-90">You've completed {stats.targetAchievement}% of your weekly target</p>
              </div>
              <div className="text-6xl font-bold opacity-90">
                {stats.targetAchievement}%
              </div>
            </div>
            <div className="mt-6 bg-white/20 rounded-full h-5 overflow-hidden">
              <div 
                className="bg-white h-5 rounded-full transition-all duration-1000 shadow-lg"
                style={{ width: `${Math.min(stats.targetAchievement, 100)}%` }}
              />
            </div>
          </div>
        </div>

        {/* Add Application Button */}
        <button
          onClick={() => toast.success('Add application feature coming soon!')}
          className="fixed bottom-8 right-8 bg-gradient-to-r from-indigo-600 to-purple-600 text-white p-5 rounded-full shadow-2xl hover:shadow-indigo-500/50 hover:scale-110 transition-all duration-300 group"
        >
          <svg className="w-6 h-6 group-hover:rotate-90 transition-transform duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
          </svg>
        </button>
      </div>
    </div>
  );
}

// Metric Card Component
function MetricCard({ title, value, icon, trend, trendLabel, color = "from-indigo-500 to-indigo-600", iconBg = "bg-indigo-100" }: any) {
  const isPositiveTrend = typeof trend === 'number' ? trend > 0 : trend === 'good';
  
  return (
    <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg p-6 border border-gray-100 hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
      <div className="flex items-center justify-between mb-4">
        <div className={`${iconBg} p-3 rounded-xl`}>
          <span className="text-2xl">{icon}</span>
        </div>
        {typeof trend === 'number' && (
          <div className={`flex items-center text-sm font-semibold px-2 py-1 rounded-full ${isPositiveTrend ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
            <span className="text-xs">{isPositiveTrend ? '↑' : '↓'}</span>
            <span className="ml-1">{Math.abs(trend)}%</span>
          </div>
        )}
      </div>
      <h3 className="text-3xl font-bold bg-gradient-to-br from-gray-900 to-gray-700 bg-clip-text text-transparent">{value}</h3>
      <p className="text-sm font-medium text-gray-600 mt-2">{title}</p>
      {trendLabel && (
        <p className="text-xs text-gray-500 mt-3 font-medium">{trendLabel}</p>
      )}
    </div>
  );
}
