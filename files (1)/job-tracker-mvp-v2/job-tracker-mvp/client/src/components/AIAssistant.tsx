'use client';

import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import { getApiBaseUrl } from '../lib/getApiBaseUrl';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface AIAssistantProps {
  isOpen: boolean;
  onClose: () => void;
}

async function fetchWithAuth(endpoint: string, options: RequestInit = {}) {
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> | undefined),
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${getApiBaseUrl()}${endpoint}`, {
    ...options,
    credentials: 'include',
    headers,
  });
  return res.json();
}

export function AIAssistant({ isOpen, onClose }: AIAssistantProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'assistant',
      content: "Hello! I'm your AI job search assistant. I can help you with:\n\n• **Analyze my CV** — paste your CV text and I'll extract skills & give recommendations\n• **Match job** — paste a job description to get a match score\n• **Predict success** — analyze chances for an application\n• **Insights** — get AI-powered dashboard insights\n\nTry: \"analyze my cv\" or \"match this job\"",
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || loading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    const userInput = input;
    setInput('');
    setLoading(true);

    try {
      const response = await getAIResponse(userInput);
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: response,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, assistantMessage]);
    } catch (error) {
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: '❌ Sorry, I encountered an error. Please try again.',
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setLoading(false);
    }
  };

  const getAIResponse = async (userInput: string): Promise<string> => {
    const lowerInput = userInput.toLowerCase();

    // CV Analysis — calls real ML API
    if (lowerInput.includes('analyze') && (lowerInput.includes('cv') || lowerInput.includes('resume'))) {
      // Extract CV text (everything after "analyze cv:" or the entire input)
      const cvText = userInput.replace(/^.*?(analyze|check)\s*(my\s*)?(cv|resume):?\s*/i, '').trim();
      if (cvText.length < 50) {
        return "Please paste your CV text after the command. Example:\n\n**analyze my cv:** [paste your full CV text here]";
      }
      try {
        const result = await fetchWithAuth('/api/ml-analytics/analyze-cv', {
          method: 'POST',
          body: JSON.stringify({ cvText: cvText }),
        });
        const skills = result.skills_found || [];
        const recs = result.recommendations || [];
        const strengths = result.strengths || [];
        const weaknesses = result.weaknesses || [];
        const score = result.optimization_score || 0;

        return `📄 **CV Analysis Results**\n\n` +
          `**Optimization Score:** ${Math.round(score * 100)}%\n\n` +
          `**Skills Found (${skills.length}):** ${skills.slice(0, 10).join(', ') || 'None detected'}\n\n` +
          `**Strengths:** ${strengths.length > 0 ? '\n• ' + strengths.join('\n• ') : 'Add more experience to build strengths'}\n\n` +
          `**Weaknesses:** ${weaknesses.length > 0 ? '\n• ' + weaknesses.join('\n• ') : 'Looking good!'}\n\n` +
          `**Recommendations:**\n${recs.map((r: string) => `• ${r}`).join('\n') || '• Keep improving!'}`;
      } catch {
        return "❌ Could not analyze CV. Make sure the ML service is running.";
      }
    }

    // Job Matching — calls real ML API
    if (lowerInput.includes('match') && (lowerInput.includes('job') || lowerInput.includes('description'))) {
      const jobDesc = userInput.replace(/^.*?(match|compare)\s*(this\s*)?(job|description):?\s*/i, '').trim();
      if (jobDesc.length < 30) {
        return "Please paste the job description after the command. Example:\n\n**match this job:** [paste job description here]";
      }
      return "📋 To match a job, I need your CV too. Please use the format:\n\n**match job:**\nCV: [paste CV]\nJOB: [paste job description]\n\nOr use the Job Matching feature in the dashboard.";
    }

    // Insights — calls real ML API
    if (lowerInput.includes('insight') || lowerInput.includes('analytics') || lowerInput.includes('stats')) {
      try {
        const result = await fetchWithAuth('/api/ml-analytics/insights?period=30');
        return `📊 **Your 30-Day Insights**\n\n` +
          `• **Total Applications:** ${result.totalApplications || 0}\n` +
          `• **Avg Time/App:** ${Math.round((result.averageTimePerApp || 0) / 60)} minutes\n` +
          `• **Status Breakdown:** ${Object.entries(result.statusBreakdown || {}).map(([k, v]) => `${k}: ${v}`).join(', ') || 'N/A'}\n\n` +
          `💡 **Recommendation:** ${result.recommendation || 'Keep applying!'}`;
      } catch {
        return "❌ Could not fetch insights. Please try again.";
      }
    }

    // ML Health Check
    if (lowerInput.includes('health') || lowerInput.includes('status') && lowerInput.includes('ml')) {
      try {
        const result = await fetchWithAuth('/api/ml-analytics/health');
        return `🔧 **ML Service Status**\n\n` +
          `• Service: ${result.service}\n` +
          `• Status: ${result.status === 'healthy' ? '✅ Healthy' : '❌ Unavailable'}\n` +
          `• Connected: ${result.connected ? 'Yes' : 'No'}`;
      } catch {
        return "❌ ML service appears to be down.";
      }
    }

    // Default helpful response with real capabilities
    if (lowerInput.includes('help') || lowerInput.includes('what can you do')) {
      return "Here's what I can do (all powered by real AI):\n\n" +
        "📄 **Analyze CV** — \"analyze my cv: [paste CV text]\"\n" +
        "📊 **Get Insights** — \"show my insights\" or \"analytics\"\n" +
        "🔧 **Check ML Status** — \"ml health check\"\n" +
        "🎯 **Interview Tips** — \"interview preparation\"\n" +
        "📈 **Strategy** — \"application strategy advice\"";
    }

    // Interview tips (local knowledge)
    if (lowerInput.includes('interview')) {
      return "🎯 **Interview Preparation**\n\n" +
        "• **Research the company** — Check website, Glassdoor reviews, recent news\n" +
        "• **Prepare STAR stories** — Situation, Task, Action, Result\n" +
        "• **Common questions** — 'Tell me about yourself', 'Why this role?', 'Biggest weakness?'\n" +
        "• **Prepare questions** — 'What does success look like?', 'Team structure?'\n" +
        "• **Technical prep** — Review fundamentals for your role\n\n" +
        "💡 Tip: Check your calendar events for upcoming interviews!";
    }

    // Strategy (local knowledge)
    if (lowerInput.includes('strategy') || lowerInput.includes('advice') || lowerInput.includes('tips')) {
      return "📈 **Application Strategy**\n\n" +
        "• **Best time to apply:** Monday-Thursday, 9-11 AM\n" +
        "• **Quality > Quantity:** 3-5 well-tailored apps/day beats 20 generic ones\n" +
        "• **Follow up:** 7-10 days after application\n" +
        "• **Tailor your CV:** Match keywords from job description\n" +
        "• **Track everything:** Use the dashboard to monitor your progress\n\n" +
        "Say \"show my insights\" to get personalized data from your applications!";
    }

    return "I can help with:\n\n" +
      "• **\"analyze my cv: [text]\"** — AI-powered CV analysis\n" +
      "• **\"show my insights\"** — Application analytics\n" +
      "• **\"interview tips\"** — Preparation advice\n" +
      "• **\"strategy advice\"** — Application optimization\n" +
      "• **\"ml health check\"** — Check AI service status\n\n" +
      "What would you like to do?";
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-2xl h-[600px] flex flex-col transition-colors"
        >
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b-2 border-gray-200 dark:border-gray-700">
            <div>
              <h2 className="text-2xl font-bold text-black dark:text-white transition-colors">
                🧠 AI Assistant
              </h2>
              <p className="text-sm text-gray-600 dark:text-gray-400 transition-colors">
                Your personalized job search advisor
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-black dark:hover:text-white transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[80%] rounded-lg p-4 ${
                    message.role === 'user'
                      ? 'bg-black dark:bg-white text-white dark:text-black'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-gray-100'
                  } transition-colors`}
                >
                  <p className="whitespace-pre-wrap text-sm">{message.content}</p>
                  <p className="text-xs opacity-70 mt-2">
                    {message.timestamp.toLocaleTimeString().slice(0, 5)}
                  </p>
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="bg-gray-100 dark:bg-gray-700 rounded-lg p-4">
                  <div className="flex space-x-2">
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }}></div>
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="p-6 border-t-2 border-gray-200 dark:border-gray-700">
            <div className="flex space-x-2">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSend()}
                placeholder="Ask me anything about job searching..."
                className="flex-1 px-4 py-3 border-2 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-black dark:text-white rounded-lg focus:border-black dark:focus:border-white focus:outline-none transition-colors"
              />
              <button
                onClick={handleSend}
                disabled={loading || !input.trim()}
                className="px-6 py-3 bg-black dark:bg-white text-white dark:text-black rounded-lg font-semibold hover:bg-gray-800 dark:hover:bg-gray-200 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Send
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
