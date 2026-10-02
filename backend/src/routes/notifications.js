const router = require('express').Router();
const db = require('../config/db');
const { authenticate } = require('../middleware/auth');
const { notFound } = require('../utils/http');
router.use(authenticate);
router.get('/', async (req,res)=>{
  const rows = await db.q(`SELECT id,title,message,type,is_read,created_at FROM notifications WHERE user_id=? ORDER BY created_at DESC LIMIT 100`, [req.user.id]);
  res.json({success:true,data:rows});
});
router.patch('/:id/read', async (req,res)=>{
  const r=await db.q('UPDATE notifications SET is_read=1 WHERE id=? AND user_id=?',[req.params.id,req.user.id]);
  if(!r.affectedRows) throw notFound('Notification not found');
  res.json({success:true});
});
router.patch('/read-all', async (req,res)=>{
  await db.q('UPDATE notifications SET is_read=1 WHERE user_id=?',[req.user.id]);
  res.json({success:true});
});
module.exports=router;
