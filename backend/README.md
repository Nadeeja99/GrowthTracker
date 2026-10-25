# GrowthTracker Backend API 🚀

A robust, production-ready backend API for the GrowthTracker application built with Node.js, Express, TypeScript, and PostgreSQL.

## ✨ Features

- **🔐 Authentication & Authorization**: JWT-based auth with refresh tokens
- **📊 Database**: PostgreSQL with Prisma ORM for type-safe database operations
- **🛡️ Security**: Rate limiting, CORS, helmet, input validation
- **📝 Validation**: Zod schemas for request validation
- **📊 Logging**: Winston-based structured logging
- **🧪 Testing**: Jest testing framework with supertest
- **🐳 Docker**: Containerized development environment
- **📈 Analytics**: Comprehensive productivity analytics and insights

## 🏗️ Architecture

```
src/
├── config/          # Database and app configuration
├── controllers/     # Request handlers (future implementation)
├── middleware/      # Custom middleware (auth, validation)
├── models/          # Data models (Prisma schema)
├── routes/          # API route definitions
├── services/        # Business logic (future implementation)
├── utils/           # Utility functions and validation
└── index.ts         # Main application entry point
```

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- Docker and Docker Compose
- npm or yarn

### 1. Clone and Setup

```bash
cd backend
npm install
```

### 2. Start the Database

```bash
docker-compose up -d
```

This will start PostgreSQL on port 5432.

### 3. Environment Setup

Copy the development environment file:

```bash
cp env.development .env
```

### 4. Database Setup

```bash
# Generate Prisma client
npm run db:generate

# Apply migrations to the database
npm run db:migrate:deploy

# (Optional) Open Prisma Studio
npm run db:studio
```

### 5. Start Development Server

```bash
npm run dev
```

The API will be available at `http://localhost:5000`

## 📚 API Endpoints

### Authentication
- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login
- `POST /api/auth/refresh` - Refresh access token
- `POST /api/auth/logout` - User logout
- `GET /api/auth/me` - Get current user

### Users
- `PUT /api/users/profile` - Update user profile

### Goals
- `GET /api/goals` - Get all goals (paginated)
- `POST /api/goals` - Create new goal
- `GET /api/goals/:id` - Get specific goal
- `PUT /api/goals/:id` - Update goal
- `DELETE /api/goals/:id` - Delete goal

### Tasks
- `GET /api/tasks` - Get all tasks (paginated)
- `POST /api/tasks` - Create new task
- `GET /api/tasks/:id` - Get specific task
- `PUT /api/tasks/:id` - Update task
- `DELETE /api/tasks/:id` - Delete task

### Schedules
- `GET /api/schedules` - Get all schedules (paginated)
- `POST /api/schedules` - Create new schedule
- `GET /api/schedules/range` - Get schedules by date range
- `GET /api/schedules/:id` - Get specific schedule
- `PUT /api/schedules/:id` - Update schedule
- `DELETE /api/schedules/:id` - Delete schedule

### Habits
- `GET /api/habits` - Get all habits (paginated)
- `POST /api/habits` - Create new habit
- `GET /api/habits/:id` - Get specific habit
- `PUT /api/habits/:id` - Update habit
- `DELETE /api/habits/:id` - Delete habit
- `POST /api/habits/:id/complete` - Mark habit as completed

### Analytics
- `GET /api/analytics/overview` - Get analytics overview
- `GET /api/analytics/weekly-trends` - Get weekly trends
- `GET /api/analytics/goal-progress` - Get goal progress analytics
- `GET /api/analytics/time-allocation` - Get time allocation analytics

## 🛠️ Development

### Available Scripts

```bash
npm run dev          # Start development server with nodemon
npm run build        # Build TypeScript to JavaScript
npm run start        # Start production server
npm run test         # Run tests
npm run test:watch   # Run tests in watch mode
npm run test:coverage # Run tests with coverage
npm run lint         # Run ESLint
npm run lint:fix     # Fix ESLint issues
```

### Database Commands

```bash
npm run db:generate  # Generate Prisma client
npm run db:migrate            # Create + apply a new migration (development)
npm run db:migrate:deploy     # Apply pending migrations (production/CI)
npm run db:migrate:baseline   # One-time: mark 0_init applied on a db created via db push
npm run db:studio    # Open Prisma Studio
npm run db:seed      # Seed database with sample data
```

### Code Structure

- **Routes**: Define API endpoints and HTTP methods
- **Middleware**: Handle authentication, validation, and error handling
- **Validation**: Zod schemas for request/response validation
- **Database**: Prisma models and database operations
- **Utils**: Helper functions and logging

## 🔒 Security Features

- **JWT Authentication**: Secure token-based authentication
- **Password Hashing**: bcrypt with configurable rounds
- **Rate Limiting**: Configurable request rate limiting
- **CORS Protection**: Cross-origin resource sharing configuration
- **Input Validation**: Zod schema validation for all inputs
- **Helmet**: Security headers middleware
- **Cookie Security**: HTTP-only, secure cookies for refresh tokens

## 📊 Database Schema

The application uses PostgreSQL with the following main entities:

- **Users**: Authentication and profile information
- **Goals**: User goals with progress tracking
- **Tasks**: Individual tasks linked to goals
- **Schedules**: Time-based scheduling
- **Habits**: Recurring habit tracking
- **Analytics**: Performance metrics and insights

## 🧪 Testing

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Generate coverage report
npm run test:coverage
```

## 🐳 Docker Development

### Start Services
```bash
docker-compose up -d
```

### Stop Services
```bash
docker-compose down
```

### View Logs
```bash
docker-compose logs -f postgres
```

## 📝 Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `NODE_ENV` | Environment mode | `development` |
| `PORT` | Server port | `5000` |
| `DATABASE_URL` | PostgreSQL connection string | - |
| `JWT_SECRET` | JWT signing secret | - |
| `JWT_REFRESH_SECRET` | JWT refresh secret | - |
| `CORS_ORIGIN` | Allowed CORS origin | `http://localhost:3000` |
| `LOG_LEVEL` | Logging level | `info` |

## 🚀 Deployment

### Production Build
```bash
npm run build
npm start
```

### Environment Variables
Ensure all production environment variables are set:
- Strong JWT secrets
- Production database URL
- Proper CORS origins
- Logging configuration

### Database Migration
```bash
npm run db:migrate
```

## 🤝 Contributing

1. Follow the existing code style
2. Add tests for new features
3. Update documentation
4. Use conventional commit messages

## 📄 License

MIT License - see LICENSE file for details

## 🆘 Support

For issues and questions:
- Check the API documentation
- Review error logs
- Open an issue in the repository

---

**Happy coding! 🚀**
