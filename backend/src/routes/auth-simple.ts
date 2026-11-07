import { Router, CookieOptions, Response } from 'express';
import { createHash, randomBytes } from 'crypto';
import bcrypt from 'bcryptjs';
import { Prisma } from '@prisma/client';
import { prisma } from '../config/database';
import { authenticate, AuthRequest } from '../middleware/auth-simple';
import {
  registerSchema, loginSchema, demoLoginSchema, changePasswordSchema, forgotPasswordSchema,
  resetPasswordSchema, deleteAccountSchema,
} from '../utils/validation';
import { logger } from '../utils/logger';
import { generateAccessToken, generateRefreshToken, verifyRefreshToken, REFRESH_TOKEN_TTL_MS } from '../utils/simpleAuth';
import { env } from '../config/env';
import { DEMO_EMAIL } from '../config/demo';
import { HttpError } from '../utils/httpError';
import { getMailer, passwordResetEmail } from '../services/mail';
import { reportError } from '../services/monitoring';

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
  return { user: withDemoFlag(publicUser), accessToken: generateAccessToken(user) };
}

// Lets the app label the shared demo account and hide actions that would affect other visitors.
const withDemoFlag = <T extends { email: string }>(user: T) => ({ ...user, isDemo: user.email === DEMO_EMAIL });

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

// "Try the demo": signs in to the shared, seeded demo account without a
// password. Off unless DEMO_LOGIN_ENABLED=true. The account is rebuilt by the
// seed (on every cold start on Render), so visitors' changes don't last.
router.post('/demo', async (req: AuthRequest, res) => {
  if (!env.DEMO_LOGIN_ENABLED) throw new HttpError(404, 'The demo isn’t available here.');
  const { timezone } = demoLoginSchema.parse(req.body ?? {});

  const found = await prisma.user.findUnique({ where: { email: DEMO_EMAIL }, select: { id: true } });
  if (!found) throw new HttpError(503, 'The demo account isn’t set up yet. Please try again shortly.');
  const user = await prisma.user.update({
    where: { id: found.id },
    data: timezone ? { timezone } : {},
    select: sessionUserSelect,
  });

  logger.info('Demo sign-in', { userId: user.id });
  res.json({ success: true, data: issueSession(res, user) });
});

// Exchange the refresh cookie for a new access token (and a rotated cookie)
router.post('/refresh', async (req: AuthRequest, res) => {
  try {
    const refreshToken = req.cookies[REFRESH_COOKIE];

    // No cookie simply means "not signed in" (every first visit checks), so it
    // isn't an error. A cookie that fails verification still gets a 401.
    if (!refreshToken) {
      return res.json({ success: true, data: null });
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
  // Everyone shares the demo account; one visitor mustn't sign out the rest.
  if (req.user!.email === DEMO_EMAIL) throw new HttpError(403, 'Not available on the shared demo account.');
  // The calendar link goes too: it shows the same plan, to anyone who has a copy.
  await prisma.user.update({ where: { id: req.user!.id }, data: { tokenVersion: { increment: 1 }, calendarToken: null } });
  // Notifications show the user's plan, so revoked devices stop getting them too.
  await prisma.pushSubscription.deleteMany({ where: { userId: req.user!.id } });
  res.clearCookie(REFRESH_COOKIE, refreshCookieOptions);

  logger.info('All sessions revoked', { userId: req.user!.id });

  res.json({ success: true, message: 'Signed out of all devices' });
});

// ─── Passwords and account ───────────────────────────────────────────────────

const RESET_LINK_MINUTES = 30;
// At most one reset email per account per minute, so the form can't be used to flood an inbox.
const RESET_EMAIL_COOLDOWN_MS = 60_000;
const INVALID_RESET_LINK = 'This reset link is invalid or has expired. Request a new one.';

const sha256 = (value: string) => createHash('sha256').update(value).digest('hex');

// The shared demo account's credentials must not change, or other visitors are locked out.
function assertNotDemo(email: string) {
  if (email === DEMO_EMAIL) throw new HttpError(403, 'Not available on the shared demo account.');
}

// The current password, checked before sensitive changes. A wrong one is a
// 400, not a 401: the app treats 401 as "session expired" and would sign out.
async function assertPassword(userId: string, password: string, message: string) {
  const { password: hash } = await prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { password: true } });
  if (!(await bcrypt.compare(password, hash))) throw new HttpError(400, message);
  return hash;
}

// Change password. Signs out every other device, and keeps this one signed in
// with a fresh session.
router.put('/password', authenticate, async (req: AuthRequest, res) => {
  assertNotDemo(req.user!.email);
  const { currentPassword, newPassword } = changePasswordSchema.parse(req.body);
  await assertPassword(req.user!.id, currentPassword, 'Your current password is incorrect.');
  if (currentPassword === newPassword) {
    throw new HttpError(400, 'Choose a new password that’s different from your current one.');
  }

  const user = await prisma.user.update({
    where: { id: req.user!.id },
    data: { password: await bcrypt.hash(newPassword, env.BCRYPT_ROUNDS), tokenVersion: { increment: 1 }, calendarToken: null },
    select: sessionUserSelect,
  });
  await prisma.passwordResetToken.deleteMany({ where: { userId: user.id } });
  // This device registers again the next time the app opens.
  await prisma.pushSubscription.deleteMany({ where: { userId: user.id } });

  logger.info('Password changed', { userId: user.id });
  res.json({ success: true, message: 'Password changed', data: issueSession(res, user) });
});

// "Forgot password": emails a single-use link. The answer is the same whether
// or not the account exists, and the email is sent after responding, so
// neither the message nor the timing reveals who has an account.
router.post('/password/forgot', async (req: AuthRequest, res) => {
  const { email } = forgotPasswordSchema.parse(req.body);
  const mailer = getMailer();
  if (!mailer && env.isProduction) {
    throw new HttpError(503, 'Password reset by email isn’t set up on this server yet.');
  }

  const user = await prisma.user.findFirst({
    where: { email: { equals: email, mode: 'insensitive' } },
    select: { id: true, email: true, firstName: true },
  });
  res.json({ success: true, message: 'If an account uses that email, a reset link is on its way.' });

  if (!user || user.email === DEMO_EMAIL) return;
  sendResetLink(user, mailer).catch(error => {
    logger.error('Password reset email failed', { userId: user.id, error: (error as Error).message });
    reportError(error, { feature: 'password-reset-email' });
  });
});

async function sendResetLink(user: { id: string; email: string; firstName: string | null }, mailer: ReturnType<typeof getMailer>) {
  const now = Date.now();
  const recent = await prisma.passwordResetToken.findFirst({
    where: { userId: user.id, createdAt: { gt: new Date(now - RESET_EMAIL_COOLDOWN_MS) } },
    select: { id: true },
  });
  if (recent) return;

  const token = randomBytes(32).toString('base64url');
  await prisma.$transaction([
    // A new link replaces any earlier one; long-expired links of anyone are tidied up too.
    prisma.passwordResetToken.deleteMany({
      where: { OR: [{ userId: user.id }, { expiresAt: { lt: new Date(now - 24 * 60 * 60 * 1000) } }] },
    }),
    prisma.passwordResetToken.create({
      data: { userId: user.id, tokenHash: sha256(token), expiresAt: new Date(now + RESET_LINK_MINUTES * 60_000) },
    }),
  ]);

  const link = `${env.appUrl}/reset-password?token=${token}`;
  if (mailer) {
    await mailer.send(passwordResetEmail(user.email, user.firstName, link, RESET_LINK_MINUTES));
    logger.info('Password reset email sent', { userId: user.id });
  } else {
    // Development without an email provider: the link goes to the server log.
    logger.warn('Email is off; password reset link (development only)', { userId: user.id, link });
  }
}

// Sets a new password from a reset link, signs out every other device and
// signs this one in.
router.post('/password/reset', async (req: AuthRequest, res) => {
  const { token, newPassword } = resetPasswordSchema.parse(req.body);
  const now = new Date();
  const record = await prisma.passwordResetToken.findUnique({ where: { tokenHash: sha256(token) } });
  if (!record || record.usedAt || record.expiresAt < now) throw new HttpError(400, INVALID_RESET_LINK);

  const password = await bcrypt.hash(newPassword, env.BCRYPT_ROUNDS);
  const user = await prisma.$transaction(async tx => {
    // Claim the link atomically, so two requests can't both use it.
    const claimed = await tx.passwordResetToken.updateMany({ where: { id: record.id, usedAt: null }, data: { usedAt: now } });
    if (claimed.count === 0) throw new HttpError(400, INVALID_RESET_LINK);
    await tx.passwordResetToken.deleteMany({ where: { userId: record.userId, id: { not: record.id } } });
    await tx.pushSubscription.deleteMany({ where: { userId: record.userId } });
    return tx.user.update({
      where: { id: record.userId },
      data: { password, tokenVersion: { increment: 1 }, calendarToken: null },
      select: sessionUserSelect,
    });
  });

  logger.info('Password reset', { userId: user.id });
  res.json({ success: true, message: 'Password updated', data: issueSession(res, user) });
});

// Deletes the account and everything in it (goals, tasks, blocks, habits,
// reviews, focus sessions, AI history). Anonymous AI usage counts are kept,
// unlinked, so the global AI cap can't be reset by deleting accounts.
router.delete('/account', authenticate, async (req: AuthRequest, res) => {
  assertNotDemo(req.user!.email);
  const { password } = deleteAccountSchema.parse(req.body);
  await assertPassword(req.user!.id, password, 'That password is incorrect.');

  await prisma.user.delete({ where: { id: req.user!.id } });
  res.clearCookie(REFRESH_COOKIE, refreshCookieOptions);

  logger.info('Account deleted', { userId: req.user!.id });
  res.json({ success: true, message: 'Account deleted' });
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
    data: { user: withDemoFlag(user) }
  });
});

export default router;
