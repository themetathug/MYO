import Redis from 'ioredis';
import { logger } from '../utils/logger';

let redisClient: Redis | null = null;

export async function initializeRedis(): Promise<void> {
  try {
    redisClient = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
      maxRetriesPerRequest: 3,
      retryStrategy: (times) => {
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
      reconnectOnError: (err) => {
        const targetError = 'READONLY';
        if (err.message.includes(targetError)) {
          // Only reconnect when the error contains "READONLY"
          return true;
        }
        return false;
      },
    });

    redisClient.on('connect', () => {
      logger.info('Redis connected successfully');
    });

    redisClient.on('error', (error) => {
      logger.error('Redis connection error:', error);
    });

    redisClient.on('close', () => {
      logger.warn('Redis connection closed');
    });

    // Test connection
    await redisClient.ping();
  } catch (error) {
    logger.error('Failed to initialize Redis:', error);
    throw error;
  }
}

export { redisClient };

// Cache utilities
export class CacheService {
  private static DEFAULT_TTL = 3600; // 1 hour in seconds

  static async get<T>(key: string): Promise<T | null> {
    try {
      if (!redisClient) {
        logger.warn('Redis client not initialized');
        return null;
      }

      const data = await redisClient.get(key);
      if (!data) return null;

      return JSON.parse(data) as T;
    } catch (error) {
      logger.error(`Error getting cache key ${key}:`, error);
      return null;
    }
  }

  static async set(
    key: string,
    value: any,
    ttl: number = CacheService.DEFAULT_TTL
  ): Promise<boolean> {
    try {
      if (!redisClient) {
        logger.warn('Redis client not initialized');
        return false;
      }

      const serialized = JSON.stringify(value);
      await redisClient.setex(key, ttl, serialized);
      return true;
    } catch (error) {
      logger.error(`Error setting cache key ${key}:`, error);
      return false;
    }
  }

  static async delete(key: string): Promise<boolean> {
    try {
      if (!redisClient) {
        logger.warn('Redis client not initialized');
        return false;
      }

      await redisClient.del(key);
      return true;
    } catch (error) {
      logger.error(`Error deleting cache key ${key}:`, error);
      return false;
    }
  }

  static async deletePattern(pattern: string): Promise<number> {
    try {
      if (!redisClient) {
        logger.warn('Redis client not initialized');
        return 0;
      }

      const keys = await redisClient.keys(pattern);
      if (keys.length === 0) return 0;

      const deleted = await redisClient.del(...keys);
      return deleted;
    } catch (error) {
      logger.error(`Error deleting cache pattern ${pattern}:`, error);
      return 0;
    }
  }

  static async flush(): Promise<void> {
    try {
      if (!redisClient) {
        logger.warn('Redis client not initialized');
        return;
      }

      await redisClient.flushall();
      logger.info('Redis cache flushed');
    } catch (error) {
      logger.error('Error flushing cache:', error);
    }
  }

  // Rate limiting helper
  static async checkRateLimit(
    identifier: string,
    limit: number,
    windowSeconds: number
  ): Promise<{ allowed: boolean; remaining: number; resetIn: number }> {
    try {
      if (!redisClient) {
        // If Redis is not available, allow the request
        return { allowed: true, remaining: limit, resetIn: 0 };
      }

      const key = `rate_limit:${identifier}`;
      const current = await redisClient.incr(key);

      if (current === 1) {
        // First request in this window
        await redisClient.expire(key, windowSeconds);
      }

      const ttl = await redisClient.ttl(key);
      const allowed = current <= limit;
      const remaining = Math.max(0, limit - current);

      return {
        allowed,
        remaining,
        resetIn: ttl > 0 ? ttl : windowSeconds,
      };
    } catch (error) {
      logger.error('Error checking rate limit:', error);
      // On error, allow the request
      return { allowed: true, remaining: limit, resetIn: 0 };
    }
  }
}

// Session management
export class SessionService {
  static async create(token: string, userId: string, ttl: number = 7 * 24 * 60 * 60): Promise<void> {
    await CacheService.set(`session:${token}`, { userId, createdAt: new Date() }, ttl);
  }

  static async get(token: string): Promise<{ userId: string; createdAt: Date } | null> {
    return CacheService.get(`session:${token}`);
  }

  static async destroy(token: string): Promise<void> {
    await CacheService.delete(`session:${token}`);
  }

  static async destroyAllUserSessions(userId: string): Promise<void> {
    await CacheService.deletePattern(`session:*:${userId}`);
  }
}
