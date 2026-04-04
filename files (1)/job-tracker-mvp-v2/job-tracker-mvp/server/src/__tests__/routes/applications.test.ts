/**
 * Applications Routes Tests
 */

import request from 'supertest';
import express from 'express';
import applicationsRouter from '../../routes/applications.routes';
import { authMiddleware } from '../../middleware/auth.middleware';

// Mock auth middleware
jest.mock('../../middleware/auth.middleware', () => ({
  authMiddleware: (req: any, res: any, next: any) => {
    req.user = { id: 'test-user-id' };
    next();
  },
}));

const app = express();
app.use(express.json());
app.use('/api/applications', applicationsRouter);

describe('Applications API', () => {
  describe('GET /api/applications', () => {
    it('should return applications list', async () => {
      const response = await request(app)
        .get('/api/applications')
        .expect(200);

      expect(response.body).toHaveProperty('applications');
      expect(Array.isArray(response.body.applications)).toBe(true);
    });
  });

  describe('POST /api/applications', () => {
    it('should create a new application', async () => {
      const applicationData = {
        company: 'Test Company',
        position: 'Software Engineer',
        location: 'London, UK',
        status: 'APPLIED',
      };

      const response = await request(app)
        .post('/api/applications')
        .send(applicationData)
        .expect(201);

      expect(response.body).toHaveProperty('application');
      expect(response.body.application.company).toBe(applicationData.company);
    });

    it('should reject invalid data', async () => {
      const response = await request(app)
        .post('/api/applications')
        .send({ company: '' }) // Invalid: empty company
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });
  });
});
