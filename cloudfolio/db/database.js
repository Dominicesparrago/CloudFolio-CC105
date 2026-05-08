const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');
const path = require('path');
const fs = require('fs');

const dbPath = path.join(__dirname, 'cloudfolio.db');
const db = new Database(dbPath);

// Enable WAL mode for better performance
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Create tables
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    phone TEXT,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL CHECK(role IN ('member', 'staff', 'admin')),
    staff_id TEXT UNIQUE,
    status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'suspended', 'inactive')),
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS loans (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    member_id INTEGER NOT NULL REFERENCES users(id),
    item_title TEXT NOT NULL,
    item_author TEXT,
    item_type TEXT NOT NULL DEFAULT 'book' CHECK(item_type IN ('book', 'magazine', 'dvd', 'other')),
    item_call_no TEXT,
    borrowed_date TEXT NOT NULL,
    due_date TEXT NOT NULL,
    returned_date TEXT,
    status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'overdue', 'due_today', 'returned')),
    renewed_count INTEGER NOT NULL DEFAULT 0,
    created_by INTEGER REFERENCES users(id),
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS fines (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    member_id INTEGER NOT NULL REFERENCES users(id),
    loan_id INTEGER REFERENCES loans(id),
    amount REAL NOT NULL DEFAULT 0,
    reason TEXT,
    status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'paid', 'waived')),
    paid_date TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS notifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    member_id INTEGER REFERENCES users(id),
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'info' CHECK(type IN ('info', 'warning', 'reminder', 'overdue')),
    sent INTEGER NOT NULL DEFAULT 0,
    sent_at TEXT,
    created_by INTEGER REFERENCES users(id),
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS system_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    label TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'text' CHECK(type IN ('text', 'number', 'boolean', 'select'))
  );

  CREATE TABLE IF NOT EXISTS activity_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER REFERENCES users(id),
    user_name TEXT,
    action TEXT NOT NULL,
    entity_type TEXT,
    entity_id INTEGER,
    details TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

// Check if already seeded
const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get();

if (userCount.count === 0) {
  const saltRounds = 10;

  // Seed users
  const insertUser = db.prepare(`
    INSERT INTO users (name, email, phone, password_hash, role, staff_id, status, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const users = [
    { name: 'Juan dela Cruz', email: 'admin@cloudfolio.com', phone: null, password: 'admin123', role: 'admin', staff_id: 'ADMIN-001', status: 'active', created_at: '2026-01-01 08:00:00' },
    { name: 'Maria Reyes', email: 'maria@cloudfolio.com', phone: null, password: 'staff123', role: 'staff', staff_id: 'STAFF-001', status: 'active', created_at: '2026-01-05 09:00:00' },
    { name: 'Pedro Santos', email: 'pedro@cloudfolio.com', phone: null, password: 'staff123', role: 'staff', staff_id: 'STAFF-002', status: 'active', created_at: '2026-01-05 09:30:00' },
    { name: 'Ana Garcia', email: 'ana@example.com', phone: '09171234567', password: 'member123', role: 'member', staff_id: null, status: 'active', created_at: '2026-01-10 10:00:00' },
    { name: 'Jose Reyes', email: 'jose@example.com', phone: '09189876543', password: 'member123', role: 'member', staff_id: null, status: 'active', created_at: '2026-01-12 11:00:00' },
    { name: 'Carmen Lopez', email: 'carmen@example.com', phone: '09161112233', password: 'member123', role: 'member', staff_id: null, status: 'suspended', created_at: '2026-01-15 10:00:00' },
    { name: 'Luis Torres', email: 'luis@example.com', phone: '09154445566', password: 'member123', role: 'member', staff_id: null, status: 'active', created_at: '2026-01-20 14:00:00' },
    { name: 'Maria Santos', email: 'maria.s@example.com', phone: '09177778899', password: 'member123', role: 'member', staff_id: null, status: 'active', created_at: '2026-01-25 09:00:00' },
  ];

  const insertedUsers = {};
  for (const u of users) {
    const hash = bcrypt.hashSync(u.password, saltRounds);
    const result = insertUser.run(u.name, u.email, u.phone, hash, u.role, u.staff_id, u.status, u.created_at);
    insertedUsers[u.name] = result.lastInsertRowid;
  }

  // Seed loans
  const insertLoan = db.prepare(`
    INSERT INTO loans (member_id, item_title, item_author, item_type, item_call_no, borrowed_date, due_date, returned_date, status, renewed_count, created_by, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const staffId = insertedUsers['Maria Reyes'];
  const adminId = insertedUsers['Juan dela Cruz'];

  const loanResults = [];

  loanResults.push(insertLoan.run(insertedUsers['Ana Garcia'], 'Noli Me Tangere', 'Jose Rizal', 'book', 'FIL-001', '2026-04-20', '2026-05-04', null, 'overdue', 0, staffId, '2026-04-20 09:00:00').lastInsertRowid);
  loanResults.push(insertLoan.run(insertedUsers['Ana Garcia'], 'The Alchemist', 'Paulo Coelho', 'book', 'FIC-002', '2026-04-28', '2026-05-12', null, 'active', 0, staffId, '2026-04-28 10:00:00').lastInsertRowid);
  loanResults.push(insertLoan.run(insertedUsers['Jose Reyes'], '1984', 'George Orwell', 'book', 'FIC-003', '2026-04-15', '2026-04-29', null, 'overdue', 0, staffId, '2026-04-15 09:30:00').lastInsertRowid);
  loanResults.push(insertLoan.run(insertedUsers['Jose Reyes'], 'Pride and Prejudice', 'Jane Austen', 'book', 'FIC-004', '2026-05-01', '2026-05-07', null, 'due_today', 0, staffId, '2026-05-01 11:00:00').lastInsertRowid);
  loanResults.push(insertLoan.run(insertedUsers['Luis Torres'], 'The Great Gatsby', 'F. Scott Fitzgerald', 'book', 'FIC-005', '2026-05-03', '2026-05-17', null, 'active', 0, staffId, '2026-05-03 14:00:00').lastInsertRowid);
  loanResults.push(insertLoan.run(insertedUsers['Maria Santos'], 'Harry Potter and the Sorcerer\'s Stone', 'J.K. Rowling', 'book', 'FIC-006', '2026-03-10', '2026-03-24', '2026-03-23', 'returned', 0, insertedUsers['Pedro Santos'], '2026-03-10 09:00:00').lastInsertRowid);
  loanResults.push(insertLoan.run(insertedUsers['Carmen Lopez'], 'El Filibusterismo', 'Jose Rizal', 'book', 'FIL-002', '2026-04-10', '2026-04-24', null, 'overdue', 0, staffId, '2026-04-10 10:00:00').lastInsertRowid);
  loanResults.push(insertLoan.run(insertedUsers['Maria Santos'], 'To Kill a Mockingbird', 'Harper Lee', 'book', 'FIC-007', '2026-04-29', '2026-05-13', null, 'active', 0, staffId, '2026-04-29 11:00:00').lastInsertRowid);

  // Seed fines
  const insertFine = db.prepare(`
    INSERT INTO fines (member_id, loan_id, amount, reason, status, paid_date, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  insertFine.run(insertedUsers['Ana Garcia'], loanResults[0], 30.00, 'Overdue - 3 days past due', 'pending', null, '2026-05-07 08:00:00');
  insertFine.run(insertedUsers['Jose Reyes'], loanResults[2], 80.00, 'Overdue - 8 days past due', 'pending', null, '2026-05-07 08:00:00');
  insertFine.run(insertedUsers['Carmen Lopez'], loanResults[6], 130.00, 'Overdue - 13 days past due', 'pending', null, '2026-05-07 08:00:00');
  insertFine.run(insertedUsers['Maria Santos'], loanResults[5], 0.00, 'No fines', 'paid', '2026-03-23', '2026-03-23 10:00:00');

  // Seed notifications
  const insertNotif = db.prepare(`
    INSERT INTO notifications (member_id, title, message, type, sent, sent_at, created_by, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  insertNotif.run(insertedUsers['Ana Garcia'], 'Overdue Notice', 'Your loan of Noli Me Tangere is overdue. Please return immediately.', 'overdue', 0, null, adminId, '2026-05-05 09:00:00');
  insertNotif.run(insertedUsers['Jose Reyes'], 'Overdue Notice', 'Your loan of 1984 is overdue. Please return immediately.', 'overdue', 0, null, adminId, '2026-05-05 09:00:00');
  insertNotif.run(insertedUsers['Jose Reyes'], 'Due Date Reminder', 'Your loan of Pride and Prejudice is due today.', 'reminder', 0, null, adminId, '2026-05-07 08:00:00');
  insertNotif.run(insertedUsers['Carmen Lopez'], 'Overdue Notice', 'Your loan of El Filibusterismo is overdue.', 'overdue', 1, '2026-04-25', adminId, '2026-04-25 09:00:00');
  insertNotif.run(null, 'Welcome to CloudFolio', 'Welcome to the CloudFolio library system!', 'info', 1, '2026-04-01', adminId, '2026-04-01 08:00:00');

  // Seed system settings
  const insertSetting = db.prepare(`
    INSERT INTO system_settings (key, value, label, type) VALUES (?, ?, ?, ?)
  `);

  insertSetting.run('loan_period_days', '14', 'Default Loan Period (days)', 'number');
  insertSetting.run('fine_per_day', '10.00', 'Fine Per Day (PHP)', 'number');
  insertSetting.run('fine_cap', '200.00', 'Fine Cap (PHP)', 'number');
  insertSetting.run('max_renewals', '2', 'Maximum Renewals', 'number');
  insertSetting.run('max_active_loans', '5', 'Maximum Active Loans Per Member', 'number');
  insertSetting.run('library_name', 'CloudFolio Library', 'Library Name', 'text');
  insertSetting.run('library_email', 'library@cloudfolio.com', 'Library Email', 'text');
  insertSetting.run('library_phone', '(02) 1234-5678', 'Library Phone', 'text');
  insertSetting.run('library_address', '123 Library St., Manila, Philippines', 'Library Address', 'text');

  // Seed activity logs
  const insertLog = db.prepare(`
    INSERT INTO activity_logs (user_id, user_name, action, entity_type, entity_id, details, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  insertLog.run(adminId, 'Juan dela Cruz', 'LOGIN', 'auth', null, 'Admin login', '2026-05-07 07:30:00');
  insertLog.run(staffId, 'Maria Reyes', 'CREATE_LOAN', 'loan', loanResults[0], 'Created loan for Ana Garcia - Noli Me Tangere', '2026-04-20 09:00:00');
  insertLog.run(null, 'system', 'MARK_OVERDUE', 'loan', null, 'Marked 3 loans as overdue', '2026-05-07 08:00:00');
  insertLog.run(staffId, 'Maria Reyes', 'CREATE_FINE', 'fine', null, 'Fine created for Ana Garcia - PHP 30.00', '2026-05-07 08:05:00');
  insertLog.run(adminId, 'Juan dela Cruz', 'SEND_NOTIFICATION', 'notification', null, 'Sent overdue notice to Carmen Lopez', '2026-04-25 09:00:00');
  insertLog.run(insertedUsers['Pedro Santos'], 'Pedro Santos', 'RETURN_BOOK', 'loan', loanResults[5], "Returned: Harry Potter by Maria Santos", '2026-03-23 10:00:00');
  insertLog.run(adminId, 'Juan dela Cruz', 'CREATE_MEMBER', 'user', insertedUsers['Carmen Lopez'], 'Created member account: Carmen Lopez', '2026-01-15 10:00:00');
  insertLog.run(adminId, 'Juan dela Cruz', 'SUSPEND_MEMBER', 'user', insertedUsers['Carmen Lopez'], 'Suspended member account: Carmen Lopez', '2026-04-05 14:00:00');
  insertLog.run(adminId, 'Juan dela Cruz', 'UPDATE_SETTINGS', 'settings', null, 'Updated fine_per_day to 10.00', '2026-04-01 09:00:00');
  insertLog.run(staffId, 'Maria Reyes', 'LOGIN', 'auth', null, 'Staff login', '2026-05-07 08:00:00');

  console.log('Database seeded successfully.');
}

// Helper function to log activity
function logActivity(userId, userName, action, entityType, entityId, details) {
  try {
    db.prepare(`
      INSERT INTO activity_logs (user_id, user_name, action, entity_type, entity_id, details, created_at)
      VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
    `).run(userId || null, userName || 'system', action, entityType || null, entityId || null, details || null);
  } catch (err) {
    console.error('Failed to log activity:', err);
  }
}

module.exports = { db, logActivity };
