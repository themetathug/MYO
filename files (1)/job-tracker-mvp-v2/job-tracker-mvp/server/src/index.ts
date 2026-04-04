import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import dotenv from 'dotenv';
import { createServer } from 'http';
import { rateLimit } from 'express-rate-limit';
import net from 'net';
import { randomUUID } from 'crypto';

// Load environment variables
dotenv.config();

// Import routers
import authRouter from './routes/auth.routes';
import applicationsRouter from './routes/applications.routes';
import analyticsRouter from './routes/analytics.routes';
import mlAnalyticsRouter from './routes/ml-analytics.routes';
import userRouter from './routes/user.routes';
import coldEmailsRouter from './routes/cold-emails.routes';
import scraperRouter from './routes/scraper.routes';
import emailParserRouter from './routes/email-parser.routes';
import companyContactsRouter from './routes/company-contacts.routes';
import emailSettingsRouter from './routes/email-settings.routes';
import notificationsRouter from './routes/notifications.routes';

// Import middleware
import { errorHandler } from './middleware/error.middleware';
import { authMiddleware } from './middleware/auth.middleware';
import { logger, runWithRequestContext } from './utils/logger';
import { initializeDatabase } from './database/client';
import { runMigrations } from './database/migrate';
import { getQueueHealthMetrics } from './services/queue.service';
import { getCronHealth, stopAllCronJobs } from './jobs/email-monitor.job';

const app = express();
const server = createServer(app);
const DEFAULT_PORT = parseInt(process.env.PORT || '3001', 10);
const requestMetrics = {
  total: 0,
  errorCount: 0,
  routeLatencyMs: new Map<string, { count: number; totalMs: number; maxMs: number }>(),
};

// Helper function to check if a port is available
function isPortAvailable(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const tester = net.createServer()
      .once('error', () => resolve(false))
      .once('listening', () => {
        tester.once('close', () => resolve(true)).close();
      })
      .listen(port);
  });
}

// Helper function to find an available port
async function findAvailablePort(startPort: number, maxAttempts: number = 10): Promise<number> {
  for (let i = 0; i < maxAttempts; i++) {
    const port = startPort + i;
    const available = await isPortAvailable(port);
    if (available) {
      return port;
    }
  }
  throw new Error(`Could not find an available port starting from ${startPort}`);
}

// Rate limiting - More lenient for development
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.NODE_ENV === 'production' ? 100 : 1000, // More lenient in development
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

// Middleware
app.use((req, res, next) => {
  const requestId = (req.headers['x-request-id'] as string) || randomUUID();
  (req as any).requestId = requestId;
  res.setHeader('X-Request-Id', requestId);

  const start = Date.now();
  runWithRequestContext({ requestId }, () => {
    res.on('finish', () => {
      requestMetrics.total++;
      if (res.statusCode >= 500) requestMetrics.errorCount++;
      const duration = Date.now() - start;
      const key = `${req.method} ${req.path}`;
      const existing = requestMetrics.routeLatencyMs.get(key) || { count: 0, totalMs: 0, maxMs: 0 };
      existing.count += 1;
      existing.totalMs += duration;
      existing.maxMs = Math.max(existing.maxMs, duration);
      requestMetrics.routeLatencyMs.set(key, existing);
    });
    next();
  });
});

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
}));
// CORS configuration - Security hardened
const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',').map(o => o.trim()) || [];
const isProduction = process.env.NODE_ENV === 'production';

// Allow Chrome extensions and LinkedIn (for development)
app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps, Postman, or Chrome extensions)
    if (!origin) {
      // In production, be more strict about no-origin requests
      if (isProduction) {
        return callback(new Error('Origin required in production'));
      }
      return callback(null, true);
    }
    
    // Always allow Chrome extension origins (chrome-extension://*)
    if (origin.startsWith('chrome-extension://')) {
      return callback(null, true);
    }
    
    // In production, only allow explicitly configured origins
    if (isProduction) {
      if (allowedOrigins.length === 0) {
        logger.warn('⚠️ No ALLOWED_ORIGINS configured in production!');
        return callback(new Error('CORS not configured'));
      }
      
      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      
      logger.warn(`🚫 CORS blocked origin: ${origin}`);
      return callback(new Error('Not allowed by CORS'));
    }
    
    // Development mode: Allow common localhost origins and configured origins
    const devOrigins = [
      'http://localhost:3000',
      'http://localhost:3001',
      'http://localhost:3002',
      'http://localhost:3003',
      'http://127.0.0.1:3000',
      'http://127.0.0.1:3001',
    ];
    
    if (devOrigins.includes(origin) || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    
    // In development, log but allow (for flexibility)
    logger.debug(`⚠️ Allowing origin in dev mode: ${origin}`);
    return callback(null, true);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  maxAge: 86400, // 24 hours
}));
app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(morgan('combined', { stream: { write: (message) => logger.info(message.trim()) } }));

// Optional Sentry bootstrap
if (process.env.SENTRY_DSN) {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const Sentry = require('@sentry/node');
    Sentry.init({ dsn: process.env.SENTRY_DSN, environment: process.env.NODE_ENV || 'development' });
    logger.info('✅ Sentry initialized');
  } catch (e) {
    logger.warn('Sentry package not available; skipping initialization');
  }
}

// Apply rate limiting to API routes
app.use('/api', limiter);

// Root endpoint
app.get('/', (_req, res) => {
  res.status(200).json({
    message: 'UK Job Tracker API',
    status: 'healthy',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
  });
});

// Health check endpoint
app.get('/health', (_req, res) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development',
  });
});

app.get('/health/db', async (_req, res) => {
  try {
    await poolQueryHealthcheck();
    return res.status(200).json({ status: 'healthy', database: 'up', timestamp: new Date().toISOString() });
  } catch (error) {
    return res.status(503).json({ status: 'unhealthy', database: 'down', error: String(error) });
  }
});

app.get('/health/ready', async (_req, res) => {
  try {
    await poolQueryHealthcheck();
    const cron = getCronHealth();
    // Queue health has a 2 s timeout so Redis unavailability doesn't hang the endpoint
    const queue = await Promise.race([
      getQueueHealthMetrics(),
      new Promise<{ redisAvailable: boolean; queues: Record<string, any> }>((resolve) =>
        setTimeout(() => resolve({ redisAvailable: false, queues: {} }), 2000)
      ),
    ]);
    return res.status(200).json({
      status: 'ready',
      database: 'up',
      queue,
      cron,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return res.status(503).json({
      status: 'not_ready',
      error: String(error),
      timestamp: new Date().toISOString(),
    });
  }
});

app.get('/metrics', async (_req, res) => {
  const queue = await Promise.race([
    getQueueHealthMetrics(),
    new Promise<{ redisAvailable: boolean; queues: Record<string, any> }>((resolve) =>
      setTimeout(() => resolve({ redisAvailable: false, queues: {} }), 2000)
    ),
  ]);
  const cron = getCronHealth();
  const routeLatencies = Array.from(requestMetrics.routeLatencyMs.entries()).map(([route, value]) => ({
    route,
    count: value.count,
    avgMs: value.count > 0 ? Math.round((value.totalMs / value.count) * 100) / 100 : 0,
    maxMs: value.maxMs,
  }));

  return res.json({
    uptimeSec: Math.round(process.uptime()),
    requests: {
      total: requestMetrics.total,
      errorCount: requestMetrics.errorCount,
      errorRate: requestMetrics.total > 0 ? Math.round((requestMetrics.errorCount / requestMetrics.total) * 10000) / 100 : 0,
    },
    routeLatencies,
    queue,
    cron,
    timestamp: new Date().toISOString(),
  });
});

// ── Server-Sent Events endpoint ──────────────────────────────────────────────
// Replaces dashboard 5-second polling; keeps the connection open and pushes
// a lightweight heartbeat every 15 s plus a 'refresh' event whenever an
// application or status change occurs (via a simple in-memory pub-sub).
import { appEvents } from './utils/event-bus';

const sseClients = new Map<string, Set<any>>();

export function notifyUser(userId: string, eventType: string, data?: object) {
  const clients = sseClients.get(userId);
  if (!clients || clients.size === 0) return;
  const payload = `event: ${eventType}\ndata: ${JSON.stringify(data ?? {})}\n\n`;
  for (const res of clients) {
    try { res.write(payload); } catch { /* client disconnected */ }
  }
}

// Route handlers emit 'user:refresh' via the event bus — no circular imports.
appEvents.on('user:refresh', (userId: string) => notifyUser(userId, 'refresh', { ts: Date.now() }));

// SSE tokens: short-lived (5 min) tokens so EventSource can auth without
// custom headers (browser EventSource API does not support them).
const sseTokens = new Map<string, { userId: string; expiresAt: number }>();

app.post('/api/auth/sse-token', authMiddleware as any, (req: any, res: any) => {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });
  const token = require('crypto').randomBytes(24).toString('hex');
  sseTokens.set(token, { userId, expiresAt: Date.now() + 5 * 60 * 1000 });
  // Clean up expired tokens lazily
  for (const [t, v] of sseTokens.entries()) {
    if (v.expiresAt < Date.now()) sseTokens.delete(t);
  }
  return res.json({ token });
});

app.get('/api/events', (req: any, res: any) => {
  // Accept auth via cookie (same-origin) OR one-time query token (cross-origin proxy).
  let userId: string | undefined;

  const queryToken = req.query?.token as string | undefined;
  if (queryToken) {
    const entry = sseTokens.get(queryToken);
    if (entry && entry.expiresAt > Date.now()) {
      userId = entry.userId;
      sseTokens.delete(queryToken); // one-time use
    }
  }

  // Fallback: standard cookie/JWT middleware path
  if (!userId) {
    const cookieHeader = req.headers.cookie || '';
    const cookies = Object.fromEntries(
      cookieHeader.split(';').map((p: string) => p.trim()).filter(Boolean).map((p: string) => {
        const eq = p.indexOf('=');
        return eq === -1 ? [p, ''] : [p.slice(0, eq), decodeURIComponent(p.slice(eq + 1))];
      })
    ) as Record<string, string>;
    const accessToken = cookies.access_token;
    if (accessToken) {
      try {
        const jwt = require('jsonwebtoken');
        const decoded = jwt.verify(accessToken, process.env.JWT_SECRET || 'development-secret-key') as any;
        userId = decoded.userId;
      } catch { /* invalid token */ }
    }
  }

  if (!userId) return res.status(401).end();

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  if (!sseClients.has(userId)) sseClients.set(userId, new Set());
  sseClients.get(userId!)!.add(res);

  res.write('event: connected\ndata: {}\n\n');

  const heartbeat = setInterval(() => {
    try { res.write(': ping\n\n'); } catch { clearInterval(heartbeat); }
  }, 15_000);

  req.on('close', () => {
    clearInterval(heartbeat);
    sseClients.get(userId!)?.delete(res);
  });
});

// API Routes
app.use('/api/auth', authRouter);
app.use('/api/applications', authMiddleware, applicationsRouter);
app.use('/api/cold-emails', authMiddleware, coldEmailsRouter);
app.use('/api/analytics', authMiddleware, analyticsRouter);
app.use('/api/ml-analytics', authMiddleware, mlAnalyticsRouter);
app.use('/api/users', authMiddleware, userRouter);
app.use('/api/scraper', authMiddleware, scraperRouter);
app.use('/api/email-parser', authMiddleware, emailParserRouter);
app.use('/api/company-contacts', authMiddleware, companyContactsRouter);
app.use('/api/email-settings', authMiddleware, emailSettingsRouter);
app.use('/api/notifications', authMiddleware, notificationsRouter);

// Error handling middleware (must be last)
app.use(errorHandler);

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: `The requested resource ${req.url} was not found`,
  });
});

// Import cron jobs
import { startEmailMonitoringCron, startGhostingDetectionCron, startCompanyContactsAutoCron } from './jobs/email-monitor.job';
import { startDataRetentionCron } from './jobs/data-retention.job';
import { initializeQueue, closeQueues } from './services/queue.service';

async function poolQueryHealthcheck() {
  const { pool } = await import('./database/client');
  await pool.query('SELECT 1');
}

// Initialize services and start server
async function startServer() {
  try {
    // Initialize database
    await initializeDatabase();
    
    // Run migrations (with error handling)
    try {
      await runMigrations();
    } catch (migrationError) {
      if (process.env.NODE_ENV === 'production') {
        logger.error('❌ Migration failed in production. Aborting startup.', migrationError);
        throw migrationError;
      }
      logger.warn('⚠️ Migration failed in development (continuing):', migrationError);
    }

    // Initialize job queues (gracefully handles Redis unavailability)
    try {
      await initializeQueue();
    } catch (queueError) {
      logger.warn('⚠️ Queue initialization failed (non-critical, Redis may not be running):', queueError);
    }

    // Start cron jobs for email monitoring, ghosting detection, company contacts, and data retention
    startEmailMonitoringCron();
    startGhostingDetectionCron();
    startCompanyContactsAutoCron();
    startDataRetentionCron();

    // Check if default port is available, if not find another one
    let port = DEFAULT_PORT;
    const portAvailable = await isPortAvailable(DEFAULT_PORT);
    
    if (!portAvailable) {
      logger.warn(`⚠️  Port ${DEFAULT_PORT} is already in use. Searching for an available port...`);
      port = await findAvailablePort(DEFAULT_PORT);
      logger.info(`✅ Found available port: ${port}`);
    }

    // Start server with error handling for port conflicts
    server.listen(port, () => {
      logger.info(`🚀 Server is running on port ${port}`);
      logger.info(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
      logger.info(`🔒 CORS enabled for: ${process.env.ALLOWED_ORIGINS || 'http://localhost:3000'}`);
      logger.info(`🔑 JWT_SECRET: ${process.env.JWT_SECRET ? '✅ Set' : '⚠️ Using default (development-secret-key)'}`);
    });

    // Handle server errors (fallback in case port becomes unavailable between check and listen)
    server.on('error', async (error: NodeJS.ErrnoException) => {
      if (error.code === 'EADDRINUSE') {
        logger.error(`❌ Port ${port} is already in use. Trying to find another port...`);
        try {
          // Close the server first if it's partially initialized
          server.close();
          // Try to find another port and restart
          const newPort = await findAvailablePort(port + 1);
          logger.info(`🔄 Retrying on port ${newPort}...`);
          server.listen(newPort, () => {
            logger.info(`🚀 Server is running on port ${newPort}`);
          });
        } catch (err) {
          logger.error('Failed to find an available port:', err);
          process.exit(1);
        }
      } else {
        logger.error('Server error:', error);
        process.exit(1);
      }
    });

  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received. Starting graceful shutdown...');
  stopAllCronJobs();
  await closeQueues();
  server.close(() => {
    logger.info('Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received. Starting graceful shutdown...');
  stopAllCronJobs();
  await closeQueues();
  server.close(() => {
    logger.info('Server closed');
    process.exit(0);
  });
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Start the server
startServer();

export default app;
