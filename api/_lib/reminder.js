// Shared rules for the "forgotten workout" push reminder (Vercel functions in /api).

// Push services a browser subscription may point to: the server only ever posts there.
const PUSH_HOSTS = [
  /^fcm\.googleapis\.com$/,
  /^(.+\.)?push\.apple\.com$/,
  /^updates\.push\.services\.mozilla\.com$/,
  /^(.+\.)?push\.services\.mozilla\.com$/,
  /^(.+\.)?notify\.windows\.com$/,
];

export const MAX_DELAY_MS = 2 * 60 * 60 * 1000;

export function validSubscription(sub) {
  if (!sub || typeof sub !== 'object' || typeof sub.endpoint !== 'string' || sub.endpoint.length > 1000) return null;
  let url;
  try { url = new URL(sub.endpoint); } catch { return null; }
  if (url.protocol !== 'https:' || !PUSH_HOSTS.some(re => re.test(url.hostname))) return null;
  const { p256dh, auth } = sub.keys || {};
  if (typeof p256dh !== 'string' || typeof auth !== 'string' || p256dh.length > 200 || auth.length > 100) return null;
  return { endpoint: sub.endpoint, keys: { p256dh, auth } };
}

export const MESSAGES = {
  it: { title: 'Stai ancora allenandoti?', body: "Nessuna attività da 20 minuti. Se hai finito, termina l'allenamento: altrimenti si chiuderà da solo." },
  en: { title: 'Still training?', body: 'No activity for 20 minutes. If you are done, finish the workout: otherwise it will close on its own.' },
};

export const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });
