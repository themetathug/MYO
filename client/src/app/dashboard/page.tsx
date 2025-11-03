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
    responsesReceived: 0,
    currentStreak: 0,
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
          responsesReceived: statsData.responsesReceived || 0,
          currentStreak: statsData.currentStreak || 0,
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
        <div className="min-h-screen bg-white flex items-center justify-center">
          <div className="text-center">
            <div className="w-16 h-16 border-4 border-black border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-xl font-semibold text-black">Loading your dashboard...</p>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <CustomCursor />
      <ParticleBackground />
      
      <div className="min-h-screen bg-white">
        {/* Navigation */}
        <nav className="bg-white border-b-2 border-gray-200 px-6 py-4">
          <div className="max-w-7xl mx-auto flex items-center justify-between">
            <div className="flex items-center space-x-8">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-black rounded-lg flex items-center justify-center">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                </div>
                <span className="text-2xl font-bold text-black">UK Jobs Insider</span>
              </div>
              
              <div className="flex space-x-6">
                <button className="px-4 py-2 text-black font-medium border-b-2 border-black">
                  Dashboard
                </button>
                <button 
                  onClick={() => window.location.href = '/dashboard/applications'}
                  className="px-4 py-2 text-gray-700 hover:text-black font-medium transition"
                >
                  Applications
                </button>
                <button 
                  onClick={() => window.location.href = '/dashboard/cold-emails'}
                  className="px-4 py-2 text-gray-700 hover:text-black font-medium transition"
                >
                  Cold Emails
                </button>
              </div>
            </div>
            
            <div className="flex items-center space-x-4">
              <div className="bg-green-50 border-2 border-green-500 text-green-800 px-4 py-2 rounded-full text-sm font-semibold">
                ✓ All Systems Active
              </div>
              <button
                onClick={() => {
                  localStorage.removeItem('token');
                  window.location.href = '/login';
                }}
                className="px-6 py-2 bg-black text-white rounded-lg font-medium hover:bg-gray-800 transition"
              >
                Logout
              </button>
            </div>
          </div>
        </nav>

        <div className="max-w-7xl mx-auto p-6 space-y-8">
          {/* Header */}
          <div>
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-5xl font-bold text-black mb-2">Dashboard</h1>
                <p className="text-gray-600 text-lg">Track, analyze, and optimize your job search journey</p>
              </div>
              
              {/* Scraping Buttons */}
              <div className="flex items-center gap-3">
                <div
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    e.nativeEvent.stopImmediatePropagation();
                    toast.success('🚀 Feature Coming Soon!', {
                      duration: 4000,
                      icon: '⏳',
                      style: {
                        background: 'linear-gradient(to right, #10b981, #059669)',
                        color: 'white',
                        fontWeight: 'bold',
                      },
                    });
                    return false;
                  }}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                  }}
                  onMouseUp={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                  }}
                  className="px-6 py-3 bg-gradient-to-r from-gray-400 to-gray-600 text-white rounded-lg font-semibold shadow-lg transition-all flex items-center gap-2 cursor-not-allowed opacity-75 select-none pointer-events-auto"
                  title="Feature Coming Soon - Click for details"
                  style={{ userSelect: 'none', WebkitUserSelect: 'none' }}
                >
                  <span className="text-xl">🔍</span>
                  <span>Scrape Jobs (Coming Soon)</span>
                </div>
                
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
                  whileHover={{ scale: 1.05, boxShadow: '0 10px 30px rgba(0,0,0,0.3)', y: -2 }}
                  whileTap={{ scale: 0.95 }}
                  className="px-6 py-3 bg-black text-white rounded-lg font-semibold shadow-lg hover:shadow-xl transition-all flex items-center gap-2 border-2 border-gray-200"
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
              className="bg-white border-4 border-black rounded-xl p-6 shadow-lg"
            >
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0 w-14 h-14 bg-black rounded-lg flex items-center justify-center">
                  <span className="text-3xl">🚀</span>
                </div>
                <div className="flex-1">
                  <h3 className="text-xl font-bold text-black mb-2">Import Your LinkedIn Jobs in 3 Clicks!</h3>
                  <div className="space-y-2 text-gray-700">
                    <p><strong className="text-black">1.</strong> Click the "Import from LinkedIn" button above</p>
                    <p><strong className="text-black">2.</strong> On LinkedIn, click the Chrome extension icon</p>
                    <p><strong className="text-black">3.</strong> Click "📥 Capture My Applied Jobs" and done! All jobs sync here automatically</p>
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
                    ? 'bg-black text-white shadow-lg' 
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Last {days} days
              </motion.button>
            ))}
          </div>

          {/* Key Metrics - 3D Flip Cards with FIXED HEIGHT */}
          <motion.div 
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-16"
            style={{ minHeight: '315px' }}
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
              trend={Math.round(stats.responseRate)}
              trendPositive={stats.responseRate >= 15}
              detailedStats={{
                responses: stats.responsesReceived,
                interviews: stats.interviews,
                offers: stats.offers,
                pending: stats.pending
              }}
            />
            
            <MetricCard3D
              title="Current Streak"
              value={`${stats.currentStreak} days`}
              subtitle={`Best: ${stats.longestStreak} days`}
              icon="🔥"
              trend={stats.currentStreak}
              trendPositive={stats.currentStreak > 0}
              detailedStats={{
                current: stats.currentStreak,
                longest: stats.longestStreak,
                thisMonth: stats.monthlyApplications,
                weeklyGoal: stats.weeklyGoal
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
                <h3 className="text-2xl font-bold text-black mb-4">⏱️ Total Time Investment</h3>
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 bg-black text-white rounded-xl">
                    <span className="text-lg font-medium">Total Time Spent</span>
                    <span className="text-3xl font-bold">{stats.totalTimeSpent} hours</span>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3 bg-gray-50 rounded-lg">
                      <div className="text-xs text-gray-600 mb-1">Average per App</div>
                      <div className="text-xl font-bold text-black">{stats.averageTimePerApp} min</div>
                    </div>
                    <div className="p-3 bg-gray-50 rounded-lg">
                      <div className="text-xs text-gray-600 mb-1">Total Applications</div>
                      <div className="text-xl font-bold text-black">{stats.totalApplications}</div>
                    </div>
                  </div>
                </div>
              </GlassCard>

              <GlassCard className="p-6" depth="medium">
                <h3 className="text-2xl font-bold text-black mb-4">📅 Daily Application Counts</h3>
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
                          className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                          whileHover={{ scale: 1.02, x: 5 }}
                        >
                          <span className="font-medium text-black">{formattedDate}</span>
                          <div className="flex items-center gap-2">
                            <span className="text-xl font-bold text-black">{count}</span>
                            <span className="text-sm text-gray-600">
                              {count === 1 ? 'application' : 'applications'}
                            </span>
                          </div>
                        </motion.div>
                      );
                    })}
                  {Object.keys(stats.dailyCounts || {}).length === 0 && (
                    <div className="text-center text-gray-500 py-8">
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
                  <h3 className="text-2xl font-bold text-black">Application Trend</h3>
                  <motion.div 
                    className="flex items-center space-x-2"
                    animate={{ scale: [1, 1.05, 1] }}
                    transition={{ duration: 2, repeat: Infinity }}
                  >
                    <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse shadow-lg"></div>
                    <span className="text-sm text-gray-600 font-medium">Live Data</span>
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
                          ticks: { precision: 0, color: '#666666' },
                          grid: { color: 'rgba(0, 0, 0, 0.05)' }
                        },
                        x: {
                          ticks: { color: '#666666' },
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
                <h3 className="text-2xl font-bold text-black mb-4">Application Status</h3>
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
                            color: '#000000',
                            usePointStyle: true,
                          }
                        },
                        tooltip: {
                          backgroundColor: 'rgba(0, 0, 0, 0.9)',
                          padding: 15,
                          titleFont: { size: 14 },
                          bodyFont: { size: 13 },
                          borderColor: '#000000',
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
              <h3 className="text-2xl font-bold text-black mb-4">Performance by Job Board</h3>
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
                          grid: { color: 'rgba(0, 0, 0, 0.05)' },
                          ticks: { 
                            color: '#666666', 
                            precision: 0,
                            stepSize: 1
                          }
                        },
                        x: {
                          grid: { display: false },
                          ticks: { 
                            color: '#666666',
                            maxRotation: 45,
                            minRotation: 45
                          }
                        }
                      }
                    }}
                  />
                ) : (
                  <div style={{ 
                    height: '250px', 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center',
                    flexDirection: 'column',
                    color: '#666666'
                  }}>
                    <div style={{ fontSize: '48px', marginBottom: '16px' }}>📊</div>
                    <p style={{ fontSize: '16px', fontWeight: 'bold' }}>No job board data yet</p>
                    <p style={{ fontSize: '14px', marginTop: '8px' }}>Apply to jobs to see performance metrics</p>
                  </div>
                )}
              </div>
            </GlassCard>

            {/* Cold Email Metrics */}
            <GlassCard className="p-6 h-full" depth="medium">
              <h3 className="text-2xl font-bold text-black mb-6">Cold Email Performance</h3>
              <div className="space-y-4">
                <motion.div 
                  className="flex items-center justify-between p-4 bg-gray-50 rounded-xl"
                  whileHover={{ scale: 1.02 }}
                >
                  <span className="text-gray-700 font-medium">Emails Sent</span>
                  <span className="text-2xl font-bold">{stats.coldEmailsSent}</span>
                </motion.div>
                <motion.div 
                  className="flex items-center justify-between p-4 bg-gray-50 rounded-xl"
                  whileHover={{ scale: 1.02 }}
                >
                  <span className="text-gray-700 font-medium">Responses</span>
                  <span className="text-2xl font-bold">{stats.coldEmailResponses}</span>
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
            <h3 className="text-xl font-bold text-black mb-4">CV Version Performance</h3>
            <div className="space-y-3">
              {stats.cvVersionPerformance.map((cv, index) => (
                <motion.div 
                  key={index} 
                  className="bg-gray-50 p-3 rounded-xl"
                  whileHover={{ scale: 1.01, x: 5 }}
                  transition={{ type: "spring", stiffness: 300 }}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-base font-bold text-black">{cv.name}</span>
                    <div className="text-right">
                      <span className="text-xl font-bold text-black">{cv.conversionRate.toFixed(1)}%</span>
                      <p className="text-xs text-gray-600">{cv.interviews} interviews</p>
                    </div>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                    <motion.div 
                      className="bg-black h-2 rounded-full"
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
            <motion.div 
              className="bg-black text-white rounded-xl p-8 shadow-sm"
              whileHover={{ 
                y: -3, 
                boxShadow: "0 15px 30px rgba(0,0,0,0.3)"
              }}
              transition={{ type: "spring", stiffness: 300 }}
            >
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-3xl font-bold">Weekly Goal</h3>
                  <p className="text-gray-300 mt-2">{stats.weeklyApplications}/{stats.weeklyGoal} applications</p>
                </div>
                <div className="text-6xl font-bold">
                  {stats.weeklyAchievement}%
                </div>
              </div>
              <div className="mt-6 bg-white/20 rounded-full h-4 overflow-hidden">
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
              className="bg-white border-2 border-gray-200 rounded-xl p-8 shadow-sm"
              whileHover={{ 
                y: -3, 
                boxShadow: "0 15px 30px rgba(0,0,0,0.1)"
              }}
              transition={{ type: "spring", stiffness: 300 }}
            >
              <h3 className="text-2xl font-bold text-black mb-6">Optimal Application Timing</h3>
              <div className="space-y-4">
                <motion.div 
                  className="flex items-center justify-between p-4 bg-gray-50 rounded-xl"
                  whileHover={{ scale: 1.02 }}
                >
                  <span className="text-gray-700 font-medium">Best Day</span>
                  <span className="text-xl font-bold text-black">{stats.bestDayOfWeek}</span>
                </motion.div>
                <motion.div 
                  className="flex items-center justify-between p-4 bg-gray-50 rounded-xl"
                  whileHover={{ scale: 1.02 }}
                >
                  <span className="text-gray-700 font-medium">Best Time</span>
                  <span className="text-xl font-bold text-black">{stats.bestTimeOfDay}</span>
                </motion.div>
                <motion.div 
                  className="flex items-center justify-between p-4 bg-black text-white rounded-xl"
                  whileHover={{ scale: 1.02, boxShadow: "0 10px 20px rgba(0,0,0,0.2)" }}
                >
                  <span className="font-medium">Avg. Response Time</span>
                  <span className="text-xl font-bold">{stats.averageResponseTime} days</span>
                </motion.div>
              </div>
            </motion.div>
          </div>
        </div>

        {/* AI Features FAB */}
        <motion.button
          onClick={() => setShowAIModal(true)}
          whileHover={{ scale: 1.1, rotate: 90 }}
          whileTap={{ scale: 0.9 }}
          className="fixed bottom-8 right-8 bg-black text-white p-6 rounded-full shadow-2xl z-50 border-2 border-gray-200"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
          </svg>
        </motion.button>

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
                        <h3 className="text-xl font-bold text-black mb-2">AI AGENTIC SCRAPING</h3>
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
                        <h3 className="text-xl font-bold text-black mb-2">CONNECT TO YOUR GPTS</h3>
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
                        <h3 className="text-xl font-bold text-black mb-2">AI ASSISTANT</h3>
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
                        <h3 className="text-xl font-bold text-black mb-2">AI SUPPORT CHATBOTS</h3>
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
    <GlassCard className="p-6 h-full" depth="medium">
      <div className="flex items-center justify-between mb-4">
        <motion.div 
          className="text-4xl"
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
        {typeof trend === 'number' && (
          <motion.div 
            className={`px-3 py-1 rounded-full text-sm font-bold ${trendPositive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}
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
        className="text-3xl font-bold text-black mb-2"
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
      <p className="text-sm font-semibold text-gray-700">{title}</p>
      {subtitle && (
        <p className="text-xs text-gray-500 mt-2">{subtitle}</p>
      )}
      <motion.div 
        className="mt-2 text-xs text-gray-400 text-center"
        animate={{ opacity: [0.5, 1, 0.5] }}
        transition={{ duration: 2, repeat: Infinity }}
      >
        👆 Click to see details
      </motion.div>
    </GlassCard>
  );

  const back = (
    <GlassCard className="p-6 h-full bg-gradient-to-br from-black to-gray-800 text-white" depth="heavy">
      <div className="flex items-center justify-between mb-4">
        <motion.div 
          className="text-4xl"
          animate={{ rotateZ: 360 }}
          transition={{ duration: 2, ease: "easeInOut" }}
        >
          {icon}
        </motion.div>
      </div>
      <h3 className="text-2xl font-bold mb-3">{title} Details</h3>
      
      {detailedStats ? (
        <div className="space-y-2 text-sm">
          {Object.entries(detailedStats).map(([key, val]: [string, any], index) => (
            <motion.div 
              key={key} 
              className="flex justify-between items-center py-1 border-b border-white/10"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.1 }}
            >
              <span className="text-white/70 capitalize text-xs">{key.replace(/([A-Z])/g, ' $1').trim()}</span>
              <span className="text-white font-bold text-sm">{typeof val === 'number' ? val.toLocaleString() : val}</span>
            </motion.div>
          ))}
        </div>
      ) : (
        <div className="space-y-2 text-sm">
          <div className="flex justify-between items-center py-1 border-b border-white/10">
            <span className="text-white/70 text-xs">Weekly Growth</span>
            <span className="text-white font-bold text-sm">{trend}%</span>
          </div>
          <div className="flex justify-between items-center py-1 border-b border-white/10">
            <span className="text-white/70 text-xs">Target</span>
            <span className="text-white font-bold text-sm">On Track</span>
          </div>
          <div className="flex justify-between items-center py-1">
            <span className="text-white/70 text-xs">Status</span>
            <span className="text-green-400 font-bold text-sm">✓ Active</span>
          </div>
        </div>
      )}
      
      <motion.div 
        className="mt-2 text-xs text-white/50 text-center"
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
      className="h-full"
      style={{ height: '180px' }} // FIXED HEIGHT TO PREVENT OVERLAP
      whileHover={{ y: -3 }}
      transition={{ type: "spring", stiffness: 300, damping: 20 }}
    >
      <FlipCard 
        front={front} 
        back={back}
        flipOnClick={true}
        animationDuration={0.6}
      />
    </motion.div>
  );
}