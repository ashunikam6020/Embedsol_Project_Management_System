// Safe migration for an existing installation. Run: npm run db:migrate
const db = require('../config/db');
(async () => {
  await db.q(`CREATE TABLE IF NOT EXISTS daily_reports (
    id INT AUTO_INCREMENT PRIMARY KEY,
    employee_id INT NOT NULL,
    report_date DATE NOT NULL,
    summary TEXT NOT NULL,
    blockers TEXT,
    tomorrow_plan TEXT,
    status ENUM('DRAFT','SUBMITTED','REVIEWED','RETURNED') NOT NULL DEFAULT 'DRAFT',
    hr_comment TEXT,
    submitted_at DATETIME NULL,
    reviewed_by INT NULL,
    reviewed_at DATETIME NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE,
    FOREIGN KEY (reviewed_by) REFERENCES employees(id) ON DELETE SET NULL,
    UNIQUE KEY uq_daily_report_employee_date (employee_id, report_date),
    INDEX idx_daily_reports_date (report_date),
    INDEX idx_daily_reports_status (status)
  )`);
  // Hardware / Software team support (safe to run more than once)
  const T = "ENUM('HARDWARE','SOFTWARE','GENERAL') NOT NULL DEFAULT 'GENERAL'";
  await db.q(`ALTER TABLE employees ADD COLUMN IF NOT EXISTS work_type ${T}`);
  await db.q(`ALTER TABLE tasks ADD COLUMN IF NOT EXISTS task_type ${T}`);
  await db.q(`ALTER TABLE daily_task_logs ADD COLUMN IF NOT EXISTS work_type ${T}`);
  await db.q('ALTER TABLE daily_task_logs ADD COLUMN IF NOT EXISTS work_category VARCHAR(80) NULL');
  await db.q('ALTER TABLE daily_task_logs ADD COLUMN IF NOT EXISTS reference VARCHAR(150) NULL');
  await db.q('ALTER TABLE daily_task_logs ADD COLUMN IF NOT EXISTS tools_used VARCHAR(255) NULL');
  await db.q("ALTER TABLE daily_task_logs ADD COLUMN IF NOT EXISTS test_result ENUM('NA','PASS','FAIL','PARTIAL') NOT NULL DEFAULT 'NA'");
  await db.q("UPDATE tasks t JOIN employees e ON e.id = t.assigned_to SET t.task_type = e.work_type WHERE t.task_type = 'GENERAL' AND e.work_type <> 'GENERAL'");

  await db.q(`CREATE TABLE IF NOT EXISTS attendance (
    id INT AUTO_INCREMENT PRIMARY KEY,
    employee_id INT NOT NULL,
    attendance_date DATE NOT NULL,
    check_in DATETIME NULL,
    check_out DATETIME NULL,
    status ENUM('PRESENT','LATE','HALF_DAY','ABSENT') NOT NULL DEFAULT 'PRESENT',
    notes VARCHAR(500) NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE,
    UNIQUE KEY uq_attendance_employee_date (employee_id, attendance_date),
    INDEX idx_attendance_date (attendance_date)
  )`);
  await db.q(`CREATE TABLE IF NOT EXISTS task_comments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    task_id INT NOT NULL,
    user_id INT NOT NULL,
    comment TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_task_comments_task (task_id)
  )`);
  await db.q(`CREATE TABLE IF NOT EXISTS notifications (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    title VARCHAR(180) NOT NULL,
    message TEXT NOT NULL,
    type ENUM('INFO','TASK','REPORT','ATTENDANCE','SYSTEM') NOT NULL DEFAULT 'INFO',
    is_read TINYINT(1) NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_notifications_user_read (user_id, is_read)
  )`);
  await db.q(`CREATE TABLE IF NOT EXISTS audit_logs (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    actor_user_id INT NULL,
    action VARCHAR(100) NOT NULL,
    entity_type VARCHAR(80) NOT NULL,
    entity_id INT NULL,
    details TEXT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (actor_user_id) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_audit_created (created_at)
  )`);
  await db.q(`CREATE TABLE IF NOT EXISTS project_members (
    id INT AUTO_INCREMENT PRIMARY KEY,
    project_id INT NOT NULL,
    employee_id INT NOT NULL,
    member_role VARCHAR(100) NOT NULL DEFAULT 'MEMBER',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
    FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE,
    UNIQUE KEY uq_project_member (project_id, employee_id)
  )`);


  await db.q("ALTER TABLE projects ADD COLUMN IF NOT EXISTS project_type ENUM('HARDWARE','SOFTWARE','BOTH') NOT NULL DEFAULT 'BOTH'");
  await db.q('ALTER TABLE projects ADD COLUMN IF NOT EXISTS responsible_employee_id INT NULL');
  try { await db.q('ALTER TABLE projects ADD CONSTRAINT fk_projects_responsible_employee FOREIGN KEY (responsible_employee_id) REFERENCES employees(id) ON DELETE SET NULL'); } catch (e) { if (!String(e.message).includes('Duplicate')) throw e; }
  await db.q(`CREATE TABLE IF NOT EXISTS project_materials (
    id INT AUTO_INCREMENT PRIMARY KEY,
    project_id INT NOT NULL,
    material_type ENUM('HARDWARE','SOFTWARE') NOT NULL,
    material_name VARCHAR(200) NOT NULL,
    software_kind ENUM('LANGUAGE','FRAMEWORK','TOOL','DATABASE','OTHER') NULL,
    version VARCHAR(50) NULL,
    quantity DECIMAL(10,2) NULL,
    unit VARCHAR(50) NULL,
    remarks VARCHAR(500) NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
    INDEX idx_project_materials_project (project_id),
    INDEX idx_project_materials_type (material_type)
  )`);

  await db.q("ALTER TABLE project_materials ADD COLUMN IF NOT EXISTS software_kind ENUM('LANGUAGE','FRAMEWORK','TOOL','DATABASE','OTHER') NULL AFTER material_name");
  await db.q('ALTER TABLE project_materials ADD COLUMN IF NOT EXISTS version VARCHAR(50) NULL AFTER software_kind');
  console.log('Migration complete: daily reports, team types, attendance, comments, notifications, audit logs, project members and project technology fields are ready.');
  console.log('Next: open Employees and set each person as Hardware or Software.');
  await db.end();
})().catch((e) => { console.error('Migration failed:', e.message); process.exit(1); });
