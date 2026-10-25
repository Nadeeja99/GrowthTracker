# GrowthTracker

A full-stack personal development tracker that helps you set goals, build habits, schedule activities, manage tasks, and visualise your progress over time.

---

## Features

### Core
- **Today View** — Unified daily dashboard with a greeting, today's schedule, habit check-ins, due tasks, and a daily review (performance, energy, mood + notes, saved to your account), a 7-day completion strip, and weekly goal-hour progress
- **Goal Management** — Goals with a description, target date, colour, weekly/daily hour targets and priority; break them into **milestones**, which drive the goal's progress
- **Task Manager** — Create tasks with saved subtasks and tags, priority, due dates, and goal associations
- **Analytics** — Charts for time allocation, weekly trends, and completion rates, plus productivity insights
- **Settings** — Edit your profile, set working hours, configure Pomodoro timer preferences, toggle dark/light mode
- **Authentication** — Secure JWT-based registration and login with HTTP-only refresh token cookies

### Schedule
- **Weekly Calendar** — Visual 7-day calendar showing activity counts, completion progress bars, and status badges per day
- **Daily Schedule** — Hour-by-hour time-slot view with quick stats (completed / in-progress / pending / skipped)
- **Activity Status Tracking** — Mark activities as pending, in-progress, completed, skipped, or rescheduled
- **Recurring Schedules** — Pick a date range, select days of the week (or use Weekdays / Weekends / Every day presets), set a time slot, and bulk-create all sessions at once with a live preview
- **Schedule–Task Link** — Attach a schedule block to a specific task; the task name appears as a badge on calendar and daily views
- **Schedule Templates** — Save reusable activity templates and apply them to any date

### Habits
- **Habit Tracker** — Create daily, weekly, or monthly habits with a target count
- **One-tap completion** — Mark a habit done for today directly from the tracker or the Today View
- **Streaks** — Consecutive-day streak count displayed with a flame indicator
- **30-day Heatmap** — Expandable completion heatmap on each habit card

### Focus
- **Pomodoro Timer** — Circular countdown ring for Work, Short Break, and Long Break sessions
- **Session cycling** — Dot indicators track progress through the 4-session Pomodoro cycle
- **Configurable durations** — Session lengths are read from your Settings preferences
- **Goal & task context** — Associate a focus session with a goal and task
- **Saved focus history** — Every focus interval (stopped-early ones after 1 minute) is stored; it counts toward the goal's weekly hours and the task's logged time

### Quick Capture
- **Floating action button** — Always-visible `+` button (bottom-right) to instantly create a task or schedule activity
- **Keyboard shortcut** — Press `Cmd+K` (Mac) or `Ctrl+K` (Windows/Linux) to open Quick Capture from anywhere in the app
- **Task mode** — Title, goal, and priority (low / medium / high)
- **Activity mode** — Title, goal, date, start time, and end time

---

## Tech Stack

### Frontend
| Technology | Purpose |
|---|---|
| [Next.js 14](https://nextjs.org/) | React framework with App Router |
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
│       │   ├── Focus/         # Pomodoro timer
│       │   ├── Goals/
│       │   ├── Habits/        # Habit tracker & heatmap
│       │   ├── Layout/        # Header, mobile nav
│       │   ├── Schedule/      # Calendar, daily view, recurring form, templates
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
| POST | `/api/auth/refresh` | Refresh access token |
| GET | `/api/auth/me` | Get current user |
| GET/POST | `/api/goals` | List / create goals |
| GET/PUT/DELETE | `/api/goals/:id` | Get / update / delete a goal |
| POST | `/api/goals/:id/milestones` | Add a milestone (returns the goal with recalculated progress) |
| PUT/DELETE | `/api/milestones/:id` | Update / delete a milestone |
| GET/POST | `/api/tasks` | List / create tasks |
| GET/PUT/DELETE | `/api/tasks/:id` | Get / update / delete a task (incl. full subtask list and tags) |
| PATCH | `/api/tasks/:id/subtasks/:subtaskId` | Toggle or rename one subtask |
| GET/POST | `/api/schedules` | List / create schedule activities |
| GET/PUT/DELETE | `/api/schedules/:id` | Get / update / delete an activity |
| GET/POST | `/api/habits` | List / create habits |
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
