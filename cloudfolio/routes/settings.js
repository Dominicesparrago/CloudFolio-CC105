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

function requireAdmin(req, res, next) {
  if (!req.session.user) return res.status(401).json({ error: 'Not authenticated.' });
  if (req.session.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required.' });
  }
  next();
}

// GET /api/settings - Return all settings as key-value object (staff can read for fine rates)
router.get('/', requireStaff, (req, res) => {
  const rows = db.prepare('SELECT * FROM system_settings').all();
  const settings = {};
  const meta = {};
  for (const row of rows) {
    settings[row.key] = row.value;
    meta[row.key] = { label: row.label, type: row.type };
  }
  res.json({ settings, meta });
});

// PUT /api/settings - Update settings
router.put('/', requireAdmin, (req, res) => {
  const updates = req.body;
  if (!updates || typeof updates !== 'object') {
    return res.status(400).json({ error: 'Invalid settings data.' });
  }

  const update = db.prepare('UPDATE system_settings SET value = ? WHERE key = ?');
  const updateMany = db.transaction((items) => {
    for (const [key, value] of Object.entries(items)) {
      update.run(String(value), key);
    }
  });
  updateMany(updates);

  const user = req.session.user;
  logActivity(user.id, user.name, 'UPDATE_SETTINGS', 'settings', null, `Updated settings: ${Object.keys(updates).join(', ')}`);

  const rows = db.prepare('SELECT * FROM system_settings').all();
  const settings = {};
  const meta = {};
  for (const row of rows) {
    settings[row.key] = row.value;
    meta[row.key] = { label: row.label, type: row.type };
  }
  res.json({ settings, meta });
});

module.exports = router;
