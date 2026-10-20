/* LUKEN push service worker: does not cache customer data. */
self.addEventListener('push', event => {
  let payload = {};
  try { payload = event.data ? event.data.json() : {}; } catch (_) {}
  const title = '루켄 · 신규 상담 신청';
  const options = {
    body: '새로운 마케팅 상담이 접수되었습니다. 확인해 주세요.',
    icon: './icon-192.png',
    badge: './icon-192.png',
    tag: payload.id ? `lead-${String(payload.id).slice(0,80)}` : 'luken-new-lead',
    data: { url: '/luken-workspace/' }
  };
  event.waitUntil(self.registration.showNotification(title, options));
});
self.addEventListener('notificationclick', event => {
  event.notification.close();
  const url = new URL('/luken-workspace/', self.location.origin).href;
  event.waitUntil((async () => {
    const clientsList = await clients.matchAll({type:'window', includeUncontrolled:true});
    for (const client of clientsList) {
      if (client.url.startsWith(url) && 'focus' in client) return client.focus();
    }
    if (clients.openWindow) return clients.openWindow(url);
  })());
});
