'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import { coldEmailsAPI, emailParserAPI } from '../../../lib/api';
import { CustomCursor } from '../../../components/CustomCursor';
import { ParticleBackground } from '../../../components/ParticleBackground';
import { GlassCard } from '../../../components/GlassCard';

export default function ColdEmailsPage() {
  const [coldEmails, setColdEmails] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showParseModal, setShowParseModal] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [formData, setFormData] = useState({
    recipientEmail: '',
    recipientName: '',
    company: '',
    subject: '',
    message: '',
  });
  const [parseConfig, setParseConfig] = useState({
    email: '',
    password: '',
    host: 'imap.gmail.com',
    port: 993,
    tls: true,
    days: 7,
    provider: 'gmail' as 'gmail' | 'outlook' | 'custom',
  });

  useEffect(() => {
    fetchColdEmails();
  }, []);

  const fetchColdEmails = async () => {
    try {
      setLoading(true);
      const data = await coldEmailsAPI.getAll();
      setColdEmails(data.coldEmails || []);
    } catch (error: any) {
      toast.error('Failed to load cold emails');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      await coldEmailsAPI.create(formData);
      
      toast.success('Cold email tracked! 📧');
      setShowAddModal(false);
      setFormData({
        recipientEmail: '',
        recipientName: '',
        company: '',
        subject: '',
        message: '',
      });
      fetchColdEmails();
    } catch (error: any) {
      toast.error(error.message || 'Failed to add cold email');
    }
  };

  const markAsResponded = async (id: string) => {
    try {
      await coldEmailsAPI.update(id, {
        responded: true,
        responseDate: new Date().toISOString(),
        conversionStatus: 'INTERESTED',
      });
      toast.success('Marked as responded! ✅');
      fetchColdEmails();
    } catch (error: any) {
      toast.error('Failed to update');
    }
  };

  const markAsNotInterested = async (id: string) => {
    try {
      await coldEmailsAPI.update(id, {
        responded: true,
        responseDate: new Date().toISOString(),
        conversionStatus: 'NOT_INTERESTED',
      });
      toast.success('Updated status');
      fetchColdEmails();
    } catch (error: any) {
      toast.error('Failed to update');
    }
  };

  const handleProviderChange = async (provider: 'gmail' | 'outlook' | 'custom') => {
    if (provider === 'gmail') {
      try {
        const config = await emailParserAPI.getGmailConfig();
        setParseConfig({ ...parseConfig, provider, host: config.host, port: config.port, tls: config.tls });
      } catch (error) {
        toast.error('Failed to load Gmail config');
      }
    } else if (provider === 'outlook') {
      try {
        const config = await emailParserAPI.getOutlookConfig();
        setParseConfig({ ...parseConfig, provider, host: config.host, port: config.port, tls: config.tls });
      } catch (error) {
        toast.error('Failed to load Outlook config');
      }
    } else {
      setParseConfig({ ...parseConfig, provider, host: '', port: 993 });
    }
  };

  const handleParseEmails = async (e: React.FormEvent) => {
    e.preventDefault();
    setParsing(true);
    try {
      const result = await emailParserAPI.parse({
        email: parseConfig.email,
        password: parseConfig.password,
        host: parseConfig.host,
        port: parseConfig.port,
        tls: parseConfig.tls,
        days: parseConfig.days,
      });
      
      toast.success(`✅ Parsed ${result.count} job-related emails!`);
      setShowParseModal(false);
      setParseConfig({ ...parseConfig, password: '' }); // Clear password
      // Refresh cold emails list after a short delay to ensure DB is updated
      setTimeout(() => {
        fetchColdEmails();
      }, 500);
    } catch (error: any) {
      const errorMessage = error.message || 'Failed to parse emails';
      
      // Check if it's an App Password error
      if (errorMessage.includes('App Password') || errorMessage.includes('Application-specific password')) {
        toast.error(
          <div>
            <div className="font-semibold mb-1">⚠️ Gmail App Password Required</div>
            <div className="text-sm">
              You need to use an App Password, not your regular password.
              <br />
              <a 
                href="https://support.google.com/accounts/answer/185833" 
                target="_blank" 
                rel="noopener noreferrer"
                className="underline text-blue-400"
              >
                Learn how to create one →
              </a>
            </div>
          </div>,
          { duration: 8000 }
        );
      } else {
        toast.error(errorMessage);
      }
    } finally {
      setParsing(false);
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
            <p className="text-xl font-semibold text-black">Loading cold emails...</p>
          </div>
        </div>
      </>
    );
  }

  const stats = {
    total: coldEmails.length,
    responded: coldEmails.filter(e => e.responded).length,
    conversionRate: coldEmails.length > 0 
      ? Math.round((coldEmails.filter(e => e.responded).length / coldEmails.length) * 100) 
      : 0,
  };

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
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                </div>
                <span className="text-2xl font-bold text-black">UK Jobs Insider</span>
              </div>
              
              <div className="flex space-x-6">
                <button 
                  onClick={() => window.location.href = '/dashboard'}
                  className="px-4 py-2 text-gray-700 hover:text-black font-medium transition"
                >
                  Dashboard
                </button>
                <button className="px-4 py-2 text-black font-medium border-b-2 border-black">
                  Cold Emails
                </button>
              </div>
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
        </nav>

        <div className="max-w-7xl mx-auto px-6 py-8">
          {/* Header with Stats */}
          <div className="mb-8">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h1 className="text-4xl font-bold text-black mb-2">Cold Email Tracking</h1>
                <p className="text-gray-600">Track your networking emails and measure success</p>
              </div>
              <div className="flex space-x-3">
                <button
                  onClick={() => setShowParseModal(true)}
                  className="px-6 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition flex items-center space-x-2"
                >
                  <span>🔍</span>
                  <span>Parse Emails</span>
                </button>
                <button
                  onClick={() => setShowAddModal(true)}
                  className="px-6 py-3 bg-black text-white rounded-lg font-semibold hover:bg-gray-800 transition flex items-center space-x-2"
                >
                  <span>📧</span>
                  <span>Log Cold Email</span>
                </button>
              </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-3 gap-6">
              <GlassCard className="p-6" depth="light">
                <div className="text-sm text-gray-600 mb-2">Total Sent</div>
                <div className="text-4xl font-bold text-black">{stats.total}</div>
              </GlassCard>
              <GlassCard className="p-6" depth="light">
                <div className="text-sm text-gray-600 mb-2">Responses</div>
                <div className="text-4xl font-bold text-green-600">{stats.responded}</div>
              </GlassCard>
              <GlassCard className="p-6" depth="light">
                <div className="text-sm text-gray-600 mb-2">Conversion Rate</div>
                <div className="text-4xl font-bold text-black">{stats.conversionRate}%</div>
              </GlassCard>
            </div>
          </div>

          {/* Cold Emails List */}
          <GlassCard className="p-6" depth="medium">
            {coldEmails.length === 0 ? (
              <div className="text-center py-12">
                <div className="text-6xl mb-4">📧</div>
                <h3 className="text-2xl font-bold text-black mb-2">No cold emails tracked yet</h3>
                <p className="text-gray-600 mb-6">Start logging your networking emails</p>
                <button
                  onClick={() => setShowAddModal(true)}
                  className="px-6 py-3 bg-black text-white rounded-lg font-semibold hover:bg-gray-800 transition"
                >
                  Log Your First Cold Email
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {coldEmails.map((email, idx) => (
                  <motion.div
                    key={email.id}
                    className={`p-5 rounded-xl border-2 ${email.responded ? 'bg-green-50 border-green-300' : 'bg-gray-50 border-gray-200'}`}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.05 }}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-3 mb-2">
                          <h3 className="text-lg font-bold text-black">{email.recipient_name || email.recipient_email}</h3>
                          {email.source === 'EMAIL_PARSED' && (
                            <span className="px-2 py-1 bg-blue-600 text-white text-xs font-semibold rounded-full">📥 Parsed</span>
                          )}
                          {email.responded && <span className="px-2 py-1 bg-green-600 text-white text-xs font-semibold rounded-full">✓ Responded</span>}
                        </div>
                        <div className="text-sm text-gray-600 space-y-1">
                          <div>📧 {email.recipient_email}</div>
                          {email.position && (
                            <div className="text-base font-semibold text-black">
                              💼 Position: {email.position}
                            </div>
                          )}
                          {email.company && <div>🏢 Company: {email.company}</div>}
                          {email.location && <div>📍 Location: {email.location}</div>}
                          {email.job_url && (
                            <div>
                              🔗 <a href={email.job_url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                                Job Link
                              </a>
                            </div>
                          )}
                          {email.subject && <div>📝 Subject: {email.subject}</div>}
                          <div>📅 {email.source === 'EMAIL_PARSED' ? 'Received' : 'Sent'}: {new Date(email.sent_at).toLocaleDateString()}</div>
                          {email.response_date && (
                            <div className="text-green-600 font-medium">
                              ✓ Responded: {new Date(email.response_date).toLocaleDateString()}
                              {email.response_time_hours && ` (${Math.round(email.response_time_hours / 24)} days)`}
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex flex-col space-y-2">
                        {!email.responded && (
                          <>
                            <button
                              onClick={() => markAsResponded(email.id)}
                              className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-semibold hover:bg-green-700 transition"
                            >
                              ✓ Mark Responded
                            </button>
                            <button
                              onClick={() => markAsNotInterested(email.id)}
                              className="px-4 py-2 bg-gray-300 text-gray-700 rounded-lg text-sm font-semibold hover:bg-gray-400 transition"
                            >
                              ✗ Not Interested
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </GlassCard>
        </div>

        {/* Add Cold Email Modal */}
        {showAddModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="bg-white rounded-2xl p-8 max-w-2xl w-full max-h-[90vh] overflow-y-auto"
            >
              <h2 className="text-3xl font-bold text-black mb-6">Log Cold Email</h2>
              
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Recipient Email *</label>
                    <input
                      type="email"
                      required
                      value={formData.recipientEmail}
                      onChange={(e) => setFormData({ ...formData, recipientEmail: e.target.value })}
                      className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-black focus:outline-none"
                      placeholder="john@company.com"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Recipient Name</label>
                    <input
                      type="text"
                      value={formData.recipientName}
                      onChange={(e) => setFormData({ ...formData, recipientName: e.target.value })}
                      className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-black focus:outline-none"
                      placeholder="John Smith"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Company</label>
                  <input
                    type="text"
                    value={formData.company}
                    onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-black focus:outline-none"
                    placeholder="Company name"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Email Subject</label>
                  <input
                    type="text"
                    value={formData.subject}
                    onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-black focus:outline-none"
                    placeholder="Job inquiry - Software Engineer position"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Message (Optional)</label>
                  <textarea
                    value={formData.message}
                    onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-black focus:outline-none h-32"
                    placeholder="Email content (optional, for your reference)..."
                  />
                </div>

                <div className="flex space-x-4 pt-4">
                  <button
                    type="submit"
                    className="flex-1 px-6 py-3 bg-black text-white rounded-lg font-semibold hover:bg-gray-800 transition"
                  >
                    📧 Save Cold Email
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowAddModal(false)}
                    className="px-6 py-3 border-2 border-gray-300 text-gray-700 rounded-lg font-semibold hover:border-black transition"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}

        {/* Parse Emails Modal */}
        {showParseModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="bg-white rounded-2xl p-8 max-w-2xl w-full max-h-[90vh] overflow-y-auto"
            >
              <h2 className="text-3xl font-bold text-black mb-6">Parse Job Emails</h2>
              
              <form onSubmit={handleParseEmails} className="space-y-4">
                <div className="bg-blue-50 p-4 rounded-lg mb-4">
                  <p className="text-sm text-blue-700 mb-2">
                    <strong>📋 How it works:</strong>
                    <br />
                    Connect your email to automatically parse job-related emails from the last 7 days.
                    The system will extract job positions, companies, locations, and URLs from your emails.
                  </p>
                  {parseConfig.provider === 'gmail' && (
                    <div className="mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded">
                      <p className="text-sm text-yellow-800 font-semibold mb-1">⚠️ Important for Gmail:</p>
                      <p className="text-xs text-yellow-700">
                        You <strong>MUST</strong> use an App Password, not your regular Gmail password.
                        <br />
                        <a 
                          href="https://support.google.com/accounts/answer/185833" 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-blue-600 underline font-semibold"
                        >
                          📖 Learn how to create an App Password →
                        </a>
                      </p>
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Email Provider</label>
                  <select
                    value={parseConfig.provider}
                    onChange={(e) => handleProviderChange(e.target.value as 'gmail' | 'outlook' | 'custom')}
                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-black focus:outline-none"
                  >
                    <option value="gmail">Gmail</option>
                    <option value="outlook">Outlook</option>
                    <option value="custom">Custom IMAP</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Email Address *</label>
                  <input
                    type="email"
                    required
                    value={parseConfig.email}
                    onChange={(e) => setParseConfig({ ...parseConfig, email: e.target.value })}
                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-black focus:outline-none"
                    placeholder="your.email@gmail.com"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Password / App Password *</label>
                  <input
                    type="password"
                    required
                    value={parseConfig.password}
                    onChange={(e) => setParseConfig({ ...parseConfig, password: e.target.value })}
                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-black focus:outline-none"
                    placeholder="Your email password or app password"
                  />
                  {parseConfig.provider === 'gmail' && (
                    <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded">
                      <p className="text-xs text-red-700 font-semibold mb-1">⚠️ Required for Gmail:</p>
                      <p className="text-xs text-red-600">
                        You <strong>cannot</strong> use your regular Gmail password. You must create an App Password.
                      </p>
                      <a 
                        href="https://support.google.com/accounts/answer/185833" 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-xs text-blue-600 underline font-semibold block mt-1"
                      >
                        📖 Step-by-step guide to create App Password →
                      </a>
                      <p className="text-xs text-gray-600 mt-2">
                        Steps: Google Account → Security → 2-Step Verification → App Passwords → Generate
                      </p>
                    </div>
                  )}
                  {parseConfig.provider === 'outlook' && (
                    <p className="text-xs text-gray-500 mt-1">
                      For Outlook: Use your regular password or an app-specific password if 2FA is enabled.
                    </p>
                  )}
                </div>

                {parseConfig.provider === 'custom' && (
                  <>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">IMAP Host *</label>
                      <input
                        type="text"
                        required={parseConfig.provider === 'custom'}
                        value={parseConfig.host}
                        onChange={(e) => setParseConfig({ ...parseConfig, host: e.target.value })}
                        className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-black focus:outline-none"
                        placeholder="imap.example.com"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">Port *</label>
                      <input
                        type="number"
                        required={parseConfig.provider === 'custom'}
                        value={parseConfig.port}
                        onChange={(e) => setParseConfig({ ...parseConfig, port: parseInt(e.target.value) })}
                        className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-black focus:outline-none"
                        placeholder="993"
                      />
                    </div>
                  </>
                )}

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Days to Parse</label>
                  <input
                    type="number"
                    min="1"
                    max="30"
                    value={parseConfig.days}
                    onChange={(e) => setParseConfig({ ...parseConfig, days: parseInt(e.target.value) })}
                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-black focus:outline-none"
                  />
                </div>

                <div className="flex space-x-4 pt-4">
                  <button
                    type="submit"
                    disabled={parsing}
                    className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition disabled:opacity-50"
                  >
                    {parsing ? 'Parsing...' : '🔍 Parse Emails'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowParseModal(false)}
                    className="px-6 py-3 border-2 border-gray-300 text-gray-700 rounded-lg font-semibold hover:border-black transition"
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

