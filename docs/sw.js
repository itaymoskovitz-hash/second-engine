/* Second Engine service worker: the app opens without a connection.
   Pages: network first, cached copy when offline. Versioned CDN files and fonts: cache first.
   Never cached: Supabase API, Google Calendar, Google sign-in, the AI function. */
const V = 'se-v2';
const SHELL = ['./', 'index.html', 'manifest.webmanifest', 'icon.svg', 'icon-192.png', 'icon-512.png'];
const STATIC = /^https:\/\/(cdn\.jsdelivr\.net\/npm\/@supabase\/supabase-js@[\d.]+\/|fonts\.googleapis\.com\/|fonts\.gstatic\.com\/)/;

self.addEventListener('install', e => { e.waitUntil(caches.open(V).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== V).map(k => caches.delete(k)))).then(() => self.clients.claim())); });

self.addEventListener('fetch', e => {
  const r = e.request; if (r.method !== 'GET') return;
  const u = new URL(r.url);
  if (u.origin === location.origin){
    e.respondWith(fetch(r).then(res => { if (res.ok){ const cp = res.clone(); caches.open(V).then(c => c.put(r, cp)); } return res; })
      .catch(() => caches.match(r, {ignoreSearch: true}).then(m => m || (r.mode === 'navigate' ? caches.match('index.html') : Response.error()))));
    return;
  }
  if (STATIC.test(r.url)){
    e.respondWith(caches.match(r).then(m => m || fetch(r).then(res => { if (res.ok || res.type === 'opaque'){ const cp = res.clone(); caches.open(V).then(c => c.put(r, cp)); } return res; })));
  }
});

/* workout reminders sent by the send-reminders function */
self.addEventListener('push', e => {
  let d = {}; try { d = e.data ? e.data.json() : {}; } catch(err){ d = {body: e.data && e.data.text()}; }
  e.waitUntil(self.registration.showNotification(d.title || 'Second Engine', {body: d.body || '', icon: 'icon-192.png', badge: 'icon-192.png', tag: 'workout', data: {url: d.url || './'}}));
});
self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(self.clients.matchAll({type: 'window', includeUncontrolled: true}).then(list => {
    const open = list.find(c => c.url.startsWith(self.registration.scope));
    return open ? open.focus() : self.clients.openWindow(e.notification.data && e.notification.data.url || './');
  }));
});
