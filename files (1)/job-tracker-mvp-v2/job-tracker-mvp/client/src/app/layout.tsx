import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { Providers } from './providers'
import { Toaster } from 'react-hot-toast'
import { PageTransition } from '../components/PageTransition'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'MYATS - Job Tracker',
  description: 'Track and optimize your job applications with intelligent insights',
}

const sentryDsn = process.env.NEXT_PUBLIC_SENTRY_DSN || ''

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  const darkMode = localStorage.getItem('darkMode') === 'true';
                  if (darkMode) {
                    document.documentElement.classList.add('dark');
                  } else {
                    document.documentElement.classList.remove('dark');
                  }
                } catch (e) {}
              })();
            `,
          }}
        />
        {sentryDsn ? (
          <>
            <script src="https://browser.sentry-cdn.com/8.42.0/bundle.tracing.min.js" crossOrigin="anonymous" />
            <script
              dangerouslySetInnerHTML={{
                __html: `
                  (function() {
                    if (!window.Sentry) return;
                    window.Sentry.init({
                      dsn: '${sentryDsn}',
                      tracesSampleRate: 0.1,
                      environment: '${process.env.NODE_ENV || 'development'}'
                    });
                  })();
                `,
              }}
            />
          </>
        ) : null}
      </head>
      <body className={inter.className}>
        <Providers>
          {children}
          <Toaster position="top-right" />
        </Providers>
      </body>
    </html>
  )
}
