const express = require('express');
const bcrypt = require('bcryptjs');
const router = express.Router();
const { db, logActivity } = require('../db/database');

// Auth middleware for staff/admin
function requireStaff(req, res, next) {
  if (!req.session.user) return res.status(401).json({ error: 'Not authenticated.' });
  if (!['staff', 'admin'].includes(req.session.user.role)) {
    return res.status(403).json({ error: 'Access denied.' });
  }
  next();
}

// Auth middleware for admin only
function requireAdmin(req, res, next) {
  if (!req.session.user) return res.status(401).json({ error: 'Not authenticated.' });
  if (req.session.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required.' });
  }
  next();
}

// GET /api/members/me - Get current member's data (member role)
router.get('/me', (req, res) => {
  if (!req.session.user) return res.status(401).json({ error: 'Not authenticated.' });
  if (req.session.user.role !== 'member') return res.status(403).json({ error: 'Member access only.' });

  const member = db.prepare('SELECT id, name, email, phone, role, status, created_at FROM users WHERE id = ?').get(req.session.user.id);
  if (!member) return res.status(404).json({ error: 'Member not found.' });

  const loans = db.prepare(`
    SELECT * FROM loans WHERE member_id = ? ORDER BY created_at DESC
  `).all(member.id);

  const fines = db.prepare(`
    SELECT f.*, l.item_title FROM fines f
    LEFT JOIN loans l ON f.loan_id = l.id
    WHERE f.member_id = ? ORDER BY f.created_at DESC
  `).all(member.id);

  const notifications = db.prepare(`
    SELECT id, title, message, type, sent_at, created_at FROM notifications
    WHERE member_id = ? ORDER BY created_at DESC LIMIT 10
  `).all(member.id);

  const activeLoansCount = loans.filter(l => ['active', 'overdue', 'due_today'].includes(l.status)).length;
  const pendingFinesTotal = fines.filter(f => f.status === 'pending').reduce((sum, f) => sum + f.amount, 0);

  res.json({ ...member, loans, fines, notifications, activeLoansCount, pendingFinesTotal });
});

// GET /api/members - List all members with active loan count and pending fine total
router.get('/', requireStaff, (req, res) => {
  const members = db.prepare(`
    SELECT u.id, u.name, u.email, u.phone, u.role, u.status, u.staff_id, u.created_at,
      COUNT(DISTINCT CASE WHEN l.status IN ('active','overdue','due_today') THEN l.id END) as active_loans,
      COALESCE(SUM(CASE WHEN f.status = 'pending' THEN f.amount ELSE 0 END), 0) as pending_fines
    FROM users u
    LEFT JOIN loans l ON u.id = l.member_id
    LEFT JOIN fines f ON u.id = f.member_id
    WHERE u.role = 'member'
    GROUP BY u.id
    ORDER BY u.name ASC
  `).all();

  res.json(members);
});

// GET /api/members/:id - Get one member with loans and fines
router.get('/:id', requireStaff, (req, res) => {
  const member = db.prepare('SELECT id, name, email, phone, role, status, created_at FROM users WHERE id = ? AND role = \'member\'').get(req.params.id);
  if (!member) return res.status(404).json({ error: 'Member not found.' });

  const loans = db.prepare('SELECT * FROM loans WHERE member_id = ? ORDER BY created_at DESC').all(member.id);
  const fines = db.prepare(`
    SELECT f.*, l.item_title FROM fines f
    LEFT JOIN loans l ON f.loan_id = l.id
    WHERE f.member_id = ? ORDER BY f.created_at DESC
  `).all(member.id);

  res.json({ ...member, loans, fines });
});

// POST /api/members - Create member (admin only)
router.post('/', requireAdmin, (req, res) => {
  const { name, email, phone, password } = req.body;
  if (!name || !email || !password) {
    return res.status(400).json({ error: 'Name, email, and password are required.' });
  }

  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
  if (existing) return res.status(409).json({ error: 'Email already in use.' });

  const hash = bcrypt.hashSync(password, 10);
  const result = db.prepare(`
    INSERT INTO users (name, email, phone, password_hash, role, status, created_at)
    VALUES (?, ?, ?, ?, 'member', 'active', datetime('now'))
  `).run(name, email, phone || null, hash);

  const user = req.session.user;
  logActivity(user.id, user.name, 'CREATE_MEMBER', 'user', result.lastInsertRowid, `Created member account: ${name}`);

  const member = db.prepare('SELECT id, name, email, phone, role, status, created_at FROM users WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(member);
});

// PUT /api/members/:id - Update member
router.put('/:id', requireStaff, (req, res) => {
  const { name, email, phone, status } = req.body;
  const member = db.prepare('SELECT * FROM users WHERE id = ? AND role = \'member\'').get(req.params.id);
  if (!member) return res.status(404).json({ error: 'Member not found.' });

  if (email && email !== member.email) {
    const existing = db.prepare('SELECT id FROM users WHERE email = ? AND id != ?').get(email, member.id);
    if (existing) return res.status(409).json({ error: 'Email already in use.' });
  }

  db.prepare(`
    UPDATE users SET name = ?, email = ?, phone = ?, status = ? WHERE id = ?
  `).run(name || member.name, email || member.email, phone !== undefined ? phone : member.phone, status || member.status, member.id);

  const user = req.session.user;
  if (status && status !== member.status) {
    const action = status === 'suspended' ? 'SUSPEND_MEMBER' : status === 'active' ? 'ACTIVATE_MEMBER' : 'UPDATE_MEMBER';
    logActivity(user.id, user.name, action, 'user', member.id, `${action === 'SUSPEND_MEMBER' ? 'Suspended' : 'Updated'} member account: ${member.name}`);
  } else {
    logActivity(user.id, user.name, 'UPDATE_MEMBER', 'user', member.id, `Updated member account: ${member.name}`);
  }

  const updated = db.prepare('SELECT id, name, email, phone, role, status, created_at FROM users WHERE id = ?').get(member.id);
  res.json(updated);
});

module.exports = router;
