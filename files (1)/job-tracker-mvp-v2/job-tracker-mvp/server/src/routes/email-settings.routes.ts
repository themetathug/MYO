import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { pool } from '../database/client';
import { logger } from '../utils/logger';
import { validateRequest } from '../middleware/validation.middleware';
import { asyncHandler, AppError } from '../middleware/error.middleware';
import crypto from 'crypto';

const router = Router();

const FALLBACK_ENC_KEY = 'default-key-change-in-production-32c';
const ENCRYPTION_KEY = process.env.EMAIL_ENCRYPTION_KEY || FALLBACK_ENC_KEY;
const ALGORITHM = 'aes-256-cbc';

if (process.env.NODE_ENV === 'production' && ENCRYPTION_KEY === FALLBACK_ENC_KEY) {
  logger.error('❌ FATAL: EMAIL_ENCRYPTION_KEY is not set or uses the insecure default in production. Aborting.');
  process.exit(1);
}

function encrypt(text: string): string {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, Buffer.from(ENCRYPTION_KEY.slice(0, 32)), iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return iv.toString('hex') + ':' + encrypted;
}

function decrypt(encryptedText: string): string {
  const [ivHex, encrypted] = encryptedText.split(':');
  const iv = Buffer.from(ivHex, 'hex');
  const decipher = crypto.createDecipheriv(ALGORITHM, Buffer.from(ENCRYPTION_KEY.slice(0, 32)), iv);
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

const emailSettingsSchema = z.object({
  emailSyncEnabled:              z.boolean().optional(),
  emailProvider:                 z.enum(['gmail', 'outlook', 'imap']).optional(),
  emailAddress:                  z.string().email().optional(),
  emailPassword:                 z.string().optional(),
  imapHost:                      z.string().optional(),
  imapPort:                      z.number().int().min(1).max(65535).optional(),
  imapTls:                       z.boolean().optional(),
  syncFrequencyMinutes:          z.number().int().min(5).max(1440).optional(),
  notificationEnabled:           z.boolean().optional(),
  ghostingNotificationEnabled:   z.boolean().optional(),
});

const credentialsSchema = z.object({
  email:    z.string().email(),
  password: z.string().min(1),
  host:     z.string().min(1),
  port:     z.number().int().min(1).max(65535),
  tls:      z.boolean().optional(),
  provider: z.enum(['gmail', 'outlook', 'imap']).optional(),
});

// ─── Shared upsert helper ────────────────────────────────────────────────────

async function upsertSettings(userId: string, body: z.infer<typeof emailSettingsSchema>) {
  const {
    emailSyncEnabled, emailProvider, emailAddress, emailPassword,
    imapHost, imapPort, imapTls, syncFrequencyMinutes,
    notificationEnabled, ghostingNotificationEnabled,
  } = body;

  let finalImapHost = imapHost;
  let finalImapPort = imapPort;
  let finalImapTls  = imapTls !== false;

  if (!finalImapHost && emailProvider === 'gmail') {
    finalImapHost = 'imap.gmail.com';
    finalImapPort = 993;
    finalImapTls  = true;
  } else if (!finalImapHost && emailProvider === 'outlook') {
    finalImapHost = 'outlook.office365.com';
    finalImapPort = 993;
    finalImapTls  = true;
  }

  // Encrypt new password or retain existing
  let encryptedPassword: string | null = null;
  if (emailPassword) {
    encryptedPassword = encrypt(emailPassword);
  } else {
    const ex = await pool.query(
      'SELECT email_password_encrypted FROM user_email_settings WHERE user_id = $1',
      [userId]
    );
    encryptedPassword = ex.rows[0]?.email_password_encrypted ?? null;
  }

  const existing = await pool.query('SELECT id FROM user_email_settings WHERE user_id = $1', [userId]);

  let result;
  if (existing.rows.length > 0) {
    result = await pool.query(
      `UPDATE user_email_settings
       SET email_sync_enabled            = COALESCE($1,  email_sync_enabled),
           email_provider                = COALESCE($2,  email_provider),
           email_address                 = COALESCE($3,  email_address),
           email_password_encrypted      = COALESCE($4,  email_password_encrypted),
           imap_host                     = COALESCE($5,  imap_host),
           imap_port                     = COALESCE($6,  imap_port),
           imap_tls                      = COALESCE($7,  imap_tls),
           sync_frequency_minutes        = COALESCE($8,  sync_frequency_minutes),
           notification_enabled          = COALESCE($9,  notification_enabled),
           ghosting_notification_enabled = COALESCE($10, ghosting_notification_enabled),
           updated_at                    = NOW()
       WHERE user_id = $11 RETURNING *`,
      [emailSyncEnabled, emailProvider, emailAddress, encryptedPassword,
       finalImapHost, finalImapPort, finalImapTls, syncFrequencyMinutes ?? 30,
       notificationEnabled, ghostingNotificationEnabled, userId]
    );
  } else {
    result = await pool.query(
      `INSERT INTO user_email_settings
       (user_id, email_sync_enabled, email_provider, email_address, email_password_encrypted,
        imap_host, imap_port, imap_tls, sync_frequency_minutes, notification_enabled,
        ghosting_notification_enabled, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,NOW(),NOW()) RETURNING *`,
      [userId, emailSyncEnabled ?? false, emailProvider, emailAddress, encryptedPassword,
       finalImapHost, finalImapPort, finalImapTls, syncFrequencyMinutes ?? 30,
       notificationEnabled !== false, ghostingNotificationEnabled !== false]
    );
  }

  const row = result.rows[0];
  return {
    emailSyncEnabled:            row.email_sync_enabled,
    emailProvider:               row.email_provider,
    emailAddress:                row.email_address,
    imapHost:                    row.imap_host,
    imapPort:                    row.imap_port,
    imapTls:                     row.imap_tls,
    syncFrequencyMinutes:        row.sync_frequency_minutes,
    notificationEnabled:         row.notification_enabled,
    ghostingNotificationEnabled: row.ghosting_notification_enabled,
  };
}

// ─── GET /api/email-settings ──────────────────────────────────────────────────

router.get('/', asyncHandler(async (req: Request, res: Response) => {
  const userId = (req as any).user?.id;
  if (!userId) throw new AppError('Unauthorized', 401, 'UNAUTHORIZED');

  const result = await pool.query(
    `SELECT email_sync_enabled, email_provider, email_address, imap_host, imap_port, imap_tls,
            last_sync_at, sync_frequency_minutes, notification_enabled, ghosting_notification_enabled
     FROM user_email_settings WHERE user_id = $1`,
    [userId]
  );

  if (result.rows.length === 0) {
    return res.json({
      emailSyncEnabled: false, emailProvider: null, emailAddress: null,
      imapHost: null, imapPort: null, imapTls: true, lastSyncAt: null,
      syncFrequencyMinutes: 30, notificationEnabled: true, ghostingNotificationEnabled: true,
    });
  }

  const s = result.rows[0];
  return res.json({
    emailSyncEnabled:            s.email_sync_enabled,
    emailProvider:               s.email_provider,
    emailAddress:                s.email_address,
    imapHost:                    s.imap_host,
    imapPort:                    s.imap_port,
    imapTls:                     s.imap_tls,
    lastSyncAt:                  s.last_sync_at,
    syncFrequencyMinutes:        s.sync_frequency_minutes ?? 30,
    notificationEnabled:         s.notification_enabled,
    ghostingNotificationEnabled: s.ghosting_notification_enabled,
  });
}));

// ─── POST /api/email-settings  (upsert general settings) ─────────────────────

router.post('/', validateRequest(emailSettingsSchema), asyncHandler(async (req: Request, res: Response) => {
  const userId = (req as any).user?.id;
  if (!userId) throw new AppError('Unauthorized', 401, 'UNAUTHORIZED');

  const settings = await upsertSettings(userId, req.body);
  logger.info(`Email settings saved for user ${userId}`);
  return res.json({ success: true, message: 'Email settings saved successfully', settings });
}));

// ─── PUT /api/email-settings  (alias — same behaviour as POST) ───────────────

router.put('/', validateRequest(emailSettingsSchema), asyncHandler(async (req: Request, res: Response) => {
  const userId = (req as any).user?.id;
  if (!userId) throw new AppError('Unauthorized', 401, 'UNAUTHORIZED');

  const settings = await upsertSettings(userId, req.body);
  logger.info(`Email settings updated (PUT) for user ${userId}`);
  return res.json({ success: true, message: 'Email settings updated successfully', settings });
}));

// ─── POST /api/email-settings/credentials  (save IMAP credentials) ───────────

router.post('/credentials', validateRequest(credentialsSchema), asyncHandler(async (req: Request, res: Response) => {
  const userId = (req as any).user?.id;
  if (!userId) throw new AppError('Unauthorized', 401, 'UNAUTHORIZED');

  const { email, password, host, port, tls, provider } = req.body;

  const settings = await upsertSettings(userId, {
    emailAddress:  email,
    emailPassword: password,
    imapHost:      host,
    imapPort:      port,
    imapTls:       tls !== false,
    emailProvider: provider,
  });

  logger.info(`IMAP credentials saved for user ${userId}`);
  return res.json({ success: true, message: 'Credentials saved successfully', settings });
}));

// ─── DELETE /api/email-settings/credentials  (clear stored credentials) ──────

router.delete('/credentials', asyncHandler(async (req: Request, res: Response) => {
  const userId = (req as any).user?.id;
  if (!userId) throw new AppError('Unauthorized', 401, 'UNAUTHORIZED');

  await pool.query(
    `UPDATE user_email_settings
     SET email_password_encrypted = NULL,
         email_address             = NULL,
         email_provider            = NULL,
         imap_host                 = NULL,
         imap_port                 = NULL,
         email_sync_enabled        = false,
         updated_at                = NOW()
     WHERE user_id = $1`,
    [userId]
  );

  logger.info(`IMAP credentials cleared for user ${userId}`);
  return res.json({ success: true, message: 'Credentials removed successfully' });
}));

// ─── POST /api/email-settings/test-connection ────────────────────────────────

router.post('/test-connection', asyncHandler(async (req: Request, res: Response) => {
  const userId = (req as any).user?.id;
  if (!userId) throw new AppError('Unauthorized', 401, 'UNAUTHORIZED');

  const settingsResult = await pool.query(
    `SELECT email_password_encrypted, email_address, imap_host, imap_port, imap_tls
     FROM user_email_settings WHERE user_id = $1`,
    [userId]
  );

  if (settingsResult.rows.length === 0 || !settingsResult.rows[0].email_password_encrypted) {
    throw new AppError('Email not configured. Please save your credentials first.', 400, 'NOT_CONFIGURED');
  }

  const s = settingsResult.rows[0];
  const password = decrypt(s.email_password_encrypted);

  const { EmailParserService } = require('../services/email-parser.service');
  const emailParser = new EmailParserService();

  const isConnected = await emailParser.testConnection({
    user: s.email_address,
    password,
    host: s.imap_host,
    port: s.imap_port,
    tls:  s.imap_tls,
  });

  if (!isConnected) {
    throw new AppError('Unable to connect. Please check your credentials and IMAP settings.', 400, 'CONNECTION_FAILED');
  }

  return res.json({ success: true, message: 'Connection successful' });
}));

// ─── DELETE /api/email-settings  (disable sync) ──────────────────────────────

router.delete('/', asyncHandler(async (req: Request, res: Response) => {
  const userId = (req as any).user?.id;
  if (!userId) throw new AppError('Unauthorized', 401, 'UNAUTHORIZED');

  await pool.query(
    'UPDATE user_email_settings SET email_sync_enabled = false, updated_at = NOW() WHERE user_id = $1',
    [userId]
  );

  return res.json({ success: true, message: 'Email sync disabled' });
}));

// ─── POST /api/email-settings/sync-now ───────────────────────────────────────
// Triggers an immediate on-demand sync using the same pipeline as the cron job.
// This unifies the "email parser" and "status auto-update" flows: both call
// EmailMonitorService.processUserEmails, which handles confidence routing,
// review queue insertion, and application status writes.
router.post('/sync-now', asyncHandler(async (req: Request, res: Response) => {
  const userId = (req as any).user?.id;
  if (!userId) throw new AppError('Unauthorized', 401, 'UNAUTHORIZED');

  const { EmailMonitorService } = require('../services/email-monitor.service');
  const monitor = new EmailMonitorService();

  const config = await monitor.getUserEmailConfig(userId);
  if (!config) {
    throw new AppError('Email sync is not configured or disabled for your account.', 400, 'NOT_CONFIGURED');
  }

  // Run the full pipeline: fetch → detect → write/queue
  const result: { emailsProcessed: number; statusUpdates: number; applicationsUpdated: string[] } =
    await monitor.processApplicationEmails(userId, config);

  logger.info(`Manual sync triggered by user ${userId}: ${result.emailsProcessed} emails, ${result.statusUpdates} updates`);

  return res.json({
    success: true,
    emailsProcessed: result.emailsProcessed,
    statusUpdates: result.statusUpdates,
    applicationsUpdated: result.applicationsUpdated,
    message: `Processed ${result.emailsProcessed} emails, applied ${result.statusUpdates} status updates.`,
  });
}));

export default router;
