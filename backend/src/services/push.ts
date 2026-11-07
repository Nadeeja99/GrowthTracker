// Sending push notifications through the browser vendors' push services. The
// payload is encrypted for the device, so those services can't read it.
import webpush from 'web-push';
import { prisma } from '../config/database';
import { env } from '../config/env';
import { logger } from '../utils/logger';
import { reportError } from './monitoring';

export interface PushMessage {
  title: string;
  body: string;
  /** Page opened when the notification is tapped. */
  url: string;
  /** A newer notification with the same tag replaces the older one. */
  tag: string;
}

export interface PushTarget {
  endpoint: string;
  p256dh: string;
  auth: string;
}

/** Delivers one message; rejects with `statusCode` when the push service refuses it. */
export type PushSender = (target: PushTarget, message: PushMessage) => Promise<void>;

// A digest that's hours late is no use, so push services can drop it after this.
const TTL_SECONDS = 4 * 60 * 60;

export const pushEnabled = () => !!env.VAPID_PUBLIC_KEY && !!env.VAPID_PRIVATE_KEY;

const vapidSubject = () =>
  env.VAPID_SUBJECT ?? (env.appUrl.startsWith('https://') ? env.appUrl : 'mailto:noreply@growthtracker.dev');

const send: PushSender = async ({ endpoint, p256dh, auth }, message) => {
  await webpush.sendNotification({ endpoint, keys: { p256dh, auth } }, JSON.stringify(message), {
    TTL: TTL_SECONDS,
    timeout: 10_000,
    vapidDetails: { subject: vapidSubject(), publicKey: env.VAPID_PUBLIC_KEY!, privateKey: env.VAPID_PRIVATE_KEY! },
  });
};

let override: PushSender | undefined;

/** Tests only: replace the sender (`undefined` restores the real one). */
export function setPushSenderForTests(sender: PushSender | undefined): void {
  override = sender;
}

/** Sends to each of the user's devices, removing those that no longer exist. */
export async function sendToUser(userId: string, message: PushMessage): Promise<{ sent: number; failed: number }> {
  if (!pushEnabled() && !override) return { sent: 0, failed: 0 };
  const targets = await prisma.pushSubscription.findMany({ where: { userId } });
  let sent = 0;
  let failed = 0;

  await Promise.all(targets.map(async target => {
    try {
      await (override ?? send)(target, message);
      sent++;
    } catch (error) {
      const status = (error as { statusCode?: number }).statusCode;
      // The push service's way of saying this device unsubscribed or is gone.
      if (status === 404 || status === 410) {
        await prisma.pushSubscription.deleteMany({ where: { id: target.id } });
        return;
      }
      failed++;
      logger.error('Push delivery failed', { userId, status, tag: message.tag });
      // A new error, because the original holds the device's private endpoint.
      reportError(new Error(`Push delivery failed (${status ?? 'network'})`), { feature: 'push', tag: message.tag });
    }
  }));

  return { sent, failed };
}
