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
