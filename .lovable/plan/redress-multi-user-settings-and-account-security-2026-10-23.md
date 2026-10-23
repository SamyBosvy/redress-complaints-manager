# Redress: multi-user settings and account security

## Scope
Build post-setup Settings, organisation invitations and membership management, personal account security, and email readiness. Phase 8 remains paused: no Stripe, pricing, checkout, or billing changes.

## 1. Users, invitations and organisation access
- Add **Settings → Users**, editable only by Org Admins. Show members’ names, emails, roles, Active/Deactivated status, last sign-in, and a separate Invited list with expiry and delivery state.
- Invite an email address with one of the five existing roles. Links expire after exactly seven days, are single-use, and support resend and revoke. Resend invalidates the previous link.
- A new user signs up and verifies their email; an existing user signs in. Acceptance verifies the account email against the invitation and atomically joins the correct firm with the stored role. Completed firms bypass setup.
- Support role changes, deactivation/reactivation, and explicit Org Admin transfer. Protect the last active Org Admin in the database, including simultaneous changes. Preserve memberships and historical attribution rather than deleting users.
- Support people belonging to more than one firm with an organisation selector. Switching firms clears private cached data. Deactivated memberships cannot access that firm, even through direct requests.
- Assignment menus show only active, non-Read-only handlers. Historical names remain available in timelines even after deactivation.

## 2. Post-setup Settings
Add **Settings** to the sidebar for Org Admins and Complaints Managers. Managers can view configuration, but cannot change it or manage invitations/members.

- **Organisation:** legal entity name, licence, home country, regulator, firm address, base currency, and “Require 2FA for all members”. Add firm address to letter merge fields and letter output.
- **Countries & ADR:** add/remove served countries; edit body name, website and contact. Removing a served country does not delete its historical complaints or holiday calendar.
- **Calendars:** country and year filters; add, edit and delete holidays.
- **Rule sets:** create/edit acknowledgement, final and extended business-day rules; set the default and assign overrides by country and product. Show the effective rule for each country/product combination, with precedence: country+product, country, product, default.
- Preserve existing complaint deadline dates when rules or calendars change. Add an explicit Org Admin deadline recalculation action on the case, showing old/new dates and requiring a reason. Audit the change and show it in the timeline.

## 3. Authentication and Account
- Add **Forgot password?** and a public reset-password page with recovery-link validation and new-password confirmation.
- Require a verified email before organisation access or invitation acceptance; provide a clear confirmation state and resend option.
- Add **Account** for every user: name, verified email-change flow, password change with current password, authenticator enrolment, factor management, and all-session sign-out.
- TOTP enrolment shows a QR code and manual setup option, then requires a valid authenticator code. Sign-in challenges verified factors; an organisation requiring 2FA sends unenrolled members to enrolment and denies private firm data until verification.
- **Recovery codes:** the platform does not supply these natively. Implement a separate password-authenticated recovery flow with one-time, hashed codes, attempt limits, atomic consumption and security audit events. A code resets lost factors and requires fresh enrolment; it never manufactures a verified 2FA session. Codes are shown once and never stored in plaintext or audit snapshots.
- Fix desktop and mobile sign-out together: cancel requests, clear private cached data, sign out, and replace the current history entry with `/auth`.

## 4. Email readiness
- Confirmation and password-reset emails can already use the platform’s default authentication sender; they do not require a custom domain.
- Invitation emails and each member’s expected daily digest need a real sending domain you own. No sender domain is currently configured.
- Build secure invitation links and clearly report when an email has not been sent. Allow the Org Admin to copy a link while sending is unavailable; do not falsely show successful delivery.
- Prepare recipient-specific daily digest selection for at-risk (three business days or fewer), overdue, and awaiting-QA complaints, respecting active memberships and roles. Do not send customer complaint letters or marketing emails.
- After domain setup, use the managed email scaffolds for branded authentication emails, invitations and daily digests. Schedule secure, recipient-specific sends with retry-safe event identifiers; do not create an email queue or bulk broadcast endpoint.
- **What you provide:** a domain you own and access to its DNS settings. The setup dialog supplies the exact assigned DNS records; none can be quoted yet because no domain exists. DNS verification and live email delivery remain pending until you complete setup. No external email-service key is needed.

## Technical safeguards
- Preserve roles in `org_members`; add active state and narrow, authenticated operations rather than granting broad new membership writes.
- Extend shared organisation-access helpers to require active membership, verified email and the required assurance level. Apply equivalent checks before privileged server work; a page redirect alone is not security.
- New organisation-scoped tables receive explicit grants, RLS and `audit_capture` in the same migration. Exclude invitation secrets and recovery-code hashes from audit snapshots. Record the authenticated actor for privileged changes.
- Validate cross-org references and assignment targets in the database. Protect membership identity, last-admin rules, invitation acceptance and deadline recalculation independently of the UI.
- Keep public invite/reset screens separate from private organisation pages. Never expose member lists, last-sign-in details, emails or invite secrets to anonymous callers.
- Use managed migrations and generated types, existing design tokens and controls, and unique page metadata. Record structural decisions in `AGENTS.md`.

## Verification and completion
- Add focused tests for seven-day expiry, resend/revoke/single-use acceptance, email matching, role changes, concurrent last-admin protection, transfer, inactive access, handler eligibility, assignment precedence, unchanged existing deadlines, reason-required recalculation, and recovery-code consumption.
- Exercise database security rules as well as UI logic; verify direct requests cannot bypass deactivation, 2FA, role restrictions or tenant isolation.
- Check Settings and Account on desktop and mobile; check blocking enrolment/recovery screens at 320×568, 360×640 and 390×844, including enlarged text and reachable continuation/sign-out controls.
- Run affected tests and inspect preview errors; update `roadmap.md` with completed work and specific blockers.
- **Current verification blocker:** there are no signed-up accounts in this project. Real member/invite/account flows need an account created through signup; email delivery needs the sending domain. Report these as unverified until exercised, not as completed checks.
- All-session sign-out revokes refresh sessions; already-issued access tokens can remain valid until expiry. Membership deactivation is enforced independently at the database layer.