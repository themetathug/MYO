import cron from 'node-cron';
import { pool } from '../database/client';
import { logger } from '../utils/logger';

/**
 * Nightly data-retention cleanup.
 *
 * Policy (matches privacy policy):
 *  - email_status_updates rows older than 90 days → deleted
 *  - status_detection_logs older than 90 days → deleted
 *  - scraper_jobs older than 30 days → deleted
 *  - extension_tokens that are expired or revoked for > 7 days → deleted
 *  - refresh_tokens that are revoked or expired for > 7 days → deleted
 *  - auth_sessions older than 90 days with no recent activity → deleted
 *  - soft-deleted users (deleted_at IS NOT NULL > 30 days ago) → hard purge
 */
async function runDataRetention(): Promise<void> {
  logger.info('🗑️  Data retention job starting…');

  const results: Record<string, number> = {};

  try {
    const emailUpdates = await pool.query(
      `DELETE FROM email_status_updates WHERE created_at < NOW() - INTERVAL '90 days'`
    );
    results.email_status_updates = emailUpdates.rowCount ?? 0;

    const detectionLogs = await pool.query(
      `DELETE FROM status_detection_logs WHERE created_at < NOW() - INTERVAL '90 days'`
    );
    results.status_detection_logs = detectionLogs.rowCount ?? 0;

    const scraperJobs = await pool.query(
      `DELETE FROM scraper_jobs WHERE created_at < NOW() - INTERVAL '30 days'`
    );
    results.scraper_jobs = scraperJobs.rowCount ?? 0;

    const extTokens = await pool.query(
      `DELETE FROM extension_tokens
       WHERE (expires_at < NOW() OR revoked_at IS NOT NULL)
         AND COALESCE(revoked_at, expires_at) < NOW() - INTERVAL '7 days'`
    );
    results.extension_tokens = extTokens.rowCount ?? 0;

    const refreshTokens = await pool.query(
      `DELETE FROM refresh_tokens
       WHERE (expires_at < NOW() OR revoked_at IS NOT NULL)
         AND COALESCE(revoked_at, expires_at) < NOW() - INTERVAL '7 days'`
    );
    results.refresh_tokens = refreshTokens.rowCount ?? 0;

    const authSessions = await pool.query(
      `DELETE FROM auth_sessions
       WHERE last_used_at < NOW() - INTERVAL '90 days'`
    );
    results.auth_sessions = authSessions.rowCount ?? 0;

    // Hard-purge soft-deleted users and all their data (via CASCADE) after 30 days.
    // This fulfils the privacy policy "deleted accounts purged within 30 days" promise.
    // Requires a deleted_at column on users — added gracefully with IF EXISTS guard.
    const deletedUsersCheck = await pool.query(
      `SELECT EXISTS (
         SELECT 1 FROM information_schema.columns
         WHERE table_name = 'users' AND column_name = 'deleted_at'
       ) AS has_col`
    );
    if (deletedUsersCheck.rows[0]?.has_col) {
      const purgedUsers = await pool.query(
        `DELETE FROM users
         WHERE deleted_at IS NOT NULL
           AND deleted_at < NOW() - INTERVAL '30 days'`
      );
      results.purged_deleted_users = purgedUsers.rowCount ?? 0;
    }

    const totalDeleted = Object.values(results).reduce((a, b) => a + b, 0);
    logger.info(`✅ Data retention complete — ${totalDeleted} rows deleted`, results);
  } catch (error) {
    logger.error('❌ Data retention job failed:', error);
  }
}

export function startDataRetentionCron(): void {
  // Run every night at 03:00 UTC
  cron.schedule('0 3 * * *', runDataRetention, { timezone: 'UTC' });
  logger.info('📅 Data retention cron scheduled (daily 03:00 UTC)');
}
