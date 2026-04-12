import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { findUserByIdForAuth } from '../database/auth-queries';
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
    const token = req.headers.authorization?.replace('Bearer ', '');

    if (!token) {
      return res.status(401).json({
        error: 'Authentication required',
        message: 'Please provide a valid authentication token',
      });
    }

    // Verify JWT token
    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET || 'development-secret-key',
      {
        issuer: 'uk-jobs-insider',
        audience: 'job-tracker',
      }
    ) as JwtPayload;

    const userRow = await findUserByIdForAuth(decoded.userId);

    if (!userRow) {
      return res.status(401).json({
        error: 'Invalid token',
        message: 'User not found.',
      });
    }

    req.user = {
      id: userRow.id,
      email: userRow.email,
      subscription: userRow.subscription,
    };

    next();
  } catch (error) {
    logger.error('Authentication error:', error);
    
    if (error instanceof jwt.TokenExpiredError) {
      return res.status(401).json({
        error: 'Token expired',
        message: 'Your session has expired. Please login again.',
      });
    }
    
    if (error instanceof jwt.JsonWebTokenError) {
      return res.status(401).json({
        error: 'Invalid token',
        message: 'The provided token is invalid.',
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
  const token = req.headers.authorization?.replace('Bearer ', '');
  
  if (!token) {
    return next();
  }

  try {
    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET || 'development-secret-key',
      {
        issuer: 'uk-jobs-insider',
        audience: 'job-tracker',
      }
    ) as JwtPayload;

    const userRow = await findUserByIdForAuth(decoded.userId);

    if (userRow) {
      req.user = {
        id: userRow.id,
        email: userRow.email,
        subscription: userRow.subscription,
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
) {
  if (!req.user) {
    return res.status(401).json({
      error: 'Authentication required',
      message: 'Please login to access this resource.',
    });
  }

  if (req.user.subscription !== 'ENTERPRISE') {
    return res.status(403).json({
      error: 'Insufficient permissions',
      message: 'This action requires enterprise subscription.',
    });
  }

  next();
}
