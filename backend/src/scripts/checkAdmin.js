// node src/scripts/checkAdmin.js         -> shows what the backend sees and tests the admin password
// node src/scripts/checkAdmin.js --fix   -> also resets the admin password and repairs the account
const bcrypt = require('bcryptjs');
require('dotenv').config();
const db = require('../config/db');

const EMAIL = process.env.ADMIN_EMAIL || 'admin@embedsol.com';
const PASSWORD = process.env.ADMIN_PASSWORD || 'Admin@123';
const fix = process.argv.includes('--fix');

(async () => {
  console.log('Database :', process.env.DB_HOST, '/', process.env.DB_NAME, '(user ' + process.env.DB_USER + ')');
  console.log('Checking :', EMAIL, ' password from .env/default:', PASSWORD);
  const users = await db.q(
    `SELECT u.id, u.username, u.email, u.role, u.is_active, u.password_hash, e.id AS employee_id, e.is_active AS employee_active
       FROM users u LEFT JOIN employees e ON e.user_id = u.id`);
  console.log('\nUsers in this database:', users.length);
  for (const u of users) {
    console.log(` - id=${u.id} ${u.email} role=${u.role} active=${u.is_active} employee=${u.employee_id ?? 'MISSING'} employee_active=${u.employee_active ?? '-'}`);
  }
  const admin = users.find((u) => u.email === EMAIL || u.username === EMAIL);
  if (!admin) console.log('\nRESULT: no user with that email. Run: npm run seed');
  else {
    const ok = await bcrypt.compare(PASSWORD, admin.password_hash);
    console.log(`\nPassword matches: ${ok ? 'YES' : 'NO'}`);
    if (!admin.is_active) console.log('Account is deactivated.');
    if (!admin.employee_id) console.log('Employee record is missing.');
    if (fix) {
      await db.q('UPDATE users SET password_hash=?, is_active=1, role=? WHERE id=?', [await bcrypt.hash(PASSWORD, 10), 'ADMIN', admin.id]);
      if (admin.employee_id) await db.q('UPDATE employees SET is_active=1 WHERE id=?', [admin.employee_id]);
      console.log(`FIXED: you can now sign in with  ${EMAIL}  /  ${PASSWORD}`);
    } else if (!ok) console.log('Run again with --fix to reset the password.');
  }
  await db.end();
})().catch((e) => { console.error('Check failed:', e.message); process.exit(1); });