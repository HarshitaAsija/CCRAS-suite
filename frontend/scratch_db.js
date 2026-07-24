const { Client } = require('pg');

const client = new Client({
  host: '100.101.210.91',
  port: 5432,
  database: 'ccras_db',
  user: 'readonly',
  password: 'Read1234'
});

async function run() {
  await client.connect();
  const res = await client.query("SELECT table_name FROM information_schema.tables WHERE table_schema='public'");
  const tables = res.rows.map(r => r.table_name);
  for (const table of tables) {
    try {
      const countRes = await client.query(`SELECT count(*) FROM "${table}"`);
      console.log(`${table}: ${countRes.rows[0].count}`);
    } catch (e) {
      console.log(`${table}: ERROR`);
    }
  }
  await client.end();
}

run().catch(console.error);
