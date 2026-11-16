// @vitest-environment node
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { beforeAll, afterAll, it, expect } from 'vitest';
const db = new PGlite(), org = '10000000-0000-4000-8000-000000000001', other = '10000000-0000-4000-8000-000000000002', user = '30000000-0000-4000-8000-000000000001';
const cols = 'id,org_id,reference,seq,received_at,channel,country_code,language,complainant_name,complainant_email,complainant_phone,customer_ref,vulnerable,vulnerable_note,product,category,summary,desired_outcome,assigned_to,priority,status,outcome,redress_amount,redress_currency,goodwill_amount,goodwill_currency,root_cause_category,root_cause_note,rule_set_id,ack_due,final_due,extended_due,holding_sent_at,holding_reason,closed_at,created_by,created_at,updated_at,anonymised_at,legal_hold,root_cause_id';
beforeAll(async () => {
  const types: Record<string, string> = { id: 'uuid', org_id: 'uuid', seq: 'int', received_at: 'timestamptz', vulnerable: 'boolean', assigned_to: 'uuid', redress_amount: 'numeric', goodwill_amount: 'numeric', rule_set_id: 'uuid', ack_due: 'date', final_due: 'date', extended_due: 'date', holding_sent_at: 'timestamptz', closed_at: 'timestamptz', created_by: 'uuid', created_at: 'timestamptz', updated_at: 'timestamptz', anonymised_at: 'timestamptz', legal_hold: 'boolean', root_cause_id: 'uuid' };
  await db.exec(`CREATE ROLE authenticated; CREATE SCHEMA auth; GRANT USAGE ON SCHEMA auth TO authenticated;
  CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT nullif(current_setting('test.user',true),'')::uuid $$;
  CREATE TABLE complaints(${cols.split(',').map(c => `${c} ${types[c] ?? 'text'}`).join(',')});
  CREATE TABLE org_members(org_id uuid,user_id uuid);
  CREATE FUNCTION business_days_between(uuid,text,date,date) RETURNS int LANGUAGE sql AS $$ SELECT ($4-$3) $$;
  CREATE TABLE template_versions(id uuid); GRANT ALL ON template_versions TO authenticated;
  GRANT SELECT ON complaints, org_members TO authenticated; ALTER TABLE complaints ENABLE ROW LEVEL SECURITY;
  CREATE POLICY r ON complaints FOR SELECT USING (EXISTS(SELECT 1 FROM org_members m WHERE m.org_id=complaints.org_id AND m.user_id=auth.uid()));`);
  await db.exec(readFileSync('drizzle/migrations/0020_queue_report_filters.sql', 'utf8').replaceAll('--> statement-breakpoint', ''));
  await db.query('INSERT INTO org_members VALUES($1,$2)', [org, user]);
  const ins = (ref: string, o: string, closed: string | null, holding: string | null) => db.query("INSERT INTO complaints(id,org_id,reference,final_due,extended_due,closed_at,holding_sent_at,legal_hold,vulnerable) VALUES(gen_random_uuid(),$1,$2,'2026-03-25','2026-04-20',$3,$4,false,false)", [o, ref, closed, holding]);
  await ins('ON', org, '2026-03-25T23:00:00Z', null); await ins('LATE', org, '2026-03-26T00:10:00Z', null); await ins('EXT', org, '2026-04-15T00:00:00Z', '2026-03-10T00:00:00Z'); await ins('OPEN', org, null, null); await ins('HIDDEN', other, '2026-03-01T00:00:00Z', null);
}, 30000);
afterAll(() => db.close());
it('exposes resolved_within_deadline matching the report rule', async () => {
  await db.exec("SET TIME ZONE 'Europe/Warsaw'");
  const r = await db.query<{ reference: string; resolved_within_deadline: boolean | null }>('SELECT reference,resolved_within_deadline FROM complaint_queue ORDER BY reference');
  expect(Object.fromEntries(r.rows.map(x => [x.reference, x.resolved_within_deadline]))).toEqual({ EXT: true, HIDDEN: true, LATE: false, ON: true, OPEN: null });
});
it('keeps security_invoker so complaint RLS applies', async () => {
  const opt = await db.query<{ reloptions: string[] }>("SELECT reloptions FROM pg_class WHERE relname='complaint_queue'");
  expect(opt.rows[0]?.reloptions).toContain('security_invoker=true');
  await db.query("SELECT set_config('test.user',$1,false)", [user]); await db.exec('SET ROLE authenticated');
  expect((await db.query<{ reference: string }>('SELECT reference FROM complaint_queue')).rows.map(r => r.reference).sort()).toEqual(['EXT', 'LATE', 'ON', 'OPEN']);
  await db.exec('RESET ROLE');
});
it('revokes write privileges on template_versions', async () => {
  const r = await db.query<{ p: string }>("SELECT privilege_type p FROM information_schema.role_table_grants WHERE table_name='template_versions' AND grantee='authenticated' ORDER BY 1");
  expect(r.rows.map(x => x.p)).toEqual(['SELECT']);
});
