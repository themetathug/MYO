import { Pool } from 'pg';
import { logger } from '../utils/logger';

const pool = new Pool({
  host: process.env.DB_HOST || process.env.POSTGRES_HOST || 'localhost', // Use 'localhost' for local, 'postgres' for Docker
  port: parseInt(process.env.DB_PORT || process.env.POSTGRES_PORT || '5432'),
  database: process.env.DB_NAME || process.env.POSTGRES_DB || 'jobtracker',
  user: process.env.DB_USER || process.env.POSTGRES_USER || 'postgres',
  password: process.env.DB_PASSWORD || process.env.POSTGRES_PASSWORD || 'postgres', // Default password for local setup
  connectionTimeoutMillis: 10000,
  idleTimeoutMillis: 30000,
  ssl: false
});

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