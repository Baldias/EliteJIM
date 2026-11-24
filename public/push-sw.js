// Push handlers, imported by the generated service worker (vite.config.js → workbox.importScripts).
self.addEventListener('push', (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch { data = {}; }
  event.waitUntil(self.registration.showNotification(data.title || 'EliteJIM', {
    body: data.body || '',
    tag: data.tag || 'elitejim',
    renotify: true,
    icon: '/pwa-192x192.png',
    badge: '/pwa-192x192.png',
    data: { url: data.url || '/' },
  }));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = new URL(event.notification.data?.url || '/', self.location.origin).href;
  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const open = windows.find(w => new URL(w.url).origin === self.location.origin);
    if (open) {
      await open.focus();
      if ('navigate' in open) await open.navigate(url).catch(() => {});
      return;
    }
    await self.clients.openWindow(url);
  })());
});
