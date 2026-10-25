import { Router, CookieOptions, Response } from 'express';
import bcrypt from 'bcryptjs';
import { Prisma } from '@prisma/client';
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

// Fields safe to return to the client.
const publicUserSelect = {
  id: true,
  email: true,
  username: true,
  firstName: true,
  lastName: true,
  timezone: true,
  avatar: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.UserSelect;

const sessionUserSelect = { ...publicUserSelect, tokenVersion: true } satisfies Prisma.UserSelect;
type SessionUser = Prisma.UserGetPayload<{ select: typeof sessionUserSelect }>;

/**
 * Issues a fresh access token and sets a fresh refresh cookie. Called on
 * login/registration and on every refresh, so refresh tokens rotate.
 */
function issueSession(res: Response, user: SessionUser) {
  res.cookie(REFRESH_COOKIE, generateRefreshToken(user), { ...refreshCookieOptions, maxAge: REFRESH_TOKEN_TTL_MS });
  const { tokenVersion: _tokenVersion, ...publicUser } = user;
  return { user: publicUser, accessToken: generateAccessToken(user) };
}

// Register new user
router.post('/register', async (req: AuthRequest, res) => {
  const { email, username, password, firstName, lastName, timezone } = registerSchema.parse(req.body);

  const existingUser = await prisma.user.findFirst({
    where: { OR: [{ email }, { username }] },
    select: { email: true },
  });

  if (existingUser) {
    return res.status(400).json({
      success: false,
      error: existingUser.email === email ? 'Email already registered' : 'Username already taken'
    });
  }

  const user = await prisma.user.create({
    data: {
      email,
      username,
      password: await bcrypt.hash(password, env.BCRYPT_ROUNDS),
      firstName,
      lastName,
      ...(timezone && { timezone }),
    },
    select: sessionUserSelect,
  });

  logger.info('User registered', { userId: user.id });

  res.status(201).json({
    success: true,
    message: 'User registered successfully',
    data: issueSession(res, user),
  });
});

// Login user
router.post('/login', async (req: AuthRequest, res) => {
  const { email, password } = loginSchema.parse(req.body);

  const found = await prisma.user.findUnique({
    where: { email },
    select: { ...sessionUserSelect, password: true },
  });

  // Same response for unknown email and wrong password, so accounts can't be probed.
  if (!found || !(await bcrypt.compare(password, found.password))) {
    return res.status(401).json({
      success: false,
      error: 'Invalid credentials'
    });
  }

  const { password: _password, ...user } = found;
  logger.info('User logged in', { userId: user.id });

  res.json({
    success: true,
    message: 'Login successful',
    data: issueSession(res, user),
  });
});

// Exchange the refresh cookie for a new access token (and a rotated cookie)
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
    const user = await prisma.user.findUnique({ where: { id: decoded.id }, select: sessionUserSelect });

    if (!user || user.tokenVersion !== decoded.ver) {
      res.clearCookie(REFRESH_COOKIE, refreshCookieOptions);
      return res.status(401).json({ success: false, error: 'Session expired' });
    }

    res.json({
      success: true,
      message: 'Token refreshed successfully',
      data: issueSession(res, user),
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

// Sign out of every device: bumping tokenVersion invalidates all access and
// refresh tokens issued so far.
router.post('/logout-all', authenticate, async (req: AuthRequest, res) => {
  await prisma.user.update({ where: { id: req.user!.id }, data: { tokenVersion: { increment: 1 } } });
  res.clearCookie(REFRESH_COOKIE, refreshCookieOptions);

  logger.info('All sessions revoked', { userId: req.user!.id });

  res.json({ success: true, message: 'Signed out of all devices' });
});

// Get current user
router.get('/me', authenticate, async (req: AuthRequest, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.user!.id },
    select: publicUserSelect,
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
