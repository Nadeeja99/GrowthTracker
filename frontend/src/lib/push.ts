// Web push on this device: asking permission, and keeping the server's list of
// devices right. The server holds one entry per browser or installed app.
import { apiClient } from '@/lib/api';

export type PushSupport = 'ready' | 'needs-install' | 'blocked' | 'unsupported';

const isIos = () =>
  /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

const isInstalled = () =>
  window.matchMedia('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true;

export function pushSupport(): PushSupport {
  // On iPhone and iPad, push exists only once the app is on the Home Screen.
  if (isIos() && !isInstalled()) return 'needs-install';
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) return 'unsupported';
  return Notification.permission === 'denied' ? 'blocked' : 'ready';
}

export function urlBase64ToBytes(value: string): Uint8Array {
  const base64 = (value + '='.repeat((4 - (value.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/');
  return Uint8Array.from(atob(base64), char => char.charCodeAt(0));
}

/** This device's subscription, if it has one. */
export async function currentPushSubscription(): Promise<PushSubscription | null> {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return null;
  const registration = await navigator.serviceWorker.getRegistration();
  return (await registration?.pushManager.getSubscription()) ?? null;
}

const toServer = (subscription: PushSubscription) => {
  const { endpoint, keys } = subscription.toJSON();
  return { endpoint: endpoint!, keys: { p256dh: keys!.p256dh, auth: keys!.auth } };
};

// Some browsers (or networks) can't reach their push service and never answer.
const SUBSCRIBE_TIMEOUT_MS = 30_000;

/** Must run from a tap: browsers refuse to ask for permission otherwise. */
export async function enablePush(publicKey: string): Promise<void> {
  if ((await Notification.requestPermission()) !== 'granted') {
    throw new Error('Notifications are blocked. Allow them for GrowthTracker in your phone’s settings.');
  }
  const registration = await navigator.serviceWorker.ready;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const subscription = await Promise.race([
    registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToBytes(publicKey) }),
    new Promise<never>((_resolve, reject) => {
      timer = setTimeout(() => reject(new Error('This browser couldn’t reach its notification service. Please try again.')), SUBSCRIBE_TIMEOUT_MS);
    }),
  ]).finally(() => clearTimeout(timer));
  await apiClient.savePushSubscription(toServer(subscription));
}

export async function disablePush(): Promise<void> {
  const subscription = await currentPushSubscription();
  if (!subscription) return;
  await apiClient.deletePushSubscription(subscription.endpoint);
  await subscription.unsubscribe();
}

/** Stops this device getting notifications, for sign-out. Never gets in the way of it. */
export async function forgetPushDevice({ tellServer = true } = {}): Promise<void> {
  try {
    const subscription = await currentPushSubscription();
    if (!subscription) return;
    if (tellServer) await apiClient.deletePushSubscription(subscription.endpoint).catch(() => undefined);
    await subscription.unsubscribe();
  } catch {
    // Unsubscribed or not, signing out carries on.
  }
}

/** Re-registers this device, as browsers can renew a subscription without telling the page. */
export async function syncPushDevice(): Promise<void> {
  try {
    const subscription = await currentPushSubscription();
    if (subscription) await apiClient.savePushSubscription(toServer(subscription));
  } catch {
    // Offline, or the server's asleep: the next opening tries again.
  }
}
