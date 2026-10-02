# Embedsol Technologies – V4 Changelog

## Included
- Fixed local MariaDB host to `127.0.0.1`.
- Safe migration for existing installations; no database drop/reset.
- Attendance check-in/check-out and admin attendance history.
- Task comments API for employee/admin communication.
- In-app notifications API and notifications page.
- Audit log API and admin Audit Log page.
- Project-level member table and admin API.
- Added Attendance and Notifications to the main navigation.

## Existing features retained
- JWT authentication
- Admin and employee roles
- Employee management
- Hardware / Software / General teams
- Projects and tasks
- Daily work logs
- Daily reports and HR review
- Dashboard and reports

## Setup
1. Extract the ZIP.
2. In `backend`, confirm `.env` values.
3. Run `npm.cmd install`.
4. Run `npm.cmd run db:migrate`.
5. Run `npm.cmd run dev`.
6. In `frontend`, run `npm.cmd install` and `npm.cmd run dev`.

Do not run a destructive database reset against an existing installation.
