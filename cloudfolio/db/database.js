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

  CREATE TABLE IF NOT EXISTS books (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    author TEXT NOT NULL,
    isbn TEXT,
    category TEXT,
    call_no TEXT,
    type TEXT NOT NULL DEFAULT 'book' CHECK(type IN ('book', 'magazine', 'dvd', 'other')),
    total_copies INTEGER NOT NULL DEFAULT 1,
    available_copies INTEGER NOT NULL DEFAULT 1,
    published_year INTEGER,
    added_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS suspended_days (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT NOT NULL UNIQUE,
    reason TEXT,
    created_by INTEGER REFERENCES users(id),
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

// Check if already seeded
const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get();

if (userCount.count === 0) {
  const saltRounds = 10;

  const insertUser = db.prepare(`
    INSERT INTO users (name, email, phone, password_hash, role, staff_id, status, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const users = [
    // Admin
    { name: 'Ligaya Fernandez', email: 'admin@cloudfolio.com', phone: '09171000001', password: 'admin123', role: 'admin', staff_id: 'ADMIN-001', status: 'active', created_at: '2026-01-02 08:00:00' },
    // Staff
    { name: 'Rommel Aquino', email: 'rommel@cloudfolio.com', phone: '09281000002', password: 'staff123', role: 'staff', staff_id: 'STAFF-001', status: 'active', created_at: '2026-01-03 09:00:00' },
    { name: 'Sheila Bautista', email: 'sheila@cloudfolio.com', phone: '09191000003', password: 'staff123', role: 'staff', staff_id: 'STAFF-002', status: 'active', created_at: '2026-01-03 09:30:00' },
    { name: 'Dennis Ocampo', email: 'dennis@cloudfolio.com', phone: '09361000004', password: 'staff123', role: 'staff', staff_id: 'STAFF-003', status: 'active', created_at: '2026-02-01 08:00:00' },
    // Members — active
    { name: 'Ana Marie Lim', email: 'ana.lim@student.edu.ph', phone: '09171110001', password: 'member123', role: 'member', staff_id: null, status: 'active', created_at: '2026-01-06 10:00:00' },
    { name: 'Miguel Santos', email: 'miguel.santos@student.edu.ph', phone: '09271110002', password: 'member123', role: 'member', staff_id: null, status: 'active', created_at: '2026-01-06 10:15:00' },
    { name: 'Donna Cruz', email: 'donna.cruz@student.edu.ph', phone: '09181110003', password: 'member123', role: 'member', staff_id: null, status: 'active', created_at: '2026-01-07 09:00:00' },
    { name: 'Renzo dela Torre', email: 'renzo.delatorre@student.edu.ph', phone: '09291110004', password: 'member123', role: 'member', staff_id: null, status: 'active', created_at: '2026-01-07 09:30:00' },
    { name: 'Karen Villanueva', email: 'karen.villanueva@student.edu.ph', phone: '09161110005', password: 'member123', role: 'member', staff_id: null, status: 'active', created_at: '2026-01-08 10:00:00' },
    { name: 'Jerome Castillo', email: 'jerome.castillo@student.edu.ph', phone: '09451110006', password: 'member123', role: 'member', staff_id: null, status: 'active', created_at: '2026-01-08 10:30:00' },
    { name: 'Patricia Navarro', email: 'patricia.navarro@student.edu.ph', phone: '09171110007', password: 'member123', role: 'member', staff_id: null, status: 'active', created_at: '2026-01-09 09:00:00' },
    { name: 'Danilo Gomez', email: 'danilo.gomez@student.edu.ph', phone: '09261110008', password: 'member123', role: 'member', staff_id: null, status: 'active', created_at: '2026-01-09 09:30:00' },
    { name: 'Bianca Reyes', email: 'bianca.reyes@student.edu.ph', phone: '09151110009', password: 'member123', role: 'member', staff_id: null, status: 'active', created_at: '2026-01-10 10:00:00' },
    { name: 'Tristan Herrera', email: 'tristan.herrera@student.edu.ph', phone: '09471110010', password: 'member123', role: 'member', staff_id: null, status: 'active', created_at: '2026-01-10 10:30:00' },
    { name: 'Michelle Tan', email: 'michelle.tan@student.edu.ph', phone: '09171110011', password: 'member123', role: 'member', staff_id: null, status: 'active', created_at: '2026-01-11 09:00:00' },
    { name: 'Christian Belo', email: 'christian.belo@student.edu.ph', phone: '09341110012', password: 'member123', role: 'member', staff_id: null, status: 'active', created_at: '2026-01-12 10:00:00' },
    // Suspended — multiple unpaid fines
    { name: 'Rosario Mendoza', email: 'rosario.mendoza@student.edu.ph', phone: '09221110013', password: 'member123', role: 'member', staff_id: null, status: 'suspended', created_at: '2026-01-13 10:00:00' },
    // Inactive — no longer enrolled
    { name: 'Felix Aguilar', email: 'felix.aguilar@student.edu.ph', phone: '09311110014', password: 'member123', role: 'member', staff_id: null, status: 'inactive', created_at: '2026-01-14 09:00:00' },
    // New member — registered recently, no loans yet
    { name: 'Ysabel Flores', email: 'ysabel.flores@student.edu.ph', phone: '09121110015', password: 'member123', role: 'member', staff_id: null, status: 'active', created_at: '2026-04-28 10:00:00' },
  ];

  const insertedUsers = {};
  for (const u of users) {
    const hash = bcrypt.hashSync(u.password, saltRounds);
    const result = insertUser.run(u.name, u.email, u.phone, hash, u.role, u.staff_id, u.status, u.created_at);
    insertedUsers[u.name] = result.lastInsertRowid;
  }

  const adminId  = insertedUsers['Ligaya Fernandez'];
  const staffId  = insertedUsers['Rommel Aquino'];
  const staffId2 = insertedUsers['Sheila Bautista'];
  const staffId3 = insertedUsers['Dennis Ocampo'];

  const insertLoan = db.prepare(`
    INSERT INTO loans (member_id, item_title, item_author, item_type, item_call_no, borrowed_date, due_date, returned_date, status, renewed_count, created_by, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const lR = {};

  // ── OVERDUE ──────────────────────────────────────────────────────────────────
  // 2 days overdue — fine: ₱20
  lR.miguel_noli   = insertLoan.run(insertedUsers['Miguel Santos'],     'Noli Me Tangere',                    'Jose Rizal',           'book',     'FIL-001', '2026-04-24', '2026-05-08', null,         'overdue', 0, staffId,  '2026-04-24 09:00:00').lastInsertRowid;
  // 6 days overdue — fine: ₱60
  lR.donna_pride   = insertLoan.run(insertedUsers['Donna Cruz'],        'Pride and Prejudice',                'Jane Austen',          'book',     'FIC-004', '2026-04-20', '2026-05-04', null,         'overdue', 0, staffId2, '2026-04-20 10:00:00').lastInsertRowid;
  // 12 days overdue — fine: ₱120
  lR.renzo_alch    = insertLoan.run(insertedUsers['Renzo dela Torre'],  'The Alchemist',                      'Paulo Coelho',         'book',     'FIC-002', '2026-04-14', '2026-04-28', null,         'overdue', 0, staffId,  '2026-04-14 09:30:00').lastInsertRowid;
  // 20 days overdue — fine capped: ₱200
  lR.karen_elfili  = insertLoan.run(insertedUsers['Karen Villanueva'],  'El Filibusterismo',                  'Jose Rizal',           'book',     'FIL-002', '2026-04-06', '2026-04-20', null,         'overdue', 0, staffId2, '2026-04-06 10:00:00').lastInsertRowid;
  // 38 days overdue — fine capped: ₱200
  lR.jerome_sap    = insertLoan.run(insertedUsers['Jerome Castillo'],   'Sapiens: A Brief History of Humankind','Yuval Noah Harari',  'book',     'HIS-001', '2026-03-19', '2026-04-02', null,         'overdue', 0, staffId,  '2026-03-19 09:00:00').lastInsertRowid;
  // 44 days overdue, suspended member — fine capped: ₱200
  lR.rosario_tokill= insertLoan.run(insertedUsers['Rosario Mendoza'],   'To Kill a Mockingbird',              'Harper Lee',           'book',     'FIC-007', '2026-03-13', '2026-03-27', null,         'overdue', 0, staffId2, '2026-03-13 10:30:00').lastInsertRowid;

  // ── DUE TODAY (2026-05-10) ───────────────────────────────────────────────────
  lR.ana_1984      = insertLoan.run(insertedUsers['Ana Marie Lim'],     '1984',                               'George Orwell',        'book',     'FIC-003', '2026-04-26', '2026-05-10', null,         'due_today', 0, staffId,  '2026-04-26 09:00:00').lastInsertRowid;
  lR.danilo_cosmos = insertLoan.run(insertedUsers['Danilo Gomez'],      'Cosmos',                             'Carl Sagan',           'book',     'SCI-001', '2026-04-26', '2026-05-10', null,         'due_today', 0, staffId2, '2026-04-26 10:00:00').lastInsertRowid;

  // ── ACTIVE ───────────────────────────────────────────────────────────────────
  lR.bianca_gatsby = insertLoan.run(insertedUsers['Bianca Reyes'],      'The Great Gatsby',                   'F. Scott Fitzgerald',  'book',     'FIC-005', '2026-05-03', '2026-05-17', null,         'active', 0, staffId,  '2026-05-03 09:00:00').lastInsertRowid;
  lR.tristan_think = insertLoan.run(insertedUsers['Tristan Herrera'],   'Thinking, Fast and Slow',            'Daniel Kahneman',      'book',     'PSY-001', '2026-05-06', '2026-05-20', null,         'active', 0, staffId3, '2026-05-06 10:00:00').lastInsertRowid;
  lR.michelle_hp   = insertLoan.run(insertedUsers['Michelle Tan'],      "Harry Potter and the Sorcerer's Stone",'J.K. Rowling',       'book',     'FIC-006', '2026-05-01', '2026-05-15', null,         'active', 0, staffId3, '2026-05-01 09:00:00').lastInsertRowid;
  // Renewed once — tests max renewal edge case
  lR.christian_rich= insertLoan.run(insertedUsers['Christian Belo'],    'Rich Dad Poor Dad',                  'Robert T. Kiyosaki',   'book',     'BUS-001', '2026-04-10', '2026-05-22', null,         'active', 1, staffId,  '2026-04-10 10:00:00').lastInsertRowid;
  lR.patricia_bob  = insertLoan.run(insertedUsers['Patricia Navarro'],  'Ang Paboritong Libro ni Hudas',      'Bob Ong',              'book',     'FIL-005', '2026-05-04', '2026-05-18', null,         'active', 0, staffId3, '2026-05-04 09:30:00').lastInsertRowid;

  // ── RETURNED — on time ───────────────────────────────────────────────────────
  lR.ana_alch_r    = insertLoan.run(insertedUsers['Ana Marie Lim'],     'The Alchemist',                      'Paulo Coelho',         'book',     'FIC-002', '2026-02-10', '2026-02-24', '2026-02-24', 'returned', 0, staffId,  '2026-02-10 09:00:00').lastInsertRowid;
  lR.miguel_mid_r  = insertLoan.run(insertedUsers['Miguel Santos'],     'The Midnight Library',               'Matt Haig',            'book',     'FIC-009', '2026-03-01', '2026-03-15', '2026-03-14', 'returned', 0, staffId2, '2026-03-01 10:00:00').lastInsertRowid;
  lR.jerome_bob_r  = insertLoan.run(insertedUsers['Jerome Castillo'],   'Ang Mga Kaibigan ni Mama Rosa',      'Danton Remoto',        'book',     'FIL-006', '2026-02-05', '2026-02-19', '2026-02-19', 'returned', 0, staffId2, '2026-02-05 10:00:00').lastInsertRowid;
  lR.patricia_ng_r = insertLoan.run(insertedUsers['Patricia Navarro'],  'National Geographic',                'Various',              'magazine', 'MAG-001', '2026-04-01', '2026-04-15', '2026-04-14', 'returned', 0, staffId,  '2026-04-01 09:00:00').lastInsertRowid;
  lR.bianca_pri_r  = insertLoan.run(insertedUsers['Bianca Reyes'],      'Pride and Prejudice',                'Jane Austen',          'book',     'FIC-004', '2026-01-15', '2026-01-29', '2026-01-28', 'returned', 0, staffId,  '2026-01-15 09:00:00').lastInsertRowid;
  lR.tristan_noli_r= insertLoan.run(insertedUsers['Tristan Herrera'],   'Noli Me Tangere',                    'Jose Rizal',           'book',     'FIL-001', '2026-02-03', '2026-02-17', '2026-02-16', 'returned', 0, staffId2, '2026-02-03 10:00:00').lastInsertRowid;
  lR.michelle_sap_r= insertLoan.run(insertedUsers['Michelle Tan'],      'Sapiens: A Brief History of Humankind','Yuval Noah Harari',  'book',     'HIS-001', '2026-04-08', '2026-04-22', '2026-04-21', 'returned', 0, staffId,  '2026-04-08 10:00:00').lastInsertRowid;
  lR.christian_cos_r=insertLoan.run(insertedUsers['Christian Belo'],    'Cosmos',                             'Carl Sagan',           'book',     'SCI-001', '2026-03-20', '2026-04-03', '2026-04-03', 'returned', 0, staffId,  '2026-03-20 09:00:00').lastInsertRowid;
  // Renewed to max (2 renewals) then returned
  lR.renzo_1984_r  = insertLoan.run(insertedUsers['Renzo dela Torre'],  '1984',                               'George Orwell',        'book',     'FIC-003', '2026-01-20', '2026-02-17', '2026-02-17', 'returned', 2, staffId2, '2026-01-20 09:00:00').lastInsertRowid;

  // ── RETURNED — late (generated fines) ────────────────────────────────────────
  // 3 days late → ₱30
  lR.karen_flor_r  = insertLoan.run(insertedUsers['Karen Villanueva'],  'Florante at Laura',                  'Francisco Balagtas',   'book',     'FIL-003', '2026-03-10', '2026-03-24', '2026-03-27', 'returned', 0, staffId,  '2026-03-10 09:30:00').lastInsertRowid;
  // 3 days late → ₱30
  lR.danilo_gats_r = insertLoan.run(insertedUsers['Danilo Gomez'],      'The Great Gatsby',                   'F. Scott Fitzgerald',  'book',     'FIC-005', '2026-03-15', '2026-03-29', '2026-04-01', 'returned', 0, staffId2, '2026-03-15 10:00:00').lastInsertRowid;
  // 3 days late → ₱30
  lR.donna_time_r  = insertLoan.run(insertedUsers['Donna Cruz'],        'Time Magazine',                      'Various',              'magazine', 'MAG-002', '2026-04-05', '2026-04-19', '2026-04-22', 'returned', 0, staffId3, '2026-04-05 09:00:00').lastInsertRowid;
  // 7 days late → ₱70 (suspended member's history)
  lR.rosario_1984_r= insertLoan.run(insertedUsers['Rosario Mendoza'],   '1984',                               'George Orwell',        'book',     'FIC-003', '2026-01-20', '2026-02-03', '2026-02-10', 'returned', 0, staffId2, '2026-01-20 09:30:00').lastInsertRowid;

  // ── FINES ────────────────────────────────────────────────────────────────────
  const insertFine = db.prepare(`
    INSERT INTO fines (member_id, loan_id, amount, reason, status, paid_date, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  // Pending — from current overdue loans
  insertFine.run(insertedUsers['Miguel Santos'],    lR.miguel_noli,    20.00,  'Overdue — 2 days past due date',                        'pending', null,         '2026-05-09 08:00:00');
  insertFine.run(insertedUsers['Donna Cruz'],       lR.donna_pride,    60.00,  'Overdue — 6 days past due date',                        'pending', null,         '2026-05-06 08:00:00');
  insertFine.run(insertedUsers['Renzo dela Torre'], lR.renzo_alch,    120.00,  'Overdue — 12 days past due date',                       'pending', null,         '2026-04-30 08:00:00');
  insertFine.run(insertedUsers['Karen Villanueva'], lR.karen_elfili,  200.00,  'Overdue — 20 days past due (fine cap reached)',          'pending', null,         '2026-04-24 08:00:00');
  insertFine.run(insertedUsers['Jerome Castillo'],  lR.jerome_sap,    200.00,  'Overdue — 38 days past due (fine cap reached)',          'pending', null,         '2026-04-14 08:00:00');
  insertFine.run(insertedUsers['Rosario Mendoza'],  lR.rosario_tokill,200.00,  'Overdue — 44 days past due (fine cap reached)',          'pending', null,         '2026-04-09 08:00:00');

  // Paid — today (2026-05-10) → visible under "Today" and "This Month"
  insertFine.run(insertedUsers['Donna Cruz'],       lR.donna_time_r,   30.00,  'Returned 3 days late — Time Magazine',                  'paid',    '2026-05-10', '2026-04-23 09:00:00');
  insertFine.run(insertedUsers['Danilo Gomez'],     lR.danilo_gats_r,  30.00,  'Returned 3 days late — The Great Gatsby',               'paid',    '2026-05-10', '2026-04-02 09:00:00');

  // Paid — this month, not today (2026-05-01 to 05-09) → visible under "This Month" only
  insertFine.run(insertedUsers['Karen Villanueva'], lR.karen_flor_r,   30.00,  'Returned 3 days late — Florante at Laura',              'paid',    '2026-05-07', '2026-03-28 09:00:00');
  insertFine.run(insertedUsers['Ana Marie Lim'],    null,              50.00,  'Damaged item — cover torn, partial replacement fee',    'paid',    '2026-05-03', '2026-05-03 11:00:00');
  insertFine.run(insertedUsers['Michelle Tan'],     null,              20.00,  'Lost library card replacement fee',                     'paid',    '2026-05-02', '2026-05-02 09:00:00');

  // Paid — older (April and before) → visible under "All Time" only
  insertFine.run(insertedUsers['Tristan Herrera'],  null,              80.00,  'Overdue fine settled — Q1 semester clearance',          'paid',    '2026-04-20', '2026-04-20 10:00:00');
  insertFine.run(insertedUsers['Rosario Mendoza'],  lR.rosario_1984_r, 70.00,  'Returned 7 days late — 1984',                          'paid',    '2026-03-25', '2026-02-11 09:00:00');
  insertFine.run(insertedUsers['Jerome Castillo'],  null,              60.00,  'Overdue fine settled',                                  'paid',    '2026-02-20', '2026-02-15 09:00:00');

  // Waived
  insertFine.run(insertedUsers['Ana Marie Lim'],    null,              20.00,  'First-time offense — waived per library policy',        'waived',  null,         '2026-03-15 10:00:00');
  insertFine.run(insertedUsers['Michelle Tan'],     null,              10.00,  'Grace period — extenuating circumstances approved',     'waived',  null,         '2026-03-01 09:00:00');

  // ── NOTIFICATIONS ─────────────────────────────────────────────────────────────
  const insertNotif = db.prepare(`
    INSERT INTO notifications (member_id, title, message, type, sent, sent_at, created_by, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  // Unsent
  insertNotif.run(insertedUsers['Miguel Santos'],    'Overdue Notice',      'Your loan of "Noli Me Tangere" is 2 days overdue. Please return it immediately to avoid additional charges.',                        'overdue',  0, null,             adminId,  '2026-05-09 09:00:00');
  insertNotif.run(insertedUsers['Donna Cruz'],       'Overdue Notice',      'Your loan of "Pride and Prejudice" is 6 days overdue. Current fine: ₱60.00. Please settle at the library counter.',               'overdue',  0, null,             staffId,  '2026-05-07 08:00:00');
  insertNotif.run(insertedUsers['Ana Marie Lim'],    'Due Date Reminder',   'Your loan of "1984" is due today, May 10, 2026. Please return it before closing time to avoid late charges.',                      'reminder', 0, null,             staffId2, '2026-05-10 07:30:00');
  insertNotif.run(insertedUsers['Danilo Gomez'],     'Due Date Reminder',   'Your loan of "Cosmos" is due today, May 10, 2026. Please return it before the library closes at 5:00 PM.',                        'reminder', 0, null,             staffId2, '2026-05-10 07:31:00');

  // Sent
  insertNotif.run(insertedUsers['Renzo dela Torre'], 'Overdue Notice',      'Your loan of "The Alchemist" is 12 days overdue. Outstanding fine: ₱120.00. Please settle immediately.',                          'overdue',  1, '2026-05-05 09:00:00', adminId,  '2026-05-05 09:00:00');
  insertNotif.run(insertedUsers['Karen Villanueva'], 'Final Overdue Notice','Your loan of "El Filibusterismo" has reached the maximum fine of ₱200.00. Continued non-return may result in account suspension.', 'overdue',  1, '2026-04-30 09:00:00', adminId,  '2026-04-30 09:00:00');
  insertNotif.run(insertedUsers['Jerome Castillo'],  'Overdue Warning',     'Your loan of "Sapiens" is severely overdue (38 days). Fine capped at ₱200.00. Please return the item immediately.',               'overdue',  1, '2026-04-20 09:00:00', adminId,  '2026-04-20 09:00:00');
  insertNotif.run(insertedUsers['Rosario Mendoza'],  'Account Suspended',   'Your library account has been suspended due to multiple unresolved overdue loans and unpaid fines. Please visit the library.',     'warning',  1, '2026-04-15 10:00:00', adminId,  '2026-04-15 10:00:00');
  insertNotif.run(insertedUsers['Tristan Herrera'],  'Due Date Reminder',   'Your loan of "Thinking, Fast and Slow" is due on May 20, 2026. You have 10 days remaining.',                                      'reminder', 1, '2026-05-10 08:00:00', staffId3, '2026-05-10 08:00:00');
  insertNotif.run(null,                              'Library Notice',      'The library will be closed on May 12, 2026 (Monday) for a staff development seminar. Due dates on that day are extended by one day.','info',   1, '2026-05-08 10:00:00', adminId,  '2026-05-08 10:00:00');
  insertNotif.run(null,                              'System Notice',       'Reminder: End-of-semester library clearance deadline is May 30, 2026. All outstanding fines and loans must be settled.',           'warning',  0, null,             adminId,  '2026-05-09 09:00:00');
  insertNotif.run(null,                              'System Update',       'CloudFolio Library System has been upgraded. New features: fine period filtering and the Class Calendar planner.',                   'info',     1, '2026-04-01 08:00:00', adminId,  '2026-04-01 08:00:00');

  // ── SYSTEM SETTINGS ───────────────────────────────────────────────────────────
  const insertSetting = db.prepare(`
    INSERT INTO system_settings (key, value, label, type) VALUES (?, ?, ?, ?)
  `);

  insertSetting.run('loan_period_days', '14',   'Default Loan Period (days)',         'number');
  insertSetting.run('fine_per_day',     '10.00','Fine Per Day (PHP)',                  'number');
  insertSetting.run('fine_cap',         '200.00','Fine Cap (PHP)',                     'number');
  insertSetting.run('max_renewals',     '2',    'Maximum Renewals',                   'number');
  insertSetting.run('max_active_loans', '5',    'Maximum Active Loans Per Member',    'number');
  insertSetting.run('library_name',     'CloudFolio School Library', 'Library Name',  'text');
  insertSetting.run('library_email',    'library@cloudfolio.edu.ph', 'Library Email', 'text');
  insertSetting.run('library_phone',    '(02) 8888-1234',            'Library Phone', 'text');
  insertSetting.run('library_address',  'Rm. 101, Main Building, CloudFolio Academy, Quezon City, Philippines', 'Library Address', 'text');

  // ── ACTIVITY LOGS ─────────────────────────────────────────────────────────────
  const insertLog = db.prepare(`
    INSERT INTO activity_logs (user_id, user_name, action, entity_type, entity_id, details, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  // May 10 (today)
  insertLog.run(adminId,  'Ligaya Fernandez', 'LOGIN',             'auth',         null,               'Admin login',                                                              '2026-05-10 07:15:00');
  insertLog.run(staffId2, 'Sheila Bautista',  'LOGIN',             'auth',         null,               'Staff login',                                                              '2026-05-10 07:30:00');
  insertLog.run(staffId2, 'Sheila Bautista',  'SEND_NOTIFICATION', 'notification', null,               'Sent due date reminder to Ana Marie Lim — 1984',                          '2026-05-10 07:35:00');
  insertLog.run(staffId2, 'Sheila Bautista',  'SEND_NOTIFICATION', 'notification', null,               'Sent due date reminder to Danilo Gomez — Cosmos',                         '2026-05-10 07:36:00');
  insertLog.run(staffId3, 'Dennis Ocampo',    'LOGIN',             'auth',         null,               'Staff login',                                                              '2026-05-10 08:00:00');
  insertLog.run(staffId3, 'Dennis Ocampo',    'MARK_FINE_PAID',   'fine',         null,               'Fine paid — Donna Cruz PHP 30.00 (Time Magazine, 3 days late)',            '2026-05-10 08:30:00');
  insertLog.run(staffId3, 'Dennis Ocampo',    'MARK_FINE_PAID',   'fine',         null,               'Fine paid — Danilo Gomez PHP 30.00 (The Great Gatsby, 3 days late)',       '2026-05-10 08:35:00');
  // May 9
  insertLog.run(staffId,  'Rommel Aquino',    'LOGIN',             'auth',         null,               'Staff login',                                                              '2026-05-09 08:00:00');
  insertLog.run(staffId,  'Rommel Aquino',    'CREATE_FINE',       'fine',         null,               'Fine created — Miguel Santos PHP 20.00 (Noli Me Tangere, 2 days overdue)', '2026-05-09 08:30:00');
  insertLog.run(adminId,  'Ligaya Fernandez', 'SEND_NOTIFICATION', 'notification', null,               'Sent overdue notice to Miguel Santos',                                     '2026-05-09 09:00:00');
  // May 8
  insertLog.run(adminId,  'Ligaya Fernandez', 'SEND_NOTIFICATION', 'notification', null,               'Sent library closure notice — all members',                               '2026-05-08 10:00:00');
  // May 7
  insertLog.run(staffId,  'Rommel Aquino',    'MARK_FINE_PAID',   'fine',         null,               'Fine paid — Karen Villanueva PHP 30.00 (Florante at Laura, 3 days late)', '2026-05-07 09:00:00');
  insertLog.run(staffId,  'Rommel Aquino',    'SEND_NOTIFICATION', 'notification', null,               'Sent overdue notice to Donna Cruz',                                        '2026-05-07 08:00:00');
  // May 6
  insertLog.run(staffId,  'Rommel Aquino',    'CREATE_FINE',       'fine',         null,               'Fine created — Donna Cruz PHP 60.00 (Pride and Prejudice, 6 days overdue)','2026-05-06 08:30:00');
  insertLog.run(staffId3, 'Dennis Ocampo',    'CREATE_LOAN',       'loan',         lR.tristan_think,   'Created loan for Tristan Herrera — Thinking, Fast and Slow',               '2026-05-06 10:00:00');
  // May 4-3
  insertLog.run(staffId3, 'Dennis Ocampo',    'CREATE_LOAN',       'loan',         lR.patricia_bob,    'Created loan for Patricia Navarro — Ang Paboritong Libro ni Hudas',        '2026-05-04 09:30:00');
  insertLog.run(staffId,  'Rommel Aquino',    'MARK_FINE_PAID',   'fine',         null,               'Fine paid — Ana Marie Lim PHP 50.00 (damaged item)',                       '2026-05-03 11:00:00');
  // May 2-1
  insertLog.run(staffId2, 'Sheila Bautista',  'MARK_FINE_PAID',   'fine',         null,               'Fine paid — Michelle Tan PHP 20.00 (library card replacement)',            '2026-05-02 09:00:00');
  insertLog.run(staffId3, 'Dennis Ocampo',    'CREATE_LOAN',       'loan',         lR.michelle_hp,     'Created loan for Michelle Tan — Harry Potter and the Sorcerers Stone',    '2026-05-01 09:00:00');
  // April 30
  insertLog.run(adminId,  'Ligaya Fernandez', 'SEND_NOTIFICATION', 'notification', null,               'Sent final overdue notice to Karen Villanueva',                           '2026-04-30 09:00:00');
  insertLog.run(staffId,  'Rommel Aquino',    'CREATE_FINE',       'fine',         null,               'Fine created — Renzo dela Torre PHP 120.00 (The Alchemist, 12 days)',      '2026-04-30 08:00:00');
  // April 28
  insertLog.run(adminId,  'Ligaya Fernandez', 'CREATE_MEMBER',     'user',         insertedUsers['Ysabel Flores'], 'Created member account: Ysabel Flores',                     '2026-04-28 10:00:00');
  // April 24
  insertLog.run(staffId,  'Rommel Aquino',    'CREATE_FINE',       'fine',         null,               'Fine created — Karen Villanueva PHP 200.00 (El Filibusterismo, cap)',      '2026-04-24 08:00:00');
  insertLog.run(staffId,  'Rommel Aquino',    'RENEW_LOAN',        'loan',         lR.christian_rich,  'Renewed loan for Christian Belo — Rich Dad Poor Dad (renewal 1 of 2)',     '2026-04-24 10:00:00');
  // April 22
  insertLog.run(staffId2, 'Sheila Bautista',  'RETURN_BOOK',       'loan',         lR.donna_time_r,    'Returned: Time Magazine by Donna Cruz — 3 days late',                     '2026-04-22 11:00:00');
  // April 21
  insertLog.run(staffId2, 'Sheila Bautista',  'RETURN_BOOK',       'loan',         lR.michelle_sap_r,  'Returned: Sapiens by Michelle Tan',                                        '2026-04-21 10:00:00');
  // April 20
  insertLog.run(staffId,  'Rommel Aquino',    'MARK_FINE_PAID',   'fine',         null,               'Fine settled — Tristan Herrera PHP 80.00 (Q1 clearance)',                 '2026-04-20 10:00:00');
  insertLog.run(adminId,  'Ligaya Fernandez', 'SEND_NOTIFICATION', 'notification', null,               'Sent overdue warning to Jerome Castillo',                                  '2026-04-20 09:00:00');
  insertLog.run(staffId3, 'Dennis Ocampo',    'CREATE_LOAN',       'loan',         lR.donna_pride,     'Created loan for Donna Cruz — Pride and Prejudice',                        '2026-04-20 10:00:00');
  // April 15
  insertLog.run(adminId,  'Ligaya Fernandez', 'SUSPEND_MEMBER',    'user',         insertedUsers['Rosario Mendoza'], 'Suspended account: Rosario Mendoza — multiple unresolved overdue loans', '2026-04-15 10:00:00');
  insertLog.run(adminId,  'Ligaya Fernandez', 'SEND_NOTIFICATION', 'notification', null,               'Sent suspension notice to Rosario Mendoza',                               '2026-04-15 10:05:00');
  // April 14
  insertLog.run(staffId,  'Rommel Aquino',    'CREATE_FINE',       'fine',         null,               'Fine created — Jerome Castillo PHP 200.00 (Sapiens, 38 days, cap)',        '2026-04-14 08:00:00');
  insertLog.run(staffId3, 'Dennis Ocampo',    'CREATE_LOAN',       'loan',         lR.renzo_alch,      'Created loan for Renzo dela Torre — The Alchemist',                        '2026-04-14 09:30:00');
  // April 9
  insertLog.run(staffId,  'Rommel Aquino',    'CREATE_FINE',       'fine',         null,               'Fine created — Rosario Mendoza PHP 200.00 (To Kill a Mockingbird, cap)',   '2026-04-09 08:00:00');
  // April 6
  insertLog.run(staffId2, 'Sheila Bautista',  'CREATE_LOAN',       'loan',         lR.karen_elfili,    'Created loan for Karen Villanueva — El Filibusterismo',                    '2026-04-06 10:00:00');
  // April 3
  insertLog.run(staffId,  'Rommel Aquino',    'RETURN_BOOK',       'loan',         lR.christian_cos_r, 'Returned: Cosmos by Christian Belo',                                       '2026-04-03 09:00:00');
  // April 1
  insertLog.run(staffId,  'Rommel Aquino',    'RETURN_BOOK',       'loan',         lR.danilo_gats_r,   'Returned: The Great Gatsby by Danilo Gomez — 3 days late',                '2026-04-01 10:00:00');
  insertLog.run(staffId2, 'Sheila Bautista',  'CREATE_LOAN',       'loan',         lR.patricia_ng_r,   'Created loan for Patricia Navarro — National Geographic',                  '2026-04-01 09:00:00');
  // March 27
  insertLog.run(staffId,  'Rommel Aquino',    'RETURN_BOOK',       'loan',         lR.karen_flor_r,    'Returned: Florante at Laura by Karen Villanueva — 3 days late',            '2026-03-27 09:00:00');
  // March 25
  insertLog.run(staffId2, 'Sheila Bautista',  'MARK_FINE_PAID',   'fine',         null,               'Fine paid — Rosario Mendoza PHP 70.00 (1984, 7 days late)',                '2026-03-25 10:00:00');
  // March 19
  insertLog.run(staffId,  'Rommel Aquino',    'CREATE_LOAN',       'loan',         lR.jerome_sap,      'Created loan for Jerome Castillo — Sapiens',                               '2026-03-19 09:00:00');
  // March 15
  insertLog.run(staffId,  'Rommel Aquino',    'WAIVE_FINE',        'fine',         null,               'Fine waived — Ana Marie Lim PHP 20.00 (first-time offense)',               '2026-03-15 10:00:00');
  // March 14
  insertLog.run(staffId2, 'Sheila Bautista',  'RETURN_BOOK',       'loan',         lR.miguel_mid_r,    'Returned: The Midnight Library by Miguel Santos',                          '2026-03-14 10:00:00');
  // March 13
  insertLog.run(staffId3, 'Dennis Ocampo',    'CREATE_LOAN',       'loan',         lR.rosario_tokill,  'Created loan for Rosario Mendoza — To Kill a Mockingbird',                 '2026-03-13 10:30:00');
  // March 1
  insertLog.run(staffId2, 'Sheila Bautista',  'WAIVE_FINE',        'fine',         null,               'Fine waived — Michelle Tan PHP 10.00 (extenuating circumstances)',         '2026-03-01 09:00:00');
  // February
  insertLog.run(staffId2, 'Sheila Bautista',  'MARK_FINE_PAID',   'fine',         null,               'Fine paid — Jerome Castillo PHP 60.00',                                    '2026-02-20 10:00:00');
  insertLog.run(staffId,  'Rommel Aquino',    'RETURN_BOOK',       'loan',         lR.rosario_1984_r,  'Returned: 1984 by Rosario Mendoza — 7 days late',                         '2026-02-10 09:00:00');
  insertLog.run(adminId,  'Ligaya Fernandez', 'CREATE_MEMBER',     'user',         insertedUsers['Dennis Ocampo'], 'Added staff account: Dennis Ocampo',                          '2026-02-01 08:00:00');
  insertLog.run(adminId,  'Ligaya Fernandez', 'UPDATE_SETTINGS',   'settings',     null,               'Added Dennis Ocampo as staff — system access granted',                     '2026-02-01 08:30:00');
  // January
  insertLog.run(adminId,  'Ligaya Fernandez', 'UPDATE_SETTINGS',   'settings',     null,               'Set fine_cap to ₱200.00 and fine_per_day to ₱10.00',                      '2026-01-15 10:00:00');
  insertLog.run(adminId,  'Ligaya Fernandez', 'LOGIN',             'auth',         null,               'Initial system setup and configuration',                                   '2026-01-02 08:00:00');

  // ── SUSPENDED DAYS (calendar planner) ────────────────────────────────────────
  const insertSuspended = db.prepare(`
    INSERT INTO suspended_days (date, reason, created_by, created_at) VALUES (?, ?, ?, ?)
  `);

  insertSuspended.run('2026-05-01', 'Labor Day — National Holiday',                           adminId, '2026-04-28 09:00:00');
  insertSuspended.run('2026-05-07', 'Class Suspension — Typhoon Signal No. 1 (PAGASA)',       adminId, '2026-05-07 06:00:00');

  console.log('Database seeded successfully.');
}

// Seed books catalog if empty
const bookCount = db.prepare('SELECT COUNT(*) as count FROM books').get();
if (bookCount.count === 0) {
  const insertBook = db.prepare(`
    INSERT INTO books (title, author, isbn, category, call_no, type, total_copies, available_copies, published_year, added_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const b = '2026-01-02 08:00:00';

  // ── Filipino Literature ────────────────────────────────────────────────────────
  // FIL-001: 2 copies, 1 out on loan (Miguel Santos — overdue)
  insertBook.run('Noli Me Tangere',                   'Jose Rizal',         '978-971-10-1723-7', 'Filipino Literature', 'FIL-001', 'book',    2, 1, 1887, b);
  // FIL-002: 2 copies, 1 out on loan (Karen Villanueva — overdue)
  insertBook.run('El Filibusterismo',                 'Jose Rizal',         '978-971-10-1724-4', 'Filipino Literature', 'FIL-002', 'book',    2, 1, 1891, b);
  // FIL-003: 2 copies, all available (Karen returned it)
  insertBook.run('Florante at Laura',                 'Francisco Balagtas', null,                'Filipino Literature', 'FIL-003', 'book',    2, 2, 1838, b);
  // FIL-004: 1 copy, available
  insertBook.run('Ibong Adarna',                      'Anonymous',          null,                'Filipino Literature', 'FIL-004', 'book',    1, 1, 1700, b);
  // FIL-005: 2 copies, 1 out (Patricia Navarro — active)
  insertBook.run('Ang Paboritong Libro ni Hudas',     'Bob Ong',            null,                'Filipino Literature', 'FIL-005', 'book',    2, 1, 2004, b);
  // FIL-006: 1 copy, available (Jerome returned it)
  insertBook.run('Ang Mga Kaibigan ni Mama Rosa',     'Danton Remoto',      null,                'Filipino Literature', 'FIL-006', 'book',    1, 1, 2012, b);
  // FIL-007: 2 copies, available
  insertBook.run('Banaag at Sikat',                   'Lope K. Santos',     null,                'Filipino Literature', 'FIL-007', 'book',    2, 2, 1906, b);
  // FIL-008: 3 copies, available
  insertBook.run('Luha ng Buwaya',                    'Amado V. Hernandez', null,                'Filipino Literature', 'FIL-008', 'book',    3, 3, 1962, b);

  // ── Fiction ───────────────────────────────────────────────────────────────────
  // FIC-001: 2 copies, available
  insertBook.run('Animal Farm',                       'George Orwell',      '978-0-14-118776-1', 'Fiction',             'FIC-001', 'book',    2, 2, 1945, b);
  // FIC-002: 3 copies, 1 out (Renzo dela Torre — overdue)
  insertBook.run('The Alchemist',                     'Paulo Coelho',       '978-0-06-231609-7', 'Fiction',             'FIC-002', 'book',    3, 2, 1988, b);
  // FIC-003: 2 copies, 1 out (Ana Marie Lim — due today)
  insertBook.run('1984',                              'George Orwell',      '978-0-452-28423-4', 'Fiction',             'FIC-003', 'book',    2, 1, 1949, b);
  // FIC-004: 2 copies, 1 out (Donna Cruz — overdue)
  insertBook.run('Pride and Prejudice',               'Jane Austen',        '978-0-14-143951-8', 'Fiction',             'FIC-004', 'book',    2, 1, 1813, b);
  // FIC-005: 2 copies, 1 out (Bianca Reyes — active)
  insertBook.run('The Great Gatsby',                  'F. Scott Fitzgerald','978-0-7432-7356-5', 'Fiction',             'FIC-005', 'book',    2, 1, 1925, b);
  // FIC-006: 3 copies, 1 out (Michelle Tan — active)
  insertBook.run("Harry Potter and the Sorcerer's Stone",'J.K. Rowling',   '978-0-590-35340-3', 'Fiction',             'FIC-006', 'book',    3, 2, 1997, b);
  // FIC-007: 2 copies, 1 out (Rosario Mendoza — overdue, suspended member)
  insertBook.run('To Kill a Mockingbird',             'Harper Lee',         '978-0-06-112008-4', 'Fiction',             'FIC-007', 'book',    2, 1, 1960, b);
  // FIC-008: 2 copies, available
  insertBook.run('The Da Vinci Code',                 'Dan Brown',          '978-0-385-50420-5', 'Mystery',             'FIC-008', 'book',    2, 2, 2003, b);
  // FIC-009: 2 copies, available (Miguel returned it)
  insertBook.run('The Midnight Library',              'Matt Haig',          '978-0-525-55947-4', 'Fiction',             'FIC-009', 'book',    2, 2, 2020, b);
  // FIC-010: 2 copies, available
  insertBook.run('The Little Prince',                 'Antoine de Saint-Exupéry','978-0-15-246227-3','Fiction',          'FIC-010', 'book',    2, 2, 1943, b);
  // FIC-011: 1 copy, available — single-copy edge case
  insertBook.run('Brave New World',                   'Aldous Huxley',      '978-0-06-085052-4', 'Fiction',             'FIC-011', 'book',    1, 1, 1932, b);
  // FIC-012: 2 copies, available
  insertBook.run('The Hunger Games',                  'Suzanne Collins',    '978-0-439-02348-1', 'Fiction',             'FIC-012', 'book',    2, 2, 2008, b);

  // ── History & Social Studies ──────────────────────────────────────────────────
  // HIS-001: 2 copies, 1 out (Jerome Castillo — overdue)
  insertBook.run('Sapiens: A Brief History of Humankind','Yuval Noah Harari','978-0-06-231609-8','History',             'HIS-001', 'book',    2, 1, 2011, b);
  // HIS-002: 2 copies, available
  insertBook.run('Homo Deus',                         'Yuval Noah Harari',  '978-0-06-246431-6', 'History',             'HIS-002', 'book',    2, 2, 2015, b);
  // HIS-003: 2 copies, available
  insertBook.run('A Short History of Nearly Everything','Bill Bryson',      '978-0-7679-0818-4', 'History',             'HIS-003', 'book',    2, 2, 2003, b);

  // ── Science ───────────────────────────────────────────────────────────────────
  // SCI-001: 2 copies, 1 out (Danilo Gomez — due today)
  insertBook.run('Cosmos',                            'Carl Sagan',         '978-0-345-33135-9', 'Science',             'SCI-001', 'book',    2, 1, 1980, b);
  // SCI-002: 2 copies, available
  insertBook.run('A Brief History of Time',           'Stephen Hawking',    '978-0-553-38016-3', 'Science',             'SCI-002', 'book',    2, 2, 1988, b);
  // SCI-003: 2 copies, available
  insertBook.run('The Selfish Gene',                  'Richard Dawkins',    '978-0-19-929114-4', 'Science',             'SCI-003', 'book',    2, 2, 1976, b);

  // ── Psychology & Self-Help ────────────────────────────────────────────────────
  // PSY-001: 2 copies, 1 out (Tristan Herrera — active)
  insertBook.run('Thinking, Fast and Slow',           'Daniel Kahneman',    '978-0-374-27563-1', 'Psychology',          'PSY-001', 'book',    2, 1, 2011, b);
  // PSY-002: 2 copies, available
  insertBook.run('Man\'s Search for Meaning',         'Viktor E. Frankl',   '978-0-8070-1427-1', 'Psychology',          'PSY-002', 'book',    2, 2, 1946, b);
  // PSY-003: 2 copies, available
  insertBook.run('Atomic Habits',                     'James Clear',        '978-0-7352-1129-2', 'Self-Help',           'PSY-003', 'book',    2, 2, 2018, b);
  // PSY-004: 1 copy, available
  insertBook.run('The 7 Habits of Highly Effective People','Stephen R. Covey','978-0-7432-6951-3','Self-Help',          'PSY-004', 'book',    1, 1, 1989, b);

  // ── Business & Finance ────────────────────────────────────────────────────────
  // BUS-001: 3 copies, 1 out (Christian Belo — active, renewed once)
  insertBook.run('Rich Dad Poor Dad',                 'Robert T. Kiyosaki', '978-1-61268-120-4', 'Business & Finance',  'BUS-001', 'book',    3, 2, 1997, b);
  // BUS-002: 2 copies, available
  insertBook.run('The Lean Startup',                  'Eric Ries',          '978-0-307-88789-4', 'Business & Finance',  'BUS-002', 'book',    2, 2, 2011, b);

  // ── Magazines ─────────────────────────────────────────────────────────────────
  // MAG-001: 5 copies, 4 available (Patricia returned 1)
  insertBook.run('National Geographic',               'Various',            null,                'Science',             'MAG-001', 'magazine', 5, 4, null, b);
  // MAG-002: 3 copies, 2 available (Donna returned 1)
  insertBook.run('Time Magazine',                     'Various',            null,                'News & Current Events','MAG-002', 'magazine', 3, 2, null, b);
  // MAG-003: 3 copies, all available
  insertBook.run('Reader\'s Digest',                  'Various',            null,                'General',             'MAG-003', 'magazine', 3, 3, null, b);

  // ── DVDs ──────────────────────────────────────────────────────────────────────
  insertBook.run('An Inconvenient Truth',             'Al Gore',            null,                'Documentary',         'DVD-001', 'dvd',     2, 2, 2006, b);
  insertBook.run('The Social Dilemma',                'Jeff Orlowski',      null,                'Documentary',         'DVD-002', 'dvd',     2, 2, 2020, b);

  console.log('Books catalog seeded successfully.');
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
