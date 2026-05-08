const express = require('express');
const router = express.Router();
const { db } = require('../db/database');

function requireStaff(req, res, next) {
  if (!req.session.user) return res.status(401).json({ error: 'Not authenticated.' });
  if (!['staff', 'admin'].includes(req.session.user.role)) {
    return res.status(403).json({ error: 'Staff access required.' });
  }
  next();
}

function requireAdmin(req, res, next) {
  if (!req.session.user) return res.status(401).json({ error: 'Not authenticated.' });
  if (req.session.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required.' });
  }
  next();
}

// GET /api/logs - Return all activity logs newest first (staff see recent, admin see all)
router.get('/', requireStaff, (req, res) => {
  const limit = parseInt(req.query.limit) || 100;
  const logs = db.prepare(`
    SELECT al.*, u.role as user_role
    FROM activity_logs al
    LEFT JOIN users u ON al.user_id = u.id
    ORDER BY al.created_at DESC LIMIT ?
  `).all(limit);
  res.json(logs);
});

module.exports = router;
