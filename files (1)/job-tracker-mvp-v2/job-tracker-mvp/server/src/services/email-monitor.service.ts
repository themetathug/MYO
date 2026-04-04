import { pool } from '../database/client';
import { logger } from '../utils/logger';
import { EmailConfig } from './email-parser.service';
import { StatusDetectionService, StatusDetectionResult } from './status-detection.service';
import { AIStatusAgent } from './ai-status-agent.service';
import { EmailContextExtractor } from './email-context-extractor.service';
import { CalendarIntegrationService } from './calendar-integration.service';
import { CompanyContactsAutoService } from './company-contacts-auto.service';
import crypto from 'crypto';

// Simple encryption/decryption for email passwords
const FALLBACK_ENCRYPTION_KEY = 'default-key-change-in-production-32chars!!';
const ENCRYPTION_KEY = process.env.EMAIL_ENCRYPTION_KEY || FALLBACK_ENCRYPTION_KEY;
const ALGORITHM = 'aes-256-cbc';

if (process.env.NODE_ENV === 'production' && ENCRYPTION_KEY === FALLBACK_ENCRYPTION_KEY) {
  const { logger: _l } = require('../utils/logger');
  _l.error('❌ FATAL: EMAIL_ENCRYPTION_KEY is not set or uses the insecure default in production. Aborting.');
  process.exit(1);
}

function decrypt(encryptedText: string): string {
  const parts = encryptedText.split(':');
  const iv = Buffer.from(parts[0], 'hex');
  const encrypted = parts[1];
  const decipher = crypto.createDecipheriv(ALGORITHM, Buffer.from(ENCRYPTION_KEY.slice(0, 32)), iv);
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

export interface EmailMonitorResult {
  emailsProcessed: number;
  statusUpdates: number;
  applicationsUpdated: string[];
}

export class EmailMonitorService {
  private readonly LOW_CONFIDENCE_THRESHOLD = 0.7;
  private readonly AUTO_APPLY_THRESHOLD = 0.85;
  private statusDetector: StatusDetectionService;
  private aiStatusAgent: AIStatusAgent;
  private contextExtractor: EmailContextExtractor;
  private calendarService: CalendarIntegrationService;
  private companyContactsService: CompanyContactsAutoService;

  constructor() {
    this.statusDetector = new StatusDetectionService();
    this.aiStatusAgent = new AIStatusAgent();
    this.contextExtractor = new EmailContextExtractor();
    this.calendarService = new CalendarIntegrationService();
    this.companyContactsService = new CompanyContactsAutoService();
  }

  /**
   * Get user's email configuration from database
   */
  async getUserEmailConfig(userId: string): Promise<EmailConfig | null> {
    try {
      const result = await pool.query(
        `SELECT 
          email_provider,
          email_address,
          email_password_encrypted,
          imap_host,
          imap_port,
          imap_tls
        FROM user_email_settings
        WHERE user_id = $1 AND email_sync_enabled = true`,
        [userId]
      );

      if (result.rows.length === 0) {
        logger.info(`No email sync configured for user ${userId}`);
        return null;
      }

      const settings = result.rows[0];

      if (!settings.email_password_encrypted) {
        logger.warn(`Email password not set for user ${userId}`);
        return null;
      }

      // Decrypt password
      const password = decrypt(settings.email_password_encrypted);

      // Determine IMAP settings based on provider
      let host = settings.imap_host;
      let port = settings.imap_port;
      let tls = settings.imap_tls !== false;

      if (!host) {
        // Auto-detect based on provider
        if (settings.email_provider === 'gmail') {
          host = 'imap.gmail.com';
          port = 993;
          tls = true;
        } else if (settings.email_provider === 'outlook') {
          host = 'outlook.office365.com';
          port = 993;
          tls = true;
        } else {
          logger.error(`Unknown email provider: ${settings.email_provider}`);
          return null;
        }
      }

      return {
        user: settings.email_address,
        password,
        host,
        port: port || 993,
        tls,
      };
    } catch (error) {
      logger.error('Error getting user email config:', error);
      return null;
    }
  }

  /**
   * Fetch incoming emails from user's inbox (not sent folder)
   */
  async fetchIncomingEmails(
    config: EmailConfig,
    _userId: string,
    hours: number = 1
  ): Promise<Array<{ subject: string; from: string; body: string; date: Date }>> {
    return new Promise((resolve, reject) => {
      const Imap = require('imap');
      const { simpleParser } = require('mailparser');
      
      // Import at top level would be better, but this works for now

      const imap = new Imap({
        user: config.user,
        password: config.password,
        host: config.host,
        port: config.port,
        tls: config.tls,
        tlsOptions: {
          rejectUnauthorized: true,
          servername: config.host,
        },
      });

      const emails: Array<{ subject: string; from: string; body: string; date: Date }> = [];

      imap.once('ready', () => {
        logger.info(`✅ Connected to IMAP for monitoring: ${config.host}`);

        // Open INBOX (incoming emails)
        imap.openBox('INBOX', false, (err: any) => {
          if (err) {
            logger.error('Error opening INBOX:', err);
            imap.end();
            return reject(err);
          }

          // Search for emails from last N hours — include both UNSEEN and recently-seen
          // emails so previously-read job emails are not missed.
          const since = new Date();
          since.setHours(since.getHours() - hours);

          // Run both searches in parallel and deduplicate by UID
          const searchBoth = (callback: (err: any, uids: number[]) => void) => {
            let unseenUids: number[] = [];
            let seenUids: number[] = [];
            let done = 0;
            const finish = () => {
              done++;
              if (done === 2) {
                const combined = Array.from(new Set([...unseenUids, ...seenUids]));
                callback(null, combined);
              }
            };
            imap.search(['UNSEEN', ['SINCE', since]], (e: any, r: any) => {
              if (!e) unseenUids = r || [];
              finish();
            });
            imap.search([['SINCE', since]], (e: any, r: any) => {
              if (!e) seenUids = (r || []).slice(0, 200); // cap seen to 200 to avoid huge re-scans
              finish();
            });
          };

          searchBoth((err: any, results: any) => {
            if (err) {
              logger.error('Error searching emails:', err);
              imap.end();
              return reject(err);
            }

            if (!results || results.length === 0) {
              logger.info(`No emails found in the last ${hours} hours`);
              imap.end();
              return resolve(emails);
            }

            logger.info(`Found ${results.length} emails to process (UNSEEN + recent SEEN)`);

            const fetch = imap.fetch(results, { bodies: '' });

            fetch.on('message', (msg: any) => {
              const emailData: any = {};

              msg.on('body', (stream: any) => {
                simpleParser(stream, (err: any, parsed: any) => {
                  if (!err && parsed) {
                    emailData.parsed = parsed;
                  }
                });
              });

              msg.once('end', () => {
                if (emailData.parsed) {
                  emails.push({
                    subject: emailData.parsed.subject || '',
                    from: emailData.parsed.from?.text || emailData.parsed.from?.value?.[0]?.address || '',
                    body: emailData.parsed.text || emailData.parsed.html || '',
                    date: emailData.parsed.date || new Date(),
                  });
                }
              });
            });

            fetch.once('error', (err: any) => {
              logger.error('Fetch error:', err);
              imap.end();
              reject(err);
            });

            fetch.once('end', () => {
              imap.end();
              resolve(emails);
            });
          });
        });
      });

      imap.once('error', (err: any) => {
        logger.error('IMAP error:', err);
        reject(err);
      });

      imap.connect();
    });
  }

  /**
   * Get user's applications for matching
   */
  async getUserApplications(userId: string): Promise<any[]> {
    try {
      const result = await pool.query(
        `SELECT 
          id,
          company,
          position,
          company_domain,
          status,
          applied_at,
          auto_status_enabled
        FROM applications
        WHERE user_id = $1
          AND (auto_status_enabled IS NULL OR auto_status_enabled = true)
        ORDER BY applied_at DESC`,
        [userId]
      );

      return result.rows;
    } catch (error) {
      logger.error('Error getting user applications:', error);
      return [];
    }
  }

  /**
   * Match email to application by company domain
   */
  matchEmailToApplication(
    emailFrom: string,
    applications: any[],
    statusDetector: StatusDetectionService
  ): any | null {
    const emailDomain = statusDetector.extractCompanyDomain(emailFrom);
    if (!emailDomain) return null;

    // Try exact domain match first
    let bestMatch = applications.find(
      (app) => app.company_domain && statusDetector.normalizeDomain(app.company_domain) === statusDetector.normalizeDomain(emailDomain)
    );

    if (bestMatch) return bestMatch;

    // Try matching by company name
    for (const app of applications) {
      const matchScore = statusDetector.matchDomainToCompany(
        emailDomain,
        app.company,
        app.company_domain
      );

      if (matchScore > 0.7) {
        // Update company_domain if not set
        if (!app.company_domain) {
          pool.query(
            `UPDATE applications SET company_domain = $1 WHERE id = $2`,
            [emailDomain, app.id]
          ).catch((err) => logger.error('Error updating company_domain:', err));
        }
        return app;
      }
    }

    return null;
  }

  /**
   * Update application status based on email
   */
  async updateApplicationStatus(
    applicationId: string,
    userId: string,
    detectedStatus: StatusDetectionResult & { structuredData?: any },
    email: { subject: string; from: string; body: string; date: Date }
  ): Promise<boolean> {
    try {
      const emailDomain = this.statusDetector.extractCompanyDomain(email.from);

      // Map detected status to application status enum
      const statusMap: Record<string, string> = {
        REJECTED: 'REJECTED',
        INTERVIEW_SCHEDULED: 'INTERVIEW_SCHEDULED',
        OFFERED: 'OFFERED',
        ACCEPTED: 'ACCEPTED',
        PENDING_RESPONSE: 'UNDER_REVIEW',
        UNDER_REVIEW: 'UNDER_REVIEW',
      };

      const newStatus = statusMap[detectedStatus.status] || 'UNDER_REVIEW';

      // Ignore low confidence detections
      if (detectedStatus.confidence < this.LOW_CONFIDENCE_THRESHOLD) {
        logger.info(
          `Skipping status update for ${applicationId}: confidence too low (${detectedStatus.confidence})`
        );
        return false;
      }

      // Check current status - don't downgrade (e.g., OFFERED -> REJECTED)
      const currentApp = await pool.query(
        `SELECT status FROM applications WHERE id = $1`,
        [applicationId]
      );

      if (currentApp.rows.length === 0) {
        logger.warn(`Application ${applicationId} not found`);
        return false;
      }

      const currentStatus = currentApp.rows[0].status;
      const statusHierarchy = ['APPLIED', 'UNDER_REVIEW', 'INTERVIEW_SCHEDULED', 'OFFERED', 'ACCEPTED'];

      // Don't update if new status is lower in hierarchy than current
      if (
        statusHierarchy.indexOf(newStatus) < statusHierarchy.indexOf(currentStatus) &&
        newStatus !== 'REJECTED'
      ) {
        logger.info(
          `Skipping status update: ${newStatus} is lower than current ${currentStatus}`
        );
        return false;
      }

      // Extract structured data if available (from AI agent)
      const structuredData = (detectedStatus as any).structuredData;
      const metadata: any = {};
      
      if (structuredData) {
        if (structuredData.interviewDate) metadata.interviewDate = structuredData.interviewDate;
        if (structuredData.interviewTime) metadata.interviewTime = structuredData.interviewTime;
        if (structuredData.location) metadata.location = structuredData.location;
        if (structuredData.contactInfo) metadata.contactInfo = structuredData.contactInfo;
        if (structuredData.actionItems) metadata.actionItems = structuredData.actionItems;
      }

      // Store status update record first (used by both auto-update and review queue)
      const statusUpdateResult = await pool.query(
        `INSERT INTO email_status_updates 
         (application_id, user_id, email_subject, email_from, email_domain, 
          detected_status, confidence_score, email_date, email_body_snippet, metadata, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())
         RETURNING id`,
        [
          applicationId,
          userId,
          email.subject,
          email.from,
          emailDomain,
          detectedStatus.status,
          detectedStatus.confidence,
          email.date,
          email.body.substring(0, 500), // Store snippet only
          Object.keys(metadata).length > 0
            ? JSON.stringify(metadata)
            : JSON.stringify({}),
        ]
      );

      // Medium confidence -> queue for human review, no automatic status mutation.
      if (
        detectedStatus.confidence >= this.LOW_CONFIDENCE_THRESHOLD &&
        detectedStatus.confidence < this.AUTO_APPLY_THRESHOLD
      ) {
        const statusUpdateId = statusUpdateResult.rows?.[0]?.id;
        if (statusUpdateId) {
          await pool.query(
            `INSERT INTO email_status_review_queue
             (email_status_update_id, user_id, application_id, detected_status, detected_confidence, queue_state, queued_at, expires_at, created_at, updated_at)
             VALUES ($1, $2, $3, $4, $5, 'PENDING_REVIEW', NOW(), NOW() + INTERVAL '14 days', NOW(), NOW())
             ON CONFLICT (email_status_update_id) DO NOTHING`,
            [statusUpdateId, userId, applicationId, detectedStatus.status, detectedStatus.confidence]
          );

          await pool.query(
            `INSERT INTO notifications (user_id, type, title, message, application_id, metadata, read, created_at)
             VALUES ($1, 'AI_REVIEW_REQUIRED', 'AI review required',
                     'A medium-confidence status update needs your review.',
                     $2, $3, false, NOW())`,
            [userId, applicationId, JSON.stringify({ statusUpdateId, detectedStatus: detectedStatus.status, confidence: detectedStatus.confidence })]
          );
        }

        logger.info(
          `Queued status review for application ${applicationId} (confidence: ${detectedStatus.confidence})`
        );
        return false;
      }

      // High confidence -> apply status immediately.
      await pool.query(
        `UPDATE applications
         SET status = $1,
             last_email_date = $2,
             updated_at = NOW()
         WHERE id = $3`,
        [newStatus, email.date, applicationId]
      );

      logger.info(
        `✅ Updated application ${applicationId} status to ${newStatus} (confidence: ${detectedStatus.confidence})`
      );

      return true;
    } catch (error) {
      logger.error('Error updating application status:', error);
      return false;
    }
  }

  /**
   * Monitor emails for a specific user and update application statuses
   */
  async monitorUserEmails(userId: string, hours: number = 1): Promise<EmailMonitorResult> {
    try {
      logger.info(`Starting email monitoring for user ${userId}`);

      // Get user's email config
      const emailConfig = await this.getUserEmailConfig(userId);
      if (!emailConfig) {
        logger.info(`No email sync configured for user ${userId}`);
        return {
          emailsProcessed: 0,
          statusUpdates: 0,
          applicationsUpdated: [],
        };
      }

      // Fetch incoming emails
      const emails = await this.fetchIncomingEmails(emailConfig, userId, hours);
      logger.info(`Fetched ${emails.length} emails for user ${userId}`);

      if (emails.length === 0) {
        return {
          emailsProcessed: 0,
          statusUpdates: 0,
          applicationsUpdated: [],
        };
      }

      // Get user's applications
      const applications = await this.getUserApplications(userId);
      logger.info(`Found ${applications.length} applications for matching`);

      let statusUpdates = 0;
      const applicationsUpdated: string[] = [];

      // Process each email
      for (const email of emails) {
        try {
          // Step 1: Match email to application first
          const matchingApp = this.matchEmailToApplication(
            email.from,
            applications,
            this.statusDetector
          );

          if (!matchingApp) {
            logger.debug(
              `No matching application found for email from: ${email.from}`
            );
            continue;
          }

          // Step 2: Detect status from email using AI agent (hybrid approach)
          const detected = await this.aiStatusAgent.detectStatus(
            email.subject,
            email.body,
            userId,
            matchingApp.id
          );

          if (detected.confidence < 0.7) {
            logger.debug(
              `Low confidence status detection (${detected.confidence}), skipping email: ${email.subject}`
            );
            continue;
          }

      // Get current status before update
      const currentApp = await pool.query(
        'SELECT status FROM applications WHERE id = $1',
        [matchingApp.id]
      );
      const oldStatus = currentApp.rows[0]?.status || 'APPLIED';

      // Update application status
      const updated = await this.updateApplicationStatus(
        matchingApp.id,
        userId,
        detected,
        email
      );

      if (updated) {
        statusUpdates++;
        applicationsUpdated.push(matchingApp.id);
        
        // Extract structured context from email
        try {
          const context = await this.contextExtractor.extractContext(email.subject, email.body);
          
          // Create calendar event if interview scheduled
          if (detected.status === 'INTERVIEW_SCHEDULED' && context.interviewDate) {
            await this.calendarService.createEventFromEmail(
              matchingApp.id,
              matchingApp.company,
              matchingApp.position,
              context
            );
          }
        } catch (contextError) {
          logger.error('Error extracting email context:', contextError);
          // Don't fail the update if context extraction fails
        }

        // Auto-extract and track company contact
        try {
          const emailDomain = this.statusDetector.extractCompanyDomain(email.from);
          if (emailDomain) {
            await this.companyContactsService.trackEmailHistory(userId, emailDomain, {
              subject: email.subject,
              from: email.from,
              date: email.date,
              status: detected.status,
            });
          }
        } catch (contactError) {
          logger.error('Error tracking company contact:', contactError);
          // Don't fail the update if contact tracking fails
        }
        
        // Send notification
        try {
          const { NotificationService } = require('./notification.service');
          const notificationService = new NotificationService();
          await notificationService.notifyStatusUpdate(
            userId,
            matchingApp.id,
            oldStatus,
            detected.status,
            matchingApp.company,
            matchingApp.position
          );
        } catch (notifError) {
          logger.error('Error sending status update notification:', notifError);
          // Don't fail the update if notification fails
        }
      }
        } catch (error) {
          logger.error('Error processing email:', error);
          // Continue with next email
        }
      }

      // Update last sync time
      await pool.query(
        `UPDATE user_email_settings 
         SET last_sync_at = NOW() 
         WHERE user_id = $1`,
        [userId]
      );

      logger.info(
        `Email monitoring complete for user ${userId}: ${statusUpdates} status updates from ${emails.length} emails`
      );

      return {
        emailsProcessed: emails.length,
        statusUpdates,
        applicationsUpdated,
      };
    } catch (error) {
      logger.error(`Error monitoring emails for user ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Monitor emails for all users with email sync enabled (for cron job)
   */
  async monitorAllUsers(hours: number = 1): Promise<{
    usersProcessed: number;
    totalEmailsProcessed: number;
    totalStatusUpdates: number;
  }> {
    try {
      const usersResult = await pool.query(
        `SELECT id FROM users 
         WHERE id IN (
           SELECT user_id FROM user_email_settings 
           WHERE email_sync_enabled = true
         )`
      );

      let totalEmailsProcessed = 0;
      let totalStatusUpdates = 0;
      let usersProcessed = 0;

      for (const user of usersResult.rows) {
        try {
          const result = await this.monitorUserEmails(user.id, hours);
          totalEmailsProcessed += result.emailsProcessed;
          totalStatusUpdates += result.statusUpdates;
          usersProcessed++;
        } catch (error) {
          logger.error(`Error processing user ${user.id}:`, error);
          // Continue with other users
        }
      }

      logger.info(
        `Batch email monitoring complete: ${totalStatusUpdates} status updates from ${totalEmailsProcessed} emails across ${usersProcessed} users`
      );

      return {
        usersProcessed,
        totalEmailsProcessed,
        totalStatusUpdates,
      };
    } catch (error) {
      logger.error('Error in batch email monitoring:', error);
      throw error;
    }
  }
}
