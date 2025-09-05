(() => {
  const VIEWS = ["submit", "dashboard", "settings"];
  const REQUIRED_FIELDS = [
    'patient_surname','ward','bed_number','referring_clinician','dept_from','dept_to','urgency_level','referral_notes'
  ];

  function showView(name) {
    VIEWS.forEach(v => {
      const section = document.getElementById(`view-${v}`);
      const btn = document.querySelector(`.nav-btn[data-target="${v}"]`);
      if (!section || !btn) return;
      const isActive = v === name;
      section.toggleAttribute('hidden', !isActive);
      btn.setAttribute('aria-selected', String(isActive));
    });
    try { localStorage.setItem('lastView', name); } catch {}

    if (name === 'dashboard') {
      // Lazy init when opening dashboard
      initDashboardOnce();
      loadDashboard();
    }
  }

  function initNav() {
    document.querySelectorAll('.nav-btn').forEach(btn => {
      btn.addEventListener('click', () => showView(btn.dataset.target));
    });
  }

  async function registerSW() {
    if ('serviceWorker' in navigator) {
      try {
        await navigator.serviceWorker.register('/sw.js');
      } catch (e) {
        // no-op: SW registration is optional
      }
    }
  }

  function getFormEl() { return document.getElementById('submit-form'); }
  function getStatusEl() { return document.getElementById('submit-status'); }
  function getSubmitBtn() { return document.getElementById('btn-submit'); }
  const q = (sel) => document.querySelector(sel);
  const qs = (sel) => Array.from(document.querySelectorAll(sel));

  function setStatus(message, kind = '') {
    const el = getStatusEl();
    if (!el) return;
    el.classList.remove('error','success');
    if (kind) el.classList.add(kind);
    el.textContent = message || '';
  }

  function setDashStatus(message, kind = '') {
    const el = q('#dash-status');
    if (!el) return;
    el.classList.remove('error','success');
    if (kind) el.classList.add(kind);
    el.textContent = message || '';
  }

  function setDashUpdated(text) {
    const el = q('#dash-updated');
    if (el) el.textContent = text || '';
  }

  function readForm() {
    const form = getFormEl();
    const data = Object.fromEntries(new FormData(form).entries());
    // Trim values
    Object.keys(data).forEach(k => { if (typeof data[k] === 'string') data[k] = data[k].trim(); });
    return data;
  }

  function validateForm() {
    const form = getFormEl();
    let ok = true;
    REQUIRED_FIELDS.forEach(id => {
      const el = form.querySelector(`[name="${id}"]`);
      if (!el) return;
      const val = (el.value || '').trim();
      const valid = val.length > 0 && (!el.pattern || new RegExp(el.pattern).test(val));
      el.classList.toggle('invalid', !valid);
      if (!valid) ok = false;
    });
    return ok;
  }

  function clearForm() {
    const form = getFormEl();
    form.reset();
  }

  async function prefillFromProfile() {
    try {
      if (!window.AppDB) return;
      const profile = await window.AppDB.getProfile();
      if (!profile) return;
      const setVal = (id, val) => { const el = document.getElementById(id); if (el && !el.value) el.value = val || ''; };
      setVal('referring_clinician', profile.name);
      setVal('dept_from', profile.department);
    } catch {}
  }

  function readFilters() {
    const form = q('#filters');
    if (!form) return {};
    const data = Object.fromEntries(new FormData(form).entries());
    Object.keys(data).forEach(k => { if (typeof data[k] === 'string') data[k] = data[k].trim(); });
    // Empty strings should not be sent
    Object.keys(data).forEach(k => { if (data[k] === '') delete data[k]; });
    return data;
  }

  function applyDefaultDepartmentToFilters(profile) {
    if (!profile) return;
    const depEl = q('#filter_department');
    if (depEl && !depEl.value && profile.department) depEl.value = profile.department;
  }

  function renderList(items) {
    const listEl = q('#list');
    if (!listEl) return;
    if (!items || items.length === 0) {
      listEl.innerHTML = '<div class="card-item">No referrals found.</div>';
      return;
    }
    const html = items.map(r => {
      const patient = r['Patient Surname'] || 'Unknown';
      const ward = r['Ward'] || '-';
      const bed = r['Bed Number'] || '-';
      const from = r['Department From'] || '-';
      const to = r['Department To'] || '-';
      const urg = (r['Urgency Level'] || '').toLowerCase();
      const seen = r['Clinician Seen'];
      const timeSeen = r['Time Seen'];
      const pillClass = urg === 'high' || urg === 'critical' ? 'danger' : urg === 'medium' ? 'warn' : 'ok';
      const statusText = seen ? `Seen${timeSeen ? ' • ' + timeSeen : ''}` : 'Pending';
      const rowNum = r['_row_number'] || '';
      const action = seen ? '' : `<button class="btn btn-seen" data-row="${rowNum}">Mark Seen</button>`;
      return `
        <article class="card-item" data-row="${rowNum}">
          <div class="item-header">
            <div class="strong">${patient}</div>
            <span class="pill ${pillClass}">${r['Urgency Level'] || '—'}</span>
          </div>
          <div class="rowline muted">Ward ${ward} • Bed ${bed}</div>
          <div class="rowline">${from} → ${to}</div>
          <div class="rowline muted statusline">${statusText}</div>
          <div class="actions">${action}</div>
        </article>
      `;
    }).join('');
    listEl.innerHTML = html;
    // Attach click handlers for Mark Seen (event delegation)
    listEl.addEventListener('click', (e) => {
      const btn = e.target.closest('.btn-seen');
      if (!btn) return;
      const row = btn.getAttribute('data-row');
      openSeenModal(row);
    }, { once: true });
  }

  let dashboardInitialized = false;
  function initDashboardOnce() {
    if (dashboardInitialized) return;
    dashboardInitialized = true;
    const form = q('#filters');
    if (form) {
      form.addEventListener('submit', (e) => { e.preventDefault(); loadDashboard(true); });
    }
    const refreshBtn = q('#btn-refresh');
    if (refreshBtn) refreshBtn.addEventListener('click', () => loadDashboard(true));

    // Prefill default department from profile if available
    if (window.AppDB) {
      window.AppDB.getProfile().then(p => applyDefaultDepartmentToFilters(p)).catch(() => {});
    } else {
      try {
        const department = localStorage.getItem('profile.department');
        applyDefaultDepartmentToFilters({ department });
      } catch {}
    }
  }

  async function loadDashboard(forceNetwork = false) {
    setDashStatus('');
    const filters = readFilters();
    const key = JSON.stringify(filters || {});
    const now = new Date();

    const useCache = async () => {
      try {
        const cached = window.AppDB ? await window.AppDB.getCachedReferrals(key) : [];
        if (cached && cached.length) {
          renderList(cached);
          setDashStatus('Showing cached data.');
          const updated = window.AppDB ? await window.AppDB.getMeta('lastUpdated:' + key) : null;
          if (updated) setDashUpdated('Last updated: ' + new Date(updated).toLocaleString());
          return true;
        }
      } catch {}
      return false;
    };

    if (!forceNetwork && !navigator.onLine) {
      const hadCache = await useCache();
      if (!hadCache) renderList([]);
      return;
    }

    try {
      const res = await window.AppApi.getReferrals(filters);
      if (res && res.success) {
        renderList(res.referrals || []);
        if (window.AppDB) {
          await window.AppDB.cacheReferrals(res.referrals || [], key);
          await window.AppDB.setMeta('lastUpdated:' + key, Date.now());
        }
        setDashUpdated('Last updated: ' + now.toLocaleString());
        setDashStatus('');
      } else {
        const hadCache = await useCache();
        if (!hadCache) setDashStatus('Unable to load referrals.', 'error');
      }
    } catch (e) {
      const hadCache = await useCache();
      if (!hadCache) setDashStatus('Unable to load referrals.', 'error');
    }
  }

  // Seen modal
  function openSeenModal(row_number) {
    const modal = q('#modal');
    if (!modal) return;
    q('#seen_row_number').value = row_number || '';
    q('#seen_status').textContent = '';
    // Prefill clinician
    const clinicianEl = q('#seen_clinician');
    if (clinicianEl) {
      clinicianEl.value = '';
      if (window.AppDB) {
        window.AppDB.getProfile().then(p => { if (p && p.name) clinicianEl.value = p.name; }).catch(() => {});
      } else {
        try { clinicianEl.value = localStorage.getItem('profile.name') || ''; } catch {}
      }
    }
    modal.hidden = false;

    const onCancel = () => { modal.hidden = true; cleanup(); };
    const onSubmit = async (e) => {
      e.preventDefault();
      const row = q('#seen_row_number').value;
      const clinician = (q('#seen_clinician').value || '').trim();
      const notes = (q('#seen_notes').value || '').trim();
      if (!row || !clinician) {
        q('#seen_status').textContent = 'Clinician is required.';
        return;
      }
      const payload = { row_number: Number(row), clinician_seen: clinician, clinician_notes: notes };

      const updateUI = (text) => {
        const card = q(`.card-item[data-row="${row}"] .statusline`);
        if (card) card.textContent = text;
      };

      const enqueueAndUpdate = async (label) => {
        try {
          const headers = getProfileHeaders();
          await (window.AppDB ? window.AppDB.enqueue({ type: 'update_referral', payload, headers }) : Promise.resolve());
          await registerSync();
        } catch {}
        updateUI(label || 'Seen (pending sync)');
        modal.hidden = true; cleanup();
      };

      if (!navigator.onLine) return enqueueAndUpdate('Seen (pending sync)');

      try {
        const res = await window.AppApi.updateReferral(payload);
        if (res && res.success) {
          updateUI(`Seen • ${res.time_seen || ''}`);
          modal.hidden = true; cleanup();
        } else {
          await enqueueAndUpdate('Seen (pending sync)');
        }
      } catch {
        await enqueueAndUpdate('Seen (pending sync)');
      }
    };

    const cleanup = () => {
      q('#seen_cancel').removeEventListener('click', onCancel);
      q('#seen-form').removeEventListener('submit', onSubmit);
    };

    q('#seen_cancel').addEventListener('click', onCancel);
    q('#seen-form').addEventListener('submit', onSubmit);
  }

  // Settings/Profile
  async function loadProfileIntoSettings() {
    let profile = null;
    try {
      profile = window.AppDB ? await window.AppDB.getProfile() : null;
    } catch {}
    if (!profile) {
      try {
        profile = {
          name: localStorage.getItem('profile.name') || '',
          department: localStorage.getItem('profile.department') || '',
          pin: localStorage.getItem('profile.pin') || ''
        };
      } catch {}
    }
    if (profile) {
      if (q('#profile_name')) q('#profile_name').value = profile.name || '';
      if (q('#profile_department')) q('#profile_department').value = profile.department || '';
      if (q('#profile_pin')) q('#profile_pin').value = profile.pin || '';
    }
  }

  async function saveProfile(e) {
    e.preventDefault();
    const profile = {
      name: (q('#profile_name').value || '').trim(),
      department: (q('#profile_department').value || '').trim(),
      pin: (q('#profile_pin').value || '').trim(),
    };
    if (!profile.name || !profile.department) {
      const el = q('#profile_status');
      if (el) { el.textContent = 'Name and Department are required.'; el.classList.remove('success'); el.classList.add('error'); }
      return;
    }
    try {
      if (window.AppDB) await window.AppDB.setProfile(profile);
      const el = q('#profile_status');
      if (el) { el.textContent = 'Profile saved.'; el.classList.remove('error'); el.classList.add('success'); }
      // Apply to current UI where relevant
      prefillFromProfile();
      applyDefaultDepartmentToFilters(profile);
    } catch (err) {
      const el = q('#profile_status');
      if (el) { el.textContent = 'Failed to save profile.'; el.classList.remove('success'); el.classList.add('error'); }
    }
  }

  async function submitHandler(e) {
    e.preventDefault();
    setStatus('');

    if (!validateForm()) {
      setStatus('Please complete required fields.', 'error');
      return;
    }

    const btn = getSubmitBtn();
    btn.disabled = true;
    const payload = readForm();

    const enqueueAndNotify = async () => {
      try {
        const headers = getProfileHeaders();
        await (window.AppDB ? window.AppDB.enqueue({ type: 'submit_referral', payload, headers }) : Promise.resolve());
        await registerSync();
      } catch {}
      setStatus('No connection. Saved locally and queued for sync.', 'success');
      clearForm();
    };

    if (!navigator.onLine) {
      await enqueueAndNotify();
      btn.disabled = false;
      return;
    }

    try {
      const res = await window.AppApi.submitReferral(payload);
      if (res && res.success) {
        setStatus('Referral submitted successfully.', 'success');
        clearForm();
      } else {
        await enqueueAndNotify();
      }
    } catch (err) {
      await enqueueAndNotify();
    } finally {
      btn.disabled = false;
    }
  }

  window.addEventListener('DOMContentLoaded', () => {
    initNav();
    const start = localStorage.getItem('lastView') || 'submit';
    showView(VIEWS.includes(start) ? start : 'submit');
    registerSW();
    // Attempt to flush any queued actions on load
    setTimeout(() => { registerSync(); }, 0);

    const form = getFormEl();
    if (form) {
      form.addEventListener('submit', submitHandler);
      prefillFromProfile();
    }

    const profileForm = q('#profile-form');
    if (profileForm) {
      profileForm.addEventListener('submit', saveProfile);
      loadProfileIntoSettings();
    }

    // Install prompt handling
    let deferredPrompt = null;
    const installBtn = q('#install-btn');
    if (installBtn) {
      window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault();
        deferredPrompt = e;
        installBtn.hidden = false;
      });
      installBtn.addEventListener('click', async () => {
        installBtn.hidden = true;
        if (!deferredPrompt) return;
        deferredPrompt.prompt();
        try { await deferredPrompt.userChoice; } catch {}
        deferredPrompt = null;
      });
      window.addEventListener('appinstalled', () => {
        if (installBtn) installBtn.hidden = true;
      });
    }
  });

  // Background sync helpers
  function getProfileHeaders() {
    const h = {};
    try {
      const name = localStorage.getItem('profile.name');
      const department = localStorage.getItem('profile.department');
      const pin = localStorage.getItem('profile.pin');
      if (department) h['X-Dept-Name'] = department;
      if (pin) h['X-Dept-Pin'] = pin;
      if (name) h['X-Clinician-Name'] = name;
    } catch {}
    return h;
  }

  async function registerSync() {
    if ('serviceWorker' in navigator && 'SyncManager' in window) {
      try {
        const reg = await navigator.serviceWorker.ready;
        await reg.sync.register('sync-outbox');
      } catch {}
    } else {
      try { navigator.serviceWorker.controller && navigator.serviceWorker.controller.postMessage('sync-now'); } catch {}
    }
  }

  window.addEventListener('online', () => { registerSync(); });
})();
