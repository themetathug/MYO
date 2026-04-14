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
 * All rows that might authenticate this email (Prisma + raw `"User"` + legacy `users`).
 * Deduped by `id` so the same row is not checked twice; order is Prisma variants first.
 * Login must try `bcrypt.compare` against each until one matches (stale duplicate emails).
 */
export async function findLoginCandidatesByEmail(email: string): Promise<AuthUserRow[]> {
  const e = normalizeAuthEmail(email);
  const out: AuthUserRow[] = [];
  const seenIds = new Set<string>();

  const add = (row: AuthUserRow | null | undefined) => {
    if (!row?.id || !row.password_hash) return;
    if (seenIds.has(row.id)) return;
    seenIds.add(row.id);
    out.push(row);
  };

  try {
    const exact = await prisma.user.findUnique({ where: { email: e } });
    if (exact) add(mapPrismaUserToRow(exact));
  } catch (err: unknown) {
    logger.warn('[auth] prisma.user findUnique:', err);
  }

  try {
    const ci = await prisma.user.findFirst({
      where: { email: { equals: e, mode: 'insensitive' } },
    });
    if (ci) add(mapPrismaUserToRow(ci));
  } catch (err: unknown) {
    logger.warn('[auth] prisma.user findFirst (insensitive):', err);
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
       WHERE LOWER(TRIM(email)) = $1`,
      [e]
    );
    for (const row of r.rows ?? []) add(row);
  } catch (err: unknown) {
    const code = (err as { code?: string })?.code;
    if (code !== '42P01' && code !== '42703') {
      logger.warn('[auth] User table query:', err);
    }
  }

  try {
    const r = await pool.query<AuthUserRow>(
      `SELECT id::text AS id, email, password_hash,
              first_name, last_name,
              subscription::text AS subscription,
              weekly_target, monthly_target
       FROM users
       WHERE LOWER(TRIM(email)) = $1`,
      [e]
    );
    for (const row of r.rows ?? []) add(row);
  } catch (err: unknown) {
    const code = (err as { code?: string })?.code;
    if (code !== '42P01' && code !== '42703') {
      logger.warn('[auth] users table query:', err);
    }
  }

  return out;
}

/** Minimal row for JWT middleware: id, email, subscription. */
export type AuthUserJwtRow = {
  id: string;
  email: string;
  subscription: string;
};

/**
 * Load user by id for auth middleware. Prisma first, then SQL `"User"`, then `users`.
 */
export async function findUserByIdForAuth(userId: string): Promise<AuthUserJwtRow | null> {
  const id = typeof userId === 'string' ? userId.trim().toLowerCase() : '';
  if (!id) return null;

  try {
    const u = await prisma.user.findUnique({ where: { id } });
    if (u) {
      return {
        id: u.id,
        email: u.email,
        subscription: String(u.subscription),
      };
    }
  } catch (err: unknown) {
    logger.warn('[auth] prisma.user findUnique by id:', err);
  }

  try {
    const r = await pool.query<AuthUserJwtRow>(
      `SELECT id::text AS id, email, "subscription"::text AS subscription
       FROM "User"
       WHERE id = $1`,
      [id]
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
      [id]
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

/**
 * Insert user on register — Prisma `"User"` first (canonical for this codebase);
 * if that table is missing (legacy DB), fall back to init.sql `users`.
 */
export async function insertUserForAuth(params: {
  email: string;
  passwordHash: string;
  firstName: string | null;
  lastName: string | null;
  consentTracking?: boolean;
  consentAnalytics?: boolean;
}): Promise<AuthUserRow> {
  const { email, passwordHash, firstName, lastName, consentTracking, consentAnalytics } = params;

  try {
    const user = await prisma.user.create({
      data: {
        email,
        passwordHash,
        firstName: firstName ?? undefined,
        lastName: lastName ?? undefined,
        consentTracking: consentTracking ?? false,
        consentAnalytics: consentAnalytics ?? false,
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
