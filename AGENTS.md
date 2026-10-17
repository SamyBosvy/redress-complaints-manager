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
