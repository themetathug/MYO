/**
 * ML Analytics Routes
 * AI-powered features using Python ML service
 */

import { Router } from 'express';
import { prisma } from '../database/client';
import { logger } from '../utils/logger';
import { PythonMLService } from '../services/python-ml.service';

const router = Router();

/**
 * Get AI job recommendations for user
 * GET /api/ml-analytics/recommendations
 */
router.get('/recommendations', async (req, res) => {
  try {
    const userId = req.user?.id;
    const { jobDescription } = req.query;

    if (!jobDescription) {
      return res.status(400).json({
        error: 'Job description required',
        message: 'Please provide a job description',
      });
    }

    // Get user's CV versions
    const cvVersions = await prisma.cVVersion.findMany({
      where: { userId },
      include: {
        _count: {
          select: { applications: true },
        },
      },
      orderBy: { isActive: 'desc' },
    });

    if (cvVersions.length === 0) {
      return res.json({
        recommendation: null,
        message: 'No CV versions found. Please upload a CV first.',
      });
    }

    // Get best matching CV version using AI
    const bestMatch = await PythonMLService.recommendCVVersion(
      jobDescription as string,
      cvVersions.map(cv => ({
        id: cv.id,
        name: cv.name,
        content: cv.fileName || '',
      }))
    );

    if (bestMatch) {
      // Calculate match details
      const recommendedCV = cvVersions.find(cv => cv.id === bestMatch.cvVersionId);
      
      return res.json({
        recommendation: {
          cvVersionId: bestMatch.cvVersionId,
          cvName: recommendedCV?.name || '',
          matchScore: bestMatch.score,
          successRate: recommendedCV?.conversionRate || 0,
          totalApplications: recommendedCV?._count.applications || 0,
        },
        message: `AI recommends using "${recommendedCV?.name}" for this application`,
      });
    }

    res.json({
      recommendation: null,
      message: 'No suitable CV version found for this job',
    });

  } catch (error) {
    logger.error('Error getting AI recommendations:', error);
    res.status(500).json({
      error: 'Failed to get recommendations',
      message: 'Unable to retrieve AI recommendations',
    });
  }
});

/**
 * Get CV analysis and optimization suggestions
 * POST /api/ml-analytics/analyze-cv
 */
router.post('/analyze-cv', async (req, res) => {
  try {
    const userId = req.user?.id;
    const { cvText, targetJob } = req.body;

    if (!cvText) {
      return res.status(400).json({
        error: 'CV text required',
        message: 'Please provide CV text to analyze',
      });
    }

    // Call Python ML service
    const analysis = await PythonMLService.analyzeCV({
      cv_text: cvText,
      target_job: targetJob,
    });

    res.json(analysis);

  } catch (error) {
    logger.error('Error analyzing CV:', error);
    res.status(500).json({
      error: 'Failed to analyze CV',
      message: 'Unable to analyze CV with AI',
    });
  }
});

/**
 * Predict application success probability
 * POST /api/ml-analytics/predict-success
 */
router.post('/predict-success', async (req, res) => {
  try {
    const userId = req.user?.id;
    const {
      applicationId,
      daysSincePosted,
      timeSpent,
      jobBoard,
    } = req.body;

    // Get application data
    const application = await prisma.application.findUnique({
      where: { id: applicationId },
      include: {
        cvVersion: true,
        user: {
          select: {
            _count: {
              select: {
                applications: {
                  where: {
                    status: {
                      in: ['INTERVIEW_SCHEDULED', 'INTERVIEWED', 'OFFERED', 'ACCEPTED'],
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!application || application.userId !== userId) {
      return res.status(404).json({
        error: 'Application not found',
      });
    }

    // Calculate previous success rate
    const totalApps = await prisma.application.count({
      where: { userId },
      where: { appliedAt: { lte: application.appliedAt } },
    });

    const successfulApps = totalApps > 0
      ? (application.user._count.applications / totalApps) * 100
      : 0;

    const cvVersionScore = application.cvVersion?.conversionRate || 0.5;

    // Call Python ML service
    const prediction = await PythonMLService.predictSuccess({
      days_since_posted: daysSincePosted || 1,
      cv_version_score: cvVersionScore / 100,
      time_spent: timeSpent || application.timeSpent || 0,
      previous_success_rate: successfulApps / 100,
      job_board: jobBoard || application.jobBoardSource || 'Other',
    });

    res.json({
      ...prediction,
      applicationId: application.id,
    });

  } catch (error) {
    logger.error('Error predicting success:', error);
    res.status(500).json({
      error: 'Failed to predict success',
      message: 'Unable to generate success prediction',
    });
  }
});

/**
 * Check Python ML service health
 * GET /api/ml-analytics/health
 */
router.get('/health', async (req, res) => {
  try {
    const isHealthy = await PythonMLService.healthCheck();
    
    res.json({
      service: 'python-ml',
      status: isHealthy ? 'healthy' : 'unavailable',
      connected: isHealthy,
    });
  } catch (error) {
    res.json({
      service: 'python-ml',
      status: 'unavailable',
      connected: false,
    });
  }
});

/**
 * Get AI-powered insights for user dashboard
 * GET /api/ml-analytics/insights
 */
router.get('/insights', async (req, res) => {
  try {
    const userId = req.user?.id;
    const period = parseInt(req.query.period as string) || 30;

    // Get user's applications
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - period);

    const applications = await prisma.application.findMany({
      where: {
        userId,
        appliedAt: { gte: startDate },
      },
      include: {
        cvVersion: true,
      },
    });

    // Get user's CV versions with performance
    const cvVersions = await prisma.cVVersion.findMany({
      where: { userId },
      include: {
        _count: {
          select: { applications: true },
        },
      },
    });

    // Calculate insights
    const insights = {
      totalApplications: applications.length,
      averageTimePerApp: applications.reduce((sum, app) => sum + (app.timeSpent || 0), 0) / applications.length,
      bestPerformingCV: cvVersions.reduce((best, cv) => 
        (cv.conversionRate || 0) > (best.conversionRate || 0) ? cv : best,
        cvVersions[0]
      ),
      recommendation: '',
    };

    // Generate AI recommendation
    if (applications.length > 0) {
      if (applications.length < 10) {
        insights.recommendation = '📈 Increase application volume to improve success chances';
      } else if (insights.averageTimePerApp < 300) {
        insights.recommendation = '⏱️ Spend more time tailoring each application';
      } else {
        insights.recommendation = '✅ Good application effort. Keep tracking and optimize!';
      }
    }

    res.json(insights);

  } catch (error) {
    logger.error('Error getting insights:', error);
    res.status(500).json({
      error: 'Failed to get insights',
      message: 'Unable to retrieve AI insights',
    });
  }
});

export default router;

