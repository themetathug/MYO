import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

export class AppError extends Error {
  statusCode: number;
  isOperational: boolean;

  constructor(message: string, statusCode: number = 500) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

export function errorHandler(
  err: Error | AppError,
  req: Request,
  res: Response,
  next: NextFunction
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
    user: req.user?.id,
  });

  // Handle Prisma errors
  if (err.constructor.name === 'PrismaClientKnownRequestError') {
    const prismaError = err as any;
    
    switch (prismaError.code) {
      case 'P2002':
        statusCode = 400;
        message = 'A record with this value already exists';
        error = 'DuplicateError';
        break;
      case 'P2025':
        statusCode = 404;
        message = 'Record not found';
        error = 'NotFoundError';
        break;
      case 'P2003':
        statusCode = 400;
        message = 'Invalid reference to related record';
        error = 'ReferenceError';
        break;
      default:
        statusCode = 400;
        message = 'Database operation failed';
        error = 'DatabaseError';
    }
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
  res.status(statusCode).json({
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
export function notFoundHandler(req: Request, res: Response) {
  res.status(404).json({
    error: 'NotFound',
    message: `The requested resource ${req.originalUrl} was not found`,
  });
}
