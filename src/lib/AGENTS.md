## Shared marketing data
- Complaint import parsing is browser-only and lazy; validation/mapping live in import.ts, with 100-row inserts under existing RLS. External references are appended to summary because no dedicated column exists. Why: preserve source data without schema changes.
- Public form text/options and error mapping live in public-form-i18n.ts; URL language overrides browser detection after hydration and stored option keys remain unchanged. Why: complete translations without changing intake contracts.
- Marketing and TrialBanner share CONTACT_EMAIL from src/lib/contact.ts and TRIAL_PLANS from src/lib/trial.ts; product previews are static fictional HTML. Why: prevent contact/plan drift without querying tenant data.

## Customer history
- Use safely quoted exact-ID or anchored case-insensitive-email filters against org-scoped complaint_queue under existing RLS; exclude anonymised/current cases and count all non-closed statuses as open. Why: precise customer matching without changing permissions or blocking intake.
## Holiday and digest helpers
- Daily digest selection is pure and single-recipient in src/lib/daily-digest.ts; a paginated server-only preparation helper reads one active membership without sending or scheduling. Why: prepare role-scoped data without email queues or bulk sending.
- Public holidays come from the date-holidays package via src/lib/public-holidays.ts: nationwide type 'public' only (intersection across regions; GB = England & Wales), loaded lazily, never hand-coded; imports add missing dates only. Why: wrong holidays create wrong regulatory deadlines.

## Queue bulk actions
- Selection helpers live in bulk-actions.ts; matching selection reuses queue paging/filters, and 50-case batches use existing org-scoped RLS updates with trigger audit/activity, never client-inserted events or bulk status changes. Why: preserve existing permissions and workflow boundaries.

## Detail edits and root causes
- Detail edits use edit_complaint_details and transaction-scoped trigger context for one masked timeline event and one full audit diff; business-day deadlines share complaint_deadlines. Why: preserve existing guards without duplicate activity.
- Root causes use an org-scoped foreign key and active-only new choices; reporting resolves current managed names and preserves legacy text, while closure requires a managed id. Why: retain historical choices without allowing free-text closure.

## Template merging
- Template previews and case letters share caseMergeValues and letterPdf; missing values remain visible, and template saves reject unknown fields or missing final ADR placeholders. Why: keep preview and sent-letter merging consistent without schema changes.
- Template versions are written only by template save triggers and are append-only; restores load editor text and save restored_from. Why: complete history without client-written records.
