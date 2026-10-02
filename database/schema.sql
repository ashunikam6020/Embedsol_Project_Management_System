CREATE DATABASE IF NOT EXISTS embedsol_project_management_db;
USE embedsol_project_management_db;

CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(100) NOT NULL UNIQUE,
  email VARCHAR(150) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role ENUM('ADMIN','EMPLOYEE') NOT NULL DEFAULT 'EMPLOYEE',
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS employees (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NULL UNIQUE,
  employee_code VARCHAR(50) UNIQUE,
  full_name VARCHAR(150) NOT NULL,
  work_email VARCHAR(150) NOT NULL UNIQUE,
  department VARCHAR(100),
  designation VARCHAR(100),
  work_type ENUM('HARDWARE','SOFTWARE','GENERAL') NOT NULL DEFAULT 'GENERAL',
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS projects (
  id INT AUTO_INCREMENT PRIMARY KEY,
  project_name VARCHAR(200) NOT NULL,
  client_category VARCHAR(150),
  description TEXT,
  start_date DATE,
  end_date DATE,
  status ENUM('PLANNING','ACTIVE','ON_HOLD','COMPLETED','CANCELLED') DEFAULT 'PLANNING',
  project_type ENUM('HARDWARE','SOFTWARE','BOTH') NOT NULL DEFAULT 'BOTH',
  responsible_employee_id INT NULL,
  created_by INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (responsible_employee_id) REFERENCES employees(id) ON DELETE SET NULL,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
);


CREATE TABLE IF NOT EXISTS project_materials (
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
);

CREATE TABLE IF NOT EXISTS tasks (
  id INT AUTO_INCREMENT PRIMARY KEY,
  project_id INT NOT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  assigned_to INT,
  task_type ENUM('HARDWARE','SOFTWARE','GENERAL') NOT NULL DEFAULT 'GENERAL',
  priority ENUM('LOW','MEDIUM','HIGH','CRITICAL') DEFAULT 'MEDIUM',
  status ENUM('NOT_STARTED','IN_PROGRESS','ON_HOLD','COMPLETED') DEFAULT 'NOT_STARTED',
  start_date DATE,
  end_date DATE,
  estimated_hours DECIMAL(8,2) DEFAULT 0,
  actual_hours DECIMAL(8,2) DEFAULT 0,
  actual_start_date DATE NULL,
  actual_end_date DATE NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
  FOREIGN KEY (assigned_to) REFERENCES employees(id) ON DELETE SET NULL,
  INDEX idx_tasks_project (project_id),
  INDEX idx_tasks_assigned (assigned_to),
  INDEX idx_tasks_status (status),
  INDEX idx_tasks_end_date (end_date)
);

CREATE TABLE IF NOT EXISTS daily_task_logs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  task_id INT NOT NULL,
  employee_id INT NOT NULL,
  log_date DATE NOT NULL,
  work_description TEXT NOT NULL,
  hours DECIMAL(6,2) NOT NULL DEFAULT 0,
  status ENUM('WORKING','COMPLETED','BLOCKED') DEFAULT 'WORKING',
  remarks TEXT,
  work_type ENUM('HARDWARE','SOFTWARE','GENERAL') NOT NULL DEFAULT 'GENERAL',
  work_category VARCHAR(80) NULL,
  reference VARCHAR(150) NULL,
  tools_used VARCHAR(255) NULL,
  test_result ENUM('NA','PASS','FAIL','PARTIAL') NOT NULL DEFAULT 'NA',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
  FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE,
  UNIQUE KEY uq_daily_task_employee (task_id, employee_id, log_date)
);


CREATE TABLE IF NOT EXISTS daily_reports (
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
);


-- Attendance
CREATE TABLE IF NOT EXISTS attendance (
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
);

-- Task comments / communication
CREATE TABLE IF NOT EXISTS task_comments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  task_id INT NOT NULL,
  user_id INT NOT NULL,
  comment TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_task_comments_task (task_id),
  INDEX idx_task_comments_created (created_at)
);

-- In-app notifications
CREATE TABLE IF NOT EXISTS notifications (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  title VARCHAR(180) NOT NULL,
  message TEXT NOT NULL,
  type ENUM('INFO','TASK','REPORT','ATTENDANCE','SYSTEM') NOT NULL DEFAULT 'INFO',
  is_read TINYINT(1) NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_notifications_user_read (user_id, is_read),
  INDEX idx_notifications_created (created_at)
);

-- Audit trail
CREATE TABLE IF NOT EXISTS audit_logs (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  actor_user_id INT NULL,
  action VARCHAR(100) NOT NULL,
  entity_type VARCHAR(80) NOT NULL,
  entity_id INT NULL,
  details TEXT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (actor_user_id) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_audit_created (created_at),
  INDEX idx_audit_entity (entity_type, entity_id)
);

-- Project-level team membership
CREATE TABLE IF NOT EXISTS project_members (
  id INT AUTO_INCREMENT PRIMARY KEY,
  project_id INT NOT NULL,
  employee_id INT NOT NULL,
  member_role VARCHAR(100) NOT NULL DEFAULT 'MEMBER',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
  FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE,
  UNIQUE KEY uq_project_member (project_id, employee_id)
);
