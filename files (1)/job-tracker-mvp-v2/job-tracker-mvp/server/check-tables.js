const { Pool } = require('pg');
const pool = new Pool({
  host: 'localhost', port: 5432, database: 'jobtracker', user: 'postgres', password: 'postgres'
});
pool.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name")
  .then(r => { 
    console.log('TABLES:', r.rows.map(x => x.table_name).join(', ')); 
    return pool.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'auth_sessions'");
  })
  .then(r => { 
    console.log('auth_sessions columns:', r.rows.map(x => x.column_name).join(', ') || 'TABLE MISSING'); 
    pool.end(); 
  })
  .catch(e => { console.error('ERROR:', e.message); pool.end(); process.exit(1); });
