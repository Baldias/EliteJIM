import { Client } from '@upstash/qstash';
import { MAX_DELAY_MS, json, validSubscription } from './_lib/reminder.js';

// Schedules (POST) or cancels (DELETE) the push reminder for an idle workout.
// The app schedules it when it goes to the background and cancels it when it comes back;
// QStash calls /api/send-workout-reminder at the right time, which sends the push.

const qstash = () => (process.env.QSTASH_TOKEN ? new Client({ token: process.env.QSTASH_TOKEN, ...(process.env.QSTASH_URL ? { baseUrl: process.env.QSTASH_URL } : {}) }) : null);

const appOrigin = (request) => {
  if (process.env.PUBLIC_APP_URL) return process.env.PUBLIC_APP_URL.replace(/\/$/, '');
  const url = new URL(request.url);
  const host = request.headers.get('x-forwarded-host') || url.host;
  return `https://${host}`;
};

export async function POST(request) {
  const client = qstash();
  if (!client) return json({ error: 'push-not-configured' }, 503);
  let input;
  try { input = await request.json(); } catch { return json({ error: 'bad-request' }, 400); }
  const subscription = validSubscription(input?.subscription);
  const notifyAt = Number(input?.notifyAt);
  const now = Date.now();
  if (!subscription || !Number.isFinite(notifyAt) || notifyAt < now - 60000 || notifyAt > now + MAX_DELAY_MS) return json({ error: 'bad-request' }, 400);
  const lang = input?.lang === 'en' ? 'en' : 'it';
  const { messageId } = await client.publishJSON({
    url: `${appOrigin(request)}/api/send-workout-reminder`,
    body: { subscription, lang },
    notBefore: Math.ceil(Math.max(notifyAt, now) / 1000),
    retries: 1,
  });
  return json({ id: messageId });
}

export async function DELETE(request) {
  const client = qstash();
  if (!client) return json({ error: 'push-not-configured' }, 503);
  const id = new URL(request.url).searchParams.get('id') || '';
  if (!/^[\w-]{1,100}$/.test(id)) return json({ error: 'bad-request' }, 400);
  try { await client.messages.delete(id); } catch { /* already delivered or gone */ }
  return json({ ok: true });
}
