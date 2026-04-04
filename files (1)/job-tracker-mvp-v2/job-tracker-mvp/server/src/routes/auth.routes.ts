import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import crypto from 'crypto';
import { pool } from '../database/client';
import { logger } from '../utils/logger';
import { validateRequest } from '../middleware/validation.middleware';
import { generateToken } from '../utils/jwt.utils';
import { asyncHandler, AppError } from '../middleware/error.middleware';

const router = Router();
const REFRESH_TTL_DAYS = parseInt(process.env.REFRESH_TOKEN_TTL_DAYS || '30', 10);
const isProd = process.env.NODE_ENV === 'production';

function parseCookies(req: Request): Record<string, string> {
  const cookieHeader = req.headers.cookie || '';
  return Object.fromEntries(
    cookieHeader
      .split(';')
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => {
        const eq = part.indexOf('=');
        return eq === -1 ? [part, ''] : [part.slice(0, eq), decodeURIComponent(part.slice(eq + 1))];
      })
  );
}

function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function randomToken(): string {
  return crypto.randomBytes(48).toString('hex');
}

function cookieOptions(maxAgeMs: number) {
  return {
    httpOnly: true,
    secure: isProd,
    sameSite: 'lax' as const,
    path: '/',
    maxAge: maxAgeMs,
  };
}

async function createSessionWithRefresh(userId: string, req: Request) {
  const sessionId = crypto.randomUUID();
  const familyId = crypto.randomUUID();
  const refreshToken = randomToken();
  const refreshTokenHash = hashToken(refreshToken);

  const expiresAt = new Date(Date.now() + REFRESH_TTL_DAYS * 24 * 60 * 60 * 1000);

  await pool.query(
    `INSERT INTO auth_sessions (user_id, session_id, ip_address, user_agent, created_at, last_used_at)
     VALUES ($1, $2, $3, $4, NOW(), NOW())`,
    [userId, sessionId, req.ip || null, req.headers['user-agent'] || null]
  );

  await pool.query(
    `INSERT INTO refresh_tokens (user_id, session_id, token_hash, family_id, expires_at, created_at)
     VALUES ($1, $2, $3, $4, $5, NOW())`,
    [userId, sessionId, refreshTokenHash, familyId, expiresAt]
  );

  return { sessionId, refreshToken };
}

function setAuthCookies(res: Response, accessToken: string, refreshToken: string) {
  res.cookie('access_token', accessToken, cookieOptions(15 * 60 * 1000));
  res.cookie('refresh_token', refreshToken, cookieOptions(REFRESH_TTL_DAYS * 24 * 60 * 60 * 1000));
}

function clearAuthCookies(res: Response) {
  res.clearCookie('access_token', { path: '/' });
  res.clearCookie('refresh_token', { path: '/' });
}

// Validation schemas
const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(100),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  consentTracking: z.boolean().default(false),
  consentAnalytics: z.boolean().default(false),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

// Register endpoint
router.post('/register', validateRequest(registerSchema), asyncHandler(async (req: Request, res: Response) => {
    const { email, password, firstName, lastName } = req.body;

    // Check if user exists
    const existingUserResult = await pool.query(
      'SELECT id FROM users WHERE email = $1',
      [email.toLowerCase()]
    );

    if (!existingUserResult || !existingUserResult.rows) {
      throw new Error('Database query failed - invalid result structure');
    }

    if (existingUserResult.rows.length > 0) {
      return res.status(400).json({
        error: 'User already exists',
        message: 'An account with this email already exists',
      });
    }

    // Hash password
    const salt = await bcrypt.genSalt(12);
    const passwordHash = await bcrypt.hash(password, salt);

    // Create user
    const result = await pool.query(
      `INSERT INTO users (email, password_hash, first_name, last_name, created_at, updated_at)
       VALUES ($1, $2, $3, $4, NOW(), NOW())
       RETURNING id, email, first_name, last_name, subscription, created_at`,
      [
        email.toLowerCase(),
        passwordHash,
        firstName || null,
        lastName || null,
      ]
    );

    if (!result || !result.rows || result.rows.length === 0) {
      throw new Error('Failed to create user - no data returned from database');
    }

    const user = result.rows[0];

    if (!user || !user.id) {
      throw new Error('Invalid user data returned from database');
    }

    const accessToken = generateToken(user.id, { email: user.email });
    const { refreshToken } = await createSessionWithRefresh(user.id, req);
    setAuthCookies(res, accessToken, refreshToken);

    logger.info(`New user registered: ${user.email}`);

    return res.status(201).json({
      message: 'Account created successfully',
      user: {
        id: user.id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        subscription: user.subscription,
        createdAt: user.created_at,
      },
      token: accessToken,
    });
}));

// Login endpoint
router.post('/login', validateRequest(loginSchema), asyncHandler(async (req: Request, res: Response) => {
    const { email, password } = req.body;

    // Find user
    const result = await pool.query(
      `SELECT id, email, password_hash, first_name, last_name, subscription, weekly_target, monthly_target
       FROM users
       WHERE email = $1`,
      [email.toLowerCase()]
    );

    if (!result || !result.rows || result.rows.length === 0) {
      return res.status(401).json({
        error: 'Invalid credentials',
        message: 'Email or password is incorrect',
      });
    }

    const user = result.rows[0];

    if (!user || !user.id || !user.password_hash) {
      throw new Error('Invalid user data returned from database');
    }

    // Verify password
    const isValid = await bcrypt.compare(password, user.password_hash);
    if (!isValid) {
      return res.status(401).json({
        error: 'Invalid credentials',
        message: 'Email or password is incorrect',
      });
    }

    const accessToken = generateToken(user.id, { email: user.email });
    const { refreshToken } = await createSessionWithRefresh(user.id, req);
    setAuthCookies(res, accessToken, refreshToken);

    logger.info(`User logged in: ${user.email}`);

    return res.json({
      message: 'Login successful',
      user: {
        id: user.id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        subscription: user.subscription,
        weeklyTarget: user.weekly_target,
        monthlyTarget: user.monthly_target,
      },
      token: accessToken,
    });
}));

// Logout endpoint
router.post('/logout', asyncHandler(async (req: Request, res: Response) => {
  const cookies = parseCookies(req);
  const refreshToken = cookies.refresh_token;

  if (refreshToken) {
    const refreshTokenHash = hashToken(refreshToken);
    await pool.query(
      `UPDATE refresh_tokens SET revoked_at = NOW()
       WHERE token_hash = $1 AND revoked_at IS NULL`,
      [refreshTokenHash]
    );
  }

  clearAuthCookies(res);
  res.json({
    message: 'Logged out successfully',
  });
}));

// Refresh token endpoint
router.post('/refresh', asyncHandler(async (req: Request, res: Response) => {
    const cookies = parseCookies(req);
    const rawRefreshToken = cookies.refresh_token;

    if (!rawRefreshToken) throw new AppError('Refresh token missing', 401, 'AUTH_REQUIRED');

    const tokenHash = hashToken(rawRefreshToken);
    const result = await pool.query(
      `SELECT id, user_id, session_id, family_id, expires_at, revoked_at
       FROM refresh_tokens WHERE token_hash = $1`,
      [tokenHash]
    );
    if (result.rows.length === 0) throw new AppError('Invalid refresh token', 401, 'INVALID_REFRESH');

    const tokenRow = result.rows[0];
    if (tokenRow.revoked_at) {
      await pool.query(
        `UPDATE refresh_tokens SET revoked_at = NOW()
         WHERE family_id = $1 AND revoked_at IS NULL`,
        [tokenRow.family_id]
      );
      throw new AppError('Refresh token reuse detected. Please login again.', 401, 'TOKEN_REUSE');
    }

    if (new Date(tokenRow.expires_at).getTime() <= Date.now()) {
      throw new AppError('Refresh token expired', 401, 'TOKEN_EXPIRED');
    }

    // rotate refresh token
    const newRefreshToken = randomToken();
    const newRefreshTokenHash = hashToken(newRefreshToken);

    await pool.query(
      `UPDATE refresh_tokens SET revoked_at = NOW(), last_used_at = NOW() WHERE id = $1`,
      [tokenRow.id]
    );
    await pool.query(
      `INSERT INTO refresh_tokens (user_id, session_id, token_hash, family_id, rotated_from, expires_at, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
      [
        tokenRow.user_id,
        tokenRow.session_id,
        newRefreshTokenHash,
        tokenRow.family_id,
        tokenRow.id,
        new Date(Date.now() + REFRESH_TTL_DAYS * 24 * 60 * 60 * 1000),
      ]
    );
    await pool.query(
      `UPDATE auth_sessions SET last_used_at = NOW() WHERE session_id = $1 AND revoked_at IS NULL`,
      [tokenRow.session_id]
    );

    const newAccessToken = generateToken(tokenRow.user_id);
    setAuthCookies(res, newAccessToken, newRefreshToken);

    return res.json({ message: 'Token refreshed successfully', token: newAccessToken });
}));

// ── Extension token endpoints ──────────────────────────────────────────────────
// Returns a long-lived (90-day), revocable token the Chrome extension stores
// independently of browser cookies, making it deterministic across environments.

const EXTENSION_TOKEN_TTL_DAYS = parseInt(process.env.EXTENSION_TOKEN_TTL_DAYS || '90', 10);

router.post('/extension-token', asyncHandler(async (req: Request, res: Response) => {
  const userId = (req as any).user?.id;
  if (!userId) throw new AppError('Unauthorized', 401, 'UNAUTHORIZED');

  const rawToken = crypto.randomBytes(48).toString('hex');
  const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
  const expiresAt = new Date(Date.now() + EXTENSION_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000);
  const label = (req.body?.label as string) || 'Chrome Extension';

  await pool.query(
    `INSERT INTO extension_tokens (user_id, token_hash, label, expires_at)
     VALUES ($1, $2, $3, $4)`,
    [userId, tokenHash, label.slice(0, 100), expiresAt]
  );

  logger.info(`Extension token issued for user ${userId}`);
  return res.json({
    token: rawToken,
    expiresAt,
    label,
    message: 'Store this token in the extension. It will not be shown again.',
  });
}));

router.get('/extension-tokens', asyncHandler(async (req: Request, res: Response) => {
  const userId = (req as any).user?.id;
  if (!userId) throw new AppError('Unauthorized', 401, 'UNAUTHORIZED');

  const result = await pool.query(
    `SELECT id, label, last_used_at, expires_at, revoked_at, created_at
     FROM extension_tokens
     WHERE user_id = $1
     ORDER BY created_at DESC`,
    [userId]
  );
  return res.json({ tokens: result.rows });
}));

router.delete('/extension-token/:id', asyncHandler(async (req: Request, res: Response) => {
  const userId = (req as any).user?.id;
  if (!userId) throw new AppError('Unauthorized', 401, 'UNAUTHORIZED');

  await pool.query(
    `UPDATE extension_tokens SET revoked_at = NOW()
     WHERE id = $1 AND user_id = $2 AND revoked_at IS NULL`,
    [req.params.id, userId]
  );
  return res.json({ message: 'Extension token revoked' });
}));

export default router;
