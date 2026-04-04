import { Router, Request, Response } from 'express';
import { pool } from '../database/client';
import { asyncHandler, AppError } from '../middleware/error.middleware';

const router = Router();

/**
 * GET /api/notifications
 * Get all notifications for the authenticated user
 */
router.get('/', asyncHandler(async (req: Request, res: Response) => {
  const userId = (req as any).user?.id;
  if (!userId) {
    throw new AppError('Unauthorized', 401, 'UNAUTHORIZED');
  }

    const { unreadOnly, limit } = req.query;
    const limitNum = limit ? parseInt(limit as string) : 50;

    let query = `
      SELECT 
        id,
        type,
        title,
        message,
        application_id,
        metadata,
        read,
        created_at
      FROM notifications
      WHERE user_id = $1
    `;
    const params: any[] = [userId];

    if (unreadOnly === 'true') {
      query += ' AND read = false';
    }

    query += ' ORDER BY created_at DESC LIMIT $2';
    params.push(limitNum);

    const result = await pool.query(query, params);

    // Get unread count
    const unreadResult = await pool.query(
      'SELECT COUNT(*) as count FROM notifications WHERE user_id = $1 AND read = false',
      [userId]
    );

    res.json({
      notifications: result.rows,
      unreadCount: parseInt(unreadResult.rows[0].count),
    });
}));

/**
 * POST /api/notifications/:id/read
 * Mark a notification as read
 */
router.post('/:id/read', asyncHandler(async (req: Request, res: Response) => {
    const userId = (req as any).user?.id;
    if (!userId) {
      throw new AppError('Unauthorized', 401, 'UNAUTHORIZED');
    }

    const { id } = req.params;

    // Verify notification belongs to user
    const checkResult = await pool.query(
      'SELECT id FROM notifications WHERE id = $1 AND user_id = $2',
      [id, userId]
    );

    if (checkResult.rows.length === 0) {
      throw new AppError('Notification not found', 404, 'NOT_FOUND');
    }

    await pool.query(
      'UPDATE notifications SET read = true WHERE id = $1',
      [id]
    );

    return res.json({ success: true });
}));

/**
 * POST /api/notifications/read-all
 * Mark all notifications as read for the user
 */
router.post('/read-all', asyncHandler(async (req: Request, res: Response) => {
    const userId = (req as any).user?.id;
    if (!userId) {
      throw new AppError('Unauthorized', 401, 'UNAUTHORIZED');
    }

    await pool.query(
      'UPDATE notifications SET read = true WHERE user_id = $1 AND read = false',
      [userId]
    );

    return res.json({ success: true });
}));

/**
 * DELETE /api/notifications/:id
 * Delete a notification
 */
router.delete('/:id', asyncHandler(async (req: Request, res: Response) => {
    const userId = (req as any).user?.id;
    if (!userId) {
      throw new AppError('Unauthorized', 401, 'UNAUTHORIZED');
    }

    const { id } = req.params;

    // Verify notification belongs to user
    const checkResult = await pool.query(
      'SELECT id FROM notifications WHERE id = $1 AND user_id = $2',
      [id, userId]
    );

    if (checkResult.rows.length === 0) {
      throw new AppError('Notification not found', 404, 'NOT_FOUND');
    }

    await pool.query('DELETE FROM notifications WHERE id = $1', [id]);

    return res.json({ success: true });
}));

export default router;
