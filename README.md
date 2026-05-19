# Goal Tracker

Comprehensive README describing important features, architecture, deployment, configuration, and operational procedures for this repository.

---

## 1) Project Overview

Goal Tracker is a goals and check-ins application that provides:
- User authentication (email/JWT) and optional Azure AD SSO (OIDC).
- Goal lifecycle: creation, assignment, submission, review, and progress tracking.
- Escalation rules with automated sweeps and notification logs.
- Analytics powered by materialized views for fast reporting and CSV exports.
- Email notifications via SendGrid, with SMTP fallback.

Repository layout
- `server/` — Express API, DB access, schedulers and admin endpoints.
- `client/` — React (Vite) single-page app.

---

## 2) Important Features

1. Authentication and SSO
   - Local email-based authentication issues JWT tokens.
   - Azure AD SSO via OIDC: visit `/auth/azure/login` to sign in; callback will upsert user and issue JWT.
   - Azure tenant sync utility imports users and managers using Graph API (client credentials flow).

2. Goals & Check-ins
   - REST endpoints under `/api/goals` and related routes support CRUD, status updates, and check-ins.
   - Shared goals support cross-user assignments and tracking.

3. Escalations
   - Rules define when an escalation is created (e.g., overdue submission).
   - `runEscalationSweep()` evaluates rules and writes `escalation_logs` which are viewable via admin endpoints.

4. Analytics
   - Materialized views (created in `analyticsService`) provide quarterly trends, distributions, and manager heatmaps.
   - Admin endpoint `/api/admin/analytics/refresh` ensures views exist and can be refreshed.

5. Notifications
   - `server/utils/notifications.js` uses SendGrid if `SENDGRID_API_KEY` is provided; otherwise falls back to SMTP.
   - Emails include deep links to the client using `CLIENT_URL`.

---

## 3) Architecture & deployment 

- Topology: Client (Vercel) → Server (Render) → Postgres (Render or external). Integrations: Azure AD, SendGrid.
- Automation: GitHub Actions workflows (in this repo) trigger cron POSTs to admin endpoints; Render Cron optional.

Deployment quick notes
- Backend: deploy `server/` to Render, set the env vars listed below, and deploy.
- Frontend: deploy `client/` to Vercel; set `VITE_API_BASE_URL` to backend origin and update server `CLIENT_URL`.

## 4) Detailed Features

Below are the practical details for implemented features and how to interact with them.

- Authentication
   - Endpoints: `/api/auth/login`, `/api/auth/register`, `/auth/azure/login`, `/auth/azure/callback`.
   - JWT: tokens returned in redirect (Azure) or login response. Client stores token in `localStorage` and sends in `Authorization` header.
   - Roles: `admin`, `manager`, `employee` — enforced by `requireRole()` middleware.

- Goals API
   - List/create/update/delete: standard REST under `/api/goals`.
   - Important fields: `title`, `description`, `employee_id`, `manager_id`, `status`, `progress_score`, `deadline`, `created_at`, `submitted_at`.
   - Shared goals: `/api/goals/shared` and `shared_goal_assignments` table manage assignments.

- Check-ins
   - Each goal can have check-ins (progress entries). Check-ins endpoints under `/api/checkins`.
   - Check-in fields: `goal_id`, `user_id`, `achievement_value`, `comment`, `created_at`.

- Escalations
   - Rules stored in DB (`escalation_rules`) with conditions like `days_overdue` and `target_status`.
   - `POST /api/admin/escalations/run` triggers evaluation (used by scheduler). Returns a summary of escalations created/sent.
   - `GET /api/admin/escalations/logs` and `GET /api/admin/escalations/rules` available for admin UI.
   - Example rule: "If goal not submitted 7 days after deadline, notify manager and HR".

- Analytics
   - Materialized views computed for performance (`analytics_service` creates them).
   - Exposed endpoints for trends, distributions, manager heatmaps and CSV exports under `/api/admin/analytics/*`.
   - Refresh via `POST /api/admin/analytics/refresh`.

- Notifications
   - Template: notification includes goal title, link: `${CLIENT_URL}/admin/escalations?goalId=<id>` or manager path.
   - Primary: SendGrid (env `SENDGRID_API_KEY`); fallback: SMTP with `SMTP_*` envs.

- Admin UI hooks
   - Admin pages in client call admin endpoints: refresh analytics, run escalations, view logs, manage rules and cycles.

## 5) Configuration & quick envs

Set these at minimum in Render (backend) and Vercel (frontend build):
- `DATABASE_URL`, `NODE_ENV=production`, `JWT_SECRET`, `CLIENT_URL`, `VITE_API_BASE_URL` (frontend), `CRON_SECRET`, and email/Azure secrets when used.

## 6) Operations & cron 

- Use GitHub Actions workflows included to run scheduled jobs (add `SERVER_URL` and `CRON_SECRET` as repo secrets).
- Quick manual cron test:
```
curl -X POST https://goal-tracker-server-ctg2.onrender.com/api/admin/escalations/run -H "x-cron-secret:<CRON_SECRET>"
```

## 7) Local dev 

Server
```
cd server
npm install
npm start
```
Client
```
cd client
npm install
npm run dev
```

## 8) Troubleshooting 

- Build error 127: fixed by making `postinstall` conditional in `server/package.json`.
- Catch-all route errors: fixed by serving `index.html` via middleware that skips API paths (no `*` route).

---

