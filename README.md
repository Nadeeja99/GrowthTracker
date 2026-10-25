# GrowthTracker

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
    └── src/
        ├── middleware/        # Auth, error handling
        ├── routes/            # API route handlers
        └── utils/             # Validation, logging, auth helpers
```

---

## Getting Started

### Prerequisites

- Node.js 18+
- PostgreSQL database

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
npm run dev
```

> **Existing database created with `prisma db push`?** Mark the baseline as already applied once, then deploy the rest: `npm run db:migrate:baseline && npm run db:migrate:deploy`.

The API will be available at `http://localhost:5000`.

### 3. Frontend setup

```bash
cd frontend
npm install
```

Create a `.env.local` file in the `frontend/` directory:

```env
NEXT_PUBLIC_API_URL=http://localhost:5000/api
```

Start the development server:

```bash
npm run dev
```

The app will be available at `http://localhost:3000`.

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
| `TRUST_PROXY` | Reverse-proxy hops in front of the API (`1` on Render/Fly) | `0` |
| `AUTH_RATE_LIMIT_MAX` | Failed login/register attempts per IP per window | `10` |
| `PORT` | Server port | `5000` |
| `NODE_ENV` | Environment (`development` / `production`) | `development` |
| `CORS_ORIGIN` | Allowed frontend origins (comma-separated) | `http://localhost:3000` |
| `BCRYPT_ROUNDS` | bcrypt hashing rounds | `12` |

### Frontend

| Variable | Description | Default |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | Backend API base URL | `http://localhost:5000/api` |

---

## License

MIT
