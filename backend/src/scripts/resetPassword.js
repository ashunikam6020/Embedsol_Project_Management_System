// Usage:
//   npm run reset-password                          -> creates/resets the admin (ADMIN_EMAIL / ADMIN_PASSWORD from .env, default admin@embedsol.com / Admin@123)
//   npm run reset-password -- rahul@embedsol.com NewPass@123   -> resets any existing user
const bcrypt = require('bcryptjs');
const db = require('../config/db');

const adminEmail = (process.env.ADMIN_EMAIL || 'admin@embedsol.com').toLowerCase();
const email = (process.argv[2] || adminEmail).toLowerCase();
const password = process.argv[3] || (email === adminEmail ? process.env.ADMIN_PASSWORD || 'Admin@123' : null);

(async () => {
  if (!password || password.length < 6) throw new Error('Give a password of at least 6 characters: npm run reset-password -- <email> <newPassword>');
  const hash = await bcrypt.hash(password, 10);

  await db.tx(async (conn) => {
    const u = (await conn.query('SELECT id FROM users WHERE email = ? OR username = ?', [email, email]))[0];
    if (u) {
      await conn.query('UPDATE users SET password_hash=?, is_active=1 WHERE id=?', [hash, u.id]);
      await conn.query('UPDATE employees SET is_active=1 WHERE user_id=?', [u.id]);
      console.log(`Password reset for ${email}`);
    } else if (email === adminEmail) {
      const r = await conn.query('INSERT INTO users (username,email,password_hash,role) VALUES (?,?,?,?)', [email, email, hash, 'ADMIN']);
      const e = await conn.query(
        'INSERT INTO employees (user_id,full_name,work_email,department,designation) VALUES (?,?,?,?,?)',
        [r.insertId, 'Admin User', email, 'Management', 'Administrator']);
      await conn.query('UPDATE employees SET employee_code=? WHERE id=?', ['EMB' + String(e.insertId).padStart(4, '0'), e.insertId]);
      console.log(`Admin account created: ${email}`);
    } else {
      throw new Error(`No user found with email ${email}`);
    }
  });

  console.log(`Login now with  ${email}  /  ${password}`);
  const users = await db.q('SELECT email, role, is_active FROM users ORDER BY id');
  console.log('\nAccounts in this database:');
  users.forEach((x) => console.log(` - ${x.email}  (${x.role}${x.is_active ? '' : ', INACTIVE'})`));
  await db.end();
})().catch((e) => { console.error('Failed:', e.message); process.exit(1); });
