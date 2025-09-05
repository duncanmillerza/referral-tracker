# Frontend Plan — Mobile-First PWA (with Lightweight Login)

## Overview
- Purpose: Simple, reliable referral capture and viewing for rural settings.
- Principles: Mobile-first, offline-first, low-friction, no heavy frameworks.
- Stack: Static HTML/CSS/JS + Service Worker + IndexedDB. Calls existing Python APIs in `/api`.

## Deliverables
- index.html — Single-page shell with views (Submit, Dashboard, Settings)
- styles.css — Mobile-first responsive styles
- app.js — View switching, state, rendering
- api.js — API client with profile headers + retry logic
- db.js — IndexedDB wrapper for profile, cache, outbox
- sw.js — Service worker: app shell cache + background sync
- manifest.webmanifest — PWA manifest
- icons/ — App icons (192px, 512px)
- Optional: vercel.json — SPA fallback to `index.html`

## Environment Assumptions
- APIs deployed or reachable at `/api/*`:
  - POST `/api/submit_referral`
  - GET `/api/get_referrals?department=&ward=&status=`
  - POST `/api/update_referral`
- Vercel env vars (backend): `SHEET_ID`, `GOOGLE_CREDENTIALS`, `DEPT_CODES` (JSON map of department → PIN).

---

## Phase 1 — Scaffold & App Shell
1) Create files: `index.html`, `styles.css`, `app.js`, `api.js`, `db.js`, `sw.js`, `manifest.webmanifest`, `icons/`.
2) `index.html`: header + bottom nav with three tabs: Submit | Dashboard | Settings.
3) Register `sw.js` in `app.js`; include `manifest.webmanifest` in HTML head.
4) Base styles in `styles.css`: mobile typography, spacing, buttons, inputs, cards.

## Phase 2 — Data Layer
1) `api.js`:
   - `getReferrals({ department, ward, status })`
   - `submitReferral(formData)`
   - `updateReferral({ row_number, clinician_seen, clinician_notes })`
   - Attach profile headers: `X-Dept-Name`, `X-Dept-Pin`, `X-Clinician-Name` if present.
   - Handle network errors; map to user-friendly messages.
2) `db.js` (IndexedDB): stores `profile`, `referralsCache`, `outbox`, `meta`.
   - Helpers: `getProfile/setProfile`, `enqueue/dequeue`, `cacheReferrals/getCachedReferrals`, `getMeta/setMeta`.

## Phase 3 — Submit Form (Mobile-first)
1) Fields: Patient Surname, Ward, Bed Number, Referring Clinician, Department From, Department To, Urgency, Notes.
2) Validation: required fields, basic patterns (e.g., bed number numeric), clear errors inline.
3) Auto-fill: `Referring Clinician` + `Department From` from profile (read-only, with “Edit Profile”).
4) Submit behavior:
   - Online: POST to `/api/submit_referral`; on success, clear form and show confirmation with timestamp.
   - Offline: enqueue payload in `outbox` with action `submit_referral`; show “Queued — will sync when online”.
5) Accessibility: labels, large tap targets (≥44px), keyboard-friendly.

## Phase 4 — Dashboard (List + Filters)
1) Filters: Department, Ward, Status (`pending|seen`). Default department from profile (“My Department”).
2) Fetch strategy: Network-first with cache fallback; display “Showing cached data” when offline.
3) Render compact cards: Patient, Ward/Bed, Dept From → Dept To, Urgency, Seen status/time.
4) Pull-to-refresh or refresh button; show “Last updated” time (from `meta`).
5) Empty states and error states (retry option).

## Phase 5 — Update Referral (Mark Seen)
1) Action on each card: “Mark Seen” opens inline modal or drawer.
2) Fields: Clinician Seen (prefill from profile name), Notes.
3) Online: POST `/api/update_referral`; optimistic UI update.
4) Offline: enqueue action `update_referral` with `row_number`, `clinician_seen`, `clinician_notes`; optimistic update and badge “Pending sync”.

## Phase 6 — Lightweight Login/Profile
1) Settings view fields: Clinician Name, Department (select), Department PIN.
2) Persist in `IndexedDB` (`profile`) and mirror minimal keys in `localStorage` for fast boot.
3) On app load:
   - If profile incomplete, show dismissible banner with “Complete Profile”.
   - Default Dashboard filter to profile’s department.
   - Submit form auto-fills clinician + department from profile.
4) API headers: send `X-Dept-Name`, `X-Dept-Pin`, `X-Clinician-Name` when available.
5) Backend tweaks (simple):
   - Add `DEPT_CODES` env var (JSON). Validate PIN when provided; if valid, allow server-side default filter to user department.
   - In `submit_referral`, if body missing `referring_clinician`/`dept_from`, auto-fill from headers.
   - Note: Prototype-level security; acceptable for demo/low-risk use.

## Phase 7 — PWA Polish
1) `manifest.webmanifest`: name, short_name, icons (192/512), theme/background color, `display: standalone`.
2) `sw.js`:
   - Precache app shell (index, styles, app bundles, icons, manifest).
   - Runtime cache: GET `/api/get_referrals` with Network-first, fallback to cache.
   - Background Sync: queue `outbox` posts; register sync, flush when online.
   - Versioning: bump cache version on deploy; clean old caches.
3) Add “Add to Home Screen” prompt guidance and an in-app “Install” button (where supported).

## Phase 8 — QA & Deploy
1) Test online/offline flows (airplane mode): submit, list cache, update referral.
2) Validate on small screens (360×640), tablets, and desktop.
3) Test error states: API down, invalid PIN, partial connectivity.
4) Confirm accessibility: labels, focus order, color contrast.
5) Optional: `vercel.json` for SPA fallback routes.
6) Vercel configuration: set `SHEET_ID`, `GOOGLE_CREDENTIALS`, `DEPT_CODES` env vars; deploy.

---

## Task Checklist (Step-by-Step)
- [x] Create project files (`index.html`, `styles.css`, `app.js`, `api.js`, `db.js`, `sw.js`, `manifest.webmanifest`, `icons/`).
- [x] Build app shell with bottom navigation and three views.
- [x] Register service worker and include manifest link. (Icons planned in Phase 7.)
- [x] Implement `db.js` stores: `profile`, `referralsCache`, `outbox`, `meta`.
- [x] Implement `api.js` with profile headers and error handling.
- [x] Submit form UI + validation + auto-fill from profile.
- [x] Submit offline queue + success/queued toasts.
- [x] Dashboard list rendering + filters + refresh + cached fallback.
- [x] Update referral modal; optimistic updates; offline queue.
- [x] Settings/Profile view: name, department select, department PIN; save to IndexedDB.
- [x] Backend: read profile headers; add `DEPT_CODES` validation and default department filter.
- [x] Service worker: precache shell, runtime caching, background sync for outbox, cache versioning.
- [x] PWA polish: manifest fields, icons, install prompt.
- [ ] QA: offline scenarios, small screens, accessibility, error states.
- [ ] Deploy on Vercel; set required env vars; smoke test production.
- [ ] Add icon PNG assets (192/512) and verify manifest in browsers.

## Nice-to-Haves (Future)
- [ ] Client-side CSV export of current view.
- [ ] Ward shortcuts and recent wards per profile.
- [ ] Simple analytics (counts by status/department) rendered from cached data.
- [ ] Passwordless email link or device key instead of shared PIN.
