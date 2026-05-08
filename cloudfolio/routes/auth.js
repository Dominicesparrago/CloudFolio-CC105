const express = require('express');
const bcrypt = require('bcryptjs');
const router = express.Router();
const { db, logActivity } = require('../db/database');

// POST /api/auth/login - Staff/Admin login
router.post('/login', (req, res) => {
  const { credential, password } = req.body;
  if (!credential || !password) {
    return res.status(400).json({ error: 'Credential and password are required.' });
  }

  const user = db.prepare(`
    SELECT * FROM users
    WHERE (email = ? OR staff_id = ?) AND role IN ('staff', 'admin')
  `).get(credential, credential);

  if (!user) {
    return res.status(401).json({ error: 'Invalid credentials.' });
  }

  if (user.status === 'inactive') {
    return res.status(401).json({ error: 'Account is inactive.' });
  }

  if (user.status === 'suspended') {
    return res.status(401).json({ error: 'Account is suspended.' });
  }

  const valid = bcrypt.compareSync(password, user.password_hash);
  if (!valid) {
    return res.status(401).json({ error: 'Invalid credentials.' });
  }

  req.session.user = {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    staff_id: user.staff_id
  };

  logActivity(user.id, user.name, 'LOGIN', 'auth', null, `${user.role === 'admin' ? 'Admin' : 'Staff'} login`);

  res.json({
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    staff_id: user.staff_id
  });
});

// POST /api/auth/member/login - Member login
router.post('/member/login', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required.' });
  }

  const user = db.prepare(`
    SELECT * FROM users WHERE email = ? AND role = 'member'
  `).get(email);

  if (!user) {
    return res.status(401).json({ error: 'Invalid credentials.' });
  }

  if (user.status === 'suspended') {
    return res.status(401).json({ error: 'Your account has been suspended. Please contact the library.' });
  }

  if (user.status === 'inactive') {
    return res.status(401).json({ error: 'Account is inactive.' });
  }

  const valid = bcrypt.compareSync(password, user.password_hash);
  if (!valid) {
    return res.status(401).json({ error: 'Invalid credentials.' });
  }

  req.session.user = {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    staff_id: null
  };

  logActivity(user.id, user.name, 'LOGIN', 'auth', null, 'Member login');

  res.json({
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role
  });
});

// POST /api/auth/member/signup - Member registration
router.post('/member/signup', (req, res) => {
  const { name, email, phone, password } = req.body;
  if (!name || !email || !password) {
    return res.status(400).json({ error: 'Name, email, and password are required.' });
  }

  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
  if (existing) {
    return res.status(409).json({ error: 'An account with this email already exists.' });
  }

  const hash = bcrypt.hashSync(password, 10);
  const result = db.prepare(`
    INSERT INTO users (name, email, phone, password_hash, role, status, created_at)
    VALUES (?, ?, ?, ?, 'member', 'active', datetime('now'))
  `).run(name, email, phone || null, hash);

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(result.lastInsertRowid);

  req.session.user = {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    staff_id: null
  };

  logActivity(user.id, user.name, 'SIGNUP', 'user', user.id, `New member registered: ${user.name}`);

  res.status(201).json({
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role
  });
});

// POST /api/auth/logout
router.post('/logout', (req, res) => {
  req.session.destroy(err => {
    if (err) return res.status(500).json({ error: 'Failed to logout.' });
    res.json({ message: 'Logged out successfully.' });
  });
});

// GET /api/auth/me
router.get('/me', (req, res) => {
  if (!req.session.user) {
    return res.status(401).json({ error: 'Not authenticated.' });
  }
  res.json(req.session.user);
});

module.exports = router;
