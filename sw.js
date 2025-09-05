const CACHE_NAME = 'referral-shell-v2';
const APP_SHELL = [
  '/',
  '/index.html',
  '/styles.css',
  '/app.js',
  '/api.js',
  '/db.js',
  '/manifest.webmanifest',
];

// IndexedDB helpers for SW (outbox only)
const DB_NAME = 'referral-tracker';
const DB_VERSION = 1;

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('outbox')) {
        db.createObjectStore('outbox', { keyPath: 'id', autoIncrement: true });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function withStore(storeName, mode, fn) {
  return openDB().then(db => new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, mode);
    const store = tx.objectStore(storeName);
    const result = fn(store, resolve, reject);
    if (result !== undefined) resolve(result);
  }));
}

function peekOutbox() {
  return withStore('outbox', 'readonly', (store, resolve, reject) => {
    const req = store.openCursor();
    req.onsuccess = () => {
      const cur = req.result;
      if (cur) resolve({ id: cur.key, value: cur.value });
      else resolve(null);
    };
    req.onerror = () => reject(req.error);
  });
}

function removeOutbox(id) {
  return withStore('outbox', 'readwrite', (store, resolve, reject) => {
    const req = store.delete(id);
    req.onsuccess = () => resolve(true);
    req.onerror = () => reject(req.error);
  });
}

async function syncOutbox() {
  // Process queued actions one-by-one; stop on first failure to retry later
  while (true) {
    const head = await peekOutbox();
    if (!head) break;
    const { id, value } = head;
    const { type, payload, headers } = value || {};
    let url = null;
    if (type === 'submit_referral') url = '/api/submit_referral';
    else if (type === 'update_referral') url = '/api/update_referral';
    else {
      // Unknown type; drop it to avoid blocking
      await removeOutbox(id);
      continue;
    }
    const hdrs = new Headers(headers || {});
    hdrs.set('Accept', 'application/json');
    hdrs.set('Content-Type', 'application/json');
    const res = await fetch(url, { method: 'POST', headers: hdrs, body: JSON.stringify(payload || {}) });
    if (!res.ok) throw new Error('Sync failed: ' + res.status);
    await removeOutbox(id);
  }
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL))
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))))
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  // Cache-first for app shell assets
  if (req.method === 'GET' && APP_SHELL.some(p => new URL(req.url).pathname === p)) {
    event.respondWith(
      caches.match(req).then(cached => cached || fetch(req))
    );
    return;
  }
  // Runtime cache for GET /api/get_referrals (network-first)
  const url = new URL(req.url);
  if (req.method === 'GET' && url.pathname === '/api/get_referrals') {
    event.respondWith((async () => {
      try {
        const res = await fetch(req);
        const clone = res.clone();
        const cache = await caches.open('dynamic');
        cache.put(req, clone);
        return res;
      } catch (_) {
        const cached = await caches.match(req);
        if (cached) return cached;
        throw _;
      }
    })());
    return;
  }
  // Default: network, fallback to cache
  event.respondWith(fetch(req).catch(() => caches.match(req)));
});

self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-outbox') {
    event.waitUntil(syncOutbox());
  }
});

self.addEventListener('message', (event) => {
  if (event.data === 'sync-now') {
    event.waitUntil(syncOutbox());
  }
});
