# Redress roadmap

- [x] Item #30: private atomic note mentions, shared URL timeline filters/search/order, 50-event keyset pages, keyboard picker, My day unread list/mark-read and sidebar badge; 741/741 tests passed in UTC and Sydney, automatic typecheck/build clean. Hosted recipient RLS, audit/no-delete guards and privacy note-delete cascade verified. QA/Read-only get a mentions-only My day view; caseload/default landing unchanged. Billing/public intake unchanged.
- [ ] Item #30 signed-in note save/readback, picker/filter/paging, unread badge/mark-read and phone/dark verification — no auth users; minting unavailable, filtered case safely redirects to sign-in without runtime errors. Applied 0026 plus corrective 0027 for an ambiguous SQL recipient variable found by PGlite tests; historical migration files preserved.


- [x] Item #31: controlled attachment metadata/backfill, assigned-case storage access, reasoned removal, case evidence UI and privacy metadata/ZIP exports; 723/723 tests passed in both UTC and Sydney with two workers; automatic build/typecheck clean. Hosted policies, triggers, minimised audit, removal RPC and private 20 MB limit verified. Billing and public upload form unchanged.
- [ ] Item #31 bucket MIME allow-list — native bucket tool exposes no allowed_mime_types setting; client and metadata insert checks enforce requested types, but direct storage upload MIME restriction remains unavailable.
- [ ] Item #31 signed-in upload/open/remove, SAR ZIP, erasure/retention and phone/dark verification — no auth users or complaint records; signed-out case redirects safely with no runtime errors. Applied 0024 plus corrective 0025 because PostgreSQL SELECT-policy enforcement prevented uploader removal after hiding the removed row; checked RPC preserves the intended permissions.

- [x] Item #50: setup wizard country/native-name search, exact EU/EEA selections, official FIN-NET link/copy/explicit ADR deferral, scoped password-free draft resume/clear, five-step progress/leave warnings and home-default searchable time zones; lowercase QA audit detection. Full suites: 612/612 tests in UTC and Australia/Sydney; automatic typecheck/build passed. No migrations, billing, RLS, triggers or guards changed.
- [ ] Item #50 signed-in setup save/readback, resume and phone/dark-mode verification — no auth users; session minting confirmed unavailable. Signed-out /setup redirects to /auth without runtime errors.

- [x] Item #48: auto-detected onboarding checklist on queue/My day, admin actions/manager read-only progress, user/org hide and menu restore, completion message and TEST intake prefill; 586/586 tests passed in UTC and Sydney, automatic typecheck/build passed. QA review optional without changed-field evidence; template main language inferred from home country. No migrations, billing, RLS, triggers or guards changed.
- [ ] Item #48 signed-in detection, links, hide/restore and phone/dark-mode verification — no auth users; session minting confirmed unavailable. Signed-out My day redirects to sign-in without runtime errors. Restricted evidence is shown as unavailable rather than completed.

- [x] Item #27: My day personal sections, Agent sign-in landing, g d, firm-local dates, filter-only queue links and two-minute visible-tab refresh; 569/569 tests passed in UTC and Sydney, automatic typecheck/build passed. No schema, billing, RLS, trigger or guard changes. Acknowledgement evidence is bounded to 200 candidate cases and labelled when incomplete.
- [ ] Item #27 signed-in caseload, child-table drill-downs, keyboard and mobile verification — no auth users; session minting confirmed unavailable. Signed-out /app/my-day redirects to /auth with no runtime errors.

- [x] Item #38: QA analytics, local-date URL review filters, paginated reads, role-scoped figures, masked notes, trend/table links, CSV and regulatory PDF summary/comparison. Final full suites: 525/525 tests in UTC and Australia/Sydney; automatic typecheck/build passed. No migrations, RLS, trigger, guard or billing changes.
- [ ] Item #38 signed-in analytics/list drill-down, chart, CSV/PDF and mobile verification — session minting confirms no auth users; needs a usable account and review records.

- [x] Item #40: acknowledgement/holding metrics, local dates, exports/chart/comparison and masking regression tests; no schema or billing changes. Full suites: 511/512 in each zone initially; repaired masking and 24/24 targeted tests passed in each zone; automatic typecheck/build passed.
- [ ] Item #40 signed-in report/export/mobile verification — no auth users; session minting confirmed unavailable.

- [x] Item #33 part 1: URL periods/comparison, currency-safe summaries, regulatory PDF cover/tables/methodology/footer and matching CSV.
- [ ] Item #33: signed-in export/mobile verification — needs a usable account and organisation.
- [ ] Part 2 only if a migration is needed: REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.template_versions FROM authenticated (defence-in-depth; RLS + trigger already block).

- [x] Item #22 first half: grouped merge fields, cursor insertion/search, validation, live sample/case preview/PDF, counts and unsaved/save shortcuts; no schema or billing changes.
- [x] Item #22 second half: managed migration 0019, immutable trigger-written template versions, line comparison/restore and Org Admin complaints email for letters/previews.
- [ ] Item #22: verify signed-in editor/history/restore/save, firm email settings and mobile layout — no auth users.

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

- [x] Item #34: accessible dashboard charts, report snapshot drill-downs and removable queue filters; no schema or billing changes.
- [ ] Item #34 signed-in drill-down/mobile verification — requires an account and complaint fixture.
- [x] Item34 fix: server-side drill-down filters, capped snapshots, template_versions REVOKE (0020)

- [x] Item #35: ADR working records, guarded escalation/decision/closure, queue tab and dated filter-only reporting/PDF/CSV.
- [ ] Item #35 signed-in/mobile readback — requires a usable account and case fixtures.

- [x] Item #36: managed reopening records/RPC, firm-local date checks, settings, case dialog and report/filter integration.
- [ ] Item #36 signed-in/mobile readback — requires a usable account and case fixtures.

- [x] Item #37: shared paginated audit history, URL/local-date filters, readable masked diffs and CSV/JSON export receipts; no database or billing changes.
- [ ] Item #37 signed-in audit paging/export/mobile verification — requires a usable account and audit records.
- [x] Item24: 8 more languages (form UI, case languages, import matching, template Start from English, English-fallback warning, PDF glyph test)
- [x] Item24 public correspondence languages expanded in migration 0023.
- [x] Item #28: workload/capacity, auto-assignment and atomic RLS-preserving rebalance, QA cache refresh, managed 0029; 770 tests pass in UTC/Sydney, build clean, hosted assignment guard unchanged.
- [ ] Item #28 signed-in workload/settings/Account/rebalance/mobile readback and independent PostgreSQL-session concurrency verification — no auth users; PGlite overlapping requests are serialized, not independent transactions. Existing correspondence catalogue contains 14 languages, reused without inventing a fifteenth.

- [x] Item #32: managed migration 0023 with journal/snapshot/types; restricted structured support needs, privacy wipe, summary sync/backfill, case/intake/report/My day UI; 14 public correspondence languages and static names. Final complete suites: 686/686 tests in UTC and Sydney; automatic typecheck/build clean; hosted RLS/policies/triggers/function checks passed. Sensitive drivers/notes omitted from new audit records for all readers (stronger minimisation); legacy audit values masked for non-admins.
- [ ] Item #32 signed-in case support save/readback, real public submission, report exports and My day phone/dark verification — no auth users or cases; session minting confirmed unavailable. Irish unavailable-form desktop/phone check has no hydration errors or horizontal overflow; populated country lists checked in simulated different Intl environments, not on a live firm form.
- [ ] Item #32 adjustment reporting completeness for Read-only — restricted support records are not readable; UI reports that adjustment details are restricted, not a fabricated zero. Existing legacy vulnerable_note retained as deprecated, not erased from historical records.
- [x] complaints.vulnerable_note deprecated; new writes use complaint_vulnerability.adjustments_note.

- [x] Three leftovers: managed 0030 preserves queue columns/invoker access, derives acknowledgement evidence and enables exact firm-local filter-only links; anonymous template history revoked; supplied public support translations applied, staff English unchanged. Final full suites: 788 tests in UTC and Australia/Sydney; automatic build/typecheck clean; hosted columns/grants verified.
- [ ] Three leftovers signed-in report drill-down and populated public-form visual verification — hosted database has no auth users; no accounts or tenant records created.
