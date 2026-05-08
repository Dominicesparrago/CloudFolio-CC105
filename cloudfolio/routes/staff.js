const express = require('express');
const bcrypt = require('bcryptjs');
const router = express.Router();
const { db, logActivity } = require('../db/database');

function requireAdmin(req, res, next) {
  if (!req.session.user) return res.status(401).json({ error: 'Not authenticated.' });
  if (req.session.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required.' });
  }
  next();
}

// GET /api/staff - List all staff/admin
router.get('/', requireAdmin, (req, res) => {
  const staff = db.prepare(`
    SELECT id, name, email, phone, role, staff_id, status, created_at
    FROM users WHERE role IN ('staff', 'admin')
    ORDER BY role DESC, name ASC
  `).all();
  res.json(staff);
});

// POST /api/staff - Create staff account
router.post('/', requireAdmin, (req, res) => {
  const { name, email, role, password } = req.body;
  if (!name || !email || !role) {
    return res.status(400).json({ error: 'Name, email, and role are required.' });
  }
  if (!['staff', 'admin'].includes(role)) {
    return res.status(400).json({ error: 'Role must be staff or admin.' });
  }

  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
  if (existing) return res.status(409).json({ error: 'Email already in use.' });

  // Generate next STAFF-NNN id
  let nextStaffId;
  if (role === 'admin') {
    const lastAdmin = db.prepare(`
      SELECT staff_id FROM users WHERE staff_id LIKE 'ADMIN-%' ORDER BY staff_id DESC LIMIT 1
    `).get();
    if (lastAdmin) {
      const num = parseInt(lastAdmin.staff_id.split('-')[1]) + 1;
      nextStaffId = `ADMIN-${String(num).padStart(3, '0')}`;
    } else {
      nextStaffId = 'ADMIN-001';
    }
  } else {
    const lastStaff = db.prepare(`
      SELECT staff_id FROM users WHERE staff_id LIKE 'STAFF-%' ORDER BY staff_id DESC LIMIT 1
    `).get();
    if (lastStaff) {
      const num = parseInt(lastStaff.staff_id.split('-')[1]) + 1;
      nextStaffId = `STAFF-${String(num).padStart(3, '0')}`;
    } else {
      nextStaffId = 'STAFF-001';
    }
  }

  const hash = bcrypt.hashSync(password || 'staff123', 10);
  const result = db.prepare(`
    INSERT INTO users (name, email, password_hash, role, staff_id, status, created_at)
    VALUES (?, ?, ?, ?, ?, 'active', datetime('now'))
  `).run(name, email, hash, role, nextStaffId);

  const user = req.session.user;
  logActivity(user.id, user.name, 'CREATE_STAFF', 'user', result.lastInsertRowid, `Created ${role} account: ${name} (${nextStaffId})`);

  const staff = db.prepare('SELECT id, name, email, phone, role, staff_id, status, created_at FROM users WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(staff);
});

// PUT /api/staff/:id - Update staff
router.put('/:id', requireAdmin, (req, res) => {
  const { name, email, status, role } = req.body;
  const staff = db.prepare('SELECT * FROM users WHERE id = ? AND role IN (\'staff\', \'admin\')').get(req.params.id);
  if (!staff) return res.status(404).json({ error: 'Staff not found.' });

  if (email && email !== staff.email) {
    const existing = db.prepare('SELECT id FROM users WHERE email = ? AND id != ?').get(email, staff.id);
    if (existing) return res.status(409).json({ error: 'Email already in use.' });
  }

  db.prepare(`
    UPDATE users SET name = ?, email = ?, status = ?, role = ? WHERE id = ?
  `).run(name || staff.name, email || staff.email, status || staff.status, role || staff.role, staff.id);

  const user = req.session.user;
  logActivity(user.id, user.name, 'UPDATE_STAFF', 'user', staff.id, `Updated staff account: ${staff.name}`);

  const updated = db.prepare('SELECT id, name, email, phone, role, staff_id, status, created_at FROM users WHERE id = ?').get(staff.id);
  res.json(updated);
});

// DELETE /api/staff/:id - Soft delete (set inactive)
router.delete('/:id', requireAdmin, (req, res) => {
  const staff = db.prepare('SELECT * FROM users WHERE id = ? AND role IN (\'staff\', \'admin\')').get(req.params.id);
  if (!staff) return res.status(404).json({ error: 'Staff not found.' });

  // Prevent deleting yourself
  if (staff.id === req.session.user.id) {
    return res.status(400).json({ error: 'Cannot deactivate your own account.' });
  }

  db.prepare('UPDATE users SET status = \'inactive\' WHERE id = ?').run(staff.id);

  const user = req.session.user;
  logActivity(user.id, user.name, 'DEACTIVATE_STAFF', 'user', staff.id, `Deactivated staff account: ${staff.name}`);

  res.json({ message: 'Staff account deactivated.' });
});

module.exports = router;
