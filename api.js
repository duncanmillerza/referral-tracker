// API client (no modules). Exposes functions on window.AppApi
(function () {
  function getProfileFromLocal() {
    try {
      const name = localStorage.getItem('profile.name');
      const department = localStorage.getItem('profile.department');
      const pin = localStorage.getItem('profile.pin');
      if (name || department || pin) return { name, department, pin };
    } catch {}
    return null;
  }

  async function getProfile() {
    // Prefer IndexedDB via AppDB if available, else localStorage mirror
    if (window.AppDB && typeof window.AppDB.getProfile === 'function') {
      try { const p = await window.AppDB.getProfile(); if (p) return p; } catch {}
    }
    return getProfileFromLocal();
  }

  async function buildHeaders(extra = {}) {
    const headers = new Headers({ 'Accept': 'application/json', ...extra });
    const profile = await getProfile();
    if (profile) {
      if (profile.department) headers.set('X-Dept-Name', profile.department);
      if (profile.pin) headers.set('X-Dept-Pin', profile.pin);
      if (profile.name) headers.set('X-Clinician-Name', profile.name);
    }
    return headers;
  }

  async function fetchJSON(url, options = {}) {
    const res = await fetch(url, options);
    let bodyText = '';
    try { bodyText = await res.text(); } catch {}
    const asJSON = () => { try { return JSON.parse(bodyText || '{}'); } catch { return {}; } };
    if (!res.ok) {
      const data = asJSON();
      const msg = data && data.error ? data.error : `${res.status} ${res.statusText}`;
      const err = new Error(msg);
      err.status = res.status;
      err.body = data;
      throw err;
    }
    return bodyText ? asJSON() : {};
  }

  async function getReferrals(params = {}) {
    const url = new URL('/api/get_referrals', location.origin);
    Object.entries(params).forEach(([k, v]) => { if (v != null && v !== '') url.searchParams.set(k, v); });
    const headers = await buildHeaders();
    return fetchJSON(url.href, { headers });
  }

  async function submitReferral(payload) {
    const headers = await buildHeaders({ 'Content-Type': 'application/json' });
    return fetchJSON('/api/submit_referral', {
      method: 'POST',
      headers,
      body: JSON.stringify(payload || {})
    });
  }

  async function updateReferral(payload) {
    const headers = await buildHeaders({ 'Content-Type': 'application/json' });
    return fetchJSON('/api/update_referral', {
      method: 'POST',
      headers,
      body: JSON.stringify(payload || {})
    });
  }

  window.AppApi = { getReferrals, submitReferral, updateReferral };
})();
