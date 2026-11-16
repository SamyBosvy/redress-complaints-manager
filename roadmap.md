# Redress roadmap

- [x] Items #15 + #18: reasoned detail edits with deadline confirmation and managed root causes; managed migrations 0016–0018, journal/snapshots/types refreshed, unchanged existing RLS/0015 guards and hosted read-only schema checks; final checks reported in chat.
- [ ] Verify Items #15 + #18 signed-in edits/settings/closure/report exports and mobile views — needs a usable account and organisation.

- [x] Batch 2: reviewed/applied compliance migration 0015 with managed journal/snapshot and refreshed types; legal Next step, closure checklist, four-eyes QA/draft restrictions and readable import labels.
- [ ] Batch 2 signed-in case/QA/import persistence and mobile verification — blocked: hosted database has no users or organisations; no test accounts created.

- [x] Item #20: queue multi-selection/ranges/all-matching, confirmed reassignment/priority in 50-case batches, closed-case skips, progress/results and client CSV; public-form text corrections.
- [ ] Verify Item #20 signed-in/mobile selection, persisted bulk updates and per-case audit/activity — blocked: hosted database stays paused.

- [x] Item #10 front half: local CSV/XLSX parsing, six-language column/value suggestions, validation and 50-row preview, problems CSV, 100-row existing-path inserts with progress and retained preview on errors.
- [ ] Verify Item #10 signed-in mobile upload/import, permissions and persisted readback — blocked: hosted database stays paused.

- [x] Item #25: six-language public complaint form, typed dictionary and option labels, browser/URL language selection, translated validation and metadata; existing submission values preserved.
- [ ] Verify Item #25 live form submission/confirmation — blocked: hosted database stays paused; native-speaker review needed before launch (French still needs owner review).

- [x] Item #41: truthful full marketing landing page, shared contact constant, illustrative product views, plans/FAQ; automatic typecheck/build clean, 191 tests passed; axe zero violations in light/dark, no horizontal scroll at 320/360/390/1280, menu/FAQ/skip/trial links checked locally.
- [ ] Item #41 launch readiness: CONTACT_EMAIL set to samy.bosvy@gmail.com; hosted signup/demo delivery unverified while the database stays paused.

- [x] Item #17: case Letters card, full org-scoped list, accessible body disclosures, copy/original-date PDFs and matched timeline links; ordering/sender/filename/matching unit tests.
- [ ] Verify Item #17 signed-in letter reads, timeline links, clipboard and PDF downloads — blocked: hosted database stays paused.

- [x] Item #16: customer history (10 newest, full counts) and debounced/blur non-blocking duplicate warnings; safely escaped org-scoped matching, existing RLS only.
- [ ] Verify Item #16 signed-in history, duplicate links and complaint submission — blocked: hosted database stays paused.

- [x] Enable Lovable Cloud
- [x] Phase 1: design system, auth, organisations + roles (RLS), first-run wizard
- [x] Phase 2: complaints, rule sets, business-day calendars, queue, new complaint form
- [x] Phase 3: case view, timeline, templates + letter generation, holding response clock
- [x] Installable app + "Download the app" button (landing, sign-in, in-app) — workspace rule
- [x] Phase 4: immutable audit log (DB-enforced) + viewer/CSV
- [x] Phase 5: public web form per organisation — sharing/embed, firm logo, privacy notice, Received confirmation; public and embedded submissions verified
- [ ] Verify Org Admin sharing/logo controls and queue readback with a real signed-in account — blocked: hosted database currently inaccessible; account/session availability cannot be confirmed
- [x] Phase 6: QA module + sampling, in-app alerts (daily email digest blocked: no email domain configured)
- [x] Phase 7: reporting dashboard, breakdowns, regulatory pack (CSV/PDF)
- [ ] Phase 8: Stripe billing (trial, Starter/Growth/Scale), soft feature locks only — paused until owner explicitly signals settled back in Europe; test payments connected, no prices or checkout implemented
- [x] Phase 9: Org Admin privacy page — retention with 30-day lookahead, legal holds, subject-access JSON/PDF review packs, working-record erasure with lawful-basis confirmation, organisation JSON/CSV export, draft policy/DPA pages
- [x] Retention anonymisation — authenticated scheduled processing, database-enforced eligibility and case locks, future audit minimisation; historical immutable audit and backups retained
- [ ] Verify privacy controls with a real signed-in Org Admin — blocked: hosted database currently inaccessible; account/session availability cannot be confirmed
- [ ] Enable organisation purge automation after billing cancellation verification is implemented — blocked: Phase 8 remains paused; 30-day request/cancel controls are built but unavailable
- [ ] Replace draft privacy/DPA and public privacy notice; approve historical audit/backup retention and disposal — blocked: owner/legal review
- [x] Multi-user implementation: Users/invites, 7-day acceptance, active memberships, role changes and last-admin protection; signed-in verification tracked separately
- [x] Post-setup Settings implementation: organisation/address/currency, countries/ADR, calendars, rule sets/assignments and audited deadline recalculation; signed-in verification tracked separately
- [x] Account security implementation: verified email, password reset/change, TOTP/required 2FA, recovery and all-session sign-out; signed-in verification tracked separately
- [ ] Email: invitations and daily digest; custom auth emails — sender domain required
- [x] Desktop/mobile sign-out implementation and invite/role/admin/handler/assignment tests
- [ ] Verify Users/invite acceptance, Settings, switching, account/recovery/2FA, case recalculation and sign-out end-to-end — blocked: hosted database inaccessible and session minting fails; concurrency and hosted RLS/audit behavior remain unverified

## Current scoped completion
- [x] Item #52: informational trial banner, UTC-day urgency, session dismissal above two days, no-price plan dialog and admin contact placeholder; no entitlement locks or billing changes.
- [ ] Verify Item #52 signed-in banner/dialog and mobile layout — blocked: hosted database remains paused.
- [x] Code-only PDF/currency work: shared Unicode font, firm-address letter header, per-currency report figures/CSV/PDF and Outcome currency selectors
- [x] Local verification: all 92 tests passed; automatic full typecheck/build OK at 2026-10-28 02:43:54 UTC; Polish letter (1 page), French letter (2 pages) and regulatory pack (1 page) rendered to PNG and every page visually checked
- [x] Compliance workflow database/UI hardening — migration 0015 applied; hosted columns/functions/triggers verified; letters/QA/complaints RLS unchanged.
- [ ] Verify currency controls and report exports with a signed-in firm — blocked: hosted database paused
- [x] Use actual privacy_processing read from complaints for the case recalculation gate; fail closed on read errors
- [x] No-send daily digest preparation: one active member, tenant/role-scoped clocks, at-risk 0–3 business days, overdue, pending final-response approvals; paginated server reads, no queue, schedule or sends
- [x] Membership SQL and helper tests: seven-day expiry, resend, revoke, single-use, verified email matching, role changes, last-admin protection, transfer, handler eligibility and rule precedence — 84 tests passed
- [x] Automatic full typecheck/build passed (build OK at 2026-10-26 01:33:24 UTC); 84 tests passed; public password-reset request screen verified with no runtime errors
- [x] Repair settings and password-reset preview errors; confirm clean preview
- [x] Wire role-aware Settings, Account, organisation switching and verification/2FA redirects
- [x] Add forgot-password email request and audited administrator deadline recalculation with date comparison
- [x] Fix desktop/mobile sign-out with cache clearing and replacement navigation; run scoped tests
- [x] Queue upgrades (code-only): sortable columns with aria-sort, 50-per-page server pagination replacing the silent 1000-row cap, URL-search-param tab/search/filters/sort/page with removable chips, ack due/overdue badges + tab, coloured status pills in queue and case header, deadline tooltip + business-day progress bar, clickable keyboard-accessible rows; tenant-scoped count queries
- [x] Queue verification: full typecheck clean, automatic build OK at 2026-10-30 00:31:29 UTC, 117 tests passed (25 queue tests incl. stopped-clocks-last paging, search-param validation, ack badge logic, status tones)
- [ ] Verify queue sorting/paging/badges with a signed-in firm and mobile widths — blocked: hosted database paused
- [x] Item #47: grouped role-aware Work/Insight/Admin navigation, shared user menu with organisation switching/Account/sign-out, mobile navigation Sheet closing on navigation; role visibility regression tests
- [ ] Verify Item #47 signed-in navigation, switching/sign-out and mobile widths end-to-end — blocked: hosted database paused

- [x] Item #49: shared empty states and reduced-motion-safe table skeletons; queue empty-firm/filter distinction and role actions, QA/Templates/Reports/Audit/Privacy/invitations empty states, authenticated navigation pending placeholders.
- [ ] Verify Item #49 live signed-in empty/loading states — blocked: hosted database stays paused.
- [x] Item #21: role-aware command palette, 250ms tenant-scoped complaint search (max 8), desktop/mobile search buttons, guarded global shortcuts and queue J/K row focus.
- [ ] Verify Item #21 live complaint search and signed-in mobile/keyboard navigation — blocked: hosted database remains paused.

- [x] Item #51: local Comfortable/Compact density in user menu/palette, pre-paint application and shared table CSS; associated form labels, scoped headers, decorative icons, shared focus indicators and skip link; public axe audit in both themes.
- [ ] Verify Item #51 signed-in controls and keyboard/mobile flows — blocked: hosted database stays paused.

- [x] GitHub sync check (Nov 2026)
- [x] Item #11: date-holidays nationwide public holiday pre-fill in setup and Org Admin add-missing preview in Calendars; spot-check tests for all 32 countries.
- [ ] Verify Item #11 signed-in setup save and Calendars insert — blocked: hosted database stays paused.
