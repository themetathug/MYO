import * as bcrypt from 'bcryptjs';
import { pool } from './client';

async function main() {
  console.log('🌱 Starting database seed...');

  // Minimal PG seed (Prisma has been removed from this codebase)
  const passwordHash = await bcrypt.hash('Demo123!', 12);
  const result = await pool.query(
    `INSERT INTO users (email, password_hash, first_name, last_name, weekly_target, monthly_target, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
     ON CONFLICT (email)
     DO UPDATE SET
       password_hash = EXCLUDED.password_hash,
       updated_at = NOW()
     RETURNING id, email`,
    ['demo@ukjobsinsider.com', passwordHash, 'Demo', 'User', 10, 40]
  );

  const user = result.rows[0];
  console.log(`✓ Seeded user: ${user.email}`);

  console.log('\n✅ Database seed completed successfully!');
  console.log('\n📝 Demo credentials:');
  console.log('  Email: demo@ukjobsinsider.com');
  console.log('  Password: Demo123!');
}

main()
  .catch((e) => {
    console.error('❌ Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await pool.end();
  });

