import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { pool } from '../database/client';
import { logger } from '../utils/logger';
import { validateRequest } from '../middleware/validation.middleware';
import { asyncHandler, AppError } from '../middleware/error.middleware';

const router = Router();

const createColdEmailSchema = z.object({
  recipientEmail: z.string().email(),
  recipientName:  z.string().optional(),
  company:        z.string().optional(),
  position:       z.string().optional(),
  location:       z.string().optional(),
  jobUrl:         z.string().url().optional(),
  subject:        z.string().optional(),
  message:        z.string().optional(),
});

const updateColdEmailSchema = z.object({
  responseDate:     z.string().datetime().optional(),
  responded:        z.boolean().optional(),
  conversionStatus: z.enum(['NO_RESPONSE', 'INTERESTED', 'NOT_INTERESTED', 'FOLLOW_UP']).optional(),
});

// ─── GET /api/cold-emails ─────────────────────────────────────────────────────

router.get('/', asyncHandler(async (req: Request, res: Response) => {
  const userId = (req as any).user?.id;
  if (!userId) throw new AppError('Unauthorized', 401, 'UNAUTHORIZED');

  const page  = Math.max(1, parseInt(req.query.page  as string) || 1);
  const limit = Math.max(1, Math.min(200, parseInt(req.query.limit as string) || 100));
  const offset = (page - 1) * limit;

  const [rows, countRow] = await Promise.all([
    pool.query(
      `SELECT * FROM cold_emails WHERE user_id = $1 ORDER BY sent_at DESC LIMIT $2 OFFSET $3`,
      [userId, limit, offset]
    ),
    pool.query('SELECT COUNT(*) FROM cold_emails WHERE user_id = $1', [userId]),
  ]);

  return res.json({
    coldEmails: rows.rows,
    pagination: {
      page, limit,
      total: parseInt(countRow.rows[0].count),
      totalPages: Math.ceil(parseInt(countRow.rows[0].count) / limit),
    },
  });
}));

// ─── POST /api/cold-emails ────────────────────────────────────────────────────

router.post('/', validateRequest(createColdEmailSchema), asyncHandler(async (req: Request, res: Response) => {
  const userId = (req as any).user?.id;
  if (!userId) throw new AppError('Unauthorized', 401, 'UNAUTHORIZED');

  const { recipientEmail, recipientName, company, position, location, jobUrl, subject, message } = req.body;

  const result = await pool.query(
    `INSERT INTO cold_emails
     (user_id, recipient_email, recipient_name, company, position, location, job_url, subject, message, sent_at, created_at, updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,NOW(),NOW(),NOW()) RETURNING *`,
    [userId, recipientEmail, recipientName ?? null, company ?? null,
     position ?? null, location ?? null, jobUrl ?? null, subject ?? null, message ?? null]
  );

  logger.info(`Cold email created: ${result.rows[0].id} for user ${userId}`);
  return res.status(201).json({ message: 'Cold email tracked successfully', coldEmail: result.rows[0] });
}));

// ─── PATCH /api/cold-emails/:id ───────────────────────────────────────────────

router.patch('/:id', validateRequest(updateColdEmailSchema), asyncHandler(async (req: Request, res: Response) => {
  const userId = (req as any).user?.id;
  if (!userId) throw new AppError('Unauthorized', 401, 'UNAUTHORIZED');

  const { id } = req.params;
  const updates = req.body;

  const existingResult = await pool.query(
    'SELECT sent_at FROM cold_emails WHERE id = $1 AND user_id = $2',
    [id, userId]
  );

  if (existingResult.rows.length === 0) {
    throw new AppError('Cold email not found', 404, 'NOT_FOUND');
  }

  const updateFields: string[] = [];
  const values: any[] = [];
  let idx = 1;

  if (updates.responseDate !== undefined) {
    updateFields.push(`response_date = $${idx++}`);
    values.push(updates.responseDate);

    const sentAt = new Date(existingResult.rows[0].sent_at);
    const responseDate = new Date(updates.responseDate);
    const hours = Math.round((responseDate.getTime() - sentAt.getTime()) / 3600000);
    updateFields.push(`response_time_hours = $${idx++}`);
    values.push(hours);
  }

  if (updates.responded !== undefined) {
    updateFields.push(`responded = $${idx++}`);
    values.push(updates.responded);
  }

  if (updates.conversionStatus !== undefined) {
    updateFields.push(`conversion_status = $${idx++}`);
    values.push(updates.conversionStatus);
  }

  if (updateFields.length === 0) {
    throw new AppError('No valid fields to update', 400, 'VALIDATION_ERROR');
  }

  updateFields.push(`updated_at = NOW()`);
  values.push(id, userId);

  const result = await pool.query(
    `UPDATE cold_emails SET ${updateFields.join(', ')} WHERE id = $${idx} AND user_id = $${idx + 1} RETURNING *`,
    values
  );

  return res.json({ message: 'Cold email updated successfully', coldEmail: result.rows[0] });
}));

// ─── DELETE /api/cold-emails/:id ─────────────────────────────────────────────

router.delete('/:id', asyncHandler(async (req: Request, res: Response) => {
  const userId = (req as any).user?.id;
  if (!userId) throw new AppError('Unauthorized', 401, 'UNAUTHORIZED');

  const { id } = req.params;
  const result = await pool.query(
    'DELETE FROM cold_emails WHERE id = $1 AND user_id = $2 RETURNING id',
    [id, userId]
  );

  if (result.rows.length === 0) throw new AppError('Cold email not found', 404, 'NOT_FOUND');

  return res.json({ message: 'Cold email deleted successfully' });
}));

export default router;
