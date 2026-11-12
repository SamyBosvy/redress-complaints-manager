## Customer history
## Shared marketing data
- Marketing and TrialBanner share CONTACT_EMAIL from src/lib/contact.ts and TRIAL_PLANS from src/lib/trial.ts; product previews are static fictional HTML. Why: prevent contact/plan drift without querying tenant data.

## Customer history
- Use safely quoted exact-ID or anchored case-insensitive-email filters against org-scoped complaint_queue under existing RLS; exclude anonymised/current cases and count all non-closed statuses as open. Why: precise customer matching without changing permissions or blocking intake.
## Holiday and digest helpers
- Daily digest selection is pure and single-recipient in src/lib/daily-digest.ts; a paginated server-only preparation helper reads one active membership without sending or scheduling. Why: prepare role-scoped data without email queues or bulk sending.
- Public holidays come from the date-holidays package via src/lib/public-holidays.ts: nationwide type 'public' only (intersection across regions; GB = England & Wales), loaded lazily, never hand-coded; imports add missing dates only. Why: wrong holidays create wrong regulatory deadlines.
