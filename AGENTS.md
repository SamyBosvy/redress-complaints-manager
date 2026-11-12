<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Architecture rules
- Tenancy: every app table carries org_id; RLS uses security-definer helpers is_org_member / has_org_role. Why: hard isolation between firms.
- Roles live in org_members (one role per user per org), never on profiles. Why: prevents privilege escalation.
- Organisation creation goes through the create_organisation RPC, which also seeds the default rule set. Why: atomic setup, creator becomes Org Admin.
- Signed-in pages live under src/routes/_authenticated/; /app requires a completed setup, otherwise redirects to /setup.
- Complaint reference and deadline dates are set by DB triggers on insert; remaining business days come from the complaint_queue view. Why: one source of truth for regulatory clocks.
- Clock colour/at-risk thresholds live in src/lib/complaints.ts (clockTone, isAtRisk) with tests next to it.
- Case timeline = complaint_events, written by DB triggers on complaints/letters; clients may only insert 'note' and 'attachment' events, never update/delete. Why: tamper-proof history.
- Attachments live in the private 'attachments' bucket under <org_id>/<complaint_id>/; storage RLS keys on the first folder.
- Letter merge/ADR check/status-after-send rules live in src/lib/letters.ts with tests.
- PWA: service worker registers only outside iframes/preview hosts; it never caches /~oauth or /api.
- Audit: public.audit_log is filled only by the audit_capture() trigger on every app table; UPDATE/DELETE/TRUNCATE are blocked by triggers and no client grants exist beyond SELECT. Add the trigger to every new app table. audit_log has no FK to organisations so entries survive org deletion.
- CSV exports go through src/lib/csv.ts (formula-injection safe).

- Public intake uses narrow SECURITY DEFINER RPCs: details expose only public firm fields, submission validates and writes Received/web_form atomically with a privacy receipt; no anonymous table reads or generic complaint inserts. Why: isolate tenants and avoid exposing complaint data.
- Public form retries reuse a submission UUID and return the original reference. Why: prevent duplicate complaints after connection failures.
- Firm logos use private storage with SELECT restricted to the currently published logo path and Org Admin upload policies. Why: workspace disallows public buckets while public forms still need a safe logo.
- Privacy mutations and exports use authenticated Org Admin server functions, while service-only routines perform anonymisation/purge. Why: client permissions must not allow unrestricted personal-data deletion.
- Privacy working-record erasure preserves immutable historical audit snapshots; future audit capture minimises customer free text. Why: preserve existing audit integrity without falsely claiming full GDPR erasure.
- Retention runs through a managed authenticated scheduled route; organisation purge automation stays disabled until server-verified billing cancellation is implemented. Why: preserve the payment setup hold and avoid premature deletion.
- Privacy processing claims closed complaints before removing files; claimed cases cannot be reopened or receive attachments. Why: avoid irreversible erasure races with legal holds and handling.
- Privacy exports paginate all records and include private file contents; multilingual PDFs embed a local Unicode font. Why: avoid silent row truncation and unreadable subject-access packs.

- Workspace security redirects, Settings visibility and deadline-recalculation permission UI rules live in src/lib/workspace-access.ts with tests; database RPCs remain authoritative. Why: one consistent client gate without duplicating server enforcement.
- Case loading reads privacy_processing directly from complaints under RLS and fails closed on read errors. Why: the queue view omits this field and claimed cases must not offer recalculation.
- Membership regression tests execute repository SQL routines in isolated local PostgreSQL via PGlite, never against hosted tenant data. Why: verify invite and role safeguards without creating real users or changing production records.
- All PDF generators use the shared local Unicode font loader/embedding helper for normal and bold styles. Why: avoid standard-font fallback and preserve multilingual text.
- Reporting aggregates redress and goodwill independently by their recorded currency, retaining missing-currency amounts as unspecified rather than inferring a currency. Why: never combine unlike currencies or silently omit payments.
- Queue list state (tab, search, filters, sort, page) lives in validated URL search params parsed by src/lib/queue.ts (parseQueueSearch); all QueueSearch fields stay optional so links to /app need no search object. Why: bookmarkable views without breaking navigation typing.
- Queue pagination is server-side (50/page) via pageSlices, which segments running vs stopped clocks so stopped clocks always sort last across pages; count queries must be org-scoped. Why: the "All" tab must never hide rows and stopped clocks must not interleave.
- App shell desktop/sidebar and mobile Sheet share grouped navigation from appNavigation and the same user menu; preserve existing per-link role visibility. Why: prevent navigation permission drift between screen sizes.

- EmptyState/TableSkeleton share reduced-motion-safe empty/loading views; queue uses an unfiltered org count and tested role actions. Why: distinguish empty firms from filters.
- TrialBanner uses UTC-day/expiry logic and org-scoped session dismissal, never entitlement locks. Why: billing remains independent.
- Workspace palette and shortcuts reuse appNavigation for role visibility; complaint search reuses queue filters with explicit org scope and eight-result cap. Why: preserve navigation permissions and tenant isolation without separate rules.

- Density is a local, pre-paint html preference; shared table CSS applies it everywhere. AccessibleField context associates nested controls with labels. Why: consistent density and accessible names without page-specific styling.

