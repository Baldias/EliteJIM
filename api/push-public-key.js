import { json } from './_lib/reminder.js';

// VAPID public key the browser needs to subscribe to push notifications.
export function GET() {
  const key = process.env.VAPID_PUBLIC_KEY;
  return key ? json({ key }) : json({ error: 'push-not-configured' }, 503);
}
