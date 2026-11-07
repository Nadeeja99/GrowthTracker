import { Router } from 'express';
import { prisma } from '../config/database';
import { env } from '../config/env';
import { DEMO_EMAIL } from '../config/demo';
import { authenticate, AuthRequest } from '../middleware/auth-simple';
import { HttpError } from '../utils/httpError';
import { digestSettingsSchema, pushEndpointBodySchema, pushSubscriptionSchema } from '../utils/validation';
import { pushEnabled, sendToUser } from '../services/push';

// More devices than anyone owns; old browsers leave stale entries behind.
const MAX_DEVICES_PER_USER = 10;

const router = Router();

router.use(authenticate);

const isDemo = (req: AuthRequest) => req.user!.email === DEMO_EMAIL;

// Everyone shares the demo account, so its notifications would reach strangers.
const assertAvailable = (req: AuthRequest) => {
  if (isDemo(req)) throw new HttpError(403, 'Not available on the shared demo account.');
  if (!pushEnabled()) throw new HttpError(503, 'Notifications aren’t set up on this server yet.');
};

router.get('/settings', async (req: AuthRequest, res) => {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: req.user!.id },
    select: { morningDigestAt: true, eveningDigestAt: true },
  });
  res.json({
    success: true,
    data: {
      available: pushEnabled() && !isDemo(req),
      publicKey: env.VAPID_PUBLIC_KEY ?? null,
      morning: user.morningDigestAt,
      evening: user.eveningDigestAt,
    },
  });
});

router.put('/settings', async (req: AuthRequest, res) => {
  assertAvailable(req);
  const { morning, evening } = digestSettingsSchema.parse(req.body);
  await prisma.user.update({
    where: { id: req.user!.id },
    data: { morningDigestAt: morning, eveningDigestAt: evening },
  });
  res.json({ success: true, data: { morning, evening } });
});

// Registers this device. Called again each time the app opens, because
// browsers can replace a subscription without telling the page.
router.post('/subscriptions', async (req: AuthRequest, res) => {
  assertAvailable(req);
  const userId = req.user!.id;
  const { endpoint, keys } = pushSubscriptionSchema.parse(req.body);

  // Upsert: a shared phone's subscription follows whoever signed in last.
  await prisma.pushSubscription.upsert({
    where: { endpoint },
    create: { endpoint, p256dh: keys.p256dh, auth: keys.auth, userId },
    update: { p256dh: keys.p256dh, auth: keys.auth, userId },
  });

  const stale = await prisma.pushSubscription.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    skip: MAX_DEVICES_PER_USER,
    select: { id: true },
  });
  if (stale.length) await prisma.pushSubscription.deleteMany({ where: { id: { in: stale.map(s => s.id) } } });

  res.status(201).json({ success: true });
});

router.delete('/subscriptions', async (req: AuthRequest, res) => {
  const { endpoint } = pushEndpointBodySchema.parse(req.body);
  await prisma.pushSubscription.deleteMany({ where: { endpoint, userId: req.user!.id } });
  res.json({ success: true });
});

router.post('/test', async (req: AuthRequest, res) => {
  assertAvailable(req);
  const { sent } = await sendToUser(req.user!.id, {
    title: 'Notifications are on',
    body: 'This is how your GrowthTracker digests will arrive.',
    url: '/settings',
    tag: 'test',
  });
  if (!sent) throw new HttpError(502, 'That didn’t reach your device. Try turning notifications off and on again.');
  res.json({ success: true, data: { sent } });
});

export default router;
