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

## Regulatory reports
- Response evidence uses sent letters then status-event fallback; acknowledgement links use the queue timestamp and invoker computed deadline comparison with firm-local bounds. Why: exact server-side cohorts without oversized ID lists.
- Regulatory periods/comparisons and currency-safe summaries/tables share reports.ts; org-scoped paginated status history reconstructs period-end resolution, and regulatory-pdf uses local Unicode fonts with repeated table headers. Why: consistent CSV/PDF/UI without changing workflow guards.

- Report drill-downs are filter-only server-side complaint_queue filters (reportFilterOps mirrors matchesReportFilters); snapshot IDs only for past period-end open counts up to SNAPSHOT_CAP, else a current-status note. Why: links and queries must scale without hiding historical differences.

## ADR
- ADR records are tenant-scoped trigger-validated child data; reports and filter-only drill-downs use escalation/decision dates, not receipt cohorts. Why: preserve case guards and match ADR counts at scale.

## Reopening
- Reopening uses the role-checked RPC and append-only records; firm_date controls database date boundaries. Why: prevent direct status bypass and machine-zone-dependent dates.

## Audit browsing
- Audit page and case section share org-scoped keyset queries and role-masked exports; checksums cover final downloaded bytes including footer/BOM. Why: scalable child-case history and independently verifiable files without changing database access.

## QA analytics
- QA analytics shares pure attribution/local-date metrics and URL predicates; org-scoped review reads paginate with stable ordering, available-column filters run in PostgREST and derived handler filters run after paging. Why: exact scalable drill-downs without schema or four-eyes changes.

## Personal caseload
- Workload queue links share validated metric/date predicates; automatic selection locks firm/capacity rows and rebalance uses invoker updates. Why: exact drill-downs and atomic caps without changing assignment permissions.
- My day uses caller-scoped queue predicates shared with filter-only queue links; only acknowledgement evidence is derived across up to 200 candidates with paged letters/events. Why: bounded personal reads without migrations or hidden caps.
- Mention reads/counts use recipient RLS with current case-access checks; My day exposes a mentions-only view for non-handlers. Why: retain history but hide mentions after unassignment.

## Setup progress
- Wizard drafts use a validated password-free schema scoped per user/org; country search and time-zone defaults share setup-wizard.ts. Why: safe local resume and consistent country handling without schema changes.
- Setup progress uses read-only org-scoped existing evidence, treats inaccessible evidence as unknown, and stores dismissal per user/org locally; unchanged QA values cannot prove review, so QA is optional. Why: no manual completion or new permissions/schema, and no false setup claims.

## Languages
- Owner-supplied translations remain verbatim; public country/language labels use checked-in static names, and correspondence accepts all supported languages. Why: avoid SSR/client ICU differences and intake rejection.

## Support needs
- Structured support data is a restricted tenant child record; flag sync uses existing reasoned edit guards, privacy erasure removes it, and audit capture omits sensitive drivers/notes. Why: minimise special-category exposure without weakening workflow locks.

## Notifications
- Notification writes are trusted triggers only; recipient RLS rechecks current case access, preferences run at insertion, and scheduled deadline/retention RPCs are service-only. Why: prevent spoofing and stale-access leaks without email or realtime.
