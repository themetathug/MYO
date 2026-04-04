import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';
import { ZodError } from 'zod';

export class AppError extends Error {
  statusCode: number;
  isOperational: boolean;
  code?: string;
  details?: any;

  constructor(message: string, statusCode: number = 500, code?: string, details?: any) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;
    this.code = code;
    this.details = details;
    Error.captureStackTrace(this, this.constructor);
  }
}

export function errorHandler(
  err: Error | AppError,
  req: Request,
  res: Response,
  _next: NextFunction
) {
  let statusCode = 500;
  let message = 'Internal Server Error';
  let error = 'ServerError';

  if (err instanceof AppError) {
    statusCode = err.statusCode;
    message = err.message;
    error = err.name;
  }

  // Log error details
  logger.error('Error occurred:', {
    error: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
    ip: req.ip,
    user: (req as any).user?.id,
  });

  if (process.env.SENTRY_DSN) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const Sentry = require('@sentry/node');
      Sentry.captureException(err);
    } catch {
      // no-op if Sentry SDK is unavailable
    }
  }

  // PostgreSQL unique constraint violation
  if ((err as any).code === '23505') {
    statusCode = 409;
    message = 'A record with this value already exists';
    error = 'DuplicateError';
  }

  // PostgreSQL foreign key violation
  if ((err as any).code === '23503') {
    statusCode = 400;
    message = 'Invalid reference to a related record';
    error = 'ReferenceError';
  }

  // Handle Zod validation errors
  if (err instanceof ZodError) {
    statusCode = 400;
    message = 'Validation failed';
    error = 'ValidationError';
    return res.status(statusCode).json({
      error,
      message,
      details: (err as any).issues?.map((e: { path?: (string | number)[]; message?: string }) => ({
        path: e.path?.join('.') || '',
        message: e.message || '',
      })) || [],
    });
  }

  // Handle validation errors
  if (err.constructor.name === 'ValidationError') {
    statusCode = 400;
    message = 'Validation failed';
    error = 'ValidationError';
  }

  // Handle JWT errors
  if (err.name === 'JsonWebTokenError') {
    statusCode = 401;
    message = 'Invalid authentication token';
    error = 'AuthenticationError';
  }

  if (err.name === 'TokenExpiredError') {
    statusCode = 401;
    message = 'Authentication token has expired';
    error = 'TokenExpiredError';
  }

  // Send error response
  return res.status(statusCode).json({
    error,
    message,
    ...(process.env.NODE_ENV === 'development' && {
      stack: err.stack,
      details: err,
    }),
  });
}

// Async error wrapper
export function asyncHandler(fn: Function) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

// Not found handler
export function notFoundHandler(req: Request, res: Response): void {
  res.status(404).json({
    error: 'NotFound',
    message: `The requested resource ${req.originalUrl} was not found`,
  });
}
