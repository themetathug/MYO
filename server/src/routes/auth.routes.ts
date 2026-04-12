import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { findUserByEmailForAuth, insertUserForAuth, normalizeAuthEmail } from '../database/auth-queries';
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

// Register endpoint
router.post('/register', validateRequest(registerSchema), async (req, res) => {
  try {
    const { email, password, firstName, lastName } = req.body;

    const existing = await findUserByEmailForAuth(email);
    if (existing) {
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
    res.status(500).json({
      error: 'Registration failed',
      message: 'Unable to create account. Please try again.',
      details: process.env.NODE_ENV === 'development' ? errorMessage : undefined,
    });
  }
});

// Login endpoint
router.post('/login', validateRequest(loginSchema), async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await findUserByEmailForAuth(email);

    if (!user) {
      return res.status(401).json({
        error: 'Invalid credentials',
        message: 'Email or password is incorrect',
      });
    }

    if (!user.id || !user.password_hash) {
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
