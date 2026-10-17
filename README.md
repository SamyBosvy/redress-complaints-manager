# Redress

**Every complaint answered fairly, and on time.**

## What Redress is

Redress is a complaints-management platform for EU payment institutions, e-money institutions and other payment service providers. It helps complaints teams log, track and resolve customer complaints within regulatory deadlines, keep a full audit trail, send compliant responses and report to regulators and management. It is built on my experience as EU/UK Complaints Manager at Square/Block.

- **Queue:** My complaints, Team queue, At risk, Overdue and All, with a business-day clock on every row (green, amber, red)
- **Deadlines:** PSD2 default of 15 business days, extended to 35 when a holding response is sent; rule sets per country and product; business days counted on the customer's country calendar
- **Intake:** a two-minute new complaint form and a branded public web form per firm
- **Case view:** full timeline, deadline panel, letters generated from templates with merge fields and the ADR referral block
- **Quality:** QA approval of final responses and random sampling of closed cases with a scorecard
- **Reporting:** dashboard, breakdowns, root-cause trends and a regulatory reporting pack (CSV and PDF)
- **Audit:** every action logged in an append-only audit log, enforced at database level

## Status

Built in phases. Done: organisations, roles, first-run setup wizard, complaint intake, deadline engine, queue, case view, templates, letter generation and the holding-response clock. Installable as an app. Next: audit log, public web form, QA and alerts, reporting, Stripe billing, GDPR tooling and settings pages.

## Roles

Org Admin, Complaints Manager, Agent, QA Reviewer and Read-only (Compliance/Auditor). The person who creates the organisation becomes Org Admin.

## Stack

- TanStack Start, React 19, TypeScript, Tailwind CSS 4
- Lovable Cloud (Supabase) for auth and Postgres; reference numbers and deadlines set by database triggers
- Stripe for subscriptions (planned)
- Vitest

## Data

- Multi-tenant: each organisation is isolated with row-level security
- Complaint intake, handling and letters are never blocked by plan limits or an expired trial
- Configurable retention with anonymisation, per-complainant export and erasure (GDPR, planned)
- No analytics or third-party trackers

## Development

```bash
npm install
npm run dev
npm test
```

## Rules

Engineering rules live in `AGENTS.md`. The build roadmap is in `roadmap.md`.

© 2026. All rights reserved.
