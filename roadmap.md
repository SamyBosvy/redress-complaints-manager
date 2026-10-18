# Redress roadmap

- [x] Enable Lovable Cloud
- [x] Phase 1: design system, auth, organisations + roles (RLS), first-run wizard
- [x] Phase 2: complaints, rule sets, business-day calendars, queue, new complaint form
- [x] Phase 3: case view, timeline, templates + letter generation, holding response clock
- [x] Installable app + "Download the app" button (landing, sign-in, in-app) — workspace rule
- [x] Phase 4: immutable audit log (DB-enforced) + viewer/CSV
- [x] Phase 5: public web form per organisation — sharing/embed, firm logo, privacy notice, Received confirmation; public and embedded submissions verified
- [ ] Verify Org Admin sharing/logo controls and queue readback with a real signed-in account — blocked: no auth users; owner must sign up/sign in
- [x] Phase 6: QA module + sampling, in-app alerts (daily email digest blocked: no email domain configured)
- [x] Phase 7: reporting dashboard, breakdowns, regulatory pack (CSV/PDF)
- [ ] Phase 8: Stripe billing (trial, Starter/Growth/Scale), soft feature locks only — paused until owner explicitly signals settled back in Europe; test payments connected, no prices or checkout implemented
- [x] Phase 9: Org Admin privacy page — retention with 30-day lookahead, legal holds, subject-access JSON/PDF review packs, working-record erasure with lawful-basis confirmation, organisation JSON/CSV export, draft policy/DPA pages
- [x] Retention anonymisation — authenticated scheduled processing, database-enforced eligibility and case locks, future audit minimisation; historical immutable audit and backups retained
- [ ] Verify privacy controls with a real signed-in Org Admin — blocked: no auth users; owner must sign up/sign in
- [ ] Enable organisation purge automation after billing cancellation verification is implemented — blocked: Phase 8 remains paused; 30-day request/cancel controls are built but unavailable
- [ ] Replace draft privacy/DPA and public privacy notice; approve historical audit/backup retention and disposal — blocked: owner/legal review
- [ ] Settings pages: organisation, users/invites, rule sets, calendars, ADR bodies — outside the Phase 9 request, deferred to a separate phase
