import { Router } from 'express';
import { z } from 'zod';
import { pool } from '../database/client';
import { logger } from '../utils/logger';
import { validateRequest } from '../middleware/validation.middleware';

const router = Router();

// Validation schema
const createColdEmailSchema = z.object({
  recipientEmail: z.string().email(),
  recipientName: z.string().optional(),
  company: z.string().optional(),
  subject: z.string().optional(),
  message: z.string().optional(),
});

const updateColdEmailSchema = z.object({
  responseDate: z.string().datetime().optional(),
  responded: z.boolean().optional(),
  conversionStatus: z.enum(['NO_RESPONSE', 'INTERESTED', 'NOT_INTERESTED', 'FOLLOW_UP']).optional(),
});

// Get all cold emails
router.get('/', async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const result = await pool.query(
      `SELECT * FROM cold_emails 
       WHERE user_id = $1 
       ORDER BY sent_at DESC 
       LIMIT 100`,
      [userId]
    );

    return res.json({ coldEmails: result.rows });
  } catch (error) {
    logger.error('Error fetching cold emails:', error);
    return res.status(500).json({
      error: 'Failed to fetch cold emails',
      message: 'Unable to retrieve cold emails.',
    });
  }
});

// Create cold email
router.post('/', validateRequest(createColdEmailSchema), async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { recipientEmail, recipientName, company, subject, message } = req.body;

    const result = await pool.query(
      `INSERT INTO cold_emails 
       (user_id, recipient_email, recipient_name, company, subject, message, sent_at, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW(), NOW())
       RETURNING *`,
      [userId, recipientEmail, recipientName || null, company || null, subject || null, message || null]
    );

    logger.info(`Cold email created: ${result.rows[0].id} for user ${userId}`);

    return res.status(201).json({
      message: 'Cold email tracked successfully',
      coldEmail: result.rows[0],
    });
  } catch (error) {
    logger.error('Error creating cold email:', error);
    return res.status(500).json({
      error: 'Failed to create cold email',
      message: 'Unable to track cold email.',
    });
  }
});

// Update cold email (mark as responded)
router.patch('/:id', validateRequest(updateColdEmailSchema), async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;
    const updates = req.body;

    // Get existing email to calculate response time
    const existingResult = await pool.query(
      'SELECT sent_at FROM cold_emails WHERE id = $1 AND user_id = $2',
      [id, userId]
    );

    if (existingResult.rows.length === 0) {
      return res.status(404).json({
      error: 'Cold email not found',
      message: 'The requested cold email does not exist.',
    });
    }

    const sentAt = new Date(existingResult.rows[0].sent_at);
    let responseTimeHours = null;

    // If response date is set, calculate response time
    if (updates.responseDate) {
      const responseDate = new Date(updates.responseDate);
      responseTimeHours = Math.round((responseDate.getTime() - sentAt.getTime()) / (1000 * 60 * 60));
    }

    const updateFields: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    for (const [key, value] of Object.entries(updates)) {
      const dbKey = key === 'responseDate' ? 'response_date' :
                    key === 'recipientEmail' ? 'recipient_email' :
                    key === 'recipientName' ? 'recipient_name' :
                    key === 'conversionStatus' ? 'conversion_status' :
                    key.toLowerCase();

      if (value !== undefined) {
        updateFields.push(`${dbKey} = $${paramIndex}`);
        values.push(value);
        paramIndex++;
      }
    }

    if (responseTimeHours !== null) {
      updateFields.push(`response_time_hours = $${paramIndex}`);
      values.push(responseTimeHours);
      paramIndex++;
    }

    if (updateFields.length === 0) {
      return res.status(400).json({ error: 'No valid fields to update' });
    }

    updateFields.push(`updated_at = NOW()`);
    values.push(id, userId);

    const result = await pool.query(
      `UPDATE cold_emails 
       SET ${updateFields.join(', ')}
       WHERE id = $${paramIndex} AND user_id = $${paramIndex + 1}
       RETURNING *`,
      values
    );

    return res.json({
      message: 'Cold email updated successfully',
      coldEmail: result.rows[0],
    });
  } catch (error) {
    logger.error('Error updating cold email:', error);
    return res.status(500).json({
      error: 'Failed to update cold email',
      message: 'Unable to update cold email.',
    });
  }
});

// Delete cold email
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;

    const result = await pool.query(
      'DELETE FROM cold_emails WHERE id = $1 AND user_id = $2 RETURNING id',
      [id, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: 'Cold email not found',
        message: 'The requested cold email does not exist.',
      });
    }

    return res.json({
      message: 'Cold email deleted successfully',
    });
  } catch (error) {
    logger.error('Error deleting cold email:', error);
    return res.status(500).json({
      error: 'Failed to delete cold email',
      message: 'Unable to delete cold email.',
    });
  }
});

export default router;

