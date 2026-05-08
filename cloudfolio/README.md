# CloudFolio — Library Management System

A modern, full-stack library management system built with Node.js/Express, SQLite (better-sqlite3), and a vanilla HTML/CSS/JS frontend using the CloudFolio design system.

---

## Prerequisites

- **Node.js 18+** — [Download here](https://nodejs.org/)
- **npm** (comes with Node.js)

---

## Installation

1. Navigate to the project directory:
   ```bash
   cd cloudfolio
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

---

## Running the Server

**Production mode:**
```bash
npm start
```

**Development mode (with auto-reload via nodemon):**
```bash
npm run dev
```

The server will start at: **http://localhost:3000**

The SQLite database (`db/cloudfolio.db`) is created and seeded automatically on first run.

---

## URLs

| URL | Description |
|-----|-------------|
| `http://localhost:3000/` | Landing page — portal selector |
| `http://localhost:3000/member/login.html` | Member login |
| `http://localhost:3000/member/signup.html` | Member registration |
| `http://localhost:3000/member/account.html` | Member account dashboard |
| `http://localhost:3000/staff/login.html` | Staff / Admin login |
| `http://localhost:3000/staff/dashboard.html` | Staff dashboard |
| `http://localhost:3000/staff/loans.html` | Manage loans |
| `http://localhost:3000/staff/overdue.html` | Overdue queue |
| `http://localhost:3000/staff/fines.html` | Fines & payments |
| `http://localhost:3000/staff/members.html` | Member accounts |
| `http://localhost:3000/staff/notifications.html` | Notifications |
| `http://localhost:3000/admin/dashboard.html` | Admin dashboard |
| `http://localhost:3000/admin/loans.html` | Admin: Manage loans |
| `http://localhost:3000/admin/overdue.html` | Admin: Overdue queue |
| `http://localhost:3000/admin/fines.html` | Admin: Fines & payments |
| `http://localhost:3000/admin/members.html` | Admin: Members (with create) |
| `http://localhost:3000/admin/notifications.html` | Admin: Notifications |
| `http://localhost:3000/admin/staff.html` | Admin: Staff accounts |
| `http://localhost:3000/admin/settings.html` | Admin: System settings |
| `http://localhost:3000/admin/logs.html` | Admin: Activity logs |

---

## Default Credentials

### Admin Account
| Field | Value |
|-------|-------|
| Staff ID | `ADMIN-001` |
| Email | `admin@cloudfolio.com` |
| Password | `admin123` |
| Access | Full admin portal |

### Staff Accounts
| Staff ID | Email | Password |
|----------|-------|----------|
| `STAFF-001` | `maria@cloudfolio.com` | `staff123` |
| `STAFF-002` | `pedro@cloudfolio.com` | `staff123` |

### Member Accounts
| Name | Email | Password | Status |
|------|-------|----------|--------|
| Ana Garcia | `ana@example.com` | `member123` | Active |
| Jose Reyes | `jose@example.com` | `member123` | Active |
| Carmen Lopez | `carmen@example.com` | `member123` | Suspended |
| Luis Torres | `luis@example.com` | `member123` | Active |
| Maria Santos | `maria.s@example.com` | `member123` | Active |

---

## Features

### Member Portal
- Sign in / Sign up
- View active loans, due dates, and loan status
- View outstanding fines
- Track borrowing history

### Staff Portal
- Dashboard with key stats (active loans, overdue, pending fines, members)
- Full loan management (create, return, renew)
- Overdue queue with bulk notification sending
- Fine management (mark paid, waive)
- Member account management
- Notification management

### Admin Portal
- Everything in staff portal
- Staff account management (create, edit, suspend, deactivate)
- System settings (loan period, fine rate, max renewals, library info)
- Full activity log viewer

---

## Technology Stack

| Layer | Technology |
|-------|------------|
| Runtime | Node.js 18+ |
| Web Framework | Express 4 |
| Database | SQLite via better-sqlite3 |
| Session | express-session |
| Password Hashing | bcryptjs |
| Frontend CSS | Tailwind CSS (CDN) + Custom CSS |
| Frontend Icons | Lucide Icons (CDN) |
| Fonts | Google Fonts (Plus Jakarta Sans, Crimson Pro, Courier Prime) |

---

## Project Structure

```
cloudfolio/
├── server.js           # Express app entry point
├── package.json
├── db/
│   └── database.js     # SQLite setup, schema, seed data
├── routes/
│   ├── auth.js         # Authentication routes
│   ├── loans.js        # Loan management
│   ├── members.js      # Member management
│   ├── fines.js        # Fine management
│   ├── notifications.js # Notifications
│   ├── staff.js        # Staff management (admin)
│   ├── settings.js     # System settings (admin)
│   └── logs.js         # Activity logs (admin)
└── public/
    ├── index.html      # Landing page
    ├── 404.html        # 404 error page
    ├── css/
    │   └── main.css    # Design system CSS
    ├── js/
    │   ├── theme.js    # Dark/light theme manager
    │   ├── api.js      # Fetch API wrapper
    │   ├── toast.js    # Toast notifications
    │   ├── ui.js       # UI components (modal, drawer, table)
    │   ├── staff-layout.js  # Staff sidebar/topbar
    │   └── admin-layout.js  # Admin sidebar/topbar
    ├── member/
    │   ├── login.html
    │   ├── signup.html
    │   └── account.html
    ├── staff/
    │   ├── login.html
    │   ├── dashboard.html
    │   ├── loans.html
    │   ├── overdue.html
    │   ├── fines.html
    │   ├── members.html
    │   └── notifications.html
    └── admin/
        ├── dashboard.html
        ├── loans.html
        ├── overdue.html
        ├── fines.html
        ├── members.html
        ├── notifications.html
        ├── staff.html
        ├── settings.html
        └── logs.html
```

---

## Notes

- The SQLite database file (`db/cloudfolio.db`) is created automatically on first start.
- To reset the database, delete `db/cloudfolio.db` and restart the server.
- Dark mode is persisted to `localStorage` and applies across all pages.
- Sessions use in-memory storage by default (resets on server restart in development).
