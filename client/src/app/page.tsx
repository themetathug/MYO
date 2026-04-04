'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { CustomCursor } from '../components/CustomCursor';
import { ParticleBackground } from '../components/ParticleBackground';
import { GlassCard } from '../components/GlassCard';
import { motion } from 'framer-motion';

export default function HomePage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Check if user is logged in
    const token = localStorage.getItem('token');
    if (token) {
      router.push('/dashboard');
    } else {
      setIsLoading(false);
    }
  }, [router]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <>
      <CustomCursor />
      <ParticleBackground />
      
      <div className="min-h-screen bg-white relative overflow-x-hidden">
        {/* Navigation */}
        <motion.nav 
          className="border-b border-gray-200 backdrop-blur-lg bg-white/90 sticky top-0 z-50"
          initial={{ y: -100 }}
          animate={{ y: 0 }}
          transition={{ type: 'spring', stiffness: 100 }}
        >
          <div className="container mx-auto px-4 py-4">
            <div className="flex items-center justify-between">
              <motion.div 
                className="flex items-center space-x-2"
                whileHover={{ scale: 1.05 }}
              >
                <div className="bg-black p-2 rounded">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                </div>
                <h1 className="text-2xl font-bold text-black">MYATS</h1>
              </motion.div>
              <div className="flex items-center space-x-6">
                <Link href="/login" className="text-gray-700 hover:text-black font-medium transition-colors">Login</Link>
                <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                  <Link href="/register" className="bg-black text-white px-6 py-2 rounded font-medium hover:bg-gray-900 transition-colors">Sign Up</Link>
                </motion.div>
              </div>
            </div>
          </div>
        </motion.nav>

      <div className="container mx-auto px-4 py-16 relative z-10">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <motion.div 
            className="text-center mb-16"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
          >
            <motion.div 
              className="inline-block bg-black p-6 rounded-2xl mb-6"
              animate={{ 
                y: [0, -10, 0],
              }}
              transition={{ 
                duration: 2,
                repeat: Infinity,
                ease: "easeInOut"
              }}
            >
              <svg className="w-16 h-16 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </motion.div>
            <motion.h1 
              className="text-7xl font-bold text-black mb-4"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5, delay: 0.3 }}
            >
              Track Every Application
            </motion.h1>
            <motion.p 
              className="text-xl text-gray-600 font-medium"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5, delay: 0.5 }}
            >
              Professional job tracking with real-time analytics across LinkedIn, Indeed, Dice & more
            </motion.p>
          </motion.div>

          {/* Features */}
          <motion.div 
            className="grid md:grid-cols-3 gap-8 mb-16"
            initial="hidden"
            animate="visible"
            variants={{
              hidden: {},
              visible: {
                transition: {
                  staggerChildren: 0.1
                }
              }
            }}
          >
            {[
              {
                icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />,
                title: 'Smart Analytics',
                description: 'Track application metrics and optimize your job search strategy'
              },
              {
                icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />,
                title: 'Multi-Platform Integration',
                description: 'Connect with LinkedIn, Indeed, Dice & company websites'
              },
              {
                icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />,
                title: 'Goal Tracking',
                description: 'Set targets and monitor your progress with streak tracking'
              }
            ].map((feature, index) => (
              <motion.div
                key={index}
                variants={{
                  hidden: { opacity: 0, y: 20 },
                  visible: { opacity: 1, y: 0 }
                }}
              >
                <GlassCard className="p-8" depth="medium">
                  <motion.div 
                    className="w-16 h-16 bg-black rounded-2xl flex items-center justify-center mb-4"
                    whileHover={{ rotate: 360, scale: 1.1 }}
                    transition={{ duration: 0.5 }}
                  >
                    <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      {feature.icon}
                    </svg>
                  </motion.div>
                  <h3 className="text-xl font-bold text-black mb-3">{feature.title}</h3>
                  <p className="text-gray-600">{feature.description}</p>
                </GlassCard>
              </motion.div>
            ))}
          </motion.div>

          {/* Metrics Preview */}
          <div className="bg-gray-900 p-12 rounded-3xl mb-12 text-white">
            <h2 className="text-4xl font-bold mb-8 text-center">Track Everything</h2>
            <div className="grid md:grid-cols-2 gap-6">
              <div className="flex items-start space-x-4">
                <div className="w-2 h-2 bg-white rounded-full mt-2"></div>
                <div>
                  <h3 className="font-bold mb-1">Time per Application</h3>
                  <p className="text-gray-300 text-sm">Measure efficiency of your application process</p>
                </div>
              </div>
              <div className="flex items-start space-x-4">
                <div className="w-2 h-2 bg-white rounded-full mt-2"></div>
                <div>
                  <h3 className="font-bold mb-1">CV Conversion Rate</h3>
                  <p className="text-gray-300 text-sm">Track which CV versions work best</p>
                </div>
              </div>
              <div className="flex items-start space-x-4">
                <div className="w-2 h-2 bg-white rounded-full mt-2"></div>
                <div>
                  <h3 className="font-bold mb-1">Source Channel Performance</h3>
                  <p className="text-gray-300 text-sm">Compare LinkedIn, Indeed, Dice & more</p>
                </div>
              </div>
              <div className="flex items-start space-x-4">
                <div className="w-2 h-2 bg-white rounded-full mt-2"></div>
                <div>
                  <h3 className="font-bold mb-1">Response Time Analysis</h3>
                  <p className="text-gray-300 text-sm">Understand employer reply patterns</p>
                </div>
              </div>
            </div>
          </div>

          {/* CTA Section */}
          <motion.div 
            className="bg-black rounded-3xl shadow-2xl p-12 text-center text-white relative overflow-hidden"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5 }}
          >
            <motion.h2 
              className="text-4xl font-bold mb-4"
              animate={{ scale: [1, 1.02, 1] }}
              transition={{ duration: 2, repeat: Infinity }}
            >
              Get Started Today
            </motion.h2>
            <p className="text-xl text-gray-300 mb-10">Start tracking your job applications professionally</p>
            
            <div className="flex gap-4 justify-center">
              <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                <Link
                  href="/register"
                  className="px-10 py-4 bg-white text-black font-bold rounded-lg shadow-lg hover:shadow-xl transform transition-all"
                >
                  Sign Up Free
                </Link>
              </motion.div>
              <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                <Link
                  href="/login"
                  className="px-10 py-4 bg-transparent border-2 border-white text-white font-bold rounded-lg hover:bg-white/10 transition-all"
                >
                  Login
                </Link>
              </motion.div>
            </div>

            {/* Demo Account Info */}
            <motion.div 
              className="mt-10 p-6 bg-gray-800 rounded-2xl border border-gray-700"
              whileHover={{ scale: 1.02 }}
            >
              <p className="text-lg font-semibold">
                🎯 <strong>Demo Account:</strong> demo@ukjobsinsider.com / Demo123!
              </p>
            </motion.div>
          </motion.div>
        </div>
      </div>
    </div>
    </>
  );
}
