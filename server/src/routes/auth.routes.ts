import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { findLoginCandidatesByEmail, insertUserForAuth, normalizeAuthEmail } from '../database/auth-queries';
import { logger } from '../utils/logger';
import { validateRequest } from '../middleware/validation.middleware';
import { generateToken, verifyToken } from '../utils/jwt.utils';

const router = Router();

// Validation schemas
const registerSchema = z.object({
  email: z.string().email().transform((s) => s.trim().toLowerCase()),
  password: z.string().min(8).max(100),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  consentTracking: z.boolean().default(false),
  consentAnalytics: z.boolean().default(false),
});

const loginSchema = z.object({
  email: z.string().email().transform((s) => s.trim().toLowerCase()),
  password: z.string(),
});

function registrationFailurePayload(error: unknown): {
  message: string;
  hint?: string;
} {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === 'P1001') {
      return {
        message: 'Cannot reach the database server.',
        hint: 'On Render: verify DATABASE_URL and that the database allows connections from Render.',
      };
    }
    if (error.code === 'P2021' || error.code === 'P2022') {
      return {
        message: 'The database schema is not ready for sign-up.',
        hint: 'On your API host run: npx prisma migrate deploy (then try again).',
      };
    }
  }
  const errName = error instanceof Error ? error.name : '';
  if (errName === 'PrismaClientInitializationError') {
    return {
      message: 'Cannot connect to the database.',
      hint: 'Check DATABASE_URL on Render (cloud Postgres often needs ?sslmode=require).',
    };
  }
  if (error instanceof Error && error.message.includes('Failed to create user: neither')) {
    return {
      message: 'No user table available for registration.',
      hint: 'Run Prisma migrations on the server: npx prisma migrate deploy.',
    };
  }
  return {
    message: 'Unable to create account. Please try again.',
    hint: 'See API logs on Render for details.',
  };
}

// Register endpoint
router.post('/register', validateRequest(registerSchema), async (req, res) => {
  try {
    const { email, password, firstName, lastName, consentTracking, consentAnalytics } = req.body;

    const existingAccounts = await findLoginCandidatesByEmail(email);
    if (existingAccounts.length > 0) {
      return res.status(400).json({
        error: 'User already exists',
        message: 'An account with this email already exists',
      });
    }

    // Hash password
    const salt = await bcrypt.genSalt(12);
    const passwordHash = await bcrypt.hash(password, salt);

    const user = await insertUserForAuth({
      email: normalizeAuthEmail(email),
      passwordHash,
      firstName: firstName || null,
      lastName: lastName || null,
      consentTracking: Boolean(consentTracking),
      consentAnalytics: Boolean(consentAnalytics),
    });

    if (!user?.id) {
      throw new Error('Failed to create user - no data returned from database');
    }

    // Generate token with email
    const token = generateToken(user.id, { email: user.email });

    logger.info(`New user registered: ${user.email}`);

    res.status(201).json({
      message: 'Account created successfully',
      user: {
        id: user.id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        subscription: user.subscription,
        createdAt: user.created_at?.toISOString?.() ?? new Date().toISOString(),
      },
      token,
    });
  } catch (error: unknown) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return res.status(400).json({
        error: 'User already exists',
        message: 'An account with this email already exists',
      });
    }
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Registration error:', error);
    const { message, hint } = registrationFailurePayload(error);
    res.status(500).json({
      error: 'Registration failed',
      message,
      hint,
      details: process.env.NODE_ENV === 'development' ? errorMessage : undefined,
    });
  }
});

// Login endpoint
router.post('/login', validateRequest(loginSchema), async (req, res) => {
  try {
    const { email, password } = req.body;

    const candidates = await findLoginCandidatesByEmail(email);

    if (candidates.length === 0) {
      return res.status(401).json({
        error: 'Invalid credentials',
        message: 'Email or password is incorrect',
      });
    }

    let user = null as (typeof candidates)[0] | null;
    for (const row of candidates) {
      if (row.password_hash && (await bcrypt.compare(password, row.password_hash))) {
        user = row;
        break;
      }
    }

    if (!user) {
      return res.status(401).json({
        error: 'Invalid credentials',
        message: 'Email or password is incorrect',
      });
    }

    // Generate token with email
    const token = generateToken(user.id, { email: user.email });

    logger.info(`User logged in: ${user.email}`);

    res.json({
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
      token,
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Login error:', error);
    res.status(500).json({
      error: 'Login failed',
      message: 'Unable to login. Please try again.',
      details: process.env.NODE_ENV === 'development' ? errorMessage : undefined,
    });
  }
});

// Logout endpoint
router.post('/logout', async (_req, res) => {
  res.json({
    message: 'Logged out successfully',
  });
});

// Refresh token endpoint
router.post('/refresh', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');

    if (!token) {
      return res.status(401).json({
        error: 'No token provided',
        message: 'Authentication required',
      });
    }

    // Verify token
    const payload = verifyToken(token);
    if (!payload) {
      return res.status(401).json({
        error: 'Invalid token',
        message: 'Token is invalid or expired',
      });
    }

    // Generate new token
    const newToken = generateToken(payload.userId);

    res.json({
      message: 'Token refreshed successfully',
      token: newToken,
    });
  } catch (error) {
    logger.error('Token refresh error:', error);
    res.status(500).json({
      error: 'Token refresh failed',
      message: 'Unable to refresh token. Please login again.',
    });
  }
});

export default router;
