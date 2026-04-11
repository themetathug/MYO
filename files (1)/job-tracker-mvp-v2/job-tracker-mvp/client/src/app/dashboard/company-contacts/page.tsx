'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import { companyContactsAPI, applicationsAPI } from '../../../lib/api';
import { CustomCursor } from '../../../components/CustomCursor';
import { ParticleBackground } from '../../../components/ParticleBackground';
import { GlassCard } from '../../../components/GlassCard';

interface CompanyContact {
  id: string;
  company: string;
  domain: string;
  emailAddress?: string;
  isVerified: boolean;
  created_at: string;
}

export default function CompanyContactsPage() {
  const router = useRouter();
  const [contacts, setContacts] = useState<CompanyContact[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingContact, setEditingContact] = useState<CompanyContact | null>(null);
  const [formData, setFormData] = useState({
    company: '',
    domain: '',
    emailAddress: '',
  });

  useEffect(() => {
    fetchContacts();
  }, []);

  const fetchContacts = async () => {
    try {
      setLoading(true);
      const data = await companyContactsAPI.getAll();
      const normalized = (data.contacts || []).map((c: any) => ({
        id: c.id,
        company: c.company || c.company_name || '',
        domain: c.domain || '',
        emailAddress: Array.isArray(c.emailAddresses) ? (c.emailAddresses[0] || '') : (c.email_address || ''),
        isVerified: c.isVerified ?? c.is_verified ?? c.verified ?? false,
        created_at: c.created_at,
      }));
      setContacts(normalized);
    } catch (error: any) {
      toast.error('Failed to load company contacts');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const extractDomainFromApplications = async () => {
    try {
      const data = await applicationsAPI.getAll({ limit: 100 });
      const applications = data.applications || [];
      const domains = new Set<string>();
      
      applications.forEach((app: any) => {
        if (app.company_domain) {
          domains.add(app.company_domain);
        }
        if (app.job_url) {
          try {
            const url = new URL(app.job_url);
            const domain = url.hostname.replace('www.', '');
            domains.add(domain);
          } catch (e) {
            // Invalid URL
          }
        }
      });

      return Array.from(domains);
    } catch (error) {
      console.error('Failed to extract domains:', error);
      return [];
    }
  };

  const handleAddFromApplications = async () => {
    try {
      const domains = await extractDomainFromApplications();
      if (domains.length === 0) {
        toast.error('No domains found in applications');
        return;
      }

      // Add all domains as contacts
      for (const domain of domains) {
        const company = domain.split('.')[0].charAt(0).toUpperCase() + domain.split('.')[0].slice(1);
        try {
          await companyContactsAPI.create({
            company,
            domain,
          });
        } catch (e) {
          // Domain might already exist
        }
      }

      toast.success(`Added ${domains.length} company contacts from applications`);
      fetchContacts();
    } catch (error: any) {
      toast.error('Failed to add contacts from applications');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = {
        company: formData.company,
        domain: formData.domain,
        emailAddresses: formData.emailAddress ? [formData.emailAddress] : [],
      };
      if (editingContact) {
        await companyContactsAPI.update(editingContact.id, payload);
        toast.success('Contact updated successfully!');
      } else {
        await companyContactsAPI.create(payload);
        toast.success('Contact added successfully!');
      }
      setShowAddModal(false);
      setEditingContact(null);
      setFormData({ company: '', domain: '', emailAddress: '' });
      fetchContacts();
    } catch (error: any) {
      toast.error(error.message || 'Failed to save contact');
    }
  };

  const handleEdit = (contact: CompanyContact) => {
    setEditingContact(contact);
    setFormData({
      company: contact.company,
      domain: contact.domain,
      emailAddress: contact.emailAddress || '',
    });
    setShowAddModal(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this contact?')) return;
    try {
      await companyContactsAPI.delete(id);
      toast.success('Contact deleted');
      fetchContacts();
    } catch (error: any) {
      toast.error('Failed to delete contact');
    }
  };

  const handleVerify = async (id: string) => {
    try {
      await companyContactsAPI.verify(id);
      toast.success('Contact verified');
      fetchContacts();
    } catch (error: any) {
      toast.error('Failed to verify contact');
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
            <p className="text-xl font-semibold text-black">Loading contacts...</p>
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
                  onClick={() => router.push('/dashboard')}
                  className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:text-black dark:hover:text-white font-medium transition"
                >
                  Dashboard
                </button>
                <button 
                  onClick={() => router.push('/dashboard/applications')}
                  className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:text-black dark:hover:text-white font-medium transition"
                >
                  Applications
                </button>
                <button className="px-4 py-2 text-black dark:text-white font-medium border-b-2 border-black dark:border-white">
                  Company Contacts
                </button>
              </div>
            </div>
          </div>
        </nav>

        <div className="max-w-7xl mx-auto px-6 py-8">
          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-4xl font-bold text-black dark:text-white mb-2 transition-colors">
                Company Contacts
              </h1>
              <p className="text-gray-600 dark:text-gray-400 transition-colors">
                Manage verified company domains for better email tracking
              </p>
            </div>
            <div className="flex space-x-3">
              <button
                onClick={handleAddFromApplications}
                className="px-6 py-3 border-2 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg font-semibold hover:border-black dark:hover:border-white transition"
              >
                📥 Import from Applications
              </button>
              <button
                onClick={() => {
                  setEditingContact(null);
                  setFormData({ company: '', domain: '', emailAddress: '' });
                  setShowAddModal(true);
                }}
                className="px-6 py-3 bg-black dark:bg-white text-white dark:text-black rounded-lg font-semibold hover:bg-gray-800 dark:hover:bg-gray-200 transition flex items-center space-x-2"
              >
                <span>➕</span>
                <span>Add Contact</span>
              </button>
            </div>
          </div>

          {/* Contacts List */}
          <GlassCard className="p-6" depth="medium">
            {contacts.length === 0 ? (
              <div className="text-center py-12">
                <div className="text-6xl mb-4">📇</div>
                <h3 className="text-2xl font-bold text-black dark:text-white mb-2 transition-colors">
                  No company contacts yet
                </h3>
                <p className="text-gray-600 dark:text-gray-400 mb-6 transition-colors">
                  Add company domains to improve email-based status tracking accuracy
                </p>
                <button
                  onClick={() => {
                    setEditingContact(null);
                    setFormData({ company: '', domain: '', emailAddress: '' });
                    setShowAddModal(true);
                  }}
                  className="px-6 py-3 bg-black dark:bg-white text-white dark:text-black rounded-lg font-semibold hover:bg-gray-800 dark:hover:bg-gray-200 transition"
                >
                  Add Your First Contact
                </button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b-2 border-gray-200 dark:border-gray-700 transition-colors">
                      <th className="text-left py-3 px-4 font-semibold text-gray-700 dark:text-gray-300 transition-colors">Company</th>
                      <th className="text-left py-3 px-4 font-semibold text-gray-700 dark:text-gray-300 transition-colors">Domain</th>
                      <th className="text-left py-3 px-4 font-semibold text-gray-700 dark:text-gray-300 transition-colors">Email</th>
                      <th className="text-left py-3 px-4 font-semibold text-gray-700 dark:text-gray-300 transition-colors">Status</th>
                      <th className="text-left py-3 px-4 font-semibold text-gray-700 dark:text-gray-300 transition-colors">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {contacts.map((contact, idx) => (
                      <motion.tr
                        key={contact.id}
                        className="border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: idx * 0.05 }}
                      >
                        <td className="py-4 px-4">
                          <div className="font-semibold text-black dark:text-white transition-colors">
                            {contact.company}
                          </div>
                        </td>
                        <td className="py-4 px-4">
                          <code className="px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded text-sm">
                            {contact.domain}
                          </code>
                        </td>
                        <td className="py-4 px-4 text-gray-700 dark:text-gray-300 transition-colors">
                          {contact.emailAddress || '-'}
                        </td>
                        <td className="py-4 px-4">
                          {contact.isVerified ? (
                            <span className="px-3 py-1 bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 rounded-full text-sm font-medium">
                              ✓ Verified
                            </span>
                          ) : (
                            <span className="px-3 py-1 bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200 rounded-full text-sm font-medium">
                              Unverified
                            </span>
                          )}
                        </td>
                        <td className="py-4 px-4">
                          <div className="flex space-x-2">
                            {!contact.isVerified && (
                              <button
                                onClick={() => handleVerify(contact.id)}
                                className="px-3 py-1 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded-lg text-sm font-medium hover:bg-blue-200 dark:hover:bg-blue-800 transition"
                              >
                                Verify
                              </button>
                            )}
                            <button
                              onClick={() => handleEdit(contact)}
                              className="px-3 py-1 bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-lg text-sm font-medium hover:bg-gray-200 dark:hover:bg-gray-600 transition"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => handleDelete(contact.id)}
                              className="px-3 py-1 bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200 rounded-lg text-sm font-medium hover:bg-red-200 dark:hover:bg-red-800 transition"
                            >
                              Delete
                            </button>
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

        {/* Add/Edit Modal */}
        {showAddModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="bg-white dark:bg-gray-800 rounded-2xl p-8 max-w-2xl w-full max-h-[90vh] overflow-y-auto transition-colors"
            >
              <h2 className="text-3xl font-bold text-black dark:text-white mb-6 transition-colors">
                {editingContact ? 'Edit Contact' : 'Add Company Contact'}
              </h2>
              
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 transition-colors">
                    Company Name *
                  </label>
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
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 transition-colors">
                    Domain *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.domain}
                    onChange={(e) => setFormData({ ...formData, domain: e.target.value })}
                    className="w-full px-4 py-3 border-2 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-black dark:text-white rounded-lg focus:border-black dark:focus:border-white focus:outline-none transition-colors"
                    placeholder="example.com"
                  />
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Domain without www or protocol (e.g., example.com)
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 transition-colors">
                    Email Address
                  </label>
                  <input
                    type="email"
                    value={formData.emailAddress}
                    onChange={(e) => setFormData({ ...formData, emailAddress: e.target.value })}
                    className="w-full px-4 py-3 border-2 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-black dark:text-white rounded-lg focus:border-black dark:focus:border-white focus:outline-none transition-colors"
                    placeholder="hr@example.com"
                  />
                </div>

                <div className="flex space-x-4 pt-4">
                  <button
                    type="submit"
                    className="flex-1 px-6 py-3 bg-black dark:bg-white text-white dark:text-black rounded-lg font-semibold hover:bg-gray-800 dark:hover:bg-gray-200 transition"
                  >
                    💾 {editingContact ? 'Update' : 'Save'} Contact
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowAddModal(false);
                      setEditingContact(null);
                      setFormData({ company: '', domain: '', emailAddress: '' });
                    }}
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
