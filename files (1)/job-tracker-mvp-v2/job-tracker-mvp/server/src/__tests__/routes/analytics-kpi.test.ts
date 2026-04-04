import express from 'express';
import request from 'supertest';
import analyticsRouter from '../../routes/analytics.routes';

jest.mock('../../database/client', () => ({
  pool: {
    query: jest.fn(),
  },
}));

const { pool } = require('../../database/client');

const app = express();
app.use(express.json());
app.use((req: any, _res, next) => {
  req.user = { id: 'test-user-id' };
  next();
});
app.use('/api/analytics', analyticsRouter);

describe('Analytics KPI routes', () => {
  beforeEach(() => {
    pool.query.mockReset();
  });

  it('returns ai status precision metrics', async () => {
    pool.query.mockResolvedValueOnce({
      rows: [{ confirmed: '8', corrected: '2', pending: '3' }],
    });

    const response = await request(app).get('/api/analytics/ai-status-kpi').expect(200);
    expect(response.body).toMatchObject({
      reviewed: 10,
      pending: 3,
      confirmed: 8,
      corrected: 2,
      precision: 80,
    });
  });

  it('returns recommendation adoption metrics', async () => {
    pool.query.mockResolvedValueOnce({
      rows: [
        { recommendation_type: 'cv_version', surface: 'dashboard', exposed: '10', clicked: '5', adopted: '3' },
      ],
    });

    const response = await request(app).get('/api/analytics/recommendations/adoption').expect(200);
    expect(response.body.totalExposed).toBe(10);
    expect(response.body.totalClicked).toBe(5);
    expect(response.body.totalAdopted).toBe(3);
    expect(response.body.adoptionRate).toBe(30);
    expect(response.body.breakdown[0].recommendationType).toBe('cv_version');
  });

  it('returns cv performance history with weekly deltas', async () => {
    pool.query.mockResolvedValueOnce({
      rows: [
        { cv_id: 'cv1', cv_name: 'Tech CV', week_start: '2026-02-02', applications: '5', interviews: '2', offers: '1', rejections: '1', responses: '3' },
        { cv_id: 'cv1', cv_name: 'Tech CV', week_start: '2026-02-09', applications: '4', interviews: '1', offers: '1', rejections: '0', responses: '2' },
      ],
    });

    const response = await request(app).get('/api/analytics/cv-performance/history?weeks=8').expect(200);
    expect(response.body.history.length).toBe(1);
    expect(response.body.history[0].cvName).toBe('Tech CV');
    expect(response.body.history[0].points.length).toBe(2);
    expect(response.body.history[0].weeklyDelta).not.toBeNull();
  });
});
