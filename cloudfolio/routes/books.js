const express = require('express');
const router = express.Router();
const { db, logActivity } = require('../db/database');

function requireAuth(req, res, next) {
  if (!req.session.user) return res.status(401).json({ error: 'Not authenticated.' });
  next();
}

function requireStaff(req, res, next) {
  if (!req.session.user) return res.status(401).json({ error: 'Not authenticated.' });
  if (!['staff', 'admin'].includes(req.session.user.role)) return res.status(403).json({ error: 'Staff access required.' });
  next();
}

router.get('/', requireAuth, (req, res) => {
  const books = db.prepare('SELECT * FROM books ORDER BY title ASC').all();
  res.json(books);
});

router.post('/', requireStaff, (req, res) => {
  const { title, author, isbn, category, call_no, type, total_copies, published_year } = req.body;

  if (!title || !title.trim()) return res.status(400).json({ error: 'Title is required.' });
  if (!author || !author.trim()) return res.status(400).json({ error: 'Author is required.' });
  const validTypes = ['book', 'magazine', 'dvd', 'other'];
  if (!type || !validTypes.includes(type)) return res.status(400).json({ error: 'Valid type is required.' });

  const copies = parseInt(total_copies) || 1;
  if (copies < 1) return res.status(400).json({ error: 'Total copies must be at least 1.' });

  const result = db.prepare(`
    INSERT INTO books (title, author, isbn, category, call_no, type, total_copies, available_copies, published_year)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    title.trim(),
    author.trim(),
    isbn?.trim() || null,
    category?.trim() || null,
    call_no?.trim() || null,
    type,
    copies,
    copies,
    published_year ? parseInt(published_year) : null
  );

  const book = db.prepare('SELECT * FROM books WHERE id = ?').get(result.lastInsertRowid);
  const user = req.session.user;
  logActivity(user.id, user.name, 'ADD_BOOK', 'book', book.id, `Added book: ${book.title} by ${book.author}`);

  res.status(201).json(book);
});

module.exports = router;
