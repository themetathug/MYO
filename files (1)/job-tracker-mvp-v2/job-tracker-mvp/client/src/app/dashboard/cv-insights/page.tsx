'use client';

import { useEffect, useMemo, useState } from 'react';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import { analyticsAPI } from '../../../lib/api';
import { GlassCard } from '../../../components/GlassCard';
import toast from 'react-hot-toast';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend);

const COLORS = ['#111827', '#1f2937', '#374151', '#4b5563', '#6b7280', '#9ca3af'];

export default function CVInsightsPage() {
  const [weeks, setWeeks] = useState(12);
  const [loading, setLoading] = useState(true);
  const [history, setHistory] = useState<any[]>([]);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const data = await analyticsAPI.getCvPerformanceHistory(weeks);
        setHistory(data.history || []);
      } catch (error: any) {
        toast.error(error?.message || 'Failed to load CV insights');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [weeks]);

  const chartData = useMemo(() => {
    const allWeeks = Array.from(
      new Set(history.flatMap((row: any) => row.points.map((p: any) => p.weekStart)))
    ).sort();

    return {
      labels: allWeeks,
      datasets: history.map((cv: any, idx: number) => {
        const map = new Map(cv.points.map((p: any) => [p.weekStart, p.weightedScore]));
        return {
          label: cv.cvName,
          data: allWeeks.map((week) => map.get(week) ?? null),
          borderColor: COLORS[idx % COLORS.length],
          backgroundColor: COLORS[idx % COLORS.length],
          tension: 0.25,
          spanGaps: true,
        };
      }),
    };
  }, [history]);

  const best = history.length > 0 ? history[0] : null;
  const under = history.length > 1 ? history[history.length - 1] : null;

  return (
    <div className="min-h-screen bg-white dark:bg-gray-900 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold text-black dark:text-white">CV Insights</h1>
            <p className="text-gray-600 dark:text-gray-400">Weekly ranking trend and performance deltas by resume version.</p>
          </div>
          <div className="flex items-center gap-2">
            {[8, 12, 24].map((w) => (
              <button
                key={w}
                onClick={() => setWeeks(w)}
                className={`px-3 py-2 rounded ${weeks === w ? 'bg-black text-white dark:bg-white dark:text-black' : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'}`}
              >
                {w}w
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <GlassCard className="p-5" depth="medium">
            <h2 className="text-xl font-bold text-black dark:text-white mb-2">Best Performing Resume</h2>
            {best ? (
              <p className="text-sm text-gray-700 dark:text-gray-300">
                {best.cvName} - score {best.latestWeightedScore} ({best.weeklyDelta === null ? 'new' : `${best.weeklyDelta >= 0 ? '+' : ''}${best.weeklyDelta} WoW`})
              </p>
            ) : (
              <p className="text-sm text-gray-600 dark:text-gray-400">No CV data yet.</p>
            )}
          </GlassCard>
          <GlassCard className="p-5" depth="medium">
            <h2 className="text-xl font-bold text-black dark:text-white mb-2">Underperforming Resume</h2>
            {under ? (
              <p className="text-sm text-gray-700 dark:text-gray-300">
                {under.cvName} - score {under.latestWeightedScore} ({under.weeklyDelta === null ? 'new' : `${under.weeklyDelta >= 0 ? '+' : ''}${under.weeklyDelta} WoW`})
              </p>
            ) : (
              <p className="text-sm text-gray-600 dark:text-gray-400">Need at least 2 CVs with tracked data.</p>
            )}
          </GlassCard>
        </div>

        <GlassCard className="p-5" depth="heavy">
          <h2 className="text-xl font-bold text-black dark:text-white mb-4">Weekly Weighted Score Trend</h2>
          {loading ? (
            <p className="text-sm text-gray-600 dark:text-gray-400">Loading chart...</p>
          ) : history.length === 0 ? (
            <p className="text-sm text-gray-600 dark:text-gray-400">No CV performance history yet.</p>
          ) : (
            <div style={{ height: 360 }}>
              <Line
                data={chartData}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: {
                    legend: { position: 'bottom' },
                  },
                  scales: { y: { beginAtZero: true, max: 100 } },
                }}
              />
            </div>
          )}
        </GlassCard>

        <GlassCard className="p-5" depth="medium">
          <h2 className="text-xl font-bold text-black dark:text-white mb-4">Ranking and Weekly Delta</h2>
          {history.length === 0 ? (
            <p className="text-sm text-gray-600 dark:text-gray-400">No ranking data available.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-700">
                    <th className="text-left py-2">Rank</th>
                    <th className="text-left py-2">CV</th>
                    <th className="text-left py-2">Latest Score</th>
                    <th className="text-left py-2">Previous Score</th>
                    <th className="text-left py-2">Weekly Delta</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((cv: any, idx: number) => (
                    <tr key={cv.cvId} className="border-b border-gray-100 dark:border-gray-800">
                      <td className="py-2">{idx + 1}</td>
                      <td className="py-2">{cv.cvName}</td>
                      <td className="py-2">{cv.latestWeightedScore}</td>
                      <td className="py-2">{cv.previousWeightedScore ?? 'N/A'}</td>
                      <td className="py-2">{cv.weeklyDelta === null ? 'N/A' : `${cv.weeklyDelta >= 0 ? '+' : ''}${cv.weeklyDelta}`}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </GlassCard>
      </div>
    </div>
  );
}
