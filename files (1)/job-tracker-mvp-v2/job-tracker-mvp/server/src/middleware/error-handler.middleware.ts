import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';
import { ZodError } from 'zod';

export interface ApiError extends Error {
  statusCode?: number;
  code?: string;
  details?: any;
}

/**
 * Standardized error response format
 */
export function errorHandler(
  error: ApiError | Error,
  req: Request,
  res: Response,
  _next: NextFunction
) {
  // Log error
  logger.error('API Error:', {
    message: error.message,
    stack: error.stack,
    path: req.path,
    method: req.method,
    statusCode: (error as ApiError).statusCode,
  });

  // Handle Zod validation errors
  if (error instanceof ZodError) {
    return res.status(400).json({
      error: 'Validation Error',
      message: 'Invalid request data',
      details: (error as any).issues?.map((e: { path?: (string | number)[]; message?: string }) => ({
        path: e.path?.join('.') || '',
        message: e.message || '',
      })) || [],
    });
  }

  // Handle known API errors
  if ((error as ApiError).statusCode) {
    return res.status((error as ApiError).statusCode!).json({
      error: error.name || 'Error',
      message: error.message,
      ...((error as ApiError).details && { details: (error as ApiError).details }),
    });
  }

  // Handle database errors
  if ((error as any).code === '23505') {
    // Unique constraint violation
    return res.status(409).json({
      error: 'Conflict',
      message: 'Resource already exists',
    });
  }

  if ((error as any).code === '23503') {
    // Foreign key constraint violation
    return res.status(400).json({
      error: 'Invalid Reference',
      message: 'Referenced resource does not exist',
    });
  }

  // Handle JWT errors
  if (error.name === 'JsonWebTokenError') {
    return res.status(401).json({
      error: 'Invalid Token',
      message: 'Authentication token is invalid',
    });
  }

  if (error.name === 'TokenExpiredError') {
    return res.status(401).json({
      error: 'Token Expired',
      message: 'Authentication token has expired',
    });
  }

  // Default to 500
  const statusCode = (error as ApiError).statusCode || 500;
  const message = isProduction()
    ? 'An internal server error occurred'
    : error.message;

  return res.status(statusCode).json({
    error: 'Internal Server Error',
    message,
    ...(!isProduction() && { stack: error.stack }),
  });
}

/**
 * Async error wrapper - catches async errors and passes to error handler
 */
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<any>
) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

/**
 * Create standardized API error
 */
export function createError(
  message: string,
  statusCode: number = 500,
  code?: string,
  details?: any
): ApiError {
  const error = new Error(message) as ApiError;
  error.statusCode = statusCode;
  error.code = code;
  error.details = details;
  return error;
}

/**
 * Check if in production
 */
function isProduction(): boolean {
  return process.env.NODE_ENV === 'production';
}
