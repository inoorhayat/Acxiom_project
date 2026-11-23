# AcxiomCRM

A role-based CRM built with the **MERN stack** (MongoDB, Express, React, Node.js).
It covers the full customer-sales lifecycle: leads, customers, opportunities, follow-ups, reports, dashboard analytics, audit logging and a secured REST API.

## Features

| Area | What is included |
|---|---|
| Authentication | Register, login, logout, bcrypt password hashing, password policy, account lockout after repeated failures, JWT sessions |
| Authorization | Admin, Manager and Sales Executive roles, enforced on the server; Sales Executives see only their own/assigned records |
| Customers | CRUD, search, status, duplicate prevention (email and phone), history view, deactivation instead of deletion |
| Leads | CRUD, status workflow (New, Contacted, Qualified, Unqualified, Converted, Lost), conversion to Customer + Opportunity |
| Opportunities | CRUD, stages (Qualification, Proposal, Negotiation, Won, Lost), amount, probability, weighted pipeline, Mark Won / Lost |
| Follow-Ups | Calls, meetings, emails, tasks; Planned / Completed / Missed / Cancelled; overdue and upcoming views; reschedule |
| Users & Roles | Admin-only user management, role change, activate / deactivate, unlock, password reset |
| Dashboard | KPI cards, Chart.js charts (lead status, pipeline, monthly sales), date filters (Today, This Week, This Month, Custom) |
| Reports | Customer, Lead, Follow-Up, Opportunity, Pipeline, Conversion, User Activity, Audit; filters, pagination, CSV export |
| Audit Log | Login success/failure, lockouts, create/update/delete, status and role changes; append-only, filterable |
| Validation | Client-side (instant feedback) and server-side (mandatory), including business rules |
| Security | Helmet headers, CORS allow-list, login rate limiting, input validation, no password hashes in responses, parameterized queries |

### Business rules enforced
- Opportunity amount must be greater than 0 for open stages; probability must be 0 to 100.
- Expected close date cannot be in the past for an open opportunity.
- Follow-up date cannot be earlier than today for a new or planned follow-up.
- Email and phone are validated (phone = 10-digit Indian mobile) and must be unique for customers.
- Lead status changes must follow the configured workflow.

## Project structure

```
AcxiomCRM/
├── server/                  # Express + MongoDB API
│   ├── src/
│   │   ├── config/          # DB connection, constants (roles, statuses, workflow)
│   │   ├── controllers/     # Business logic per module
│   │   ├── middleware/      # JWT auth, role authorization, error handler
│   │   ├── models/          # Mongoose schemas
│   │   ├── routes/          # REST API routes
│   │   ├── utils/           # Validators, audit writer, pagination, scope helpers
│   │   ├── seed.js          # Demo users and sample data
│   │   └── server.js        # App entry point
│   ├── .env.example
│   └── package.json
├── client/                  # React (Vite) frontend
│   ├── src/
│   │   ├── api/             # Axios client with auth header and 401 handling
│   │   ├── components/      # Layout, shared UI, generic ResourcePage (CRUD)
│   │   ├── context/         # Auth state
│   │   ├── pages/           # Login, Register, Dashboard, Customers, Leads, ...
│   │   ├── utils/           # Client-side validators
│   │   └── styles.css       # Theme (navy / blue / teal)
│   ├── .env.example
│   ├── vercel.json          # SPA routing for Vercel
│   └── package.json
├── render.yaml              # Optional Render blueprint for the API
└── README.md
```

---

## 1. Run locally (Windows, macOS or Linux)

### Prerequisites
- **Node.js 18.17 or newer** (https://nodejs.org)
- **MongoDB**, either:
  - a free **MongoDB Atlas** cluster (recommended, no install needed), or
  - a local MongoDB Community Server installed on your PC.

### Step 1: Get the code
Download the ZIP from GitHub and extract it, or run:
```bash
git clone https://github.com/<your-username>/AcxiomCRM.git
cd AcxiomCRM
```

### Step 2: Configure the backend
```bash
cd server
cp .env.example .env        # Windows PowerShell: copy .env.example .env
```
Open `server/.env` and set:
- `MONGODB_URI` - your MongoDB connection string
  (Atlas example: `mongodb+srv://USER:PASSWORD@cluster0.xxxxx.mongodb.net/acxiomcrm`)
- `JWT_SECRET` - any long random string (32+ characters)

Install dependencies, create demo data, and start the API:
```bash
npm install
npm run seed     # creates demo users and sample records (run once)
npm run dev      # API runs on http://localhost:5000
```

### Step 3: Configure and start the frontend
Open a **second terminal**:
```bash
cd client
npm install
npm run dev      # app runs on http://localhost:5173
```
Open **http://localhost:5173** in your browser.

### Demo accounts (password for all: `Admin@123`)

| Role | Email |
|---|---|
| Admin (full access, users, audit) | admin@acxiom.com |
| Manager (team pipeline, reports) | manager@acxiom.com |
| Sales Executive (own records only) | sales@acxiom.com |

Change these passwords (or delete the users) before using the app for real data.

---

## 2. Deploy

Deploy the **API on Render** and the **frontend on Vercel**. Both read their code from GitHub.

### Step 1: Push the project to GitHub
```bash
git init
git add .
git commit -m "Initial AcxiomCRM"
git branch -M main
git remote add origin https://github.com/<your-username>/AcxiomCRM.git
git push -u origin main
```
Make sure `.env` files are **not** committed (they are listed in `.gitignore`).

### Step 2: Deploy the API on Render
1. Go to https://render.com, click **New > Web Service**, and connect your GitHub repo.
2. Settings:
   - **Root Directory:** `server`
   - **Runtime:** Node
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
3. **Environment variables** (Render dashboard > Environment):
   | Key | Value |
   |---|---|
   | `MONGODB_URI` | your Atlas connection string |
   | `JWT_SECRET` | a long random string |
   | `JWT_EXPIRES_IN` | `8h` |
   | `CLIENT_URL` | your Vercel URL, e.g. `https://acxiomcrm.vercel.app` (add more URLs separated by commas if needed) |
   | `MAX_LOGIN_ATTEMPTS` | `5` |
   | `LOCKOUT_MINUTES` | `15` |
4. Deploy. Copy the service URL (e.g. `https://acxiomcrm-api.onrender.com`).
5. Check it works: open `https://<your-render-url>/api/health`. You should see `{"status":"ok"}`.
6. Seed demo data once (optional): in Render, open **Shell** and run `npm run seed`.

> Atlas: in **Network Access**, allow connections from `0.0.0.0/0` so Render can reach the database.

### Step 3: Deploy the frontend on Vercel
1. Go to https://vercel.com, click **Add New > Project**, and import your GitHub repo.
2. Settings:
   - **Root Directory:** `client`
   - **Framework Preset:** Vite (detected automatically)
   - **Build Command:** `npm run build`
   - **Output Directory:** `dist`
3. **Environment variable:**
   | Key | Value |
   |---|---|
   | `VITE_API_URL` | your Render URL, e.g. `https://acxiomcrm-api.onrender.com` (no `/api`, no trailing slash) |
4. Deploy. Then copy the Vercel URL and set it as `CLIENT_URL` on Render (step 2.3) so CORS allows it. Redeploy Render after changing it.

---

## API reference

All protected endpoints require the header `Authorization: Bearer <token>`.

| Method | Endpoint | Access |
|---|---|---|
| POST | `/api/auth/register` | Public |
| POST | `/api/auth/login` | Public (rate limited) |
| POST | `/api/auth/logout` | Authenticated |
| GET | `/api/auth/me` | Authenticated |
| POST | `/api/auth/change-password` | Authenticated |
| GET | `/api/users/assignable` | Authenticated |
| GET / POST | `/api/users` | Admin |
| PUT | `/api/users/:id` | Admin |
| PATCH | `/api/users/:id/status` | Admin |
| POST | `/api/users/:id/unlock` | Admin |
| POST | `/api/users/:id/reset-password` | Admin |
| GET / POST | `/api/customers` | Authenticated (scoped) |
| GET / PUT / DELETE | `/api/customers/:id` | Authenticated (scoped; DELETE deactivates) |
| GET / POST | `/api/leads` | Authenticated (scoped) |
| GET / PUT | `/api/leads/:id` | Authenticated (scoped) |
| POST | `/api/leads/:id/convert` | Authenticated (scoped) |
| GET / POST | `/api/opportunities` | Authenticated (scoped) |
| GET / PUT | `/api/opportunities/:id` | Authenticated (scoped) |
| GET / POST | `/api/followups` | Authenticated (scoped) |
| PUT | `/api/followups/:id` | Authenticated (scoped) |
| PATCH | `/api/followups/:id/status` | Authenticated (scoped) |
| PATCH | `/api/followups/:id/reschedule` | Authenticated (scoped) |
| GET | `/api/dashboard?range=today\|week\|month\|custom&from&to` | Authenticated |
| GET | `/api/reports/:type?format=json\|csv` | Role-based |
| GET | `/api/audit` | Admin |

Responses use HTTP status codes 200, 201, 400 (validation, with field-level `errors`), 401, 403, 404, 409 and 423 (locked account).

Example:
```bash
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@acxiom.com","password":"Admin@123"}'
```

---

## Security notes
- Passwords are hashed with bcrypt (cost 12) and never stored or returned in plain text.
- Password policy: 8+ characters with uppercase, lowercase, number and special character.
- Accounts lock for `LOCKOUT_MINUTES` after `MAX_LOGIN_ATTEMPTS` failures; the lock and unlock events are audited.
- Authorization is enforced on every API route; hiding menu items in the UI is only a convenience.
- Audit records cannot be updated or deleted through the application.
- Secrets live only in environment variables, never in source control.
- Because the app uses bearer tokens (not cookies), cross-site request forgery does not apply to API calls.
