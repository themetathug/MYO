/**
 * Database Migration Runner
 * Applies migrations in order to update database schema
 */

import { pool } from './client';
import { logger } from '../utils/logger';
import fs from 'fs';
import path from 'path';

interface Migration {
  version: string;
  sql: string;
}

/**
 * Get all migration files
 */
function getMigrations(): Migration[] {
  const migrationsDir = path.join(__dirname, 'migrations');
  
  // Check if migrations directory exists
  if (!fs.existsSync(migrationsDir)) {
    logger.warn('⚠️ Migrations directory not found, skipping migrations');
    return [];
  }
  
  const files = fs.readdirSync(migrationsDir)
    .filter(file => file.endsWith('.sql'))
    .sort();

  return files.map(file => {
    const version = file.replace('.sql', '');
    const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf-8');
    return { version, sql };
  });
}

/**
 * Get applied migrations
 */
async function getAppliedMigrations(): Promise<string[]> {
  try {
    // Create migrations table if it doesn't exist
    await pool.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version VARCHAR(50) PRIMARY KEY,
        applied_at TIMESTAMP DEFAULT NOW()
      )
    `);

    const result = await pool.query('SELECT version FROM schema_migrations ORDER BY version');
    return result.rows.map(row => row.version);
  } catch (error) {
    logger.error('Error getting applied migrations:', error);
    return [];
  }
}

/**
 * Apply a single migration and record it in schema_migrations
 */
async function applyMigration(migration: Migration): Promise<void> {
  try {
    logger.info(`Applying migration: ${migration.version}`);
    await pool.query(migration.sql);
    // Record as applied — ON CONFLICT handles the case where the SQL recorded itself
    await pool.query(
      `INSERT INTO schema_migrations (version) VALUES ($1) ON CONFLICT (version) DO NOTHING`,
      [migration.version]
    );
    logger.info(`✅ Migration ${migration.version} applied`);
  } catch (error) {
    logger.error(`❌ Error applying migration ${migration.version}:`, error);
    throw error;
  }
}

/**
 * Run all pending migrations
 */
export async function runMigrations(): Promise<void> {
  try {
    logger.info('🔄 Starting database migrations...');
    
    const allMigrations = getMigrations();
    const appliedMigrations = await getAppliedMigrations();
    
    const pendingMigrations = allMigrations.filter(
      m => !appliedMigrations.includes(m.version)
    );

    if (pendingMigrations.length === 0) {
      logger.info('✅ Database is up to date - no migrations to apply');
      return;
    }

    logger.info(`Found ${pendingMigrations.length} pending migration(s)`);

    for (const migration of pendingMigrations) {
      await applyMigration(migration);
    }

    logger.info(`✅ All migrations applied successfully`);
  } catch (error) {
    logger.error('❌ Migration failed:', error);
    throw error;
  }
}

// When executed directly (npm run db:migrate), run all pending migrations and exit.
if (require.main === module || process.argv[1]?.endsWith('migrate.ts') || process.argv[1]?.endsWith('migrate.js')) {
  runMigrations()
    .then(() => { pool.end(); process.exit(0); })
    .catch((e) => { console.error('Migration failed:', e.message); pool.end(); process.exit(1); });
}

/**
 * Check migration status
 */
export async function checkMigrationStatus(): Promise<{
  applied: string[];
  pending: string[];
  total: number;
}> {
  const allMigrations = getMigrations();
  const appliedMigrations = await getAppliedMigrations();
  
  const pending = allMigrations
    .filter(m => !appliedMigrations.includes(m.version))
    .map(m => m.version);

  return {
    applied: appliedMigrations,
    pending,
    total: allMigrations.length,
  };
}
