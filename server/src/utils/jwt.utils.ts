import jwt from 'jsonwebtoken';
import { logger } from './logger';

const JWT_SECRET = process.env.JWT_SECRET || 'development-secret-key';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

export interface TokenPayload {
  userId: string;
  email?: string;
  subscription?: string;
}

export function generateToken(userId: string, additionalPayload?: Partial<TokenPayload>): string {
  try {
    const payload: TokenPayload = {
      userId,
      ...additionalPayload,
    };

    const token = jwt.sign(payload, JWT_SECRET, {
      expiresIn: JWT_EXPIRES_IN,
      issuer: 'uk-jobs-insider',
      audience: 'job-tracker',
    });

    return token;
  } catch (error) {
    logger.error('Error generating JWT token:', error);
    throw new Error('Failed to generate authentication token');
  }
}

export function verifyToken(token: string): TokenPayload | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET, {
      issuer: 'uk-jobs-insider',
      audience: 'job-tracker',
    }) as TokenPayload;

    return decoded;
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      logger.debug('Token expired:', error.message);
    } else if (error instanceof jwt.JsonWebTokenError) {
      logger.debug('Invalid token:', error.message);
    } else {
      logger.error('Token verification error:', error);
    }
    return null;
  }
}

export function decodeToken(token: string): TokenPayload | null {
  try {
    const decoded = jwt.decode(token) as TokenPayload;
    return decoded;
  } catch (error) {
    logger.error('Error decoding token:', error);
    return null;
  }
}

export function generateRefreshToken(userId: string): string {
  try {
    const token = jwt.sign(
      { userId, type: 'refresh' },
      JWT_SECRET,
      {
        expiresIn: '30d',
        issuer: 'uk-jobs-insider',
      }
    );

    return token;
  } catch (error) {
    logger.error('Error generating refresh token:', error);
    throw new Error('Failed to generate refresh token');
  }
}

export function generatePasswordResetToken(userId: string, email: string): string {
  try {
    const token = jwt.sign(
      { userId, email, type: 'password-reset' },
      JWT_SECRET,
      {
        expiresIn: '1h',
        issuer: 'uk-jobs-insider',
      }
    );

    return token;
  } catch (error) {
    logger.error('Error generating password reset token:', error);
    throw new Error('Failed to generate password reset token');
  }
}

export function generateEmailVerificationToken(userId: string, email: string): string {
  try {
    const token = jwt.sign(
      { userId, email, type: 'email-verification' },
      JWT_SECRET,
      {
        expiresIn: '24h',
        issuer: 'uk-jobs-insider',
      }
    );

    return token;
  } catch (error) {
    logger.error('Error generating email verification token:', error);
    throw new Error('Failed to generate email verification token');
  }
}
