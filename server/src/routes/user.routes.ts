import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma } from '../database/client';
import { logger } from '../utils/logger';
import { validateRequest } from '../middleware/validation.middleware';
import { CacheService } from '../services/redis.service';

const router = Router();

// Validation schemas
const updateProfileSchema = z.object({
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  weeklyTarget: z.number().min(1).max(100).optional(),
  monthlyTarget: z.number().min(1).max(500).optional(),
  profileData: z.record(z.any()).optional(),
});

const updatePreferencesSchema = z.object({
  emailNotifications: z.boolean().optional(),
  weeklyReport: z.boolean().optional(),
  dataSharing: z.boolean().optional(),
  consentTracking: z.boolean().optional(),
  consentAnalytics: z.boolean().optional(),
});

const changePasswordSchema = z.object({
  currentPassword: z.string(),
  newPassword: z.string().min(8).max(100),
});

// Get user profile
router.get('/profile', async (req, res) => {
  try {
    const userId = req.user?.id;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        subscription: true,
        weeklyTarget: true,
        monthlyTarget: true,
        consentTracking: true,
        consentAnalytics: true,
        profileData: true,
        createdAt: true,
        lastActiveAt: true,
        _count: {
          select: {
            applications: true,
            cvVersions: true,
            coldEmails: true,
          },
        },
      },
    });

    if (!user) {
      return res.status(404).json({
        error: 'User not found',
        message: 'User profile not found',
      });
    }

    res.json(user);
  } catch (error) {
    logger.error('Error fetching user profile:', error);
    res.status(500).json({
      error: 'Failed to fetch profile',
      message: 'Unable to retrieve user profile',
    });
  }
});

// Update user profile
router.put('/profile', validateRequest(updateProfileSchema), async (req, res) => {
  try {
    const userId = req.user?.id;
    const updates = req.body;

    const user = await prisma.user.update({
      where: { id: userId },
      data: updates,
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        subscription: true,
        weeklyTarget: true,
        monthlyTarget: true,
        profileData: true,
      },
    });

    // Clear user cache
    await CacheService.deletePattern(`*:${userId}:*`);

    res.json({
      message: 'Profile updated successfully',
      user,
    });
  } catch (error) {
    logger.error('Error updating user profile:', error);
    res.status(500).json({
      error: 'Failed to update profile',
      message: 'Unable to update user profile',
    });
  }
});

// Update preferences
router.put('/preferences', validateRequest(updatePreferencesSchema), async (req, res) => {
  try {
    const userId = req.user?.id;
    const preferences = req.body;

    // Store preferences in profileData
    const user = await prisma.user.update({
      where: { id: userId },
      data: {
        consentTracking: preferences.consentTracking,
        consentAnalytics: preferences.consentAnalytics,
        profileData: {
          ...(await prisma.user.findUnique({ where: { id: userId } }))?.profileData as any,
          preferences: {
            emailNotifications: preferences.emailNotifications,
            weeklyReport: preferences.weeklyReport,
            dataSharing: preferences.dataSharing,
          },
        },
      },
    });

    res.json({
      message: 'Preferences updated successfully',
      preferences,
    });
  } catch (error) {
    logger.error('Error updating preferences:', error);
    res.status(500).json({
      error: 'Failed to update preferences',
      message: 'Unable to update preferences',
    });
  }
});

// Change password
router.put('/change-password', validateRequest(changePasswordSchema), async (req, res) => {
  try {
    const userId = req.user?.id;
    const { currentPassword, newPassword } = req.body;

    // Get user with password
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { passwordHash: true },
    });

    if (!user) {
      return res.status(404).json({
        error: 'User not found',
        message: 'User not found',
      });
    }

    // Verify current password
    const isValid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!isValid) {
      return res.status(401).json({
        error: 'Invalid password',
        message: 'Current password is incorrect',
      });
    }

    // Hash new password
    const salt = await bcrypt.genSalt(12);
    const passwordHash = await bcrypt.hash(newPassword, salt);

    // Update password
    await prisma.user.update({
      where: { id: userId },
      data: { passwordHash },
    });

    // Invalidate all sessions
    await prisma.session.deleteMany({
      where: { userId },
    });

    res.json({
      message: 'Password changed successfully. Please login again.',
    });
  } catch (error) {
    logger.error('Error changing password:', error);
    res.status(500).json({
      error: 'Failed to change password',
      message: 'Unable to change password',
    });
  }
});

// Get CV versions
router.get('/cv-versions', async (req, res) => {
  try {
    const userId = req.user?.id;

    const cvVersions = await prisma.cVVersion.findMany({
      where: { userId },
      include: {
        _count: {
          select: { applications: true },
        },
      },
      orderBy: [{ isActive: 'desc' }, { createdAt: 'desc' }],
    });

    res.json(cvVersions);
  } catch (error) {
    logger.error('Error fetching CV versions:', error);
    res.status(500).json({
      error: 'Failed to fetch CV versions',
      message: 'Unable to retrieve CV versions',
    });
  }
});

// Create CV version
router.post('/cv-versions', async (req, res) => {
  try {
    const userId = req.user?.id;
    const { name, fileName, isActive } = req.body;

    // If setting as active, deactivate other versions
    if (isActive) {
      await prisma.cVVersion.updateMany({
        where: { userId },
        data: { isActive: false },
      });
    }

    // Get the next version number
    const existingVersions = await prisma.cVVersion.count({
      where: { userId, name },
    });

    const cvVersion = await prisma.cVVersion.create({
      data: {
        userId,
        name,
        fileName,
        version: existingVersions + 1,
        isActive: isActive || false,
      },
    });

    res.status(201).json({
      message: 'CV version created successfully',
      cvVersion,
    });
  } catch (error) {
    logger.error('Error creating CV version:', error);
    res.status(500).json({
      error: 'Failed to create CV version',
      message: 'Unable to create CV version',
    });
  }
});

// Update CV version
router.put('/cv-versions/:id', async (req, res) => {
  try {
    const userId = req.user?.id;
    const { id } = req.params;
    const { name, fileName, isActive } = req.body;

    // Check ownership
    const cvVersion = await prisma.cVVersion.findFirst({
      where: { id, userId },
    });

    if (!cvVersion) {
      return res.status(404).json({
        error: 'CV version not found',
        message: 'CV version not found',
      });
    }

    // If setting as active, deactivate other versions
    if (isActive) {
      await prisma.cVVersion.updateMany({
        where: { userId, id: { not: id } },
        data: { isActive: false },
      });
    }

    const updated = await prisma.cVVersion.update({
      where: { id },
      data: { name, fileName, isActive },
    });

    res.json({
      message: 'CV version updated successfully',
      cvVersion: updated,
    });
  } catch (error) {
    logger.error('Error updating CV version:', error);
    res.status(500).json({
      error: 'Failed to update CV version',
      message: 'Unable to update CV version',
    });
  }
});

// Delete CV version
router.delete('/cv-versions/:id', async (req, res) => {
  try {
    const userId = req.user?.id;
    const { id } = req.params;

    // Check ownership
    const cvVersion = await prisma.cVVersion.findFirst({
      where: { id, userId },
      include: {
        _count: { select: { applications: true } },
      },
    });

    if (!cvVersion) {
      return res.status(404).json({
        error: 'CV version not found',
        message: 'CV version not found',
      });
    }

    if (cvVersion._count.applications > 0) {
      return res.status(400).json({
        error: 'Cannot delete CV version',
        message: 'This CV version is linked to existing applications',
      });
    }

    await prisma.cVVersion.delete({
      where: { id },
    });

    res.json({
      message: 'CV version deleted successfully',
    });
  } catch (error) {
    logger.error('Error deleting CV version:', error);
    res.status(500).json({
      error: 'Failed to delete CV version',
      message: 'Unable to delete CV version',
    });
  }
});

// Export user data (GDPR compliance)
router.get('/export', async (req, res) => {
  try {
    const userId = req.user?.id;
    const format = req.query.format || 'json';

    const userData = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        applications: {
          include: {
            events: true,
            cvVersion: true,
          },
        },
        cvVersions: true,
        coldEmails: true,
        analytics: true,
        streaks: true,
      },
    });

    if (format === 'json') {
      res.json(userData);
    } else {
      // TODO: Implement CSV/PDF export
      res.status(501).json({
        error: 'Not implemented',
        message: `Export format ${format} not yet implemented`,
      });
    }
  } catch (error) {
    logger.error('Error exporting user data:', error);
    res.status(500).json({
      error: 'Failed to export data',
      message: 'Unable to export user data',
    });
  }
});

// Delete account (GDPR compliance)
router.delete('/account', async (req, res) => {
  try {
    const userId = req.user?.id;
    const { password } = req.body;

    if (!password) {
      return res.status(400).json({
        error: 'Password required',
        message: 'Please provide your password to confirm account deletion',
      });
    }

    // Verify password
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { passwordHash: true },
    });

    if (!user) {
      return res.status(404).json({
        error: 'User not found',
        message: 'User not found',
      });
    }

    const isValid = await bcrypt.compare(password, user.passwordHash);
    if (!isValid) {
      return res.status(401).json({
        error: 'Invalid password',
        message: 'Password is incorrect',
      });
    }

    // Delete user and all related data (cascade)
    await prisma.user.delete({
      where: { id: userId },
    });

    // Clear all caches
    await CacheService.deletePattern(`*:${userId}:*`);

    res.json({
      message: 'Account deleted successfully',
    });
  } catch (error) {
    logger.error('Error deleting account:', error);
    res.status(500).json({
      error: 'Failed to delete account',
      message: 'Unable to delete account',
    });
  }
});

export default router;
