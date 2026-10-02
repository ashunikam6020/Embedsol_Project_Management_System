# Embedsol Technologies – Project & Task Management System

A complete Project, Task, Employee and Daily Work Management System with role-based access
(Administrator and Employee), dashboards and reports.

## Stack
- Frontend: React + Vite
- Backend: Node.js + Express.js
- Database: MariaDB
- Authentication: JWT + bcryptjs

## Features
1. Authentication (admin / employee login, change password)
2. Employee management (add, edit, activate/deactivate)
3. Project management with live task progress
4. Task management (assign, priority, status, dates, estimated vs actual hours, search & filters)
5. Daily work logs (date, hours, description, status, remarks)
6. Dashboard (KPIs, status breakdown, project progress, upcoming/overdue tasks)
7. Reports: project progress, employee tasks, overdue tasks, estimated vs actual effort (CSV export)

## Requirements
Node.js 18+ and MariaDB 10.5+

## Setup (first time)
```powershell
# 1. Backend
cd backend
copy .env.example .env        # then edit .env: DB_PASSWORD and JWT_SECRET
npm install
npm run db:init               # creates the database and tables
npm run seed                  # creates the first administrator
npm run seed:sample           # optional: sample projects, employees, tasks, logs
npm run dev                   # API on http://localhost:5000

# 2. Frontend (new terminal)
cd frontend
npm install
npm run dev                   # App on http://localhost:5173
```
(On macOS/Linux use `cp .env.example .env`.)

You can also create the database by running `database/schema.sql` in HeidiSQL instead of `npm run db:init`.

## Default logins (change them after first sign-in)
| Role | Login | Password |
|---|---|---|
| Administrator | admin@embedsol.com | Admin@123 |
| Employee (sample data only) | rahul@embedsol.com | Employee@123 |
| Employee (sample data only) | priya@embedsol.com | Employee@123 |

Change the admin login by setting `ADMIN_EMAIL` / `ADMIN_PASSWORD` in `.env` before `npm run seed`.

## Check it works
- API health: http://localhost:5000/api/health  (should show `database: connected`)
- App: http://localhost:5173

## Production build
```powershell
cd frontend
npm run build      # outputs frontend/dist
```
Set `VITE_API_URL` (e.g. `https://api.yourdomain.com/api`) before building if the API is on another domain,
and set `CORS_ORIGIN` in the backend `.env` to your frontend URL. Use a long random `JWT_SECRET`.

## Project structure
```text
embedsol-project-management-system/
├── backend/    Express API (routes, middleware, scripts)
├── frontend/   React app (pages, components)
├── database/   schema.sql
└── docs/       PHASES.md, API.md, BRANDING.md
```

## Hardware & Software teams, daily work and HR reports

Embedsol Technologies has Hardware employees and Software employees, so every employee has a **Team**
(Hardware / Software / General) and the daily work form changes to match.

| | Hardware employee | Software employee |
|---|---|---|
| Work categories | PCB design, firmware, hardware testing, assembly, calibration, debugging, field installation | Frontend, backend/API, database, bug fix, QA, DevOps, code review |
| Reference field | Device / board / serial no. | Module / ticket / commit |
| Tools field | Equipment / components used | Technology / tools used |
| Result field | Test result | Test / build result |

### Daily workflow
1. **Admin** adds the employee (**Employees → Add Employee**) and picks the **Team**. The employee gets a login (work email + password).
2. **Admin** creates a project and assigns tasks. The task type follows the assignee's team (Hardware / Software) unless you choose another.
3. **Employee** opens **My Daily Work**. The assigned tasks are **already listed for today, automatically**. For each task click **Log work**, enter hours and what was done (Hardware or Software form).
4. **Employee** clicks **Daily report to HR**. The report text is **auto-filled from the work just logged**; edit it, add tomorrow's plan, and submit.
5. **Admin** opens **Daily Reports / HR Review**. The **Team overview** shows, for any date, every Hardware and Software employee: open tasks, entries logged, hours and report status (employees who logged nothing show in red). Reports can be marked **Reviewed** or **Returned** with a comment.
6. **Reports → Hardware vs Software** compares the two teams (tasks, overdue, estimated vs logged hours).

Logging work updates the task's actual hours automatically; one entry per task, employee and day (saving again replaces it).

### Upgrading an existing installation
From the `backend` folder (safe to run more than once, your data is kept):
```powershell
npm run db:migrate
```
Then open **Employees → Edit** and set each person's Team to Hardware or Software. Their existing tasks follow the team automatically.
For a brand new database, `npm run db:init` creates everything.

### Sample accounts
```powershell
npm run seed:sample
```
`rahul@embedsol.com` (Hardware) and `priya@embedsol.com` (Software), password `Employee@123`.

## Can't log in?
From the `backend` folder:
```powershell
npm run check-admin                                          # shows which accounts exist and tests the admin password
npm run reset-password                                       # creates/resets admin@embedsol.com with Admin@123
npm run reset-password -- rahul@embedsol.com NewPass@123     # reset any other user
```
Also confirm `backend/.env` points to the database you ran `db:init` on and that http://localhost:5000/api/health shows `database: connected`.


## V4 additions
- Attendance: employee check-in/check-out and admin history.
- Task comments: simple task communication API.
- Notifications: in-app notification API and notification page.
- Audit log: administrator action history.
- Project members: project-level employee membership API.
- Database host default fixed to `127.0.0.1` for the local MariaDB setup used by this project.

Run `npm.cmd run db:migrate` from `backend` after extracting this version. Do not drop the existing database.


## V5 project requirements
- Project type: Hardware / Software / Hardware + Software
- Required responsible employee for each project
- Project-specific Hardware and Software material list
- Task Hardware/Software type retained
- Existing database migration supported
