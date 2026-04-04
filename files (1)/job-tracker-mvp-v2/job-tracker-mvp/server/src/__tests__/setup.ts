/**
 * Jest Test Setup
 * Runs before all tests
 */

import { pool } from '../database/client';

// Set test environment
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret-key';

// Global test timeout
jest.setTimeout(10000);

// Cleanup after all tests
afterAll(async () => {
  await pool.end();
});
