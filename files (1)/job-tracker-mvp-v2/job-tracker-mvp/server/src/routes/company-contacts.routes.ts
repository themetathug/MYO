import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { pool } from '../database/client';
import { logger } from '../utils/logger';
import { validateRequest } from '../middleware/validation.middleware';
import { asyncHandler, AppError } from '../middleware/error.middleware';

const router = Router();

const createCompanyContactSchema = z.object({
  company:        z.string().min(1).max(255),
  domain:         z.string().min(1).max(255),
  emailAddresses: z.array(z.string().email()).optional(),
  notes:          z.string().optional(),
});

const updateCompanyContactSchema = z.object({
  company:        z.string().min(1).max(255).optional(),
  domain:         z.string().min(1).max(255).optional(),
  emailAddresses: z.array(z.string().email()).optional(),
  isVerified:     z.boolean().optional(),
  notes:          z.string().optional(),
});

function formatContact(row: any) {
  return { ...row, emailAddresses: row.email_addresses || [] };
}

// ─── GET /api/company-contacts ────────────────────────────────────────────────

router.get('/', asyncHandler(async (req: Request, res: Response) => {
  const userId = (req as any).user?.id;
  if (!userId) throw new AppError('Unauthorized', 401, 'UNAUTHORIZED');

  const result = await pool.query(
    `SELECT id, company, domain, email_addresses, notes, is_verified, verified_at, last_contact_date, contact_count, created_at, updated_at
     FROM company_contacts WHERE user_id = $1 ORDER BY is_verified DESC, company ASC`,
    [userId]
  );

  return res.json({ contacts: result.rows.map(formatContact), count: result.rows.length });
}));

// ─── GET /api/company-contacts/:id ───────────────────────────────────────────

router.get('/:id', asyncHandler(async (req: Request, res: Response) => {
  const userId = (req as any).user?.id;
  if (!userId) throw new AppError('Unauthorized', 401, 'UNAUTHORIZED');

  const result = await pool.query(
    `SELECT id, company, domain, email_addresses, notes, is_verified, verified_at, last_contact_date, contact_count, created_at, updated_at
     FROM company_contacts WHERE id = $1 AND user_id = $2`,
    [req.params.id, userId]
  );

  if (result.rows.length === 0) throw new AppError('Company contact not found', 404, 'NOT_FOUND');

  return res.json({ contact: formatContact(result.rows[0]) });
}));

// ─── POST /api/company-contacts ───────────────────────────────────────────────

router.post('/', validateRequest(createCompanyContactSchema), asyncHandler(async (req: Request, res: Response) => {
  const userId = (req as any).user?.id;
  if (!userId) throw new AppError('Unauthorized', 401, 'UNAUTHORIZED');

  const { company, domain, emailAddresses, notes } = req.body;
  const normalDomain = domain.toLowerCase().trim();

  const existing = await pool.query(
    'SELECT id FROM company_contacts WHERE user_id = $1 AND domain = $2',
    [userId, normalDomain]
  );

  if (existing.rows.length > 0) {
    return res.status(409).json({
      error: 'Contact already exists',
      message: 'A contact for this domain already exists.',
      contact: existing.rows[0],
    });
  }

  const result = await pool.query(
    `INSERT INTO company_contacts (user_id, company, domain, email_addresses, notes, created_at, updated_at)
     VALUES ($1,$2,$3,$4,$5,NOW(),NOW()) RETURNING *`,
    [userId, company, normalDomain, emailAddresses ?? [], notes ?? null]
  );

  logger.info(`Company contact created: ${result.rows[0].id} for user ${userId}`);
  return res.status(201).json({ message: 'Company contact created', contact: formatContact(result.rows[0]) });
}));

// ─── Shared update handler ────────────────────────────────────────────────────

async function updateContact(req: Request, res: Response) {
  const userId = (req as any).user?.id;
  if (!userId) throw new AppError('Unauthorized', 401, 'UNAUTHORIZED');

  const { id } = req.params;
  const updates = req.body;

  const fields: string[] = [];
  const values: any[] = [];
  let i = 1;

  if (updates.company        !== undefined) { fields.push(`company = $${i++}`);        values.push(updates.company); }
  if (updates.domain         !== undefined) { fields.push(`domain = $${i++}`);         values.push(updates.domain.toLowerCase().trim()); }
  if (updates.emailAddresses !== undefined) { fields.push(`email_addresses = $${i++}`);values.push(updates.emailAddresses); }
  if (updates.notes          !== undefined) { fields.push(`notes = $${i++}`);          values.push(updates.notes); }
  if (updates.isVerified     !== undefined) {
    fields.push(`is_verified = $${i++}`);
    values.push(updates.isVerified);
    fields.push(updates.isVerified ? `verified_at = NOW()` : `verified_at = NULL`);
  }

  if (fields.length === 0) throw new AppError('No valid fields to update', 400, 'VALIDATION_ERROR');

  fields.push(`updated_at = NOW()`);
  values.push(id, userId);

  const result = await pool.query(
    `UPDATE company_contacts SET ${fields.join(', ')} WHERE id = $${i} AND user_id = $${i + 1} RETURNING *`,
    values
  );

  if (result.rows.length === 0) throw new AppError('Company contact not found', 404, 'NOT_FOUND');

  return res.json({ message: 'Company contact updated', contact: formatContact(result.rows[0]) });
}

// ─── PATCH /api/company-contacts/:id ─────────────────────────────────────────

router.patch('/:id', validateRequest(updateCompanyContactSchema), asyncHandler(updateContact));

// ─── PUT /api/company-contacts/:id  (alias) ───────────────────────────────────

router.put('/:id', validateRequest(updateCompanyContactSchema), asyncHandler(updateContact));

// ─── DELETE /api/company-contacts/:id ────────────────────────────────────────

router.delete('/:id', asyncHandler(async (req: Request, res: Response) => {
  const userId = (req as any).user?.id;
  if (!userId) throw new AppError('Unauthorized', 401, 'UNAUTHORIZED');

  const result = await pool.query(
    'DELETE FROM company_contacts WHERE id = $1 AND user_id = $2 RETURNING id',
    [req.params.id, userId]
  );

  if (result.rows.length === 0) throw new AppError('Company contact not found', 404, 'NOT_FOUND');

  return res.json({ message: 'Company contact deleted' });
}));

// ─── POST /api/company-contacts/:id/verify ───────────────────────────────────

router.post('/:id/verify', asyncHandler(async (req: Request, res: Response) => {
  const userId = (req as any).user?.id;
  if (!userId) throw new AppError('Unauthorized', 401, 'UNAUTHORIZED');

  const result = await pool.query(
    `UPDATE company_contacts SET is_verified = true, verified_at = NOW(), updated_at = NOW()
     WHERE id = $1 AND user_id = $2 RETURNING *`,
    [req.params.id, userId]
  );

  if (result.rows.length === 0) throw new AppError('Company contact not found', 404, 'NOT_FOUND');

  return res.json({ message: 'Company contact verified', contact: formatContact(result.rows[0]) });
}));

export default router;
