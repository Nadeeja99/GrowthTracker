# GrowthTracker

[![CI](https://github.com/Nadeeja99/GrowthTracker/actions/workflows/ci.yml/badge.svg)](https://github.com/Nadeeja99/GrowthTracker/actions/workflows/ci.yml)

A full-stack personal development tracker that helps you set goals, build habits, schedule activities, manage tasks, and visualise your progress over time.

---

## Features

Five areas, one loop: **plan** the week, **do** the day, **review** it, and **learn** from the data.

### Today
- Today's time blocks, daily habits and due tasks in one place, each with a one-tap **Focus** button
- Daily review: performance, energy and mood (1–5) plus notes, saved to your account
- 7-day completion strip and weekly hours per goal (planned target vs. actual)

### Plan
- **Tasks** with saved subtasks, tags, priority (low / medium / high), due dates and goal links
- **Timeline**: week calendar and hour-by-hour day view of time blocks; block statuses pending, in-progress, completed, skipped, rescheduled
- **Schedule a task** straight onto the timeline (prefilled block linked to the task)
- **Recurring blocks**: date range + weekdays, created in a single bulk request

### Goals
- Description, target date, colour, weekly/daily hour targets and priority
- **Milestones** break a goal down and drive its progress
- Weekly hours and streaks are derived from completed blocks and focus sessions (focus inside a planned block replaces the block's planned time, so nothing is counted twice)

### Habits
- Daily, weekly or monthly habits with a target count, one-tap completion, streaks and a 30-day heatmap

### Insights
- Server-computed summary for the selected range: focused time, task completion, habit consistency, average energy
- Charts for time allocation, trends and completion rates

### Focus timer (available everywhere)
- Pomodoro timer in a slide-over panel that **keeps running while you switch tabs**; the header shows the countdown
- Start it from a task or a planned block; every interval (stopped-early ones after 1 minute) is saved and counts toward the goal's hours and the task's logged time
- Accurate in background tabs (wall-clock based)

### Everywhere
- **Quick Capture**: `Cmd/Ctrl+K` to add a task or block from any page
- **Forms**: first field focused, `Cmd/Ctrl+Enter` submits
- **Design**: one blue accent on warm zinc neutrals, 1px borders instead of heavy shadows, Inter typography
- **Theme**: Light / Dark / System picker in Settings (System by default), applied before first paint so there's no flash
- **Installable**: PWA manifest with app icons (including a maskable icon for Android)
- **Resilient UX**: page-shaped loading skeletons, a first-run guide, toasts for any failed save (with the reason, or "you seem to be offline"), cached data kept on screen if a refresh fails, error boundaries and a 404 page
- **Accessible**: zero axe-core violations (WCAG 2.1 AA) in light and dark mode; dialogs trap and restore focus and close on Escape; confirmations replace `window.confirm`; every control is labelled; charts have text alternatives; skip link; honours "reduce motion"; pinch-zoom allowed
- **Security**: short-lived access token kept in memory only, silent refresh via an httpOnly cookie, and "sign out everywhere" in Settings

---

## Tech Stack

### Frontend
| Technology | Purpose |
|---|---|
| [Next.js 16](https://nextjs.org/) | React framework with App Router (one route per area) |
| [React 19](https://react.dev/) | UI library |
| [TanStack Query 5](https://tanstack.com/query) | Server-state caching, mutations and optimistic updates |
| [TypeScript](https://www.typescriptlang.org/) | Type safety |
| [Tailwind CSS](https://tailwindcss.com/) | Utility-first styling |
| [Lucide React](https://lucide.dev/) | Icon library |

### Backend
| Technology | Purpose |
|---|---|
| [Express.js](https://expressjs.com/) | REST API server |
| [TypeScript](https://www.typescriptlang.org/) | Type safety |
| [Prisma](https://www.prisma.io/) | ORM and database migrations |
| [PostgreSQL](https://www.postgresql.org/) | Relational database |
| [JWT](https://jwt.io/) | Authentication tokens |
| [bcryptjs](https://github.com/dcodeIO/bcrypt.js) | Password hashing |
| [Zod](https://zod.dev/) | Request validation |
| [Winston](https://github.com/winstonjs/winston) | Logging |

---

## Project Structure

```
GrowthTracker/
├── frontend/                  # Next.js application
│   └── src/
│       ├── app/               # App Router pages
│       ├── components/        # UI components
│       │   ├── Analytics/
│       │   ├── Focus/         # Focus timer + slide-over panel
│       │   ├── Plan/          # Plan view (tasks + timeline)
│       │   ├── Goals/
│       │   ├── Habits/        # Habit tracker & heatmap
│       │   ├── Layout/        # Header, mobile nav
│       │   ├── Schedule/      # Week calendar, day view, block + recurring forms
│       │   ├── Settings/
│       │   ├── Tasks/
│       │   ├── Today/         # Today view, daily review, weekly overview
│       │   └── ui/            # Shared UI (QuickCapture, etc.)
│       ├── contexts/          # React context (Auth)
│       ├── hooks/             # Custom hooks (useTimer, useLocalStorage, …)
│       ├── lib/               # API client, mappers, utilities
│       └── types/             # TypeScript type definitions
│
└── backend/                   # Express API server
    ├── prisma/
    │   └── schema.prisma      # Database schema
    ├── src/
    │   ├── middleware/        # Auth, proxy gate, error handling
    │   ├── routes/            # API route handlers
    │   ├── scripts/seed.ts    # Demo account seed
    │   └── utils/             # Validation, logging, auth helpers
    └── tests/                 # Jest + Supertest integration tests
```

`frontend/e2e/` holds the Playwright suite, `.github/workflows/ci.yml` the CI pipeline and `render.yaml` the deployment Blueprint.

---

## Getting Started

### Prerequisites

- Node.js 20.9+
- PostgreSQL 14+ (local, Docker or Supabase)

### 1. Clone the repository

```bash
git clone https://github.com/your-username/GrowthTracker.git
cd GrowthTracker
```

### 2. Backend setup

```bash
cd backend
npm install
```

Copy `backend/env.example` to `backend/.env` and fill in real values. The server validates its configuration at startup and refuses to boot if, for example, a JWT secret is missing or shorter than 32 characters.

Apply the database migrations and start the server:

```bash
npm run db:migrate:deploy
npm run db:seed      # optional: demo account demo@growthtracker.dev / demo-password-1
npm run dev
```

> **Existing database created with `prisma db push`?** Mark the baseline as already applied once, then deploy the rest: `npm run db:migrate:baseline && npm run db:migrate:deploy`.

The API will be available at `http://localhost:5000`.

### 3. Frontend setup

```bash
cd frontend
npm install
```

No configuration is needed: the app calls `/api/*` on its own origin and Next.js forwards it to the API at `API_ORIGIN` (default `http://localhost:5000`). Start the development server:

```bash
npm run dev
```

The app will be available at `http://localhost:3000`.

---

## Testing

| Suite | Command | What it covers |
|---|---|---|
| Backend integration (Jest + Supertest) | `cd backend && TEST_DATABASE_URL=postgresql://…/growthtracker_test npm test` | Auth and token rotation, access control between users (IDOR), validation, goals/tasks/tracking endpoints, rate limiting, proxy gate, time-zone maths, demo seed |
| Frontend unit (Vitest + Testing Library) | `cd frontend && npm test` | API client session refresh, data mappers, toast store, focus timer, dialog focus trap |
| End-to-end (Playwright + axe-core) | `cd frontend && npm run test:e2e` | Zero WCAG 2.1 AA violations on every page in light and dark mode, dialog keyboard behaviour, error toasts, skeletons, 404, delete confirmation, no React console warnings |

The backend tests run against a real Postgres database whose name must end in `_test`; every table is truncated between suites. The E2E suite needs the API running with the demo seed and starts the frontend itself (`API_ORIGIN` points it at the API; `E2E_CHANNEL=chrome` uses your installed Chrome instead of downloading Chromium). It changes the demo data, so re-run `npm run db:seed` before running it again.

GitHub Actions runs all three suites, plus lint, type checks and production builds, on every push and pull request. The E2E job runs the API in production mode behind the Next.js proxy, the same setup used on Render.

---

## Deployment (Render + Supabase, free tier)

```
browser ──► growthtracker.onrender.com (Next.js) ──/api/*──► growthtracker-api.onrender.com (Express) ──► Supabase Postgres
                 adds x-proxy-secret                              rejects requests without it
```

The browser only ever talks to the Next.js app. `/api/*` is rewritten to the API, so the refresh cookie is first-party (`SameSite=Strict`). That matters because `onrender.com` is a public suffix: two Render subdomains count as different sites, and a cookie set by one is cross-site for the other. The API refuses any request that doesn't carry the shared `API_PROXY_SECRET`, which also means client IPs (used for rate limiting) can't be spoofed by calling it directly.

### 1. Database (Supabase)
1. Create a project (pick an EU region such as Frankfurt or Ireland, near the Render region in `render.yaml`).
2. **Connect → ORMs → Prisma** gives two strings: the transaction pooler (port 6543) is `DATABASE_URL`, with `?pgbouncer=true` added; the session pooler (port 5432) is `DIRECT_URL`. Use the pooler hosts: Supabase's direct host is IPv6-only.
3. **If the database was created earlier with `prisma db push`**, mark the baseline as applied once from your machine: `DATABASE_URL=… DIRECT_URL=… npm run db:migrate:baseline`. Render applies every later migration on start.

### 2. Render
1. Push to GitHub, then in Render choose **New → Blueprint** and select the repository. `render.yaml` creates both services.
2. Fill in the prompted values:
   - `DATABASE_URL` and `DIRECT_URL`: from step 1.
   - `CORS_ORIGIN`: the app URL, e.g. `https://growthtracker.onrender.com`.
   - `API_ORIGIN`: the API URL, e.g. `https://growthtracker-api.onrender.com`.

   If Render adds a suffix to a service name, use the URLs shown in the dashboard. Correct them later under **Environment**, then redeploy the app, because `API_ORIGIN` is read at build time.
3. JWT secrets and `API_PROXY_SECRET` are generated by Render. The app copies the proxy secret from the API service, so there is nothing to paste.
4. Deploys run only after CI passes (`autoDeployTrigger: checksPass`), and each service rebuilds only when its own folder changes.

### Free-tier notes
- Free services sleep after 15 minutes without traffic. The first visit afterwards waits about a minute while the app, and then the API, wake up.
- Free instances have no pre-deploy step, so migrations run at the start of the API's start command.
- `SEED_DEMO_ON_START=true` rebuilds the demo account (`demo@growthtracker.dev` / `demo-password-1`) on every cold start, so its data stays dated around "today" and visitors' changes are reset. Set it to `false` to keep demo data between restarts. Only the demo user is touched.
- Render's free Postgres expires after 30 days, which is why the database lives on Supabase.

---

## API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/auth/register` | Register a new user |
| POST | `/api/auth/login` | Log in and receive tokens |
| POST | `/api/auth/logout` | Log out |
| POST | `/api/auth/refresh` | Exchange the refresh cookie for a new access token (rotates the cookie) |
| POST | `/api/auth/logout-all` | Revoke every session of the current user |
| GET | `/api/auth/me` | Get current user |
| GET/POST | `/api/goals` | List / create goals |
| GET/PUT/DELETE | `/api/goals/:id` | Get / update / delete a goal |
| POST | `/api/goals/:id/milestones` | Add a milestone (returns the goal with recalculated progress) |
| PUT/DELETE | `/api/milestones/:id` | Update / delete a milestone |
| GET/POST | `/api/tasks` | List / create tasks |
| GET/PUT/DELETE | `/api/tasks/:id` | Get / update / delete a task (incl. full subtask list and tags) |
| PATCH | `/api/tasks/:id/subtasks/:subtaskId` | Toggle or rename one subtask |
| GET/POST | `/api/schedules` | List / create schedule activities |
| POST | `/api/schedules/bulk` | Create up to 200 blocks at once (recurring schedules) |
| GET/PUT/DELETE | `/api/schedules/:id` | Get / update / delete an activity |
| GET/POST | `/api/habits` | List habits (with the last year of completions) / create |
| GET/PUT/DELETE | `/api/habits/:id` | Get / update / delete a habit |
| POST | `/api/habits/:id/complete` | Log a habit completion for today |
| GET | `/api/reflections` | List daily reviews (default: last year) |
| PUT | `/api/reflections/:date` | Save the review for a day (YYYY-MM-DD) |
| POST | `/api/reflections/import` | One-time import of reviews stored by older app versions |
| GET/POST | `/api/focus-sessions` | List / record focus sessions |
| PUT | `/api/users/profile` | Update user profile |
| GET | `/api/analytics/overview` | Analytics summary |
| GET | `/api/analytics/goal-progress` | Per-goal progress analytics |
| GET | `/api/analytics/weekly-trends` | Weekly task and habit trends |
| GET | `/api/analytics/time-allocation` | Time spent per goal |

---

## Environment Variables

### Backend

| Variable | Description | Default |
|---|---|---|
| `DATABASE_URL` | PostgreSQL connection string | — |
| `DIRECT_URL` | Direct (non-pooled) connection used by migrations | — |
| `JWT_SECRET` | Secret for access tokens (min. 32 chars) | — |
| `JWT_REFRESH_SECRET` | Secret for refresh tokens (min. 32 chars, must differ) | — |
| `TRUST_PROXY` | Reverse-proxy hops in front of the API (`2` on Render behind the Next.js proxy) | `0` |
| `API_PROXY_SECRET` | Shared with the frontend; when set, only proxied requests are served. Required in production | — |
| `RATE_LIMIT_MAX_REQUESTS` | API requests per IP per window (15 min) | `600` |
| `AUTH_RATE_LIMIT_MAX` | Failed login/register attempts per IP per window | `10` |
| `PORT` | Server port | `5000` |
| `NODE_ENV` | Environment (`development` / `production`) | `development` |
| `CORS_ORIGIN` | Allowed frontend origins (comma-separated) | `http://localhost:3000` |
| `BCRYPT_ROUNDS` | bcrypt hashing rounds | `12` |

### Frontend

| Variable | Description | Default |
|---|---|---|
| `API_ORIGIN` | Where `/api/*` is forwarded (read at build time) | `http://localhost:5000` |
| `API_PROXY_SECRET` | Sent to the API as `x-proxy-secret` on every proxied request | — |
| `NEXT_PUBLIC_API_URL` | Optional: call an API directly instead of through the proxy | `/api` |

---

## License

MIT
