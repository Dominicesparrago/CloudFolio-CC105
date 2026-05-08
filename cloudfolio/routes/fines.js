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

// GET /api/fines - List all fines
router.get('/', requireStaff, (req, res) => {
  const { status } = req.query;
  let query = `
    SELECT f.*, u.name as member_name, u.email as member_email,
      l.item_title, l.item_author
    FROM fines f
    JOIN users u ON f.member_id = u.id
    LEFT JOIN loans l ON f.loan_id = l.id
  `;
  const params = [];
  if (status) {
    query += ' WHERE f.status = ?';
    params.push(status);
  }
  query += ' ORDER BY f.created_at DESC';
  const fines = db.prepare(query).all(...params);
  res.json(fines);
});

// POST /api/fines - Create fine manually
router.post('/', requireStaff, (req, res) => {
  const { member_id, loan_id, amount, reason } = req.body;
  if (!member_id || amount === undefined) {
    return res.status(400).json({ error: 'member_id and amount are required.' });
  }

  const member = db.prepare('SELECT * FROM users WHERE id = ? AND role = \'member\'').get(member_id);
  if (!member) return res.status(404).json({ error: 'Member not found.' });

  const result = db.prepare(`
    INSERT INTO fines (member_id, loan_id, amount, reason, status, created_at)
    VALUES (?, ?, ?, ?, 'pending', datetime('now'))
  `).run(member_id, loan_id || null, amount, reason || null);

  const user = req.session.user;
  logActivity(user.id, user.name, 'CREATE_FINE', 'fine', result.lastInsertRowid, `Fine created for ${member.name} - PHP ${parseFloat(amount).toFixed(2)}`);

  const fine = db.prepare(`
    SELECT f.*, u.name as member_name, l.item_title FROM fines f
    JOIN users u ON f.member_id = u.id
    LEFT JOIN loans l ON f.loan_id = l.id
    WHERE f.id = ?
  `).get(result.lastInsertRowid);

  res.status(201).json(fine);
});

// PUT /api/fines/:id - Update fine status
router.put('/:id', requireStaff, (req, res) => {
  const { status } = req.body;
  if (!['paid', 'waived', 'pending'].includes(status)) {
    return res.status(400).json({ error: 'Invalid status.' });
  }

  const fine = db.prepare('SELECT * FROM fines WHERE id = ?').get(req.params.id);
  if (!fine) return res.status(404).json({ error: 'Fine not found.' });

  const paidDate = status === 'paid' ? new Date().toISOString().split('T')[0] : null;
  db.prepare(`
    UPDATE fines SET status = ?, paid_date = ? WHERE id = ?
  `).run(status, paidDate, fine.id);

  const user = req.session.user;
  const action = status === 'paid' ? 'MARK_FINE_PAID' : status === 'waived' ? 'WAIVE_FINE' : 'UPDATE_FINE';
  logActivity(user.id, user.name, action, 'fine', fine.id, `Fine ${status} for amount PHP ${fine.amount.toFixed(2)}`);

  const updated = db.prepare(`
    SELECT f.*, u.name as member_name, l.item_title FROM fines f
    JOIN users u ON f.member_id = u.id
    LEFT JOIN loans l ON f.loan_id = l.id
    WHERE f.id = ?
  `).get(fine.id);

  res.json(updated);
});

module.exports = router;
