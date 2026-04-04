import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { pool } from '../database/client';
import { validateRequest } from '../middleware/validation.middleware';
import { asyncHandler, AppError } from '../middleware/error.middleware';

const router = Router();

// Validation schemas
const updateProfileSchema = z.object({
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  weeklyTarget: z.number().min(1).max(100).optional(),
  monthlyTarget: z.number().min(1).max(500).optional(),
});

const changePasswordSchema = z.object({
  currentPassword: z.string(),
  newPassword: z.string().min(8).max(100),
});

// Get user profile
router.get('/profile', asyncHandler(async (req: Request, res: Response) => {
    const userId = (req as any).user?.id;
    if (!userId) {
      throw new AppError('Unauthorized', 401, 'UNAUTHORIZED');
    }

    const result = await pool.query(
      `SELECT 
         u.id, u.email, u.first_name, u.last_name, u.subscription, 
         u.weekly_target, u.monthly_target, u.created_at,
         (SELECT COUNT(*) FROM applications WHERE user_id = u.id) as application_count,
         (SELECT COUNT(*) FROM cold_emails WHERE user_id = u.id) as cold_email_count,
         (SELECT COUNT(*) FROM cv_versions WHERE user_id = u.id) as cv_version_count
       FROM users u
       WHERE u.id = $1`,
      [userId]
    );

    if (result.rows.length === 0) {
      throw new AppError('User not found', 404, 'NOT_FOUND');
    }

    const user = result.rows[0];
    return res.json({
      id: user.id,
      email: user.email,
      firstName: user.first_name,
      lastName: user.last_name,
      subscription: user.subscription,
      weeklyTarget: user.weekly_target,
      monthlyTarget: user.monthly_target,
      createdAt: user.created_at,
      _count: {
        applications: parseInt(user.application_count || 0),
        coldEmails: parseInt(user.cold_email_count || 0),
        cvVersions: parseInt(user.cv_version_count || 0),
      },
    });
}));

// Update user profile
router.put('/profile', validateRequest(updateProfileSchema), asyncHandler(async (req: Request, res: Response) => {
    const userId = (req as any).user?.id;
    if (!userId) {
      throw new AppError('Unauthorized', 401, 'UNAUTHORIZED');
    }

    const { firstName, lastName, weeklyTarget, monthlyTarget } = req.body;

    const updates: string[] = [];
    const values: any[] = [];
    let paramIdx = 1;

    if (firstName !== undefined) {
      updates.push(`first_name = $${paramIdx++}`);
      values.push(firstName);
    }
    if (lastName !== undefined) {
      updates.push(`last_name = $${paramIdx++}`);
      values.push(lastName);
    }
    if (weeklyTarget !== undefined) {
      updates.push(`weekly_target = $${paramIdx++}`);
      values.push(weeklyTarget);
    }
    if (monthlyTarget !== undefined) {
      updates.push(`monthly_target = $${paramIdx++}`);
      values.push(monthlyTarget);
    }

    if (updates.length === 0) {
      throw new AppError('No fields to update', 400, 'VALIDATION_ERROR');
    }

    updates.push(`updated_at = NOW()`);
    values.push(userId);

    const result = await pool.query(
      `UPDATE users SET ${updates.join(', ')} WHERE id = $${paramIdx} 
       RETURNING id, email, first_name, last_name, subscription, weekly_target, monthly_target`,
      values
    );

    return res.json({
      message: 'Profile updated successfully',
      user: result.rows[0],
    });
}));

// Change password
router.put('/change-password', validateRequest(changePasswordSchema), asyncHandler(async (req: Request, res: Response) => {
    const userId = (req as any).user?.id;
    if (!userId) {
      throw new AppError('Unauthorized', 401, 'UNAUTHORIZED');
    }

    const { currentPassword, newPassword } = req.body;

    const userResult = await pool.query(
      'SELECT password_hash FROM users WHERE id = $1',
      [userId]
    );

    if (userResult.rows.length === 0) {
      throw new AppError('User not found', 404, 'NOT_FOUND');
    }

    const isValid = await bcrypt.compare(currentPassword, userResult.rows[0].password_hash);
    if (!isValid) {
      throw new AppError('Current password is incorrect', 401, 'UNAUTHORIZED');
    }

    const salt = await bcrypt.genSalt(12);
    const passwordHash = await bcrypt.hash(newPassword, salt);

    await pool.query(
      'UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2',
      [passwordHash, userId]
    );

    return res.json({ message: 'Password changed successfully. Please login again.' });
}));

// Get CV versions
router.get('/cv-versions', asyncHandler(async (req: Request, res: Response) => {
    const userId = (req as any).user?.id;
    if (!userId) {
      throw new AppError('Unauthorized', 401, 'UNAUTHORIZED');
    }

    const result = await pool.query(
      `SELECT 
         cv.*,
         (SELECT COUNT(*) FROM applications WHERE cv_version_id = cv.id) as application_count
       FROM cv_versions cv
       WHERE cv.user_id = $1
       ORDER BY cv.is_active DESC, cv.created_at DESC`,
      [userId]
    );

    return res.json(result.rows);
}));

// Create CV version
router.post('/cv-versions', asyncHandler(async (req: Request, res: Response) => {
    const userId = (req as any).user?.id;
    if (!userId) {
      throw new AppError('Unauthorized', 401, 'UNAUTHORIZED');
    }

    const { name, fileName, cvContent, isActive } = req.body;

    if (!name) {
      throw new AppError('Name is required', 400, 'VALIDATION_ERROR');
    }

    // If setting as active, deactivate other versions
    if (isActive) {
      await pool.query(
        'UPDATE cv_versions SET is_active = false WHERE user_id = $1',
        [userId]
      );
    }

    const result = await pool.query(
      `INSERT INTO cv_versions (user_id, name, file_name, cv_content, is_active, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
       RETURNING *`,
      [userId, name, fileName || null, cvContent || null, isActive || false]
    );

    return res.status(201).json({
      message: 'CV version created successfully',
      cvVersion: result.rows[0],
    });
}));

// Update CV version
router.put('/cv-versions/:id', asyncHandler(async (req: Request, res: Response) => {
    const userId = (req as any).user?.id;
    if (!userId) {
      throw new AppError('Unauthorized', 401, 'UNAUTHORIZED');
    }

    const { id } = req.params;
    const { name, fileName, cvContent, isActive } = req.body;

    // Check ownership
    const existing = await pool.query(
      'SELECT id FROM cv_versions WHERE id = $1 AND user_id = $2',
      [id, userId]
    );

    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'CV version not found' });
    }

    // If setting as active, deactivate other versions
    if (isActive) {
      await pool.query(
        'UPDATE cv_versions SET is_active = false WHERE user_id = $1 AND id != $2',
        [userId, id]
      );
    }

    const result = await pool.query(
      `UPDATE cv_versions 
       SET name = COALESCE($1, name), 
           file_name = COALESCE($2, file_name), 
           cv_content = COALESCE($3, cv_content),
           is_active = COALESCE($4, is_active), 
           updated_at = NOW()
       WHERE id = $5 AND user_id = $6
       RETURNING *`,
      [name, fileName, cvContent, isActive, id, userId]
    );

    return res.json({
      message: 'CV version updated successfully',
      cvVersion: result.rows[0],
    });
}));

// Delete CV version
router.delete('/cv-versions/:id', asyncHandler(async (req: Request, res: Response) => {
    const userId = (req as any).user?.id;
    if (!userId) {
      throw new AppError('Unauthorized', 401, 'UNAUTHORIZED');
    }

    const { id } = req.params;

    // Check ownership and linked applications
    const existing = await pool.query(
      `SELECT cv.id, 
              (SELECT COUNT(*) FROM applications WHERE cv_version_id = cv.id) as app_count
       FROM cv_versions cv
       WHERE cv.id = $1 AND cv.user_id = $2`,
      [id, userId]
    );

    if (existing.rows.length === 0) {
      throw new AppError('CV version not found', 404, 'NOT_FOUND');
    }

    if (parseInt(existing.rows[0].app_count) > 0) {
      throw new AppError('Cannot delete CV version - linked to existing applications', 400, 'VALIDATION_ERROR');
    }

    await pool.query('DELETE FROM cv_versions WHERE id = $1 AND user_id = $2', [id, userId]);

    return res.json({ message: 'CV version deleted successfully' });
}));

// Export user data (GDPR compliance)
router.get('/export', asyncHandler(async (req: Request, res: Response) => {
    const userId = (req as any).user?.id;
    if (!userId) {
      throw new AppError('Unauthorized', 401, 'UNAUTHORIZED');
    }

    const format = (req.query.format as string) || 'json';

    const { ExportService } = require('../services/export.service');
    const exportService = new ExportService();

    const exportData = await exportService.exportUserData(userId, {
      format: format as 'csv' | 'pdf' | 'json',
      includeApplications: true,
      includeColdEmails: true,
      includeAnalytics: true,
    });

    if (format === 'json') {
      res.setHeader('Content-Type', 'application/json');
      return res.send(exportData);
    } else if (format === 'csv') {
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="job-tracker-export-${Date.now()}.csv"`);
      return res.send(exportData);
    } else if (format === 'pdf') {
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="job-tracker-export-${Date.now()}.pdf"`);
      return res.send(exportData);
    } else {
      throw new AppError('Invalid format. Use json, csv, or pdf.', 400, 'VALIDATION_ERROR');
    }
}));

// Delete account (GDPR compliance)
router.delete('/account', asyncHandler(async (req: Request, res: Response) => {
    const userId = (req as any).user?.id;
    if (!userId) {
      throw new AppError('Unauthorized', 401, 'UNAUTHORIZED');
    }

    const { password } = req.body;
    if (!password) {
      throw new AppError('Password required to confirm account deletion', 400, 'VALIDATION_ERROR');
    }

    const userResult = await pool.query(
      'SELECT password_hash FROM users WHERE id = $1',
      [userId]
    );

    if (userResult.rows.length === 0) {
      throw new AppError('User not found', 404, 'NOT_FOUND');
    }

    const isValid = await bcrypt.compare(password, userResult.rows[0].password_hash);
    if (!isValid) {
      throw new AppError('Password is incorrect', 401, 'UNAUTHORIZED');
    }

    // Delete user (cascade will delete related data)
    await pool.query('DELETE FROM users WHERE id = $1', [userId]);

    return res.json({ message: 'Account deleted successfully' });
}));

export default router;
