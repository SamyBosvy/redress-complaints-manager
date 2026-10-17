# Redress Complaints Manager

Build "Redress", a B2B complaints-management platform for EU payment institutions, e-money institutions and other payment service providers. It helps complaints teams log, track and resolve customer complaints within regulatory deadlines, keep a full audit trail, send compliant responses and produce reporting for regulators and management. It is a paid SaaS: firms sign up for a 14-day free trial, then subscribe to a plan. Each firm is a fully isolated organisation.



TECH

- Use Lovable Cloud for auth and the database, hosted in the EU.

- Multi-tenant: every organisation is fully isolated from the others with row-level security. No user can ever see another organisation's data.

- Desktop-first (complaints teams work at desks), usable on tablet and mobile for checking queues and deadlines.

- Stripe for subscriptions and billing.

- No AI features in this version.



ROLES (per organisation)

- Org Admin: settings, users, billing, rule sets, templates.

- Complaints Manager: sees all complaints, assigns, approves final responses, runs reports.

- Agent: handles complaints assigned to them, can see the team queue.

- QA Reviewer: reviews and approves or returns final responses, samples closed cases.

- Read-only (Compliance/Auditor): sees everything, can export reports, cannot change anything.

- The person who creates the organisation becomes Org Admin.



ORGANISATION SETUP (first-run wizard)

- Legal entity name, licence type (Payment Institution, E-Money Institution, Credit Institution, Other), home country and regulator.

- Countries where the firm serves customers.

- For each country: the alternative dispute resolution (ADR) or ombudsman body name, website and contact details, used in letters.

- Business-day calendar per country: weekends excluded, public holidays editable by the Org Admin.

- Deadline rule set (see below), pre-filled with the PSD2 default and fully editable.



CORE DATA



1. COMPLAINT

- Reference number (auto, e.g. RDR-2026-000123), date and time received, channel (Email, Phone, Chat, Letter, Web form, Social media, In person), country of the customer, language.

- Complainant: name, email, phone, customer/account ID, vulnerable customer flag with optional note.

- Product (Payment account, Card, Credit transfer, Direct debit, E-money wallet, Merchant acquiring, Other) and category (Unauthorised transaction, Fraud or scam, Fees and charges, Account blocked or closed, Payment delay or failure, Refund or chargeback, Customer service, Data protection, Other).

- Summary of the complaint, desired outcome stated by the customer.

- Assigned agent, priority (Standard, High), status.

- Statuses: Received, Acknowledged, Under investigation, Holding response sent, Final response sent, Closed, Escalated to ADR, Reopened.

- Outcome: Upheld, Partially upheld, Not upheld, Withdrawn. Redress paid (amount + currency), goodwill gesture (amount + currency), root cause (category + free text).

- Attachments (evidence, correspondence), internal notes (never shown to the customer).



2. DEADLINE RULE SET

- Configurable clocks per rule set: acknowledgement deadline, final response deadline, extended final response deadline (when a holding response is sent), all in business days.

- Default rule set "PSD2 payment services": final response within 15 business days, extendable to 35 business days when a holding response explaining the delay is sent.

- Rule sets can be assigned per country and per product, so firms can add their own national rules.

- Clocks count business days using the customer's country calendar.



3. TEMPLATE

- Letter and email templates: Acknowledgement, Holding response, Final response (Upheld / Partially upheld / Not upheld), Information request, Closure.

- Merge fields: {customer_name}, {reference}, {date_received}, {final_deadline}, {adr_body_name}, {adr_body_contact}, {agent_name}, {firm_name}.

- One version per language (start with English, French, Spanish, Portuguese, Polish, Dutch slots; the firm fills in the text).

- Final response templates must include the ADR referral block; the app warns if it's missing.



FEATURES



1. QUEUE (home screen)

- Tabs: My complaints, Team queue, At risk, Overdue, All.

- Each row: reference, customer, category, status, assigned agent, business days left with a colour-coded clock (green more than 5 days, amber 5 days or fewer, red overdue).

- Filters by status, category, product, country, agent, vulnerable flag. Search by reference, name or customer ID.



2. LOGGING A COMPLAINT

- "New complaint" form that takes under 2 minutes, with required fields marked.

- Public complaint web form per organisation (shareable link and embeddable snippet) with the firm's name and logo, a privacy notice and a confirmation showing the reference number. Submissions arrive with status Received.



3. CASE VIEW

- Timeline of every event: status changes, letters sent, notes, attachments, reassignments, deadline changes, each with user and timestamp.

- Deadline panel: date received, acknowledgement due, final response due, extended deadline if a holding response was sent, business days remaining.

- Generate letter from template: merge fields filled in, edit before sending, mark as sent (copy to clipboard or download PDF). Sending email directly is out of scope; the app records the date sent.

- Sending a holding response automatically switches the clock to the extended deadline and records the reason.



4. QUALITY ASSURANCE

- Optional per organisation: "Final responses require QA approval" (on by default).

- QA Reviewer approves or returns with comments; returned responses go back to the agent.

- QA sampling: Complaints Manager sets a percentage (default 10%) of closed complaints randomly assigned for QA review, with a simple scorecard (Accuracy, Fair outcome, Clear communication, Deadlines met, ADR rights given: Pass/Fail + note).



5. ALERTS

- In-app notifications and daily email digest: complaints at risk (3 business days or fewer to deadline), overdue complaints, complaints awaiting QA.



6. REPORTING

- Dashboard: open complaints, received/closed this month, % resolved within deadline, average business days to resolve, uphold rate, redress paid total, top 5 categories and root causes, vulnerable customer complaints count.

- Breakdown by product, category, country, channel and agent, over any date range.

- Regulatory reporting pack: totals by product and category, outcome, within-deadline %, redress, for a chosen period. Exports as CSV and PDF.

- Root cause trends over time (line chart).



7. AUDIT TRAIL

- Every action in the app is recorded in an immutable audit log (who, what, when, before/after values). Nobody, including the Org Admin, can edit or delete audit entries; enforce this at database level.

- Audit log viewer with filters and CSV export for Org Admin, Complaints Manager and Read-only users.



8. BILLING (Stripe)

- 14-day free trial, no card required, full Growth features.

- Plans (prices set in Stripe, editable later):

  - Starter: 3 seats, up to 100 new complaints per month, standard templates, CSV export.

  - Growth: 10 seats, up to 500 new complaints per month, custom templates, public web form branding, QA module, PDF regulatory pack.

  - Scale: unlimited seats and volume, everything in Growth, priority support ("Contact us" button, no checkout).

- Billing page for Org Admin: current plan, usage vs limits (seats, complaints this month), invoices, upgrade, downgrade, cancel.

- IMPORTANT: never block logging or handling a complaint because of plan limits or an expired trial. Firms have a legal duty to handle every complaint. When over limit or after the trial ends, show an upgrade banner and lock only premium features (exports, custom templates, QA, branding), never complaint intake, case handling or letter generation.



PRIVACY (GDPR-compliant)

- Complainant data is personal data: access limited to the organisation's users, by role.

- Retention: configurable per organisation (default 6 years after closure), after which complaint records are anonymised (personal details removed, statistics kept). Show upcoming anonymisations to the Org Admin 30 days ahead.

- Per-complainant data export (JSON + PDF) to support subject access requests, and per-complainant erasure where legally allowed, with a confirmation and an audit entry.

- Org Admin can export all organisation data (JSON + CSV) and delete the organisation after cancelling (with confirmation and a 30-day grace period).

- Privacy policy and data processing agreement pages (placeholder text the owner will replace).

- No analytics or third-party trackers in the app.



DESIGN

- Theme: balance and fairness. Calm, precise, trustworthy, built for people working queues all day.

- Colours: off-white background (#F8F7F4), deep ink navy text and navigation (#14213D), teal primary accent (#0F766E), green on track (#15803D), amber at risk (#D97706), red overdue (#B91C1C). Dark mode available.

- Clean, highly readable typography, tabular numbers for dates and amounts, dense tables with comfortable row height.

- Tone of copy: professional and plain. Example: "4 complaints due within 3 business days." not "Heads up! Some complaints need love!"



NAVIGATION

- Sidebar: Queue, New complaint, Reports, Audit log, Templates, Settings (Organisation, Users, Rule sets, Calendars, ADR bodies, Billing).

- Agents see Queue, New complaint and Templates (read-only). Read-only users see Queue, Reports and Audit log.



OUT OF SCOPE FOR NOW

No AI classification or drafting, no email inbox integration or sending from the app, no CRM integrations (Zendesk, Salesforce, Intercom), no SSO, no customer-facing portal beyond the web form, no mobile app.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/6cfa4350-d2eb-48a6-8d89-d72c173ad030).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
