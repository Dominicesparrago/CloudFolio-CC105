const express = require('express');
const router = express.Router();
const { db, logActivity } = require('../db/database');

function requireStaff(req, res, next) {
  if (!req.session.user) return res.status(401).json({ error: 'Not authenticated.' });
  if (!['staff', 'admin'].includes(req.session.user.role)) {
    return res.status(403).json({ error: 'Access denied.' });
  }
  next();
}

// GET /api/notifications - List all
router.get('/', requireStaff, (req, res) => {
  const { type, sent } = req.query;
  let query = `
    SELECT n.*, u.name as member_name
    FROM notifications n
    LEFT JOIN users u ON n.member_id = u.id
  `;
  const conditions = [];
  const params = [];
  if (type) { conditions.push('n.type = ?'); params.push(type); }
  if (sent !== undefined && sent !== '') { conditions.push('n.sent = ?'); params.push(parseInt(sent)); }
  if (conditions.length) query += ' WHERE ' + conditions.join(' AND ');
  query += ' ORDER BY n.created_at DESC';
  const notifs = db.prepare(query).all(...params);
  res.json(notifs);
});

// POST /api/notifications - Create notification
router.post('/', requireStaff, (req, res) => {
  const { member_id, title, message, type } = req.body;
  if (!title || !message) {
    return res.status(400).json({ error: 'Title and message are required.' });
  }

  const user = req.session.user;
  const result = db.prepare(`
    INSERT INTO notifications (member_id, title, message, type, sent, created_by, created_at)
    VALUES (?, ?, ?, ?, 0, ?, datetime('now'))
  `).run(member_id || null, title, message, type || 'info', user.id);

  logActivity(user.id, user.name, 'CREATE_NOTIFICATION', 'notification', result.lastInsertRowid, `Created notification: ${title}`);

  const notif = db.prepare(`
    SELECT n.*, u.name as member_name FROM notifications n
    LEFT JOIN users u ON n.member_id = u.id
    WHERE n.id = ?
  `).get(result.lastInsertRowid);

  res.status(201).json(notif);
});

// PUT /api/notifications/:id - Mark as sent
router.put('/:id', requireStaff, (req, res) => {
  const notif = db.prepare('SELECT * FROM notifications WHERE id = ?').get(req.params.id);
  if (!notif) return res.status(404).json({ error: 'Notification not found.' });

  db.prepare(`
    UPDATE notifications SET sent = 1, sent_at = datetime('now') WHERE id = ?
  `).run(notif.id);

  const user = req.session.user;
  logActivity(user.id, user.name, 'SEND_NOTIFICATION', 'notification', notif.id, `Sent notification: ${notif.title}`);

  const updated = db.prepare(`
    SELECT n.*, u.name as member_name FROM notifications n
    LEFT JOIN users u ON n.member_id = u.id
    WHERE n.id = ?
  `).get(notif.id);

  res.json(updated);
});

module.exports = router;
