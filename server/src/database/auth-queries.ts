import { Prisma } from '@prisma/client';
import { pool } from './client';
import { prisma } from './client';
import { logger } from '../utils/logger';

/** Match login/register input to stored emails regardless of case or accidental spaces. */
export function normalizeAuthEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** Row shape used by auth routes (normalized to snake_case keys). */
export type AuthUserRow = {
  id: string;
  email: string;
  password_hash: string;
  first_name: string | null;
  last_name: string | null;
  subscription: string | null;
  weekly_target: number | null;
  monthly_target: number | null;
  created_at?: Date;
};

/**
 * Find user for login. Supports both:
 * - init.sql style: table `users`, columns `password_hash`, etc.
 * - Prisma default: table "User", columns "passwordHash", etc.
 */
export async function findUserByEmailForAuth(email: string): Promise<AuthUserRow | null> {
  const e = email.toLowerCase();

  try {
    const r = await pool.query<AuthUserRow>(
      `SELECT id::text AS id, email, password_hash,
              first_name, last_name,
              subscription::text AS subscription,
              weekly_target, monthly_target
       FROM users
       WHERE email = $1`,
      [e]
    );
    if (r.rows?.length) return r.rows[0];
  } catch (err: unknown) {
    const code = (err as { code?: string })?.code;
    if (code !== '42P01' && code !== '42703') {
      logger.warn('[auth] users table query:', err);
    }
  }

  try {
    const r = await pool.query<AuthUserRow>(
      `SELECT id::text AS id, email,
              "passwordHash" AS password_hash,
              "firstName" AS first_name,
              "lastName" AS last_name,
              "subscription"::text AS subscription,
              "weeklyTarget" AS weekly_target,
              "monthlyTarget" AS monthly_target
       FROM "User"
       WHERE email = $1`,
      [e]
    );
    if (r.rows?.length) return r.rows[0];
  } catch (err: unknown) {
    const code = (err as { code?: string })?.code;
    if (code !== '42P01' && code !== '42703') {
      logger.warn('[auth] User table query:', err);
    }
  }

  return null;
}

/** Minimal row for JWT middleware: id, email, subscription. */
export type AuthUserJwtRow = {
  id: string;
  email: string;
  subscription: string;
};

/**
 * Load user by id for auth middleware. Supports `users` and Prisma `"User"`.
 */
export async function findUserByIdForAuth(userId: string): Promise<AuthUserJwtRow | null> {
  try {
    const r = await pool.query<AuthUserJwtRow>(
      `SELECT id::text AS id, email, "subscription"::text AS subscription
       FROM "User"
       WHERE id = $1`,
      [userId]
    );
    if (r.rows?.length) return r.rows[0];
  } catch (err: unknown) {
    const code = (err as { code?: string })?.code;
    if (code !== '42P01' && code !== '42703') {
      logger.warn('[auth] User id lookup:', err);
    }
  }

  try {
    const r = await pool.query<AuthUserJwtRow>(
      `SELECT id::text AS id, email, subscription::text AS subscription
       FROM users
       WHERE id = $1`,
      [userId]
    );
    if (r.rows?.length) return r.rows[0];
  } catch (err: unknown) {
    const code = (err as { code?: string })?.code;
    if (code !== '42P01' && code !== '42703') {
      logger.warn('[auth] users id lookup:', err);
    }
  }

  return null;
}

function mapPrismaUserToRow(user: {
  id: string;
  email: string;
  passwordHash: string;
  firstName: string | null;
  lastName: string | null;
  subscription: string;
  weeklyTarget: number;
  monthlyTarget: number;
}): AuthUserRow {
  return {
    id: user.id,
    email: user.email,
    password_hash: user.passwordHash,
    first_name: user.firstName,
    last_name: user.lastName,
    subscription: String(user.subscription),
    weekly_target: user.weeklyTarget,
    monthly_target: user.monthlyTarget,
  };
}

/**
 * Insert user on register — Prisma `"User"` first (canonical for this codebase);
 * if that table is missing (legacy DB), fall back to init.sql `users`.
 */
export async function insertUserForAuth(params: {
  email: string;
  passwordHash: string;
  firstName: string | null;
  lastName: string | null;
}): Promise<AuthUserRow> {
  const { email, passwordHash, firstName, lastName } = params;

  try {
    const user = await prisma.user.create({
      data: {
        email,
        passwordHash,
        firstName: firstName ?? undefined,
        lastName: lastName ?? undefined,
      },
    });
    const row = mapPrismaUserToRow(user);
    row.created_at = user.createdAt;
    return row;
  } catch (err: unknown) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      throw err;
    }
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2021') {
      logger.info('[auth] Prisma User table missing, using legacy users insert');
    } else if (err instanceof Prisma.PrismaClientKnownRequestError) {
      throw err;
    } else {
      throw err;
    }
  }

  try {
    const r = await pool.query<AuthUserRow & { created_at?: Date }>(
      `INSERT INTO users (email, password_hash, first_name, last_name, created_at, updated_at)
       VALUES ($1, $2, $3, $4, NOW(), NOW())
       RETURNING id::text AS id, email, password_hash, first_name, last_name,
                 subscription::text AS subscription, weekly_target, monthly_target, created_at`,
      [email, passwordHash, firstName, lastName]
    );
    if (r.rows?.length) return r.rows[0];
  } catch (err: unknown) {
    const code = (err as { code?: string })?.code;
    if (code !== '42P01' && code !== '42703') {
      throw err;
    }
  }

  throw new Error('Failed to create user: neither Prisma User nor legacy users table accepted the row');
}
