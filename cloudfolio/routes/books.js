const express = require('express');
const router = express.Router();
const { db } = require('../db/database');

function requireAuth(req, res, next) {
  if (!req.session.user) return res.status(401).json({ error: 'Not authenticated.' });
  next();
}

router.get('/', requireAuth, (req, res) => {
  const books = db.prepare('SELECT * FROM books ORDER BY title ASC').all();
  res.json(books);
});

module.exports = router;
