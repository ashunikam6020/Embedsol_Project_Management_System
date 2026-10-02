const router = require('express').Router();
const db = require('../config/db');
const { authenticate } = require('../middleware/auth');
const { bad, forbidden, notFound } = require('../utils/http');
const audit = require('../utils/audit');
router.use(authenticate);

router.get('/tasks/:id/comments', async (req,res)=>{
  const t=await db.q('SELECT id,assigned_to FROM tasks WHERE id=?',[req.params.id]);
  if(!t[0]) throw notFound('Task not found');
  if(req.user.role!=='ADMIN' && t[0].assigned_to!==req.user.employeeId) throw forbidden('You can only view comments for your tasks');
  const rows=await db.q(`SELECT c.id,c.task_id,c.comment,c.created_at,u.username,
      COALESCE(e.full_name,u.username) AS author_name
      FROM task_comments c JOIN users u ON u.id=c.user_id LEFT JOIN employees e ON e.user_id=u.id
      WHERE c.task_id=? ORDER BY c.created_at ASC`,[req.params.id]);
  res.json({success:true,data:rows});
});

router.post('/tasks/:id/comments', async (req,res)=>{
  const comment=String(req.body?.comment||'').trim();
  if(!comment) throw bad('Comment is required');
  const t=await db.q('SELECT id,assigned_to FROM tasks WHERE id=?',[req.params.id]);
  if(!t[0]) throw notFound('Task not found');
  if(req.user.role!=='ADMIN' && t[0].assigned_to!==req.user.employeeId) throw forbidden('You can only comment on your tasks');
  const r=await db.q('INSERT INTO task_comments (task_id,user_id,comment) VALUES (?,?,?)',[req.params.id,req.user.id,comment]);
  await audit(req.user.id,'ADD_COMMENT','TASK',Number(req.params.id));
  res.status(201).json({success:true,id:r.insertId});
});
module.exports=router;
