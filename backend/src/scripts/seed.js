// npm run seed          -> creates the first administrator
// npm run seed:sample   -> also adds sample projects, employees, tasks and logs
const bcrypt = require('bcryptjs');
const db = require('../config/db');

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@embedsol.com';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'Admin@123';
const sample = process.argv.includes('--sample');

// Creates the user + employee, or repairs them if a previous run left them half-created.
// resetPassword = true also resets the password of an existing account.
async function addEmployee(conn, name, email, dept, desig, role, password, resetPassword = false, workType = 'GENERAL') {
  const hash = await bcrypt.hash(password, 10);
  let userId;
  const u = (await conn.query('SELECT id FROM users WHERE email = ? OR username = ?', [email, email]))[0];
  if (u) {
    userId = u.id;
    if (resetPassword) await conn.query('UPDATE users SET password_hash=?, role=?, is_active=1 WHERE id=?', [hash, role, userId]);
  } else {
    userId = (await conn.query('INSERT INTO users (username,email,password_hash,role) VALUES (?,?,?,?)', [email, email, hash, role])).insertId;
  }

  const ex = (await conn.query('SELECT id FROM employees WHERE work_email = ? OR user_id = ?', [email, userId]))[0];
  if (ex) {
    await conn.query('UPDATE employees SET user_id = ?, is_active = 1 WHERE id = ?', [userId, ex.id]);
    if (workType !== 'GENERAL') await conn.query('UPDATE employees SET work_type = ? WHERE id = ?', [workType, ex.id]);
    return ex.id;
  }
  const e = await conn.query('INSERT INTO employees (user_id,full_name,work_email,department,designation,work_type) VALUES (?,?,?,?,?,?)',
    [userId, name, email, dept, desig, workType]);
  await conn.query('UPDATE employees SET employee_code=? WHERE id=?', ['EMB' + String(e.insertId).padStart(4, '0'), e.insertId]);
  return e.insertId;
}

const d = (offset) => { const x = new Date(); x.setDate(x.getDate() + offset); return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`; };

(async () => {
  await db.tx(async (conn) => {
    const adminEmp = await addEmployee(conn, 'Admin User', ADMIN_EMAIL, 'Management', 'Administrator', 'ADMIN', ADMIN_PASSWORD, true);
    console.log(`Admin ready  ->  login: ${ADMIN_EMAIL}  password: ${ADMIN_PASSWORD}`);
    if (!sample) return;

    const rahul = await addEmployee(conn, 'Rahul Sharma', 'rahul@embedsol.com', 'Engineering', 'Hardware / Firmware Engineer', 'EMPLOYEE', 'Employee@123', false, 'HARDWARE');
    const priya = await addEmployee(conn, 'Priya Patel', 'priya@embedsol.com', 'Engineering', 'Backend Developer', 'EMPLOYEE', 'Employee@123', false, 'SOFTWARE');
    if ((await conn.query('SELECT COUNT(*) c FROM projects'))[0].c > 0) return console.log('Sample data skipped (projects already exist).');

    const admin = (await conn.query('SELECT user_id FROM employees WHERE id=?', [adminEmp]))[0].user_id;
    const proj = async (n, c, s, e, st) => (await conn.query(
      'INSERT INTO projects (project_name,client_category,start_date,end_date,status,created_by) VALUES (?,?,?,?,?,?)',
      [n, c, s, e, st, admin])).insertId;
    const p1 = await proj('IoT Energy Monitoring System', 'Energy', d(-20), d(30), 'ACTIVE');
    const p2 = await proj('Smart Gateway Firmware Update', 'Industrial IoT', d(-10), d(45), 'ACTIVE');
    const p3 = await proj('Centralized Water Monitoring', 'Utilities', d(-5), d(60), 'PLANNING');

    const task = async (p, t, a, pr, st, s, e, est) => (await conn.query(
      'INSERT INTO tasks (project_id,title,assigned_to,task_type,priority,status,start_date,end_date,estimated_hours) VALUES (?,?,?,?,?,?,?,?,?)',
      [p, t, a, a === rahul ? 'HARDWARE' : a === priya ? 'SOFTWARE' : 'GENERAL', pr, st, s, e, est])).insertId;
    const t1 = await task(p1, 'Design Energy Monitoring REST API', priya, 'HIGH', 'IN_PROGRESS', d(-15), d(-2), 40);
    await task(p1, 'Energy dashboard UI', priya, 'MEDIUM', 'NOT_STARTED', d(-1), d(12), 32);
    const t3 = await task(p2, 'Modbus RS485 Calibration Module', rahul, 'CRITICAL', 'IN_PROGRESS', d(-8), d(10), 24);
    await task(p2, 'OTA update bootloader', rahul, 'HIGH', 'NOT_STARTED', d(0), d(25), 60);
    await task(p3, 'Flow Rate Sensor Validation Test', rahul, 'MEDIUM', 'NOT_STARTED', d(3), d(20), 16);
    await task(p3, 'Requirements sign-off', null, 'LOW', 'COMPLETED', d(-5), d(-1), 8);

    const log = (t, e, off, desc, h, st, wt, cat, ref, tools, test) => conn.query(
      'INSERT INTO daily_task_logs (task_id,employee_id,log_date,work_description,hours,status,work_type,work_category,reference,tools_used,test_result) VALUES (?,?,?,?,?,?,?,?,?,?,?)',
      [t, e, d(off), desc, h, st, wt, cat, ref, tools, test]);
    await log(t1, priya, -3, 'Defined endpoints and request schemas', 6, 'WORKING', 'SOFTWARE', 'Backend / API', 'API-12', 'Node.js, Postman', 'PASS');
    await log(t1, priya, -1, 'Implemented meter readings endpoint', 7.5, 'WORKING', 'SOFTWARE', 'Backend / API', 'API-14', 'Node.js, MariaDB', 'PARTIAL');
    await log(t3, rahul, -2, 'Register map and CRC validation', 5, 'WORKING', 'HARDWARE', 'Firmware Development', 'Gateway board GW-01', 'RS485 adapter, logic analyzer', 'PASS');
    await conn.query('UPDATE tasks SET actual_hours = 13.5, actual_start_date = ? WHERE id = ?', [d(-3), t1]);
    await conn.query('UPDATE tasks SET actual_hours = 5, actual_start_date = ? WHERE id = ?', [d(-2), t3]);
    console.log('Sample data added. Employee login: rahul@embedsol.com / Employee@123');
  });
  await db.end();
})().catch((e) => { console.error('Seed failed:', e.message); process.exit(1); });
