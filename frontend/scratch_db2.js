const { Client } = require('pg');

const client = new Client({
  host: '127.0.0.1',
  port: 5432,
  database: 'ccras_db',
  user: 'readonly',
  password: 'Read1234'
});

async function run() {
  try {
    await client.connect();
    console.log("Connected to local DB!");
    const res = await client.query("SELECT table_name FROM information_schema.tables WHERE table_schema='public'");
    console.log(res.rows.map(r => r.table_name));
    await client.end();
  } catch (e) {
    console.log("Failed to connect to local DB:", e.message);
  }
}

run();
