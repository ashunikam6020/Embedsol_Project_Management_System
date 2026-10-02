const router = require('express').Router();
const db = require('../config/db');
const { authenticate, requireAdmin } = require('../middleware/auth');
const { bad, notFound } = require('../utils/http');
router.use(authenticate, requireAdmin);
router.get('/:projectId', async (req,res)=>{
 const rows=await db.q(`SELECT pm.*,e.full_name,e.employee_code,e.work_type FROM project_members pm JOIN employees e ON e.id=pm.employee_id WHERE pm.project_id=? ORDER BY e.full_name`,[req.params.projectId]);
 res.json({success:true,data:rows});
});
router.post('/:projectId', async (req,res)=>{
 const employeeId=Number(req.body?.employee_id); if(!employeeId) throw bad('Employee is required');
 const p=await db.q('SELECT id FROM projects WHERE id=?',[req.params.projectId]); if(!p[0]) throw notFound('Project not found');
 const e=await db.q('SELECT id FROM employees WHERE id=? AND is_active=1',[employeeId]); if(!e[0]) throw bad('Employee does not exist or is inactive');
 const role=String(req.body?.member_role||'MEMBER').trim().slice(0,100);
 const r=await db.q('INSERT INTO project_members (project_id,employee_id,member_role) VALUES (?,?,?)',[req.params.projectId,employeeId,role]);
 res.status(201).json({success:true,id:r.insertId});
});
router.delete('/:projectId/:employeeId', async (req,res)=>{
 const r=await db.q('DELETE FROM project_members WHERE project_id=? AND employee_id=?',[req.params.projectId,req.params.employeeId]);
 if(!r.affectedRows) throw notFound('Project member not found'); res.json({success:true});
});
module.exports=router;
