'use client';

export default function PrivacyPolicyPage() {
  const lastUpdated = 'March 2026';

  return (
    <div className="min-h-screen bg-white dark:bg-gray-900 py-16 px-6">
      <div className="max-w-3xl mx-auto space-y-8 text-gray-700 dark:text-gray-300">
        <div>
          <h1 className="text-4xl font-bold text-black dark:text-white mb-2">Privacy Policy</h1>
          <p className="text-sm text-gray-500">Last updated: {lastUpdated}</p>
        </div>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-black dark:text-white">1. What we collect</h2>
          <p>We collect only the information needed to provide the UK Job Tracker service:</p>
          <ul className="list-disc pl-6 space-y-1">
            <li>Your email address and hashed password for account access.</li>
            <li>Job application data you submit (company, role, status, notes).</li>
            <li>CV/resume version names and optional content you upload for performance tracking.</li>
            <li>Email metadata (sender domain, subject, date) used for automatic status detection — we never store your full email body permanently.</li>
            <li>Time-tracking data derived from your browser session when the extension is active.</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-black dark:text-white">2. How we use it</h2>
          <ul className="list-disc pl-6 space-y-1">
            <li>To display your job application pipeline and analytics on your dashboard.</li>
            <li>To automatically update application statuses when we detect relevant emails.</li>
            <li>To compute CV performance scores and recommendations.</li>
            <li>We do not sell, rent, or share your data with any third party for marketing purposes.</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-black dark:text-white">3. Data retention</h2>
          <ul className="list-disc pl-6 space-y-1">
            <li>Your account data is retained while your account is active.</li>
            <li>Email metadata used for status matching is retained for 90 days, then automatically deleted.</li>
            <li>Deleted accounts are purged from our systems within 30 days.</li>
            <li>Anonymised aggregate analytics may be retained indefinitely.</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-black dark:text-white">4. Security</h2>
          <p>
            Email credentials you provide for sync are encrypted at rest using AES-256. All traffic is
            served over HTTPS. Authentication uses short-lived JWT tokens and rotating refresh tokens
            stored in HTTP-only cookies, not localStorage.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-black dark:text-white">5. Your rights</h2>
          <p>
            You may request a full export or deletion of your data at any time by emailing us or using
            the account settings page. We will respond within 14 days.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-black dark:text-white">6. Cookies</h2>
          <p>
            We use a single HTTP-only authentication cookie. We do not use advertising or tracking cookies.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-black dark:text-white">7. Contact</h2>
          <p>
            Questions? Reach us at{' '}
            <a href="mailto:privacy@ukjobtracker.io" className="underline text-black dark:text-white">
              privacy@ukjobtracker.io
            </a>
            .
          </p>
        </section>

        <div className="pt-8 border-t border-gray-200 dark:border-gray-700">
          <a href="/" className="text-sm text-gray-500 hover:text-black dark:hover:text-white transition-colors">
            ← Back to home
          </a>
        </div>
      </div>
    </div>
  );
}
