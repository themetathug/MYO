import { Pool } from 'pg';
import { logger } from '../utils/logger';
import fs from 'fs';
import path from 'path';

const DATABASE_URL = process.env.DATABASE_URL;

const poolConfig = DATABASE_URL
  ? {
      connectionString: DATABASE_URL,
      ssl: DATABASE_URL.includes('sslmode=require') ? { rejectUnauthorized: false } : false,
    }
  : {
      host:     process.env.DB_HOST     || process.env.POSTGRES_HOST     || 'localhost',
      port:     parseInt(process.env.DB_PORT || process.env.POSTGRES_PORT || '5432'),
      database: process.env.DB_NAME     || process.env.POSTGRES_DB       || 'jobtracker',
      user:     process.env.DB_USER     || process.env.POSTGRES_USER     || 'postgres',
      password: process.env.DB_PASSWORD || process.env.POSTGRES_PASSWORD || 'postgres',
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
    };

export const pool = new Pool({
  ...poolConfig,
  connectionTimeoutMillis: 10000,
  idleTimeoutMillis:       30000,
  max: 10,
  min:  1,
  allowExitOnIdle: true,
});

pool.on('error', (err) => {
  logger.error('Unexpected pool error:', err.message);
});

export async function initializeDatabase(): Promise<void> {
  try {
    await pool.query('SELECT NOW()');
    logger.info('✅ Database connected');

    const { rows } = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'users'
      )
    `);

    if (!rows[0].exists) {
      logger.info('🔄 Fresh database — applying init.sql...');
      const initSqlPath = path.join(__dirname, 'init.sql');

      if (!fs.existsSync(initSqlPath)) {
        throw new Error('init.sql not found — cannot initialise schema');
      }

      const sql = fs.readFileSync(initSqlPath, 'utf-8');
      // Execute as one block so Postgres handles DO $$ blocks and multi-statement DDL correctly
      await pool.query(sql);
      logger.info('✅ Schema initialised from init.sql');
    } else {
      logger.info('✅ Schema already exists');
    }
  } catch (error) {
    logger.error('❌ Database initialisation failed:', error);
    throw error;
  }
}

export async function disconnectDatabase(): Promise<void> {
  try {
    await pool.end();
    logger.info('Database disconnected');
  } catch (error) {
    logger.error('Database disconnect error:', error);
  }
}
