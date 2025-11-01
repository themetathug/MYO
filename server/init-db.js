// Quick database initialization script
const { Pool } = require('pg');

const pool = new Pool({
  host: 'localhost',
  port: 5432,
  database: 'postgres', // Connect to default database first
  user: 'postgres',
  password: 'Gowtham@1',
});

async function initDatabase() {
  try {
    console.log('🔌 Connecting to PostgreSQL...');
    
    // Check if jobtracker database exists
    const dbCheck = await pool.query(
      "SELECT 1 FROM pg_database WHERE datname = 'jobtracker'"
    );
    
    if (dbCheck.rows.length === 0) {
      console.log('📊 Creating database "jobtracker"...');
      await pool.query('CREATE DATABASE jobtracker');
      console.log('✅ Database created!');
    } else {
      console.log('✅ Database "jobtracker" already exists');
    }
    
    // Connect to jobtracker database
    pool.end();
    const jobtrackerPool = new Pool({
      host: 'localhost',
      port: 5432,
      database: 'jobtracker',
      user: 'postgres',
      password: 'Gowtham@1',
    });
    
    // Run initialization SQL
    console.log('📋 Initializing database schema...');
    const fs = require('fs');
    const path = require('path');
    const initSQL = fs.readFileSync(path.join(__dirname, 'src/database/init.sql'), 'utf8');
    await jobtrackerPool.query(initSQL);
    console.log('✅ Database schema initialized!');
    
    await jobtrackerPool.end();
    console.log('✅ Database setup complete!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('Full error:', error);
    process.exit(1);
  }
}

initDatabase();

