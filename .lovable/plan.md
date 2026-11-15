# Batch 2 compliance safeguards

- Review the staged migration against the live schema, preserve existing tenant access policies and privacy/audit protections, and apply it through the managed migration tool with refreshed types.
- Replace unrestricted case status selection with legal Next step actions and a complete close-checklist dialog.
- Enforce four-eyes QA in the interface, show pending final responses as drafts, and prevent copying/downloading/resubmitting pending drafts.
- Show mapped product and country names in import previews.
- Add workflow/checklist/QA/error/import tests, execute the full test suite, inspect automatic typecheck/build results, and verify hosted schema and policy definitions read-only.

## Technical details
- Database triggers remain authoritative; QA decisions cascade in one database transaction rather than duplicate client updates.
- Tighten review identity and draft validation so approvals cannot be reused for another letter or case. Preserve existing RLS, privacy locks and audit minimisation from migrations 0012–0014.
- No hosted test users or organisations will be created without an existing account; signed-in end-to-end verification may remain unavailable in the empty database.
- Billing is untouched.