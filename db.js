// IndexedDB wrapper and simple stores for profile, cache, outbox, meta.
// Exposes functions on window.AppDB
(function () {
  const DB_NAME = 'referral-tracker';
  const DB_VERSION = 1;
  const STORES = {
    profile: { name: 'profile', options: { keyPath: 'key' } },
    referralsCache: { name: 'referralsCache', options: { keyPath: 'key' } },
    outbox: { name: 'outbox', options: { keyPath: 'id', autoIncrement: true } },
    meta: { name: 'meta', options: { keyPath: 'key' } },
  };

  function openDB() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        Object.values(STORES).forEach(s => {
          if (!db.objectStoreNames.contains(s.name)) db.createObjectStore(s.name, s.options);
        });
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  function tx(db, storeName, mode = 'readonly') {
    const t = db.transaction(storeName, mode);
    return t.objectStore(storeName);
  }

  async function withStore(storeName, mode, fn) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const store = tx(db, storeName, mode);
      const result = fn(store, resolve, reject);
      // If fn uses callbacks, ignore result; otherwise resolve on success
      if (result !== undefined) resolve(result);
    });
  }

  // Profile
  async function getProfile() {
    try {
      return await withStore('profile', 'readonly', (store, resolve, reject) => {
        const req = store.get('singleton');
        req.onsuccess = () => resolve(req.result ? req.result.value : null);
        req.onerror = () => reject(req.error);
      });
    } catch (e) {
      return null;
    }
  }

  async function setProfile(profile) {
    // Mirror minimal fields to localStorage for fast boot
    try {
      localStorage.setItem('profile.name', profile?.name || '');
      localStorage.setItem('profile.department', profile?.department || '');
      localStorage.setItem('profile.pin', profile?.pin || '');
    } catch {}
    return withStore('profile', 'readwrite', (store, resolve, reject) => {
      const req = store.put({ key: 'singleton', value: profile });
      req.onsuccess = () => resolve(true);
      req.onerror = () => reject(req.error);
    });
  }

  // Outbox (enqueue actions for offline)
  function enqueue(item) {
    const value = { ...item, createdAt: Date.now() };
    return withStore('outbox', 'readwrite', (store, resolve, reject) => {
      const req = store.add(value);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  function peekOutbox() {
    return withStore('outbox', 'readonly', (store, resolve, reject) => {
      const req = store.openCursor();
      req.onsuccess = () => {
        const cursor = req.result;
        if (cursor) resolve({ id: cursor.key, value: cursor.value });
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

  async function dequeue() {
    const head = await peekOutbox();
    if (!head) return null;
    await removeOutbox(head.id);
    return head.value;
  }

  // Referrals cache
  function cacheReferrals(list, key = 'all') {
    const value = { key, value: { data: list || [], timestamp: Date.now() } };
    return withStore('referralsCache', 'readwrite', (store, resolve, reject) => {
      const req = store.put(value);
      req.onsuccess = () => resolve(true);
      req.onerror = () => reject(req.error);
    });
  }

  function getCachedReferrals(key = 'all') {
    return withStore('referralsCache', 'readonly', (store, resolve, reject) => {
      const req = store.get(key);
      req.onsuccess = () => resolve(req.result ? req.result.value.data : []);
      req.onerror = () => reject(req.error);
    });
  }

  // Meta
  function getMeta(key) {
    return withStore('meta', 'readonly', (store, resolve, reject) => {
      const req = store.get(key);
      req.onsuccess = () => resolve(req.result ? req.result.value : null);
      req.onerror = () => reject(req.error);
    });
  }

  function setMeta(key, value) {
    return withStore('meta', 'readwrite', (store, resolve, reject) => {
      const req = store.put({ key, value });
      req.onsuccess = () => resolve(true);
      req.onerror = () => reject(req.error);
    });
  }

  window.AppDB = { getProfile, setProfile, enqueue, dequeue, cacheReferrals, getCachedReferrals, getMeta, setMeta };
})();
