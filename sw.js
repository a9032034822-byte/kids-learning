// Service worker: приложение работает без интернета после первой загрузки.
// Оболочка — из кэша (обновляется в фоне), content/ и settings.json — сначала из сети.
// При изменении файлов оболочки поднимите VERSION (tools/kl.mjs check-shell напомнит).
const VERSION = 'kl-2026-10-08-2';
const SHELL = [
  './',
  'index.html',
  'styles.css',
  'manifest.webmanifest',
  'settings.json',
  'assets/icon.svg',
  'assets/icon-192.png',
  'assets/icon-512.png',
  'assets/icon-maskable-512.png',
  'assets/apple-touch-icon.png',
  'assets/fonts/bad-script-cyrillic-400-normal.woff',
  'src/app.js',
  'src/characters.js',
  'src/content.js',
  'src/crypto.js',
  'src/i18n.js',
  'src/markdown.js',
  'src/numwords.js',
  'src/propisi.js',
  'src/sound.js',
  'src/store.js',
  'src/sync.js',
  'src/util.js',
  'src/screens/common.js',
  'src/screens/kid.js',
  'src/screens/parent.js',
  'src/screens/picker.js',
  'src/screens/player.js',
  'src/screens/unlock.js',
  'src/tasks/choice.js',
  'src/tasks/column.js',
  'src/tasks/common.js',
  'src/tasks/fix.js',
  'src/tasks/index.js',
  'src/tasks/input.js',
  'src/tasks/offline.js',
  'src/tasks/page.js',
  'src/tasks/poem.js',
  'src/tasks/propisi.js',
  'src/tasks/read.js',
  'src/tasks/rule.js',
  'src/tasks/sort.js',
  'src/tasks/split.js',
  'src/tasks/stress.js',
];
const SHELL_CACHE = 'shell-' + VERSION;
const DATA_CACHE = 'data-v1';

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(SHELL_CACHE).then((c) => c.addAll(SHELL.map((u) => new Request(u, { cache: 'reload' })))).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('shell-') && k !== SHELL_CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

function isData(url) {
  return url.pathname.includes('/content/') || url.pathname.endsWith('/settings.json');
}

async function networkFirst(req) {
  const cache = await caches.open(DATA_CACHE);
  try {
    const res = await fetch(req, { cache: 'no-cache' });
    if (res.ok) cache.put(req, res.clone());
    else if (res.status === 404) cache.delete(req);
    return res;
  } catch {
    const hit = (await cache.match(req, { ignoreSearch: true })) || (await caches.match(req, { ignoreSearch: true }));
    return hit || new Response('offline', { status: 503 });
  }
}

async function staleWhileRevalidate(req) {
  const cache = await caches.open(SHELL_CACHE);
  const hit = await cache.match(req, { ignoreSearch: true });
  const net = fetch(req)
    .then((res) => {
      if (res.ok) cache.put(req, res.clone());
      return res;
    })
    .catch(() => null);
  if (hit) return hit;
  const res = await net;
  if (res) return res;
  if (req.mode === 'navigate') return (await cache.match('index.html')) || new Response('offline', { status: 503 });
  return new Response('offline', { status: 503 });
}

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // синхронизация и прочее — мимо кэша
  e.respondWith(isData(url) ? networkFirst(req) : staleWhileRevalidate(req));
});

self.addEventListener('message', (e) => {
  if (e.data && e.data.type === 'precache' && Array.isArray(e.data.urls)) {
    e.waitUntil(
      caches.open(DATA_CACHE).then((c) =>
        Promise.all(
          e.data.urls.map((u) =>
            fetch(u, { cache: 'no-cache' })
              .then((r) => r.ok && c.put(u, r))
              .catch(() => {})
          )
        )
      )
    );
  }
});
