import pg from 'pg';
const { Pool } = pg;

// Simple PostgreSQL connection WITHOUT Prisma
const pool = new Pool({
  user: 'postgres',
  password: 'postgres',
  host: 'localhost',
  port: 5432,
  database: 'jobtracker',
});

export const db = {
  query: (text: string, params?: any[]) => pool.query(text, params),
  pool: pool,
};

