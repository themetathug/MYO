'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import { applicationsAPI, analyticsAPI, usersAPI } from '../../../lib/api';
import { CustomCursor } from '../../../components/CustomCursor';
import { ParticleBackground } from '../../../components/ParticleBackground';
import { GlassCard } from '../../../components/GlassCard';
import { StatusHistoryModal } from '../../../components/StatusHistoryModal';
import { GhostingSettings } from '../../../components/GhostingSettings';

export default function ApplicationsPage() {
  const [applications, setApplications] = useState<any[]>([]);
  const [filteredApplications, setFilteredApplications] = useState<any[]>([]);
  const [reviewQueue, setReviewQueue] = useState<any[]>([]);
  const [reviewQueuePendingCount, setReviewQueuePendingCount] = useState(0);
  const [cvVersions, setCvVersions] = useState<any[]>([]);
  const [recommendedCv, setRecommendedCv] = useState<{ id: string; name?: string; recommendationId?: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [reviewQueueLoading, setReviewQueueLoading] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showNoCvWarning, setShowNoCvWarning] = useState(false);
  const [pendingSubmit, setPendingSubmit] = useState(false);
  const [selectedAppForHistory, setSelectedAppForHistory] = useState<string | null>(null);
  const [selectedAppForGhosting, setSelectedAppForGhosting] = useState<string | null>(null);
  
  // Filtering, search, and sorting state
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [sourceFilter, setSourceFilter] = useState<string>('ALL');
  const [sortBy, setSortBy] = useState<'date' | 'company' | 'status' | 'time'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [formData, setFormData] = useState({
    company: '',
    position: '',
    location: '',
    jobUrl: '',
    jobBoardSource: 'Company Website',
    cvVersion: 'Standard CV',
    cvVersionId: '',
    salary: '',
    status: 'APPLIED',
    notes: '',
    timeSpent: 0,
  });

  const formatTrackedTime = (app: any): string => {
    const directSeconds = Number(app?.time_spent_seconds);
    if (Number.isFinite(directSeconds) && directSeconds > 0) {
      const h = Math.floor(directSeconds / 3600);
      const m = Math.floor((directSeconds % 3600) / 60);
      const s = directSeconds % 60;
      if (h > 0) return `${h}h ${m}m ${s}s`;
      return `${m}m ${s}s`;
    }

    let metadata: any = app?.metadata;
    if (typeof metadata === 'string') {
      try {
        metadata = JSON.parse(metadata);
      } catch {
        metadata = null;
      }
    }

    const totalSecondsFromMetadata = Number(metadata?.totalTimeSeconds);
    if (Number.isFinite(totalSecondsFromMetadata) && totalSecondsFromMetadata > 0) {
      const h = Math.floor(totalSecondsFromMetadata / 3600);
      const m = Math.floor((totalSecondsFromMetadata % 3600) / 60);
      const s = totalSecondsFromMetadata % 60;
      if (h > 0) return `${h}h ${m}m ${s}s`;
      return `${m}m ${s}s`;
    }

    const minutes = Number(app?.time_spent || 0);
    if (minutes <= 0) return 'Not tracked';
    return `${minutes}m`;
  };

  useEffect(() => {
    fetchApplications();
    fetchReviewQueue();
    fetchCvVersions();
    hydrateRecommendedCv();
  }, []);

  // Keep applications page up-to-date with extension tracked entries
  useEffect(() => {
    const interval = setInterval(() => {
      fetchApplications();
      fetchReviewQueue();
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  // Apply filters, search, and sorting
  useEffect(() => {
    let filtered = [...applications];

    // Apply search
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(app =>
        app.company?.toLowerCase().includes(query) ||
        app.position?.toLowerCase().includes(query) ||
        app.location?.toLowerCase().includes(query) ||
        app.job_board_source?.toLowerCase().includes(query)
      );
    }

    // Apply status filter
    if (statusFilter !== 'ALL') {
      filtered = filtered.filter(app => app.status === statusFilter);
    }

    // Apply source filter
    if (sourceFilter !== 'ALL') {
      filtered = filtered.filter(app => app.job_board_source === sourceFilter);
    }

    // Apply sorting
    filtered.sort((a, b) => {
      let comparison = 0;
      
      switch (sortBy) {
        case 'date':
          const dateA = new Date(a.applied_at || a.created_at).getTime();
          const dateB = new Date(b.applied_at || b.created_at).getTime();
          comparison = dateA - dateB;
          break;
        case 'company':
          comparison = (a.company || '').localeCompare(b.company || '');
          break;
        case 'status':
          comparison = (a.status || '').localeCompare(b.status || '');
          break;
        case 'time':
          comparison = (a.time_spent || 0) - (b.time_spent || 0);
          break;
      }
      
      return sortOrder === 'asc' ? comparison : -comparison;
    });

    setFilteredApplications(filtered);
  }, [applications, searchQuery, statusFilter, sourceFilter, sortBy, sortOrder]);

  const fetchApplications = async () => {
    try {
      setLoading(true);
      const data = await applicationsAPI.getAll({ limit: 100 });
      setApplications(data.applications || []);
    } catch (error: any) {
      toast.error('Failed to load applications');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const hydrateRecommendedCv = () => {
    try {
      const raw = localStorage.getItem('recommendedCvForNextApplications');
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (parsed?.id) {
        setRecommendedCv(parsed);
        setFormData((prev) => ({ ...prev, cvVersionId: parsed.id }));
      }
    } catch {
      // no-op
    }
  };

  const fetchCvVersions = async () => {
    try {
      const data = await usersAPI.getCVVersions();
      const rows = Array.isArray(data) ? data : [];
      setCvVersions(rows);

      const active = rows.find((cv: any) => cv.is_active);
      if (active && !formData.cvVersionId) {
        setFormData((prev) => ({ ...prev, cvVersionId: active.id }));
      }
    } catch (error) {
      console.error('Failed to load CV versions:', error);
    }
  };

  const fetchReviewQueue = async () => {
    try {
      setReviewQueueLoading(true);
      const data = await applicationsAPI.getStatusReviewQueue({ state: 'PENDING_REVIEW', limit: 10 });
      setReviewQueue(data.items || []);
      setReviewQueuePendingCount(data.pendingCount || 0);
    } catch (error) {
      console.error('Failed to load review queue:', error);
    } finally {
      setReviewQueueLoading(false);
    }
  };

  const confirmQueueItem = async (queueId: string) => {
    try {
      await applicationsAPI.confirmReviewQueueItem(queueId);
      toast.success('Status confirmed');
      fetchApplications();
      fetchReviewQueue();
    } catch (error: any) {
      toast.error(error?.message || 'Failed to confirm');
    }
  };

  const correctQueueItem = async (queueId: string) => {
    const correctedStatus = window.prompt('Enter corrected status (e.g. APPLIED, UNDER_REVIEW, INTERVIEW_SCHEDULED, OFFERED, REJECTED)');
    if (!correctedStatus) return;
    try {
      await applicationsAPI.correctReviewQueueItem(queueId, correctedStatus.toUpperCase());
      toast.success('Correction applied');
      fetchApplications();
      fetchReviewQueue();
    } catch (error: any) {
      toast.error(error?.message || 'Failed to correct');
    }
  };

  const dismissQueueItem = async (queueId: string) => {
    try {
      await applicationsAPI.dismissReviewQueueItem(queueId);
      toast.success('Review item dismissed');
      fetchReviewQueue();
    } catch (error: any) {
      toast.error(error?.message || 'Failed to dismiss');
    }
  };

  const doSubmitApplication = async () => {
    try {
      await applicationsAPI.create({
        ...formData,
        captureMethod: 'MANUAL',
      });

      if (recommendedCv?.id && formData.cvVersionId === recommendedCv.id) {
        await analyticsAPI.trackEvent('adopted', {
          recommendationType: 'cv_version',
          recommendationId: recommendedCv.recommendationId || `best_cv_${recommendedCv.id}`,
          selectedCvVersionId: recommendedCv.id,
          surface: 'applications_manual_form',
        }).catch(() => undefined);
      }
      
      toast.success('Application added successfully! 🎉');
      setShowAddModal(false);
      setShowNoCvWarning(false);
      setPendingSubmit(false);
      setFormData({
        company: '',
        position: '',
        location: '',
        jobUrl: '',
        jobBoardSource: 'Company Website',
        cvVersion: 'Standard CV',
        cvVersionId: recommendedCv?.id || '',
        salary: '',
        status: 'APPLIED',
        notes: '',
        timeSpent: 0,
      });
      fetchApplications();
    } catch (error: any) {
      toast.error(error.message || 'Failed to add application');
      setPendingSubmit(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.cvVersionId) {
      // Show inline modal instead of browser confirm dialog
      setShowNoCvWarning(true);
      return;
    }
    await doSubmitApplication();
  };

  const updateStatus = async (id: string, status: string) => {
    try {
      await applicationsAPI.update(id, { status });
      toast.success('Status updated!');
      fetchApplications();
    } catch (error: any) {
      toast.error('Failed to update status');
    }
  };

  const markAsResponded = async (id: string) => {
    try {
      await applicationsAPI.update(id, { 
        responseDate: new Date().toISOString(),
        status: 'VIEWED'
      });
      toast.success('Marked as responded!');
      fetchApplications();
    } catch (error: any) {
      toast.error('Failed to update');
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
            <p className="text-xl font-semibold text-black">Loading applications...</p>
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
                  onClick={() => window.location.href = '/dashboard/cv-insights'}
                  className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:text-black dark:hover:text-white font-medium transition"
                >
                  CV Insights
                </button>
                <button className="px-4 py-2 text-black dark:text-white font-medium border-b-2 border-black dark:border-white">
                  Applications
                </button>
              </div>
            </div>
          </div>
        </nav>

        <div className="max-w-7xl mx-auto px-6 py-8">
          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-4xl font-bold text-black dark:text-white mb-2 transition-colors">Job Applications</h1>
              <p className="text-gray-600 dark:text-gray-400 transition-colors">
                Track and manage all your job applications ({filteredApplications.length} of {applications.length})
              </p>
            </div>
            <button
              onClick={() => setShowAddModal(true)}
              className="px-6 py-3 bg-black dark:bg-white text-white dark:text-black rounded-lg font-semibold hover:bg-gray-800 dark:hover:bg-gray-200 transition flex items-center space-x-2"
            >
              <span>➕</span>
              <span>Add Application</span>
            </button>
          </div>

          {/* Filters, Search, and Sort */}
          <GlassCard className="p-6 mb-6" depth="light">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Search */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 transition-colors">
                  🔍 Search
                </label>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Company, position, location..."
                  className="w-full px-4 py-2 border-2 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-black dark:text-white rounded-lg focus:border-black dark:focus:border-white focus:outline-none transition-colors"
                />
              </div>
              {recommendedCv && (
                <div className="mb-6 p-4 rounded-xl border border-green-300 dark:border-green-800 bg-green-50 dark:bg-green-900/20">
                  <div className="flex items-center justify-between gap-4">
                    <p className="text-sm text-green-900 dark:text-green-200">
                      Recommended CV ready: <strong>{recommendedCv.name || 'Best performing CV'}</strong>
                    </p>
                    <button
                      onClick={() => {
                        setFormData((prev) => ({ ...prev, cvVersionId: recommendedCv.id }));
                        analyticsAPI.trackEvent('clicked', {
                          recommendationType: 'cv_version',
                          recommendationId: recommendedCv.recommendationId || `best_cv_${recommendedCv.id}`,
                          recommendedCvVersionId: recommendedCv.id,
                          surface: 'applications_manual_form',
                        }).catch(() => undefined);
                        toast.success('Recommended CV pre-selected');
                      }}
                      className="px-3 py-1 text-xs rounded bg-green-700 text-white"
                    >
                      Use Recommendation
                    </button>
                  </div>
                </div>
              )}

              {/* Status Filter */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 transition-colors">
                  📊 Status
                </label>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="w-full px-4 py-2 border-2 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-black dark:text-white rounded-lg focus:border-black dark:focus:border-white focus:outline-none transition-colors"
                >
                  <option value="ALL">All Statuses</option>
                  <option value="APPLIED">Applied</option>
                  <option value="UNDER_REVIEW">Under Review</option>
                  <option value="VIEWED">Viewed</option>
                  <option value="SHORTLISTED">Shortlisted</option>
                  <option value="INTERVIEW_SCHEDULED">Interview Scheduled</option>
                  <option value="INTERVIEWED">Interviewed</option>
                  <option value="OFFERED">Offered</option>
                  <option value="ACCEPTED">Accepted</option>
                  <option value="REJECTED">Rejected</option>
                  <option value="GHOSTED">Ghosted</option>
                  <option value="WITHDRAWN">Withdrawn</option>
                </select>
              </div>

              {/* Source Filter */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 transition-colors">
                  📍 Source
                </label>
                <select
                  value={sourceFilter}
                  onChange={(e) => setSourceFilter(e.target.value)}
                  className="w-full px-4 py-2 border-2 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-black dark:text-white rounded-lg focus:border-black dark:focus:border-white focus:outline-none transition-colors"
                >
                  <option value="ALL">All Sources</option>
                  {Array.from(new Set(applications.map(a => a.job_board_source).filter(Boolean))).map(source => (
                    <option key={source} value={source}>{source}</option>
                  ))}
                </select>
              </div>

              {/* Sort */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 transition-colors">
                  🔄 Sort By
                </label>
                <div className="flex space-x-2">
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as any)}
                    className="flex-1 px-4 py-2 border-2 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-black dark:text-white rounded-lg focus:border-black dark:focus:border-white focus:outline-none transition-colors"
                  >
                    <option value="date">Date</option>
                    <option value="company">Company</option>
                    <option value="status">Status</option>
                    <option value="time">Time Spent</option>
                  </select>
                  <button
                    onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                    className="px-4 py-2 border-2 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-black dark:text-white rounded-lg hover:border-black dark:hover:border-white transition-colors"
                    title={`Sort ${sortOrder === 'asc' ? 'Descending' : 'Ascending'}`}
                  >
                    {sortOrder === 'asc' ? '↑' : '↓'}
                  </button>
                </div>
              </div>
            </div>

            {/* Clear Filters */}
            {(searchQuery || statusFilter !== 'ALL' || sourceFilter !== 'ALL') && (
              <div className="mt-4">
                <button
                  onClick={() => {
                    setSearchQuery('');
                    setStatusFilter('ALL');
                    setSourceFilter('ALL');
                  }}
                  className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
                >
                  Clear all filters
                </button>
              </div>
            )}
          </GlassCard>

          {/* Applications Table */}
          <GlassCard className="p-6 mb-6" depth="light">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-xl font-bold text-black dark:text-white transition-colors">
                  AI Review Queue
                </h2>
                <p className="text-sm text-gray-600 dark:text-gray-400 transition-colors">
                  Medium-confidence email updates that require manual confirmation ({reviewQueuePendingCount} pending)
                </p>
              </div>
            </div>

            {reviewQueueLoading ? (
              <p className="text-sm text-gray-600 dark:text-gray-400">Loading review queue...</p>
            ) : reviewQueue.length === 0 ? (
              <p className="text-sm text-gray-600 dark:text-gray-400">No pending review items.</p>
            ) : (
              <div className="space-y-3">
                {reviewQueue.map((item) => (
                  <div key={item.id} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="font-semibold text-black dark:text-white">{item.company} - {item.position}</p>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          Detected: {item.detected_status} ({Math.round((item.detected_confidence || 0) * 100)}%)
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-500">{item.email_subject}</p>
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => confirmQueueItem(item.id)} className="px-3 py-1 text-sm rounded bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200">
                          Confirm
                        </button>
                        <button onClick={() => correctQueueItem(item.id)} className="px-3 py-1 text-sm rounded bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200">
                          Correct
                        </button>
                        <button onClick={() => dismissQueueItem(item.id)} className="px-3 py-1 text-sm rounded bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200">
                          Dismiss
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </GlassCard>

          {/* Applications Table */}
          <GlassCard className="p-6" depth="medium">
            {filteredApplications.length === 0 && applications.length > 0 ? (
              <div className="text-center py-12">
                <div className="text-6xl mb-4">🔍</div>
                <h3 className="text-2xl font-bold text-black dark:text-white mb-2 transition-colors">No applications match your filters</h3>
                <p className="text-gray-600 dark:text-gray-400 mb-6 transition-colors">Try adjusting your search or filters</p>
                <button
                  onClick={() => {
                    setSearchQuery('');
                    setStatusFilter('ALL');
                    setSourceFilter('ALL');
                  }}
                  className="px-6 py-3 bg-black dark:bg-white text-white dark:text-black rounded-lg font-semibold hover:bg-gray-800 dark:hover:bg-gray-200 transition"
                >
                  Clear Filters
                </button>
              </div>
            ) : applications.length === 0 ? (
              <div className="text-center py-12">
                <div className="text-6xl mb-4">📋</div>
                <h3 className="text-2xl font-bold text-black dark:text-white mb-2 transition-colors">No applications yet</h3>
                <p className="text-gray-600 dark:text-gray-400 mb-6 transition-colors">Start by capturing jobs with the extension or add manually</p>
                <button
                  onClick={() => setShowAddModal(true)}
                  className="px-6 py-3 bg-black dark:bg-white text-white dark:text-black rounded-lg font-semibold hover:bg-gray-800 dark:hover:bg-gray-200 transition"
                >
                  Add Your First Application
                </button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b-2 border-gray-200 dark:border-gray-700 transition-colors">
                      <th className="text-left py-3 px-4 font-semibold text-gray-700 dark:text-gray-300 transition-colors">Company</th>
                      <th className="text-left py-3 px-4 font-semibold text-gray-700 dark:text-gray-300 transition-colors">Position</th>
                      <th className="text-left py-3 px-4 font-semibold text-gray-700 dark:text-gray-300 transition-colors">Source</th>
                      <th className="text-left py-3 px-4 font-semibold text-gray-700 dark:text-gray-300 transition-colors">Exact Time</th>
                      <th className="text-left py-3 px-4 font-semibold text-gray-700 dark:text-gray-300 transition-colors">Status</th>
                      <th className="text-left py-3 px-4 font-semibold text-gray-700 dark:text-gray-300 transition-colors">Applied</th>
                      <th className="text-left py-3 px-4 font-semibold text-gray-700 dark:text-gray-300 transition-colors">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredApplications.map((app, idx) => (
                      <motion.tr
                        key={app.id}
                        className="border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: idx * 0.05 }}
                      >
                        <td className="py-4 px-4">
                          <div className="font-semibold text-black dark:text-white transition-colors">{app.company}</div>
                          <div className="text-sm text-gray-600 dark:text-gray-400 transition-colors">{app.location || 'Remote'}</div>
                        </td>
                        <td className="py-4 px-4">
                          <div className="font-medium text-black dark:text-white transition-colors">{app.position}</div>
                          {app.salary && <div className="text-sm text-gray-600 dark:text-gray-400 transition-colors">{app.salary}</div>}
                        </td>
                        <td className="py-4 px-4">
                          <span className="px-3 py-1 bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-full text-sm font-medium transition-colors">
                            {app.job_board_source || 'Unknown'}
                          </span>
                        </td>
                        <td className="py-4 px-4 text-gray-700 dark:text-gray-300 transition-colors">
                          <span className="font-semibold">{formatTrackedTime(app)}</span>
                        </td>
                        <td className="py-4 px-4">
                          <select
                            value={app.status}
                            onChange={(e) => updateStatus(app.id, e.target.value)}
                            className="px-3 py-1 border-2 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-black dark:text-white rounded-lg text-sm font-medium cursor-pointer hover:border-black dark:hover:border-white transition-colors"
                          >
                            <option value="APPLIED">Applied</option>
                            <option value="VIEWED">Viewed</option>
                            <option value="UNDER_REVIEW">Under Review</option>
                            <option value="SHORTLISTED">Shortlisted</option>
                            <option value="INTERVIEW_SCHEDULED">Interview Scheduled</option>
                            <option value="INTERVIEWED">Interviewed</option>
                            <option value="OFFERED">Offered</option>
                            <option value="ACCEPTED">Accepted</option>
                            <option value="REJECTED">Rejected</option>
                            <option value="GHOSTED">Ghosted</option>
                            <option value="WITHDRAWN">Withdrawn</option>
                          </select>
                          {app.auto_status_enabled && (
                            <div className="mt-1 text-xs text-blue-600 dark:text-blue-400 flex items-center space-x-1">
                              <span>📧</span>
                              <span>Auto-tracked</span>
                            </div>
                          )}
                        </td>
                        <td className="py-4 px-4 text-gray-700 dark:text-gray-300 transition-colors">
                          {new Date(app.applied_at || app.created_at).toLocaleDateString()}
                        </td>
                        <td className="py-4 px-4">
                          <div className="flex flex-wrap gap-2">
                            <button
                              onClick={() => setSelectedAppForHistory(app.id)}
                              className="px-3 py-1 bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-200 rounded-lg text-sm font-medium hover:bg-purple-200 dark:hover:bg-purple-800 transition"
                              title="View status history"
                            >
                              📧 History
                            </button>
                            <button
                              onClick={() => setSelectedAppForGhosting(app.id)}
                              className="px-3 py-1 bg-orange-100 dark:bg-orange-900 text-orange-800 dark:text-orange-200 rounded-lg text-sm font-medium hover:bg-orange-200 dark:hover:bg-orange-800 transition"
                              title="Ghosting settings"
                            >
                              ⚙️ Settings
                            </button>
                            {!app.response_date && (
                              <button
                                onClick={() => markAsResponded(app.id)}
                                className="px-3 py-1 bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 rounded-lg text-sm font-medium hover:bg-green-200 dark:hover:bg-green-800 transition"
                              >
                                ✓ Responded
                              </button>
                            )}
                            {app.job_url && (
                              <a
                                href={app.job_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="px-3 py-1 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded-lg text-sm font-medium hover:bg-blue-200 dark:hover:bg-blue-800 transition"
                              >
                                🔗 View
                              </a>
                            )}
                          </div>
                        </td>
                      </motion.tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </GlassCard>
        </div>

        {/* Add Application Modal */}
        {showAddModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="bg-white dark:bg-gray-800 rounded-2xl p-8 max-w-2xl w-full max-h-[90vh] overflow-y-auto transition-colors"
            >
              <h2 className="text-3xl font-bold text-black dark:text-white mb-6 transition-colors">Add Job Application</h2>
              
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 transition-colors">Company *</label>
                    <input
                      type="text"
                      required
                      value={formData.company}
                      onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                      className="w-full px-4 py-3 border-2 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-black dark:text-white rounded-lg focus:border-black dark:focus:border-white focus:outline-none transition-colors"
                      placeholder="Company name"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 transition-colors">Position *</label>
                    <input
                      type="text"
                      required
                      value={formData.position}
                      onChange={(e) => setFormData({ ...formData, position: e.target.value })}
                      className="w-full px-4 py-3 border-2 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-black dark:text-white rounded-lg focus:border-black dark:focus:border-white focus:outline-none transition-colors"
                      placeholder="Job title"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 transition-colors">Location</label>
                    <input
                      type="text"
                      value={formData.location}
                      onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                      className="w-full px-4 py-3 border-2 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-black dark:text-white rounded-lg focus:border-black dark:focus:border-white focus:outline-none transition-colors"
                      placeholder="City, Country or Remote"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 transition-colors">Job Board / Source</label>
                    <select
                      value={formData.jobBoardSource}
                      onChange={(e) => setFormData({ ...formData, jobBoardSource: e.target.value })}
                      className="w-full px-4 py-3 border-2 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-black dark:text-white rounded-lg focus:border-black dark:focus:border-white focus:outline-none transition-colors"
                    >
                      <option value="Company Website">Company Website</option>
                      <option value="LinkedIn">LinkedIn</option>
                      <option value="Indeed">Indeed</option>
                      <option value="Reed">Reed</option>
                      <option value="Totaljobs">Totaljobs</option>
                      <option value="Glassdoor">Glassdoor</option>
                      <option value="Referral">Referral</option>
                      <option value="Recruiter">Recruiter</option>
                      <option value="Email">Email</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 transition-colors">CV Version Used</label>
                  <select
                    value={formData.cvVersionId}
                    onChange={(e) => setFormData({ ...formData, cvVersionId: e.target.value })}
                    className="w-full px-4 py-3 border-2 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-black dark:text-white rounded-lg focus:border-black dark:focus:border-white focus:outline-none transition-colors"
                  >
                    {cvVersions.length === 0 ? (
                      <option value="">No CV versions found</option>
                    ) : (
                      cvVersions.map((cv: any) => (
                        <option key={cv.id} value={cv.id}>
                          {cv.name}{cv.is_active ? ' (Active)' : ''}
                        </option>
                      ))
                    )}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 transition-colors">Salary Range</label>
                    <input
                      type="text"
                      value={formData.salary}
                      onChange={(e) => setFormData({ ...formData, salary: e.target.value })}
                      className="w-full px-4 py-3 border-2 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-black dark:text-white rounded-lg focus:border-black dark:focus:border-white focus:outline-none transition-colors"
                      placeholder="e.g., £40,000 - £50,000"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 transition-colors">Time Spent (minutes)</label>
                    <input
                      type="number"
                      value={formData.timeSpent}
                      onChange={(e) => setFormData({ ...formData, timeSpent: parseInt(e.target.value) || 0 })}
                      className="w-full px-4 py-3 border-2 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-black dark:text-white rounded-lg focus:border-black dark:focus:border-white focus:outline-none transition-colors"
                      placeholder="0"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 transition-colors">Job URL</label>
                  <input
                    type="url"
                    value={formData.jobUrl}
                    onChange={(e) => setFormData({ ...formData, jobUrl: e.target.value })}
                    className="w-full px-4 py-3 border-2 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-black dark:text-white rounded-lg focus:border-black dark:focus:border-white focus:outline-none transition-colors"
                    placeholder="https://..."
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 transition-colors">Notes</label>
                  <textarea
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    className="w-full px-4 py-3 border-2 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-black dark:text-white rounded-lg focus:border-black dark:focus:border-white focus:outline-none h-24 transition-colors"
                    placeholder="Any notes about this application..."
                  />
                </div>

                <div className="flex space-x-4 pt-4">
                  <button
                    type="submit"
                    className="flex-1 px-6 py-3 bg-black dark:bg-white text-white dark:text-black rounded-lg font-semibold hover:bg-gray-800 dark:hover:bg-gray-200 transition"
                  >
                    💾 Save Application
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowAddModal(false)}
                    className="px-6 py-3 border-2 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg font-semibold hover:border-black dark:hover:border-white transition"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}

        {/* No-CV inline warning modal — replaces window.confirm */}
        {showNoCvWarning && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] p-4">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="bg-white dark:bg-gray-800 rounded-2xl p-8 max-w-md w-full shadow-2xl"
            >
              <div className="text-4xl mb-4 text-center">📄</div>
              <h3 className="text-xl font-bold text-black dark:text-white mb-2 text-center">
                No CV selected
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 text-center mb-6">
                Tracking which resume you used helps measure performance over time and gives you accurate CV insights.
                Do you want to continue without selecting a CV?
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => { setShowNoCvWarning(false); doSubmitApplication(); }}
                  disabled={pendingSubmit}
                  className="flex-1 px-4 py-3 bg-black dark:bg-white text-white dark:text-black rounded-lg font-semibold hover:bg-gray-800 dark:hover:bg-gray-100 transition disabled:opacity-50"
                >
                  Continue without CV
                </button>
                <button
                  onClick={() => setShowNoCvWarning(false)}
                  className="flex-1 px-4 py-3 border-2 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg font-semibold hover:border-black dark:hover:border-white transition"
                >
                  Go back &amp; select CV
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {/* Status History Modal */}
        {selectedAppForHistory && (
          <StatusHistoryModal
            applicationId={selectedAppForHistory}
            applicationCompany={applications.find(a => a.id === selectedAppForHistory)?.company || ''}
            isOpen={!!selectedAppForHistory}
            onClose={() => setSelectedAppForHistory(null)}
            onStatusUpdate={fetchApplications}
          />
        )}

        {/* Ghosting Settings Modal */}
        {selectedAppForGhosting && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="bg-white dark:bg-gray-800 rounded-2xl p-8 max-w-2xl w-full max-h-[90vh] overflow-y-auto transition-colors"
            >
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-3xl font-bold text-black dark:text-white transition-colors">
                  Application Settings
                </h2>
                <button
                  onClick={() => setSelectedAppForGhosting(null)}
                  className="text-gray-500 hover:text-black dark:hover:text-white transition-colors"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              {(() => {
                const app = applications.find(a => a.id === selectedAppForGhosting);
                return app ? (
                  <GhostingSettings
                    applicationId={app.id}
                    currentThreshold={app.ghosting_threshold_days || 25}
                    autoStatusEnabled={app.auto_status_enabled !== false}
                    appliedAt={app.applied_at || app.created_at}
                    onUpdate={fetchApplications}
                  />
                ) : null;
              })()}
            </motion.div>
          </div>
        )}
      </div>
    </>
  );
}

