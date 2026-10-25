import 'express-async-errors';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';

import { env } from './config/env';
import { prisma } from './config/database';
import { errorHandler } from './middleware/errorHandler';
import { notFound } from './middleware/notFound';
import { requestContext } from './middleware/requestContext';
import { requireProxy } from './middleware/requireProxy';

import authRoutes from './routes/auth-simple';
import userRoutes from './routes/users';
import goalRoutes from './routes/goals';
import taskRoutes from './routes/tasks';
import scheduleRoutes from './routes/schedules';
import habitRoutes from './routes/habits';
import analyticsRoutes from './routes/analytics';
import milestoneRoutes from './routes/milestones';
import reflectionRoutes from './routes/reflections';
import focusSessionRoutes from './routes/focusSessions';
import coachRoutes from './routes/coach';
import aiRoutes from './routes/ai';

export const app = express();

// Behind a reverse proxy, req.ip is the proxy's address unless Express is told
// how many hops to trust; per-IP rate limiting depends on getting this right.
if (env.TRUST_PROXY > 0) {
  app.set('trust proxy', env.TRUST_PROXY);
}

app.use(requestContext);
app.use(requireProxy);
app.use(helmet());

app.use(cors({
  origin: env.corsOrigins,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-Id'],
  exposedHeaders: ['X-Request-Id'],
}));

const apiLimiter = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  max: env.RATE_LIMIT_MAX_REQUESTS,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Too many requests, please try again later.' },
});

// Stricter bucket for credential endpoints to slow down password guessing.
// Successful logins don't count, so legitimate users are rarely affected.
const authLimiter = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  max: env.AUTH_RATE_LIMIT_MAX,
  skipSuccessfulRequests: true,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Too many attempts, please try again later.' },
});

app.use('/api/', apiLimiter);
app.use(['/api/auth/login', '/api/auth/register'], authLimiter);

app.use(express.json({ limit: '100kb' }));
app.use(express.urlencoded({ extended: true, limit: '100kb' }));
app.use(cookieParser());
app.use(compression());

// Health check used by the host and uptime monitors. It queries the database
// so a broken connection is reported (503) instead of a false "OK".
app.get('/health', async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.status(200).json({ status: 'OK', database: 'up', uptime: process.uptime(), timestamp: new Date().toISOString() });
  } catch {
    res.status(503).json({ status: 'DEGRADED', database: 'down', timestamp: new Date().toISOString() });
  }
});

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/goals', goalRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/schedules', scheduleRoutes);
app.use('/api/habits', habitRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/milestones', milestoneRoutes);
app.use('/api/reflections', reflectionRoutes);
app.use('/api/focus-sessions', focusSessionRoutes);
app.use('/api/coach', coachRoutes);
app.use('/api/ai', aiRoutes);

app.use(notFound);
app.use(errorHandler);
