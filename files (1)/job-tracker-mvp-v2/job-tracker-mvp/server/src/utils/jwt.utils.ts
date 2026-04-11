import jwt from 'jsonwebtoken';
import { logger } from './logger';

const FALLBACK_SECRET = 'development-secret-key';
const JWT_SECRET = process.env.JWT_SECRET || FALLBACK_SECRET;

// Hard fail in production if the secret is the known insecure default.
if (process.env.NODE_ENV === 'production' && JWT_SECRET === FALLBACK_SECRET) {
  logger.error('❌ FATAL: JWT_SECRET is not set or uses the development default in production. Aborting.');
  process.exit(1);
}
const ACCESS_TOKEN_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '24h';
const JWT_ISSUER = process.env.JWT_ISSUER || 'uk-jobs-insider';
const JWT_AUDIENCE = process.env.JWT_AUDIENCE || 'job-tracker';
const ACCESS_TOKEN_TTL = ACCESS_TOKEN_EXPIRES_IN as jwt.SignOptions['expiresIn'];

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
      expiresIn: ACCESS_TOKEN_TTL,
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE,
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
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE,
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

export function generatePasswordResetToken(userId: string, email: string): string {
  try {
    const token = jwt.sign(
      { userId, email, type: 'password-reset' },
      JWT_SECRET,
      {
        expiresIn: '1h',
        issuer: JWT_ISSUER,
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
        issuer: JWT_ISSUER,
      }
    );

    return token;
  } catch (error) {
    logger.error('Error generating email verification token:', error);
    throw new Error('Failed to generate email verification token');
  }
}
