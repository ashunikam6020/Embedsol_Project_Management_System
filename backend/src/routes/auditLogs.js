const router = require('express').Router();
const db = require('../config/db');
const { authenticate, requireAdmin } = require('../middleware/auth');
router.use(authenticate, requireAdmin);
router.get('/', async (req,res)=>{
  const rows = await db.q(`SELECT a.*, u.username, u.email FROM audit_logs a LEFT JOIN users u ON u.id=a.actor_user_id ORDER BY a.created_at DESC LIMIT 200`);
  res.json({success:true,data:rows});
});
module.exports=router;
