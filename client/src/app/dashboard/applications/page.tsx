'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import { applicationsAPI } from '../../../lib/api';
import { CustomCursor } from '../../../components/CustomCursor';
import { ParticleBackground } from '../../../components/ParticleBackground';
import { GlassCard } from '../../../components/GlassCard';

export default function ApplicationsPage() {
  const [applications, setApplications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [formData, setFormData] = useState({
    company: '',
    position: '',
    location: '',
    jobUrl: '',
    jobBoardSource: 'Company Website',
    cvVersion: 'Standard CV',
    salary: '',
    status: 'APPLIED',
    notes: '',
    timeSpent: 0,
  });

  useEffect(() => {
    fetchApplications();
  }, []);

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      await applicationsAPI.create({
        ...formData,
        captureMethod: 'MANUAL',
      });
      
      toast.success('Application added successfully! 🎉');
      setShowAddModal(false);
      setFormData({
        company: '',
        position: '',
        location: '',
        jobUrl: '',
        jobBoardSource: 'Company Website',
        cvVersion: 'Standard CV',
        salary: '',
        status: 'APPLIED',
        notes: '',
        timeSpent: 0,
      });
      fetchApplications();
    } catch (error: any) {
      toast.error(error.message || 'Failed to add application');
    }
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
              <p className="text-gray-600 dark:text-gray-400 transition-colors">Track and manage all your job applications</p>
            </div>
            <button
              onClick={() => setShowAddModal(true)}
              className="px-6 py-3 bg-black dark:bg-white text-white dark:text-black rounded-lg font-semibold hover:bg-gray-800 dark:hover:bg-gray-200 transition flex items-center space-x-2"
            >
              <span>➕</span>
              <span>Add Application</span>
            </button>
          </div>

          {/* Applications Table */}
          <GlassCard className="p-6" depth="medium">
            {applications.length === 0 ? (
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
                      <th className="text-left py-3 px-4 font-semibold text-gray-700 dark:text-gray-300 transition-colors">Status</th>
                      <th className="text-left py-3 px-4 font-semibold text-gray-700 dark:text-gray-300 transition-colors">Applied</th>
                      <th className="text-left py-3 px-4 font-semibold text-gray-700 dark:text-gray-300 transition-colors">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {applications.map((app, idx) => (
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
                        <td className="py-4 px-4">
                          <select
                            value={app.status}
                            onChange={(e) => updateStatus(app.id, e.target.value)}
                            className="px-3 py-1 border-2 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-black dark:text-white rounded-lg text-sm font-medium cursor-pointer hover:border-black dark:hover:border-white transition-colors"
                          >
                            <option value="APPLIED">Applied</option>
                            <option value="VIEWED">Viewed</option>
                            <option value="SHORTLISTED">Shortlisted</option>
                            <option value="INTERVIEW_SCHEDULED">Interview Scheduled</option>
                            <option value="INTERVIEWED">Interviewed</option>
                            <option value="OFFERED">Offered</option>
                            <option value="REJECTED">Rejected</option>
                          </select>
                        </td>
                        <td className="py-4 px-4 text-gray-700 dark:text-gray-300 transition-colors">
                          {new Date(app.applied_at || app.created_at).toLocaleDateString()}
                        </td>
                        <td className="py-4 px-4">
                          <div className="flex space-x-2">
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
                    value={formData.cvVersion}
                    onChange={(e) => setFormData({ ...formData, cvVersion: e.target.value })}
                    className="w-full px-4 py-3 border-2 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-black dark:text-white rounded-lg focus:border-black dark:focus:border-white focus:outline-none transition-colors"
                  >
                    <option value="Standard CV">Standard CV</option>
                    <option value="Tech CV">Tech CV</option>
                    <option value="Creative CV">Creative CV</option>
                    <option value="Senior CV">Senior CV</option>
                    <option value="Graduate CV">Graduate CV</option>
                    <option value="Executive CV">Executive CV</option>
                    <option value="Custom CV">Custom CV</option>
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
      </div>
    </>
  );
}

