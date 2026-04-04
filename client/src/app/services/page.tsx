'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { CustomCursor } from '../../components/CustomCursor';
import { ParticleBackground } from '../../components/ParticleBackground';
import { GlassCard } from '../../components/GlassCard';

export default function ServicesPage() {
  const router = useRouter();
  const [servicesStatus, setServicesStatus] = useState<any>({});

  useEffect(() => {
    // Check if logged in
    const token = localStorage.getItem('token');
    if (!token) {
      router.push('/login');
      return;
    }

    // Check service statuses
    checkServicesStatus();
  }, [router]);

  const checkServicesStatus = async () => {
    try {
      // Check backend API
      const backendStatus = await fetch('http://localhost:3001/health').then(r => r.ok).catch(() => false);
      
      // Check Python ML Service
      const pythonStatus = await fetch('http://localhost:8000/health').then(r => r.ok).catch(() => false);

      setServicesStatus({
        backend: backendStatus ? 'online' : 'offline',
        pythonML: pythonStatus ? 'online' : 'offline',
        database: 'unknown',
        redis: 'unknown',
      });
    } catch (error) {
      console.error('Error checking services:', error);
    }
  };

  const services = [
    {
      name: 'Node.js Backend API',
      status: servicesStatus.backend || 'offline',
      icon: '⚡',
      description: 'Handles authentication, CRUD operations, and API routing',
      technologies: ['Express.js', 'TypeScript', 'Prisma', 'JWT'],
      endpoints: [
        'GET /api/auth/login',
        'GET /api/applications',
        'GET /api/analytics/dashboard',
        'GET /api/users/profile',
      ],
      features: [
        'User authentication with JWT',
        'Application tracking and management',
        'Real-time analytics calculation',
        'Redis caching for performance',
        'Rate limiting and security',
      ],
    },
    {
      name: 'Python ML Service',
      status: servicesStatus.pythonML || 'offline',
      icon: '🤖',
      description: 'AI-powered job matching, CV analysis, and success prediction',
      technologies: ['FastAPI', 'Python', 'ML', 'NLP'],
      endpoints: [
        'POST /api/v1/match-jobs',
        'POST /api/v1/analyze-cv',
        'POST /api/v1/predict-success',
      ],
      features: [
        'Intelligent job matching using AI',
        'CV analysis and optimization suggestions',
        'Success probability prediction',
        'Semantic similarity matching',
        'NLP-powered insights',
      ],
    },
    {
      name: 'PostgreSQL Database',
      status: 'unknown',
      icon: '🗄️',
      description: 'Reliable data storage with Prisma ORM',
      technologies: ['PostgreSQL', 'Prisma', 'SQL'],
      features: [
        'User data management',
        'Application history tracking',
        'CV version management',
        'Analytics and events storage',
        'ACID transactions',
      ],
    },
    {
      name: 'Redis Cache',
      status: 'unknown',
      icon: '⚡',
      description: 'High-performance caching layer',
      technologies: ['Redis', 'In-Memory'],
      features: [
        'Session management',
        'Analytics caching',
        'Performance optimization',
        'Real-time data',
      ],
    },
  ];

  return (
    <>
      <CustomCursor />
      <ParticleBackground />
      
      <div className="min-h-screen bg-white relative">
        {/* Navigation */}
        <motion.nav 
          className="bg-white/90 backdrop-blur-lg border-b border-gray-200 sticky top-0 z-50"
          initial={{ y: -100 }}
          animate={{ y: 0 }}
        >
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center h-16">
              <div className="flex items-center space-x-4">
                <button
                  onClick={() => router.push('/dashboard')}
                  className="text-gray-600 hover:text-black font-medium"
                >
                  ← Back to Dashboard
                </button>
              </div>
              <h1 className="text-xl font-bold text-black">
                System Services
              </h1>
              <motion.button
                onClick={() => {
                  localStorage.removeItem('token');
                  router.push('/');
                }}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="px-4 py-2 bg-black text-white rounded-lg transition font-medium"
              >
                Logout
              </motion.button>
            </div>
          </div>
        </motion.nav>

      <div className="max-w-7xl mx-auto p-6 relative z-10">
        {/* Header */}
        <motion.div 
          className="text-center mb-12"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <h1 className="text-5xl font-bold text-black mb-4">
            Your Services Architecture
          </h1>
          <p className="text-xl text-gray-600">All the technologies and services powering your Job Tracker</p>
        </motion.div>

        {/* Services Grid */}
        <motion.div 
          className="grid grid-cols-1 lg:grid-cols-2 gap-8"
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
          {services.map((service, index) => (
            <motion.div
              key={index}
              variants={{
                hidden: { opacity: 0, y: 20 },
                visible: { opacity: 1, y: 0 }
              }}
            >
              <GlassCard className="p-8" depth="medium">
              <div className="flex items-start justify-between mb-6">
                <div className="flex items-center space-x-4">
                  <motion.div 
                    className="text-6xl"
                    animate={{ scale: [1, 1.1, 1] }}
                    transition={{ duration: 2, repeat: Infinity, delay: index * 0.3 }}
                  >
                    {service.icon}
                  </motion.div>
                  <div>
                    <h3 className="text-2xl font-bold text-black">{service.name}</h3>
                    <motion.div 
                      className={`inline-block px-3 py-1 rounded-full text-sm font-semibold mt-2 ${
                        service.status === 'online' 
                          ? 'bg-green-100 text-green-700' 
                          : service.status === 'offline'
                          ? 'bg-red-100 text-red-700'
                          : 'bg-gray-100 text-gray-700'
                      }`}
                      animate={{ scale: [1, 1.05, 1] }}
                      transition={{ duration: 2, repeat: Infinity }}
                    >
                      {service.status === 'online' ? '✓ Online' : service.status === 'offline' ? '✗ Offline' : '? Unknown'}
                    </motion.div>
                  </div>
                </div>
              </div>

              <p className="text-gray-600 mb-6 text-lg">{service.description}</p>

              {/* Technologies */}
              <div className="mb-6">
                <h4 className="text-sm font-semibold text-gray-700 mb-3">Technologies</h4>
                <div className="flex flex-wrap gap-2">
                  {service.technologies.map((tech, i) => (
                    <span
                      key={i}
                      className="px-3 py-1 bg-indigo-100 text-indigo-700 rounded-lg text-sm font-medium"
                    >
                      {tech}
                    </span>
                  ))}
                </div>
              </div>

              {/* API Endpoints or Features */}
              <div className="mb-6">
                <h4 className="text-sm font-semibold text-gray-700 mb-3">
                  {service.endpoints ? 'API Endpoints' : 'Key Features'}
                </h4>
                <div className="space-y-2">
                  {(service.endpoints || service.features || []).map((item, i) => (
                    <div key={i} className="flex items-start space-x-2">
                      <span className="text-indigo-600 mt-1">•</span>
                      <span className="text-sm text-gray-600 font-mono">{item}</span>
                    </div>
                  ))}
                </div>
              </div>
              </GlassCard>
            </motion.div>
          ))}
        </motion.div>

        {/* System Architecture */}
        <GlassCard className="p-8 mt-12" depth="medium">
          <h2 className="text-3xl font-bold text-black mb-6">System Architecture</h2>
          <div className="grid md:grid-cols-4 gap-6">
            {[
              { icon: '⚛️', label: 'Frontend', tech: 'React/Next.js', color: 'bg-blue-50' },
              { icon: '⚡', label: 'Backend', tech: 'Node.js/Express', color: 'bg-green-50' },
              { icon: '🤖', label: 'ML Service', tech: 'Python/FastAPI', color: 'bg-purple-50' },
              { icon: '🗄️', label: 'Database', tech: 'PostgreSQL', color: 'bg-orange-50' },
            ].map((arch, index) => (
              <motion.div 
                key={index}
                className={`text-center p-4 ${arch.color} rounded-xl`}
                whileHover={{ scale: 1.05, y: -5 }}
              >
                <div className="text-4xl mb-2">{arch.icon}</div>
                <h3 className="font-bold text-black">{arch.label}</h3>
                <p className="text-sm text-gray-600">{arch.tech}</p>
              </motion.div>
            ))}
          </div>
        </GlassCard>

        {/* Tech Stack Summary */}
        <GlassCard className="p-8 mt-8 bg-black text-white" depth="heavy">
          <h2 className="text-3xl font-bold mb-6">Complete Tech Stack</h2>
          <div className="grid md:grid-cols-3 gap-6">
            <div>
              <h3 className="font-bold mb-3 text-lg">Languages</h3>
              <ul className="space-y-2 text-white/90">
                <li>• TypeScript (Frontend & Backend)</li>
                <li>• JavaScript (Extension)</li>
                <li>• Python (ML Service)</li>
                <li>• SQL (Database)</li>
              </ul>
            </div>
            <div>
              <h3 className="font-bold mb-3 text-lg">Frameworks</h3>
              <ul className="space-y-2 text-white/90">
                <li>• Next.js 14</li>
                <li>• Express.js</li>
                <li>• FastAPI</li>
                <li>• Prisma ORM</li>
              </ul>
            </div>
            <div>
              <h3 className="font-bold mb-3 text-lg">Infrastructure</h3>
              <ul className="space-y-2 text-white/90">
                <li>• PostgreSQL</li>
                <li>• Redis</li>
                <li>• Docker</li>
                <li>• Bull Queue</li>
              </ul>
            </div>
          </div>
        </GlassCard>
      </div>
    </div>
    </>
  );
}

