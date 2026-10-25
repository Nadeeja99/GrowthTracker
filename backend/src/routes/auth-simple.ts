import { Router, CookieOptions } from 'express';
import bcrypt from 'bcryptjs';
import { prisma } from '../config/database';
import { authenticate, AuthRequest } from '../middleware/auth-simple';
import { registerSchema, loginSchema } from '../utils/validation';
import { logger } from '../utils/logger';
import { generateAccessToken, generateRefreshToken, verifyRefreshToken, REFRESH_TOKEN_TTL_MS } from '../utils/simpleAuth';
import { env } from '../config/env';

const router = Router();

const REFRESH_COOKIE = 'refreshToken';
// clearCookie() only removes a cookie when these options match the ones it was set with.
const refreshCookieOptions: CookieOptions = {
  httpOnly: true,
  secure: env.isProduction,
  sameSite: 'strict',
  path: '/api/auth',
};

// Register new user
router.post('/register', async (req: AuthRequest, res) => {
  // Validate input
  const validatedData = registerSchema.parse(req.body);
  const { email, username, password, firstName, lastName, timezone } = validatedData;

  // Check if user already exists
  const existingUser = await prisma.user.findFirst({
    where: {
      OR: [
        { email },
        { username }
      ]
    }
  });

  if (existingUser) {
    return res.status(400).json({
      success: false,
      error: existingUser.email === email ? 'Email already registered' : 'Username already taken'
    });
  }

  // Hash password
  const hashedPassword = await bcrypt.hash(password, env.BCRYPT_ROUNDS);

  // Create user
  const user = await prisma.user.create({
    data: {
      email,
      username,
      password: hashedPassword,
      firstName,
      lastName,
      ...(timezone && { timezone }),
    },
    select: {
      id: true,
      email: true,
      username: true,
      firstName: true,
      lastName: true,
      timezone: true,
      createdAt: true,
    }
  });

  // Generate tokens
  const accessToken = generateAccessToken(user);
  const refreshToken = generateRefreshToken(user);

  // Set refresh token in HTTP-only cookie
  res.cookie(REFRESH_COOKIE, refreshToken, { ...refreshCookieOptions, maxAge: REFRESH_TOKEN_TTL_MS });

  logger.info('User registered', { userId: user.id });

  res.status(201).json({
    success: true,
    message: 'User registered successfully',
    data: {
      user,
      accessToken,
    }
  });
});

// Login user
router.post('/login', async (req: AuthRequest, res) => {
  // Validate input
  const validatedData = loginSchema.parse(req.body);
  const { email, password } = validatedData;

  // Find user
  const user = await prisma.user.findUnique({
    where: { email },
    select: {
      id: true,
      email: true,
      username: true,
      password: true,
      firstName: true,
      lastName: true,
      timezone: true,
    }
  });

  if (!user) {
    return res.status(401).json({
      success: false,
      error: 'Invalid credentials'
    });
  }

  // Check password
  const isPasswordValid = await bcrypt.compare(password, user.password);
  if (!isPasswordValid) {
    return res.status(401).json({
      success: false,
      error: 'Invalid credentials'
    });
  }

  // Generate tokens
  const accessToken = generateAccessToken(user);
  const refreshToken = generateRefreshToken(user);

  // Set refresh token in HTTP-only cookie
  res.cookie(REFRESH_COOKIE, refreshToken, { ...refreshCookieOptions, maxAge: REFRESH_TOKEN_TTL_MS });

  const { password: _, ...userWithoutPassword } = user;

  logger.info('User logged in', { userId: user.id });

  res.json({
    success: true,
    message: 'Login successful',
    data: {
      user: userWithoutPassword,
      accessToken,
    }
  });
});

// Refresh access token
router.post('/refresh', async (req: AuthRequest, res) => {
  try {
    const refreshToken = req.cookies[REFRESH_COOKIE];

    if (!refreshToken) {
      return res.status(401).json({
        success: false,
        error: 'Refresh token not provided'
      });
    }

    const decoded = verifyRefreshToken(refreshToken);

    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
      select: { id: true, email: true, username: true }
    });

    if (!user) {
      return res.status(401).json({ success: false, error: 'User not found' });
    }

    const accessToken = generateAccessToken(user);

    res.json({
      success: true,
      message: 'Token refreshed successfully',
      data: { accessToken }
    });
  } catch (error) {
    logger.warn('Token refresh rejected', { reason: error instanceof Error ? error.message : 'unknown' });
    res.status(401).json({
      success: false,
      error: 'Invalid refresh token'
    });
  }
});

// Logout user. Deliberately unauthenticated: clearing the cookie must work
// even after the access token has expired.
router.post('/logout', async (_req, res) => {
  res.clearCookie(REFRESH_COOKIE, refreshCookieOptions);

  res.json({
    success: true,
    message: 'Logout successful'
  });
});

// Get current user
router.get('/me', authenticate, async (req: AuthRequest, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.user!.id },
    select: {
      id: true,
      email: true,
      username: true,
      firstName: true,
      lastName: true,
      timezone: true,
      avatar: true,
      createdAt: true,
      updatedAt: true,
    }
  });

  if (!user) {
    return res.status(404).json({
      success: false,
      error: 'User not found'
    });
  }

  res.json({
    success: true,
    data: { user }
  });
});

export default router;
