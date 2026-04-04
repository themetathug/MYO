'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { motion } from 'framer-motion';
import { CustomCursor } from '../../components/CustomCursor';
import { ParticleBackground } from '../../components/ParticleBackground';

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });

  useEffect(() => {
    // Check if redirected due to expired token
    if (searchParams?.get('expired') === 'true') {
      toast.error('Your session expired. Please login again.');
    }
  }, [searchParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (response.ok) {
        localStorage.setItem('token', data.token);
        localStorage.setItem('user', JSON.stringify(data.user));
        toast.success('Login successful!');
        router.push('/dashboard');
      } else {
        // For demo, allow mock login
        if (formData.email === 'demo@ukjobsinsider.com' && formData.password === 'Demo123!') {
          localStorage.setItem('token', 'mock-token');
          localStorage.setItem('user', JSON.stringify({ 
            id: 'demo-user',
            email: formData.email,
            firstName: 'Demo',
            lastName: 'User'
          }));
          toast.success('Login successful! (Demo Mode)');
          router.push('/dashboard');
        } else {
          toast.error(data.message || 'Login failed');
        }
      }
    } catch (error) {
      // Allow demo login even if API is down
      if (formData.email === 'demo@ukjobsinsider.com' && formData.password === 'Demo123!') {
        localStorage.setItem('token', 'mock-token');
        localStorage.setItem('user', JSON.stringify({ 
          id: 'demo-user',
          email: formData.email,
          firstName: 'Demo',
          lastName: 'User'
        }));
        toast.success('Login successful! (Demo Mode)');
        router.push('/dashboard');
      } else {
        toast.error('Unable to connect to server. Try demo account.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleDemoLogin = () => {
    setFormData({
      email: 'demo@ukjobsinsider.com',
      password: 'Demo123!',
    });
    toast.success('Demo credentials filled!');
  };

  return (
    <>
      <CustomCursor />
      <ParticleBackground />
      
      <div className="min-h-screen bg-white flex items-center justify-center p-4 relative">
        <motion.div 
          className="max-w-md w-full relative z-10"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
        >
          <div className="bg-white/90 backdrop-blur-xl rounded-3xl shadow-2xl p-8 border-2 border-gray-200" style={{ transformStyle: 'preserve-3d' }}>
          {/* Logo */}
          <motion.div 
            className="text-center mb-8"
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <motion.div 
              className="inline-block bg-black p-4 rounded-2xl mb-4"
              animate={{ 
                y: [0, -5, 0],
                rotateY: [0, 5, 0, -5, 0]
              }}
              transition={{ 
                duration: 3,
                repeat: Infinity,
                ease: "easeInOut"
              }}
            >
              <svg className="w-12 h-12 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </motion.div>
            <h1 className="text-4xl font-bold text-black">
              Welcome Back
            </h1>
            <p className="text-gray-600 mt-2 text-lg">Login to your Job Tracker account</p>
          </motion.div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Email Address
              </label>
              <input
                type="email"
                required
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition shadow-sm hover:shadow-md"
                placeholder="you@example.com"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Password
              </label>
              <input
                type="password"
                required
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition shadow-sm hover:shadow-md"
                placeholder="••••••••"
              />
            </div>

            <div className="flex items-center justify-between">
              <label className="flex items-center">
                <input type="checkbox" className="rounded border-gray-300 text-indigo-600" />
                <span className="ml-2 text-sm text-gray-600">Remember me</span>
              </label>
              <Link href="/forgot-password" className="text-sm text-indigo-600 hover:text-indigo-500">
                Forgot password?
              </Link>
            </div>

            <motion.button
              type="submit"
              disabled={isLoading}
              whileHover={{ scale: 1.02, y: -2 }}
              whileTap={{ scale: 0.98 }}
              className="w-full py-4 px-4 bg-black text-white font-bold rounded-lg shadow-lg hover:shadow-2xl disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              {isLoading ? 'Signing in...' : 'Sign In'}
            </motion.button>
          </form>

          <div className="mt-6">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-300"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-4 bg-white text-gray-500">Or</span>
              </div>
            </div>

            <motion.button
              onClick={handleDemoLogin}
              whileHover={{ scale: 1.02, y: -2 }}
              whileTap={{ scale: 0.98 }}
              className="mt-4 w-full py-4 px-4 bg-white text-black font-bold rounded-lg shadow-lg hover:shadow-2xl border-2 border-black transition-all"
            >
              Use Demo Account
            </motion.button>
          </div>

          <p className="mt-6 text-center text-sm text-gray-600">
            Don't have an account?{' '}
            <Link href="/register" className="text-indigo-600 hover:text-indigo-500 font-semibold">
              Sign up
            </Link>
          </p>
          </div>
        </motion.div>
      </div>
    </>
  );
}
