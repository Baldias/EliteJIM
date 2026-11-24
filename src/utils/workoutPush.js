import { WORKOUT_INACTIVITY_WARNING_MS } from './workoutInactivity';
import { getLanguage } from '../i18n';

// Push reminder for a workout left open: scheduled on the server (/api/workout-reminder)
// when the app goes to the background, cancelled when it comes back.

const PENDING_KEY = 'ej-workout-reminder-id';

export const isPushSupported = () => typeof window !== 'undefined'
  && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;

// iPhone/iPad only allow web push for the app added to the Home Screen.
export const needsHomeScreenInstall = () => typeof window !== 'undefined'
  && /iPad|iPhone|iPod/.test(navigator.userAgent)
  && !(window.matchMedia?.('(display-mode: standalone)').matches || navigator.standalone);

const keyBytes = (base64) => {
  const padded = (base64 + '='.repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/');
  return Uint8Array.from(atob(padded), c => c.charCodeAt(0));
};

const registration = () => navigator.serviceWorker.ready;

async function currentSubscription() {
  if (!isPushSupported()) return null;
  return (await registration()).pushManager.getSubscription();
}

// Must run from a tap: asks for permission and subscribes this device.
export async function enableWorkoutPush() {
  if (!isPushSupported()) throw new Error('unsupported');
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') throw new Error('denied');
  const res = await fetch('/api/push-public-key');
  if (!res.ok) throw new Error('not-configured');
  const { key } = await res.json();
  const reg = await registration();
  const existing = await reg.pushManager.getSubscription();
  if (existing) return existing;
  return reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(key) });
}

export async function disableWorkoutPush() {
  await cancelWorkoutReminder();
  const sub = await currentSubscription().catch(() => null);
  await sub?.unsubscribe().catch(() => {});
}

const readPending = () => { try { return localStorage.getItem(PENDING_KEY); } catch { return null; } };
const writePending = (id) => { try { if (id) localStorage.setItem(PENDING_KEY, id); else localStorage.removeItem(PENDING_KEY); } catch { /* storage unavailable */ } };

export async function scheduleWorkoutReminder(lastActivityAt, now = Date.now()) {
  const notifyAt = lastActivityAt + WORKOUT_INACTIVITY_WARNING_MS;
  if (!Number.isFinite(notifyAt) || notifyAt <= now) return; // the in-app warning is already showing
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
  const sub = await currentSubscription();
  if (!sub) return;
  await cancelWorkoutReminder();
  const res = await fetch('/api/workout-reminder', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ subscription: sub.toJSON(), notifyAt, lang: getLanguage() }),
    keepalive: true,
  });
  if (res.ok) writePending((await res.json()).id);
}

export async function cancelWorkoutReminder() {
  const id = readPending();
  if (!id) return;
  writePending(null);
  await fetch(`/api/workout-reminder?id=${encodeURIComponent(id)}`, { method: 'DELETE', keepalive: true }).catch(() => {});
}
