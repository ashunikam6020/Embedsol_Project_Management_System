# Development Phases – Status

| Phase | Scope | Status |
|-------|-------|--------|
| 1 | Project setup: repo structure, React frontend, Express backend, MariaDB schema, environment config | ✅ Complete |
| 2 | Authentication: admin/employee login, JWT, bcryptjs, role-based access, change password | ✅ Complete |
| 3 | Employee management: add, list, edit, activate/deactivate, password reset | ✅ Complete |
| 4 | Project management: create, list, details, edit, delete, progress | ✅ Complete |
| 5 | Task management: create, assign, priority/status, dates, estimated effort, update, delete, search & filters | ✅ Complete |
| 6 | Daily task management: daily work logs, hours, description, status, remarks (auto-updates task actual hours) | ✅ Complete |
| 7 | Dashboards & reports: admin/employee dashboard, KPIs, project progress, 4 reports with CSV export | ✅ Complete |
| 8 | Testing & deployment: API tested end-to-end, error handling, seed scripts, documentation | ✅ Complete |
| 9 | Employee daily report: one report per day to HR, review / return with comment | ✅ Complete |
| 10 | Hardware / Software teams: employee team, task type, team-specific daily work form, auto-added daily tasks, auto-filled report, admin team overview, Hardware vs Software report | ✅ Complete |

## Business rules
- Only administrators create/edit/delete projects, employees and tasks.
- Employees see only their own tasks and can update progress and log work on them.
- One work log per task / employee / day (saving again the same day replaces it).
- Saving a log recalculates the task's actual hours, moves a "Not Started" task to "In Progress", and a log marked "Completed" completes the task.
- A task is overdue when it is not completed and its target end date has passed.
- Project progress = completed tasks ÷ total tasks.
- Every employee belongs to a team: Hardware, Software or General. Task type defaults to the assignee's team.
- An employee's open assigned tasks (started on or before the day, not completed) appear in My Daily Work automatically; nothing has to be added by hand.
- Changing an employee's team also updates their tasks that had no type.
- The admin Team overview lists active employees only (administrator accounts are excluded).
