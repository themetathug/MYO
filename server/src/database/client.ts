/// <reference types="node" />
import { Pool, type PoolConfig } from 'pg';
import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger';

/**
 * pg treats any non-URL string as a connection string and may resolve hostname "base"
 * if DATABASE_URL was set to the placeholder `base`. Prisma also needs a real URL.
 */
function assertValidDatabaseUrlIfSet(): void {
  const raw = process.env.DATABASE_URL?.trim();
  if (!raw) return;
  if (!/^postgres(ql)?:\/\//i.test(raw)) {
    throw new Error(
      'Invalid DATABASE_URL: must start with postgresql:// or postgres:// (full connection string). ' +
        'On Render: open your PostgreSQL service → Connect → copy Internal Database URL or External Database URL. ' +
        'Do not use placeholders like "base".'
    );
  }
}

assertValidDatabaseUrlIfSet();

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient | undefined };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

function buildPoolConfig(): PoolConfig {
  const databaseUrl = process.env.DATABASE_URL?.trim();
  const base = {
    connectionTimeoutMillis: 10000,
    idleTimeoutMillis: 30000,
  };

  if (databaseUrl) {
    const requireSsl =
      process.env.DATABASE_SSL !== 'false' &&
      (databaseUrl.includes('sslmode=require') ||
        databaseUrl.includes('render.com') ||
        process.env.NODE_ENV === 'production');
    return {
      ...base,
      connectionString: databaseUrl,
      ssl: requireSsl ? { rejectUnauthorized: false } : false,
    };
  }

  const host = process.env.DB_HOST || process.env.POSTGRES_HOST || 'localhost';

  return {
    ...base,
    host,
    port: parseInt(process.env.DB_PORT || process.env.POSTGRES_PORT || '5432', 10),
    database: process.env.DB_NAME || process.env.POSTGRES_DB || 'jobtracker',
    user: process.env.DB_USER || process.env.POSTGRES_USER || 'postgres',
    password: process.env.DB_PASSWORD || process.env.POSTGRES_PASSWORD || 'postgres',
    ssl: false,
  };
}

const pool = new Pool(buildPoolConfig());

// Initialize database connection
export async function initializeDatabase() {
  try {
    await pool.query('SELECT NOW()');
    logger.info('✅ Database connected successfully');

    // Ensure cold_emails table has expected columns (for older installations)
    await pool.query(`
      ALTER TABLE IF EXISTS cold_emails
        ADD COLUMN IF NOT EXISTS position VARCHAR(255);
    `);

    await pool.query(`
      ALTER TABLE IF EXISTS cold_emails
        ADD COLUMN IF NOT EXISTS location VARCHAR(255);
    `);

    await pool.query(`
      ALTER TABLE IF EXISTS cold_emails
        ADD COLUMN IF NOT EXISTS job_url TEXT;
    `);

    await pool.query(`
      ALTER TABLE IF EXISTS cold_emails
        ADD COLUMN IF NOT EXISTS sender_email VARCHAR(255);
    `);

    await pool.query(`
      ALTER TABLE IF EXISTS cold_emails
        ADD COLUMN IF NOT EXISTS source VARCHAR(50) DEFAULT 'MANUAL';
    `);

    await pool.query(`
      ALTER TABLE IF EXISTS cold_emails
        ADD COLUMN IF NOT EXISTS message TEXT;
    `);

    await pool.query(`
      ALTER TABLE IF EXISTS cold_emails
        ADD COLUMN IF NOT EXISTS company VARCHAR(255);
    `);

    logger.info('✅ Ensured cold_emails table has required columns');
  } catch (error) {
    logger.error('Database connection failed:', error);
    throw error;
  }
}

// Graceful shutdown
export async function disconnectDatabase() {
  try {
    await pool.end();
    logger.info('Database disconnected');
  } catch (error) {
    logger.error('Database disconnect error:', error);
  }
}

// Export pool for queries
export { pool };