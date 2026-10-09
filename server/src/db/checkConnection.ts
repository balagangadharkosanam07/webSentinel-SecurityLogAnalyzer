import { checkDatabaseConnection, pool } from './index.js';

async function main() {
  console.log('🔍 Testing PostgreSQL connection to Neon DB...');
  const result = await checkDatabaseConnection();

  if (result.connected) {
    console.log('🚀 Neon DB connection successful!');
    console.log(`   PostgreSQL Version: ${result.version}`);
  } else {
    console.error('❌ Connection failed:', result.error);
    process.exit(1);
  }

  await pool.end();
}

main().catch((err) => {
  console.error('Fatal connection check error:', err);
  process.exit(1);
});
