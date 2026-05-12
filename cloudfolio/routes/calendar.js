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

// GET /api/calendar - List suspended days (optional ?year=&month= filter)
router.get('/', requireStaff, (req, res) => {
  try {
    const { year, month } = req.query;
    let rows;
    if (year && month) {
      const m = String(month).padStart(2, '0');
      rows = db.prepare('SELECT * FROM suspended_days WHERE date LIKE ? ORDER BY date ASC').all(`${year}-${m}-%`);
    } else if (year) {
      rows = db.prepare('SELECT * FROM suspended_days WHERE date LIKE ? ORDER BY date ASC').all(`${year}-%`);
    } else {
      rows = db.prepare('SELECT * FROM suspended_days ORDER BY date ASC').all();
    }
    res.json(rows);
  } catch (err) {
    console.error('Calendar GET error:', err.message);
    res.status(500).json({ error: 'Failed to load calendar.' });
  }
});

// GET /api/calendar/fine-days?from=YYYY-MM-DD&to=YYYY-MM-DD
// Returns count of non-suspended days between from (exclusive) and to (inclusive)
router.get('/fine-days', requireStaff, (req, res) => {
  try {
    const { from, to } = req.query;
    if (!from || !to) return res.status(400).json({ error: 'from and to are required.' });

    const fromDate = new Date(from + 'T00:00:00');
    const toDate = new Date(to + 'T00:00:00');

    if (fromDate >= toDate) return res.json({ total_days: 0, suspended_days: 0, fine_days: 0 });

    const suspended = db.prepare(
      'SELECT date FROM suspended_days WHERE date > ? AND date <= ?'
    ).all(from, to);
    const suspendedSet = new Set(suspended.map(s => s.date));

    let totalDays = 0;
    let suspendedCount = 0;
    const cur = new Date(fromDate);
    cur.setDate(cur.getDate() + 1);

    while (cur <= toDate) {
      const d = cur.toISOString().split('T')[0];
      totalDays++;
      if (suspendedSet.has(d)) suspendedCount++;
      cur.setDate(cur.getDate() + 1);
    }

    res.json({ total_days: totalDays, suspended_days: suspendedCount, fine_days: totalDays - suspendedCount });
  } catch (err) {
    console.error('Calendar fine-days error:', err.message);
    res.status(500).json({ error: 'Failed to calculate fine days.' });
  }
});

// POST /api/calendar - Mark a day as suspended (admin only)
router.post('/', requireAdmin, (req, res) => {
  try {
    const { date, reason } = req.body;
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res.status(400).json({ error: 'Valid date (YYYY-MM-DD) is required.' });
    }

    const existing = db.prepare('SELECT id FROM suspended_days WHERE date = ?').get(date);
    if (existing) return res.status(409).json({ error: 'This date is already suspended.' });

    const user = req.session.user;
    const result = db.prepare(
      "INSERT INTO suspended_days (date, reason, created_by, created_at) VALUES (?, ?, ?, datetime('now'))"
    ).run(date, reason || null, user.id);

    logActivity(user.id, user.name, 'MARK_SUSPENDED_DAY', 'calendar', result.lastInsertRowid,
      `Marked ${date} as suspended${reason ? ': ' + reason : ''}`);

    res.status(201).json({ id: result.lastInsertRowid, date, reason: reason || null });
  } catch (err) {
    console.error('Calendar POST error:', err.message);
    res.status(500).json({ error: 'Failed to mark suspended day.' });
  }
});

// DELETE /api/calendar/:date - Remove a suspended day (admin only)
router.delete('/:date', requireAdmin, (req, res) => {
  try {
    const { date } = req.params;
    const existing = db.prepare('SELECT id FROM suspended_days WHERE date = ?').get(date);
    if (!existing) return res.status(404).json({ error: 'Suspended day not found.' });

    db.prepare('DELETE FROM suspended_days WHERE date = ?').run(date);

    const user = req.session.user;
    logActivity(user.id, user.name, 'REMOVE_SUSPENDED_DAY', 'calendar', existing.id,
      `Removed suspension for ${date}`);

    res.json({ success: true });
  } catch (err) {
    console.error('Calendar DELETE error:', err.message);
    res.status(500).json({ error: 'Failed to remove suspended day.' });
  }
});

module.exports = router;
