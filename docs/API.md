# API Reference

Base URL: `http://localhost:5000/api`. Send `Authorization: Bearer <token>` on every request except login and health.
Responses look like `{ "success": true, "data": ... }` or `{ "success": false, "message": "..." }`.

| Method | Endpoint | Access | Purpose |
|---|---|---|---|
| GET | /health | public | API + database status |
| POST | /auth/login | public | `{ username, password }` → token |
| GET | /auth/me | any | Current user |
| POST | /auth/change-password | any | Change own password |
| GET | /employees | any* | List employees (*employees see active only) |
| POST | /employees | admin | Create employee + login account |
| PUT | /employees/:id | admin | Update employee (optional password reset) |
| PATCH | /employees/:id/status | admin | Activate / deactivate |
| GET | /projects | any | List with progress (employees: their projects) |
| GET | /projects/:id | any | Project details with tasks |
| POST / PUT / DELETE | /projects[/:id] | admin | Manage projects |
| GET | /tasks | any | List; filters: search, project_id, assigned_to, status, priority, overdue=1 |
| POST / PUT / DELETE | /tasks[/:id] | admin | Manage tasks |
| PATCH | /tasks/:id/progress | admin or assignee | Status, actual dates, actual hours |
| GET | /tasks/:id/logs | admin or assignee | Daily logs of a task |
| POST | /tasks/:id/logs | admin or assignee | Add/replace the day's log |
| GET | /logs | any | Daily work report; filters: from, to, employee_id, task_id, project_id |
| DELETE | /logs/:id | admin or owner | Delete a log |
| GET | /dashboard | any | KPIs (scoped to the user's role) |
| GET | /reports/projects, /employees, /overdue, /effort | admin | Reports |

## Daily reports and teams (added later)

| Method | Endpoint | Access | Purpose |
|---|---|---|---|
| GET | /daily-reports/my-day?date= | employee | Tasks added automatically for the day + today's entries + report |
| GET | /daily-reports/overview?date=&work_type= | admin | Team overview: entries, hours and report status per employee |
| GET | /daily-reports/today | employee | Today's report |
| GET | /daily-reports | any | Reports (employees: their own); filters: from, to, employee_id, status |
| POST | /daily-reports | employee | Submit or save a draft (one per day) |
| PATCH | /daily-reports/:id/review | admin | `{ status: REVIEWED or RETURNED, hr_comment }` |
| GET | /reports/teams | admin | Hardware vs Software comparison |

Extra fields: employees `work_type` (HARDWARE / SOFTWARE / GENERAL), tasks `task_type`, work logs
`work_type`, `work_category`, `reference`, `tools_used`, `test_result` (NA / PASS / FAIL / PARTIAL).
Filters: `/tasks?task_type=`, `/logs?work_type=`.
