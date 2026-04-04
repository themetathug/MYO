import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { pool } from '../database/client';
import { logger } from '../utils/logger';

interface JwtPayload {
  userId: string;
  iat: number;
  exp: number;
}

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email?: string;
        subscription?: string;
      };
    }
  }
}

export async function authMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
) {
  // Skip authentication for OPTIONS requests (CORS preflight)
  if (req.method === 'OPTIONS') {
    return next();
  }

  try {
    const cookieHeader = req.headers.cookie || '';
    const cookies = Object.fromEntries(
      cookieHeader
        .split(';')
        .map((part) => part.trim())
        .filter(Boolean)
        .map((part) => {
          const eq = part.indexOf('=');
          return eq === -1 ? [part, ''] : [part.slice(0, eq), decodeURIComponent(part.slice(eq + 1))];
        })
    ) as Record<string, string>;

    const rawToken = cookies.access_token || req.headers.authorization?.replace('Bearer ', '');

    if (!rawToken) {
      return res.status(401).json({
        error: 'Authentication required',
        message: 'Please provide a valid authentication token',
      });
    }

    // Extension tokens are 96-char hex strings; JWT tokens are dot-separated.
    // Try extension token path first for requests coming from the extension.
    if (!rawToken.includes('.')) {
      const tokenHash = require('crypto').createHash('sha256').update(rawToken).digest('hex');
      const extResult = await pool.query(
        `SELECT et.user_id, u.email, u.subscription
         FROM extension_tokens et
         JOIN users u ON u.id = et.user_id
         WHERE et.token_hash = $1
           AND et.revoked_at IS NULL
           AND et.expires_at > NOW()`,
        [tokenHash]
      );
      if (extResult.rows.length === 0) {
        return res.status(401).json({ error: 'Invalid extension token', code: 'INVALID_TOKEN' });
      }
      // Update last_used_at without blocking the request
      pool.query(`UPDATE extension_tokens SET last_used_at = NOW() WHERE token_hash = $1`, [tokenHash]).catch(() => {});
      const u = extResult.rows[0];
      req.user = { id: u.user_id, email: u.email, subscription: u.subscription };
      return next();
    }

    // Verify JWT token with strict issuer/audience validation.
    const decoded = jwt.verify(
      rawToken,
      process.env.JWT_SECRET || 'development-secret-key',
      {
        issuer: process.env.JWT_ISSUER || 'uk-jobs-insider',
        audience: process.env.JWT_AUDIENCE || 'job-tracker',
      }
    ) as JwtPayload;

    // Verify user exists in database
    const result = await pool.query(
      'SELECT id, email, subscription FROM users WHERE id = $1',
      [decoded.userId]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({
        error: 'Invalid token',
        message: 'User not found.',
      });
    }

    const user = result.rows[0];

    // Attach user to request
    req.user = {
      id: user.id,
      email: user.email,
      subscription: user.subscription,
    };

    next();
  } catch (error) {
    logger.error('Authentication error:', error);
    
    if (error instanceof jwt.TokenExpiredError) {
      return res.status(401).json({
        error: 'Token expired',
        message: 'Your session has expired. Please login again.',
        code: 'TOKEN_EXPIRED',
      });
    }
    
    if (error instanceof jwt.JsonWebTokenError) {
      // Log more details for debugging
      logger.debug('JWT Error details:', {
        name: error.name,
        message: error.message,
        hasJWT_SECRET: !!process.env.JWT_SECRET,
      });
      
      return res.status(401).json({
        error: 'Invalid token',
        message: 'The provided token is invalid. Please login again.',
        code: 'INVALID_TOKEN',
      });
    }

    return res.status(500).json({
      error: 'Authentication failed',
      message: 'An error occurred during authentication.',
    });
  }
}

// Optional auth middleware (doesn't require auth but adds user if token present)
export async function optionalAuthMiddleware(
  req: Request,
  _res: Response,
  next: NextFunction
) {
  const cookieHeader = req.headers.cookie || '';
  const cookies = Object.fromEntries(
    cookieHeader
      .split(';')
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => {
        const eq = part.indexOf('=');
        return eq === -1 ? [part, ''] : [part.slice(0, eq), decodeURIComponent(part.slice(eq + 1))];
      })
  ) as Record<string, string>;

  const token = cookies.access_token || req.headers.authorization?.replace('Bearer ', '');
  
  if (!token) {
    return next();
  }

  try {
    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET || 'development-secret-key',
      {
        issuer: process.env.JWT_ISSUER || 'uk-jobs-insider',
        audience: process.env.JWT_AUDIENCE || 'job-tracker',
      }
    ) as JwtPayload;

    const result = await pool.query(
      'SELECT id, email, subscription FROM users WHERE id = $1',
      [decoded.userId]
    );

    if (result.rows.length > 0) {
      const user = result.rows[0];
      req.user = {
        id: user.id,
        email: user.email,
        subscription: user.subscription,
      };
    }
  } catch (error) {
    // Silently ignore invalid tokens for optional auth
    logger.debug('Optional auth token invalid:', error);
  }

  next();
}

// Admin-only middleware
export async function adminMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  if (!req.user) {
    res.status(401).json({
      error: 'Authentication required',
      message: 'Please login to access this resource.',
    });
    return;
  }

  if (req.user.subscription !== 'ENTERPRISE') {
    res.status(403).json({
      error: 'Insufficient permissions',
      message: 'This action requires enterprise subscription.',
    });
    return;
  }

  return next();
}
