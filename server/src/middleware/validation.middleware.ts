import { Request, Response, NextFunction } from 'express';
import { z, ZodError } from 'zod';
import { logger } from '../utils/logger';

export function validateRequest(schema: z.ZodSchema) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      // Check body size to prevent DOS attacks
      const bodySize = JSON.stringify(req.body).length;
      if (bodySize > 1000000) { // 1MB limit
        res.status(413).json({
          error: 'Payload too large',
          message: 'Request body exceeds maximum size (1MB)',
        });
        return;
      }

      // Validate request body
      req.body = await schema.parseAsync(req.body);
      next();
    } catch (error: unknown) {
      if (error instanceof ZodError) {
        const zodError = error as ZodError;
        const errors = zodError.issues.map((err: any) => ({
          field: err.path.join('.'),
          message: err.message,
        }));

        // Don't log sensitive user data
        logger.warn('Validation error:', { errors });

        res.status(400).json({
          error: 'Validation failed',
          message: 'The request contains invalid data',
          errors,
        });
        return;
      }

      logger.error('Unexpected validation error:', error);
      
      res.status(500).json({
        error: 'Internal server error',
        message: 'An unexpected error occurred',
      });
    }
  };
}

// Common validation schemas
export const paginationSchema = z.object({
  page: z.preprocess((val) => val || '1', z.string().regex(/^\d+$/).transform(Number)),
  limit: z.preprocess((val) => val || '20', z.string().regex(/^\d+$/).transform(Number)),
  sortBy: z.string().optional(),
  order: z.enum(['asc', 'desc']).default('desc'),
});

export const uuidSchema = z.string().uuid({
  message: 'Invalid ID format',
});

export const emailSchema = z
  .string()
  .email()
  .transform((email: string) => email.toLowerCase());

export const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(100, 'Password must be less than 100 characters')
  .regex(
    /(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
    'Password must contain at least one uppercase letter, one lowercase letter, and one number'
  );

export const dateSchema = z.string().datetime({
  message: 'Invalid date format. Use ISO 8601 format',
});

// Sanitize input to prevent XSS
export function sanitizeInput(input: any): any {
  if (typeof input === 'string') {
    // Remove HTML tags and scripts
    // Limit input size to prevent DOS attacks (100KB max per field)
    if (input.length > 100000) {
      throw new Error('Input size exceeds maximum allowed (100KB)');
    }
    
    return input
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/<[^>]+>/g, '')
      .trim();
  }
  
  if (Array.isArray(input)) {
    // Limit array size to prevent DOS attacks
    if (input.length > 1000) {
      throw new Error('Array size exceeds maximum allowed (1000 items)');
    }
    return input.map(sanitizeInput);
  }
  
  if (typeof input === 'object' && input !== null) {
    const sanitized: any = {};
    let keyCount = 0;
    const MAX_KEYS = 100; // Prevent excessive object nesting
    
    for (const key in input) {
      if (input.hasOwnProperty(key)) {
        if (keyCount++ > MAX_KEYS) {
          throw new Error('Object contains too many keys');
        }
        sanitized[key] = sanitizeInput(input[key]);
      }
    }
    return sanitized;
  }
  
  return input;
}

// Validate query parameters
export function validateQuery(schema: z.ZodSchema) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const validatedQuery = await schema.parseAsync(req.query);
      req.query = validatedQuery as any;
      next();
    } catch (error: unknown) {
      if (error instanceof ZodError) {
        const zodError = error as ZodError;
        const errors = zodError.issues.map((err: any) => ({
          field: err.path.join('.'),
          message: err.message,
        }));

        logger.warn('Query validation error:', { errors });

        res.status(400).json({
          error: 'Invalid query parameters',
          message: 'The request contains invalid query parameters',
          errors,
        });
        return;
      }

      logger.error('Unexpected query validation error:', error);

      res.status(500).json({
        error: 'Internal server error',
        message: 'An unexpected error occurred',
      });
    }
  };
}

// Validate params
export function validateParams(schema: z.ZodSchema) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const validatedParams = await schema.parseAsync(req.params);
      req.params = validatedParams as any;
      next();
    } catch (error: unknown) {
      if (error instanceof ZodError) {
        const zodError = error as ZodError;
        const errors = zodError.issues.map((err: any) => ({
          field: err.path.join('.'),
          message: err.message,
        }));

        logger.warn('Params validation error:', { errors });

        res.status(400).json({
          error: 'Invalid parameters',
          message: 'The request contains invalid parameters',
          errors,
        });
        return;
      }

      logger.error('Unexpected params validation error:', error);

      res.status(500).json({
        error: 'Internal server error',
        message: 'An unexpected error occurred',
      });
    }
  };
}
