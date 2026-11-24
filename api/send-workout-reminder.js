import { Receiver } from '@upstash/qstash';
import * as webpush from 'web-push';
import { MESSAGES, json, validSubscription } from './_lib/reminder.js';

// Called by QStash only (signed request): sends the "still training?" push notification.
export async function POST(request) {
  const { QSTASH_CURRENT_SIGNING_KEY, QSTASH_NEXT_SIGNING_KEY, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT } = process.env;
  if (!QSTASH_CURRENT_SIGNING_KEY || !QSTASH_NEXT_SIGNING_KEY || !VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) return json({ error: 'push-not-configured' }, 503);

  const raw = await request.text();
  const receiver = new Receiver({ currentSigningKey: QSTASH_CURRENT_SIGNING_KEY, nextSigningKey: QSTASH_NEXT_SIGNING_KEY });
  const valid = await receiver.verify({ signature: request.headers.get('upstash-signature') || '', body: raw }).catch(() => false);
  if (!valid) return json({ error: 'unauthorized' }, 401);

  let input;
  try { input = JSON.parse(raw); } catch { return json({ error: 'bad-request' }, 400); }
  const subscription = validSubscription(input?.subscription);
  if (!subscription) return json({ error: 'bad-request' }, 400);
  const message = MESSAGES[input?.lang] || MESSAGES.it;

  webpush.setVapidDetails(VAPID_SUBJECT || 'mailto:noreply@example.com', VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
  try {
    await webpush.sendNotification(subscription, JSON.stringify({ ...message, tag: 'workout-idle', url: '/workout' }), { TTL: 15 * 60, urgency: 'high' });
  } catch (err) {
    // 404/410: the subscription expired; nothing to retry.
    if (err?.statusCode === 404 || err?.statusCode === 410) return json({ ok: false, expired: true });
    throw err;
  }
  return json({ ok: true });
}
