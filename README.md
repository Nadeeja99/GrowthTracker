# GrowthTracker

A full-stack personal development tracker that helps you set goals, schedule activities, manage tasks, and visualise your progress over time.

---

## Features

- **Goal Management** — Create and track personal goals with colour-coding, weekly/daily hour targets, and priority levels
- **Schedule** — Plan daily activities linked to goals; track status (pending, in-progress, completed, skipped, rescheduled); apply reusable schedule templates
- **Task Manager** — Create tasks with subtasks, tags, priority, due dates, and goal associations
- **Analytics** — Charts for goal progress, time allocation, weekly trends, habit strength, and completion rates
- **Settings** — Edit your profile, set working hours, configure Pomodoro timer preferences, toggle dark/light mode
- **Authentication** — Secure JWT-based registration and login with HTTP-only refresh token cookies

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
│       │   ├── Dashboard/
│       │   ├── Goals/
│       │   ├── Layout/
│       │   ├── Schedule/
│       │   ├── Settings/
│       │   └── Tasks/
│       ├── contexts/          # React context (Auth)
│       ├── hooks/             # Custom hooks
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

Create a `.env` file in the `backend/` directory:

```env
DATABASE_URL="postgresql://user:password@localhost:5432/growthtracker"
JWT_SECRET="your-secret-key-here"
NODE_ENV=development
PORT=5000
CORS_ORIGIN="http://localhost:3000"
BCRYPT_ROUNDS=12
```

Apply the database schema and start the server:

```bash
npx prisma db push
npm run dev
```

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
| GET/POST | `/api/tasks` | List / create tasks |
| GET/PUT/DELETE | `/api/tasks/:id` | Get / update / delete a task |
| GET/POST | `/api/schedules` | List / create schedule activities |
| GET/PUT/DELETE | `/api/schedules/:id` | Get / update / delete an activity |
| PUT | `/api/users/profile` | Update user profile |
| GET | `/api/users/stats` | Get user statistics |
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
| `JWT_SECRET` | Secret key for signing JWT tokens | — |
| `PORT` | Server port | `5000` |
| `NODE_ENV` | Environment (`development` / `production`) | `development` |
| `CORS_ORIGIN` | Allowed frontend origin | `http://localhost:3000` |
| `BCRYPT_ROUNDS` | bcrypt hashing rounds | `12` |

### Frontend

| Variable | Description | Default |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | Backend API base URL | `http://localhost:5000/api` |

---

## License

MIT
