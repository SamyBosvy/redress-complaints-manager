// @vitest-environment node
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { beforeAll, beforeEach, afterAll, it, expect } from 'vitest';
import { EVENT_GROUPS, eventGroup, eventGroups } from '@/lib/timeline';

const db = new PGlite();
const org = '10000000-0000-4000-8000-000000000001';
const complaint = '20000000-0000-4000-8000-000000000001';
const author = '30000000-0000-4000-8000-000000000001';
const reviewer = '30000000-0000-4000-8000-000000000002';
const letter = '40000000-0000-4000-8000-000000000001';
beforeAll(async () => {
  await db.exec(`SET TIME ZONE 'UTC'; CREATE SCHEMA auth;
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT current_setting('test.user')::uuid $$;
    CREATE TABLE organisations(id uuid PRIMARY KEY, retention_years integer);
    CREATE TABLE complaints(id uuid PRIMARY KEY, org_id uuid, assigned_to uuid, status text, reference text,
      closed_at timestamptz, legal_hold boolean DEFAULT false, privacy_processing boolean DEFAULT false, anonymised_at timestamptz,
      complainant_name text,complainant_email text,complainant_phone text,customer_ref text,vulnerable_note text,summary text,
      desired_outcome text,holding_reason text,root_cause_note text,root_cause_category text);
    CREATE TABLE letters(id uuid PRIMARY KEY,org_id uuid,complaint_id uuid,status text,sent_at timestamptz,approved_by uuid,sent_by uuid);
    CREATE TABLE qa_reviews(id uuid DEFAULT gen_random_uuid(),org_id uuid,complaint_id uuid,letter_id uuid,kind text,status text,reviewer uuid,comments text,scorecard jsonb,decided_at timestamptz);
    CREATE TABLE notifications(org_id uuid,user_id uuid,kind text,title text,complaint_id uuid);
    CREATE TABLE complaint_events(id uuid DEFAULT gen_random_uuid(),org_id uuid,complaint_id uuid,actor uuid,kind text,detail jsonb,created_at timestamptz DEFAULT now());
    CREATE TABLE complaint_attachments(org_id uuid,complaint_id uuid,storage_path text,file_name text);
    CREATE TABLE privacy_operations(org_id uuid,actor uuid,complaint_id uuid,kind text,detail jsonb);
    CREATE FUNCTION can_read_mention_case(uuid,uuid,uuid) RETURNS boolean LANGUAGE sql AS $$ SELECT $3 IN ('${author}'::uuid,'${reviewer}'::uuid) $$;`);
  const guard = readFileSync('drizzle/migrations/0015_compliance_hardening.sql', 'utf8').split('\n').find(line => line.startsWith('CREATE OR REPLACE FUNCTION public.qa_reviews_guard()'));
  if (!guard) throw new Error('Missing original QA guard');
  await db.exec(guard);
  await db.exec(readFileSync('drizzle/migrations/0028_qa_timeline_events.sql', 'utf8'));
  await db.exec(`CREATE TRIGGER qa_guard BEFORE INSERT OR UPDATE ON qa_reviews FOR EACH ROW EXECUTE FUNCTION qa_reviews_guard();
    CREATE TRIGGER qa_decided AFTER UPDATE ON qa_reviews FOR EACH ROW EXECUTE FUNCTION qa_reviews_after_decide();`);
}, 30000);
beforeEach(async () => {
  await db.exec('TRUNCATE organisations,complaints,letters,qa_reviews,notifications,complaint_events,privacy_operations;');
  await db.query('INSERT INTO organisations VALUES($1,6)', [org]);
  await db.query("INSERT INTO complaints(id,org_id,assigned_to,status,reference) VALUES($1,$2,$3,'pending_qa','RDR-test')", [complaint, org, author]);
  await db.query("INSERT INTO letters(id,org_id,complaint_id,status,sent_by) VALUES($1,$2,$3,'pending_approval',$4)", [letter, org, complaint, author]);
  await db.query("INSERT INTO qa_reviews(org_id,complaint_id,letter_id,kind,status) VALUES($1,$2,$3,'approval','pending')", [org, complaint, letter]);
  await db.query("SELECT set_config('test.user',$1,false)", [reviewer]);
});
afterAll(() => db.close());
const decide = (status: string, comment: string | null = null) => db.query('UPDATE qa_reviews SET status=$1,comments=$2', [status, comment]);
type Page = { events: { kind: string; detail: unknown }[]; matching: number };
const page = async (groups: string[]) => (await db.query<{ p: Page }>('SELECT case_timeline_page($1,$2::text[]) p', [complaint, groups])).rows[0]?.p;

it('return writes exactly one reviewer event, caps comments and preserves status/notification logic', async () => {
  await decide('returned', 'x'.repeat(1100));
  expect((await db.query('SELECT actor,kind,detail FROM complaint_events')).rows).toEqual([{ actor: reviewer, kind: 'qa_returned', detail: { letter_id: letter, comment: 'x'.repeat(1000) } }]);
  expect((await db.query('SELECT status FROM complaints')).rows).toEqual([{ status: 'under_investigation' }]);
  expect((await db.query('SELECT kind,user_id FROM notifications')).rows).toEqual([{ kind: 'qa_returned', user_id: author }]);
  await db.exec("UPDATE qa_reviews SET comments='edited'");
  expect((await db.query('SELECT * FROM complaint_events')).rows).toHaveLength(1);
});
it('omits absent reviewer comments', async () => {
  await decide('returned', '   ');
  expect((await db.query('SELECT detail FROM complaint_events')).rows).toEqual([{ detail: { letter_id: letter } }]);
});
it('approval records QA-approved letter_sent and both filters match without duplication', async () => {
  await decide('approved');
  expect((await db.query('SELECT actor,kind,detail FROM complaint_events')).rows).toEqual([{ actor: reviewer, kind: 'letter_sent', detail: { letter_id: letter, template: 'final', language: '', qa: 'approved' } }]);
  expect((await db.query('SELECT status FROM complaints')).rows).toEqual([{ status: 'final_response_sent' }]);
  await db.query("INSERT INTO complaint_events(org_id,complaint_id,kind,detail) VALUES($1,$2,'qa_returned','{}'),($1,$2,'status','{}')", [org, complaint]);
  expect((await page(['qa']))?.events.map(row => row.kind).sort()).toEqual(['letter_sent', 'qa_returned']);
  expect((await page(['letters']))?.events.map(row => row.kind)).toEqual(['letter_sent']);
  expect((await page(['letters', 'qa']))?.matching).toBe(2);
});
it('SQL and client agree for every known, retired and unknown kind and detail membership', async () => {
  const kinds = [...Object.keys(EVENT_GROUPS), 'qa_passed', 'qa_failed', 'qa_pending', 'qa_sample', 'qa_decided', 'qa_review', 'qa_approved', 'future_event'];
  for (const kind of kinds) {
    expect((await db.query<{ g: string }>('SELECT timeline_group($1) g', [kind])).rows[0]?.g).toBe(eventGroup(kind));
    for (const detail of [{}, { qa: null }, { qa: 'approved' }]) {
      await db.exec('TRUNCATE complaint_events');
      await db.query('INSERT INTO complaint_events(org_id,complaint_id,kind,detail) VALUES($1,$2,$3,$4::jsonb)', [org, complaint, kind, JSON.stringify(detail)]);
      for (const group of ['qa', 'letters']) expect((await page([group]))?.matching).toBe(eventGroups(kind, detail).includes(group as 'qa' | 'letters') ? 1 : 0);
    }
  }
});
it('privacy erasure redacts returned comments while retaining non-personal event metadata', async () => {
  await decide('returned', 'Customer-sensitive QA comment');
  await db.exec("UPDATE complaints SET status='closed',closed_at=now(),privacy_processing=true");
  await db.query('SELECT privacy_anonymise_case($1,$2,$3,$4)', [org, complaint, 'Lawful erasure request', reviewer]);
  expect((await db.query("SELECT detail FROM complaint_events WHERE kind='qa_returned'")).rows).toEqual([{ detail: { letter_id: letter } }]);
  expect((await db.query('SELECT comments FROM qa_reviews')).rows).toEqual([{ comments: null }]);
});