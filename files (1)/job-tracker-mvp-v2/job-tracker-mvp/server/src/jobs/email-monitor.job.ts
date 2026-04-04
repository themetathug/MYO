import { logger } from '../utils/logger';
import { EmailMonitorService } from '../services/email-monitor.service';
import { GhostingDetectionService } from '../services/ghosting-detection.service';
import { CompanyContactsAutoService } from '../services/company-contacts-auto.service';

// Simple interval-based cron (no external dependency needed)
// Can be replaced with node-cron later if needed

let emailMonitorInterval: NodeJS.Timeout | null = null;
let ghostingCheckInterval: NodeJS.Timeout | null = null;
let lastEmailMonitorRunAt: Date | null = null;
let lastGhostingRunAt: Date | null = null;
let lastCompanyAutoRunAt: Date | null = null;

const emailMonitorService = new EmailMonitorService();
const ghostingDetectionService = new GhostingDetectionService();

/**
 * Start email monitoring cron job (runs every 30 minutes)
 */
export function startEmailMonitoringCron() {
  // Clear any existing interval
  if (emailMonitorInterval) {
    clearInterval(emailMonitorInterval);
  }

  // Run immediately on start (optional - can remove if you want to wait 30 min)
  // runEmailMonitoring();

  // Then run every 30 minutes
  emailMonitorInterval = setInterval(() => {
    runEmailMonitoring();
  }, 30 * 60 * 1000); // 30 minutes in milliseconds

  logger.info('✅ Email monitoring cron job started (runs every 30 minutes)');
}

/**
 * Start ghosting detection cron job (runs daily at 9 AM)
 */
export function startGhostingDetectionCron() {
  // Clear any existing interval
  if (ghostingCheckInterval) {
    clearInterval(ghostingCheckInterval);
  }

  // Calculate milliseconds until next 9 AM
  const now = new Date();
  const next9AM = new Date();
  next9AM.setHours(9, 0, 0, 0);
  
  // If it's already past 9 AM today, schedule for tomorrow
  if (now.getTime() > next9AM.getTime()) {
    next9AM.setDate(next9AM.getDate() + 1);
  }

  const msUntil9AM = next9AM.getTime() - now.getTime();

  // Run at next 9 AM
  setTimeout(() => {
    runGhostingDetection();
    
    // Then run every 24 hours
    ghostingCheckInterval = setInterval(() => {
      runGhostingDetection();
    }, 24 * 60 * 60 * 1000); // 24 hours
  }, msUntil9AM);

  logger.info(`✅ Ghosting detection cron job started (runs daily at 9 AM, next run in ${Math.round(msUntil9AM / 1000 / 60)} minutes)`);
}

/**
 * Run email monitoring for all users
 */
async function runEmailMonitoring() {
  try {
    lastEmailMonitorRunAt = new Date();
    logger.info('🔄 Starting scheduled email monitoring...');
    const result = await emailMonitorService.monitorAllUsers(1); // Check last 1 hour of emails
    
    logger.info(
      `✅ Email monitoring complete: ${result.totalStatusUpdates} status updates from ${result.totalEmailsProcessed} emails across ${result.usersProcessed} users`
    );
  } catch (error) {
    logger.error('❌ Error in scheduled email monitoring:', error);
  }
}

/**
 * Run ghosting detection for all users
 */
async function runGhostingDetection() {
  try {
    lastGhostingRunAt = new Date();
    logger.info('🔄 Starting scheduled ghosting detection...');
    const result = await ghostingDetectionService.checkAllUsersForGhostedApplications();
    
    logger.info(
      `✅ Ghosting detection complete: ${result.totalGhosted} applications marked as ghosted across ${result.usersProcessed} users`
    );
  } catch (error) {
    logger.error('❌ Error in scheduled ghosting detection:', error);
  }
}

/**
 * Start company contacts auto-extraction cron job (runs daily at 10 AM)
 */
export function startCompanyContactsAutoCron() {
  // Calculate milliseconds until next 10 AM
  const now = new Date();
  const next10AM = new Date();
  next10AM.setHours(10, 0, 0, 0);
  
  // If it's already past 10 AM today, schedule for tomorrow
  if (now.getTime() > next10AM.getTime()) {
    next10AM.setDate(next10AM.getDate() + 1);
  }

  const msUntil10AM = next10AM.getTime() - now.getTime();

  // Run at next 10 AM
  setTimeout(() => {
    runCompanyContactsAuto();
    
    // Then run every 24 hours
    setInterval(() => {
      runCompanyContactsAuto();
    }, 24 * 60 * 60 * 1000); // 24 hours
  }, msUntil10AM);

  logger.info(`✅ Company contacts auto-extraction cron job started (runs daily at 10 AM, next run in ${Math.round(msUntil10AM / 1000 / 60)} minutes)`);
}

/**
 * Run company contacts auto-extraction
 */
async function runCompanyContactsAuto() {
  try {
    lastCompanyAutoRunAt = new Date();
    logger.info('📧 Starting scheduled company contacts auto-extraction...');
    const contactsService = new CompanyContactsAutoService();
    const { pool } = require('../database/client');
    
    // Get all users with email sync enabled
    const users = await pool.query(
      `SELECT DISTINCT user_id FROM user_email_settings WHERE email_sync_enabled = true`
    );
    
    let totalExtracted = 0;
    let totalVerified = 0;
    
    for (const user of users.rows) {
      const extracted = await contactsService.extractFromEmails(user.user_id);
      const verified = await contactsService.autoVerifyDomains(user.user_id);
      totalExtracted += extracted;
      totalVerified += verified;
    }
    
    logger.info(`✅ Company contacts auto-extraction complete: ${totalExtracted} extracted, ${totalVerified} verified`);
  } catch (error) {
    logger.error('❌ Error in company contacts auto-extraction:', error);
  }
}

/**
 * Stop all cron jobs
 */
export function stopAllCronJobs() {
  if (emailMonitorInterval) {
    clearInterval(emailMonitorInterval);
    emailMonitorInterval = null;
    logger.info('⏹️ Email monitoring cron job stopped');
  }

  if (ghostingCheckInterval) {
    clearInterval(ghostingCheckInterval);
    ghostingCheckInterval = null;
    logger.info('⏹️ Ghosting detection cron job stopped');
  }
}

/**
 * Manually trigger email monitoring (for testing or API calls)
 */
export async function triggerEmailMonitoring(userId?: string) {
  try {
    if (userId) {
      // Monitor specific user
      return await emailMonitorService.monitorUserEmails(userId, 1);
    } else {
      // Monitor all users
      return await emailMonitorService.monitorAllUsers(1);
    }
  } catch (error) {
    logger.error('Error triggering email monitoring:', error);
    throw error;
  }
}

/**
 * Manually trigger ghosting detection (for testing or API calls)
 */
export async function triggerGhostingDetection(userId?: string) {
  try {
    if (userId) {
      // Check specific user
      return await ghostingDetectionService.checkForGhostedApplications(userId);
    } else {
      // Check all users
      return await ghostingDetectionService.checkAllUsersForGhostedApplications();
    }
  } catch (error) {
    logger.error('Error triggering ghosting detection:', error);
    throw error;
  }
}

export function getCronHealth() {
  return {
    emailMonitorRunning: !!emailMonitorInterval,
    ghostingMonitorRunning: !!ghostingCheckInterval,
    lastEmailMonitorRunAt,
    lastGhostingRunAt,
    lastCompanyAutoRunAt,
  };
}
