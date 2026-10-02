const db = require('../config/db');

async function audit(actorUserId, action, entityType, entityId = null, details = null) {
  try {
    await db.q(
      `INSERT INTO audit_logs (actor_user_id, action, entity_type, entity_id, details)
       VALUES (?, ?, ?, ?, ?)`,
      [actorUserId || null, action, entityType, entityId, details ? JSON.stringify(details) : null]
    );
  } catch (err) {
    // Audit failure must not break the main business operation.
    console.error('Audit log error:', err.message);
  }
}

module.exports = audit;
