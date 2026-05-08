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

function calcStatus(dueDate) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(dueDate);
  due.setHours(0, 0, 0, 0);
  if (due < today) return 'overdue';
  if (due.getTime() === today.getTime()) return 'due_today';
  return 'active';
}

// GET /api/loans - List all loans
router.get('/', requireStaff, (req, res) => {
  const { status } = req.query;
  let query = `
    SELECT l.*, u.name as member_name, u.email as member_email
    FROM loans l
    JOIN users u ON l.member_id = u.id
  `;
  const params = [];
  if (status) {
    query += ' WHERE l.status = ?';
    params.push(status);
  }
  query += ' ORDER BY l.created_at DESC';
  const loans = db.prepare(query).all(...params);
  res.json(loans);
});

// GET /api/loans/overdue - Alias for overdue loans
router.get('/overdue', requireStaff, (req, res) => {
  const loans = db.prepare(`
    SELECT l.*, u.name as member_name, u.email as member_email
    FROM loans l
    JOIN users u ON l.member_id = u.id
    WHERE l.status = 'overdue'
    ORDER BY l.due_date ASC
  `).all();
  res.json(loans);
});

// POST /api/loans - Create loan
router.post('/', requireStaff, (req, res) => {
  const { member_id, item_title, item_author, item_type, item_call_no, due_date } = req.body;
  if (!member_id || !item_title || !due_date) {
    return res.status(400).json({ error: 'member_id, item_title, and due_date are required.' });
  }

  const member = db.prepare('SELECT * FROM users WHERE id = ? AND role = \'member\'').get(member_id);
  if (!member) return res.status(404).json({ error: 'Member not found.' });

  if (member.status === 'suspended') {
    return res.status(400).json({ error: 'Cannot create loan for suspended member.' });
  }

  // Check max active loans
  const settingMax = db.prepare('SELECT value FROM system_settings WHERE key = \'max_active_loans\'').get();
  const maxLoans = settingMax ? parseInt(settingMax.value) : 5;
  const activeCount = db.prepare(`
    SELECT COUNT(*) as count FROM loans WHERE member_id = ? AND status IN ('active','overdue','due_today')
  `).get(member_id);
  if (activeCount.count >= maxLoans) {
    return res.status(400).json({ error: `Member has reached the maximum of ${maxLoans} active loans.` });
  }

  const today = new Date().toISOString().split('T')[0];
  const status = calcStatus(due_date);
  const user = req.session.user;

  const result = db.prepare(`
    INSERT INTO loans (member_id, item_title, item_author, item_type, item_call_no, borrowed_date, due_date, status, renewed_count, created_by, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, datetime('now'))
  `).run(member_id, item_title, item_author || null, item_type || 'book', item_call_no || null, today, due_date, status, user.id);

  logActivity(user.id, user.name, 'CREATE_LOAN', 'loan', result.lastInsertRowid, `Created loan for ${member.name} - ${item_title}`);

  const loan = db.prepare(`
    SELECT l.*, u.name as member_name FROM loans l JOIN users u ON l.member_id = u.id WHERE l.id = ?
  `).get(result.lastInsertRowid);

  res.status(201).json(loan);
});

// PUT /api/loans/:id - Update loan (return or renew)
router.put('/:id', requireStaff, (req, res) => {
  const { action } = req.body;
  const loan = db.prepare('SELECT * FROM loans WHERE id = ?').get(req.params.id);
  if (!loan) return res.status(404).json({ error: 'Loan not found.' });

  const user = req.session.user;

  if (action === 'return') {
    if (loan.status === 'returned') {
      return res.status(400).json({ error: 'Loan already returned.' });
    }
    const today = new Date().toISOString().split('T')[0];
    db.prepare(`
      UPDATE loans SET returned_date = ?, status = 'returned' WHERE id = ?
    `).run(today, loan.id);

    logActivity(user.id, user.name, 'RETURN_BOOK', 'loan', loan.id, `Returned: ${loan.item_title}`);
  } else if (action === 'renew') {
    if (loan.status === 'returned') {
      return res.status(400).json({ error: 'Cannot renew returned loan.' });
    }

    const settingMax = db.prepare('SELECT value FROM system_settings WHERE key = \'max_renewals\'').get();
    const maxRenewals = settingMax ? parseInt(settingMax.value) : 2;

    if (loan.renewed_count >= maxRenewals) {
      return res.status(400).json({ error: `Maximum renewals (${maxRenewals}) reached.` });
    }

    const settingPeriod = db.prepare('SELECT value FROM system_settings WHERE key = \'loan_period_days\'').get();
    const loanPeriod = settingPeriod ? parseInt(settingPeriod.value) : 14;

    const currentDue = new Date(loan.due_date);
    currentDue.setDate(currentDue.getDate() + loanPeriod);
    const newDueDate = currentDue.toISOString().split('T')[0];
    const newStatus = calcStatus(newDueDate);
    const newCount = loan.renewed_count + 1;

    db.prepare(`
      UPDATE loans SET due_date = ?, renewed_count = ?, status = ? WHERE id = ?
    `).run(newDueDate, newCount, newStatus, loan.id);

    logActivity(user.id, user.name, 'RENEW_LOAN', 'loan', loan.id, `Renewed: ${loan.item_title} - new due date ${newDueDate}`);
  } else {
    return res.status(400).json({ error: 'Invalid action. Use "return" or "renew".' });
  }

  const updated = db.prepare(`
    SELECT l.*, u.name as member_name FROM loans l JOIN users u ON l.member_id = u.id WHERE l.id = ?
  `).get(loan.id);

  res.json(updated);
});

module.exports = router;
