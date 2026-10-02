# V5 Changes

## Project requirements added

1. **Task type**
   - Admin can select Hardware or Software when creating a task.
   - Existing V4 task_type support is retained.

2. **Project responsible person**
   - Every new project has a required responsible employee.
   - Project cards and project details show the responsible person.
   - Completed projects remain visible with their responsible person.

3. **Project type**
   - Hardware
   - Software
   - Hardware + Software

4. **Project materials**
   - Admin can add Hardware materials and Software materials to each project.
   - Each material supports name, quantity, unit and remarks.
   - Materials are displayed in project details.

## Database migration

Run the safe migration before using V5 with an existing database:

```powershell
cd backend
npm.cmd run db:migrate
```

Do not drop the existing database.
