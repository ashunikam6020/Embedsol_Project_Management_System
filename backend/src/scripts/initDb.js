// Creates the database and tables from database/schema.sql
const fs = require('fs');
const path = require('path');
const mariadb = require('mariadb');
require('dotenv').config();

(async () => {
  const conn = await mariadb.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    multipleStatements: true
  });
  const sql = fs.readFileSync(path.join(__dirname, '../../../database/schema.sql'), 'utf8');
  await conn.query(sql);
  await conn.end();
  console.log('Database and tables are ready.');
})().catch((e) => { console.error('DB init failed:', e.message); process.exit(1); });
