// @vitest-environment node
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { beforeAll, afterAll, beforeEach, it, expect } from 'vitest';
const db = new PGlite();
const org = '10000000-0000-4000-8000-000000000001', other = '10000000-0000-4000-8000-000000000002', id = '20000000-0000-4000-8000-000000000001';
const admin = '30000000-0000-4000-8000-000000000001', agent = '30000000-0000-4000-8000-000000000002';
const as = (u: string) => db.query("SELECT set_config('test.user',$1,false)", [u]);
beforeAll(async () => {
  await db.exec(`CREATE ROLE authenticated; CREATE ROLE anon; CREATE ROLE service_role; CREATE SCHEMA auth; GRANT USAGE ON SCHEMA auth TO authenticated;
  CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$SELECT nullif(current_setting('test.user',true),'')::uuid$$;
  CREATE TYPE public.app_role AS ENUM('org_admin','complaints_manager','qa_reviewer','agent','read_only');
  CREATE TABLE public.org_members(org_id uuid,user_id uuid,role public.app_role,active boolean DEFAULT true);
  CREATE FUNCTION public.is_org_member(uuid) RETURNS boolean LANGUAGE sql SECURITY DEFINER AS $$SELECT EXISTS(SELECT 1 FROM public.org_members WHERE org_id=$1 AND user_id=auth.uid() AND active)$$;
  CREATE FUNCTION public.has_org_role(uuid,public.app_role[]) RETURNS boolean LANGUAGE sql SECURITY DEFINER AS $$SELECT EXISTS(SELECT 1 FROM public.org_members WHERE org_id=$1 AND user_id=auth.uid() AND role=ANY($2) AND active)$$;
  CREATE TABLE public.organisations(id uuid PRIMARY KEY,qa_required boolean);
  CREATE TABLE public.complaints(id uuid PRIMARY KEY,org_id uuid,status text,assigned_to uuid,anonymised_at timestamptz,privacy_processing boolean DEFAULT false,outcome text,root_cause_category text,root_cause_note text,redress_amount numeric,redress_currency text,goodwill_amount numeric,goodwill_currency text,country_code text,holding_reason text,reference text,channel text,final_due date,extended_due date,holding_sent_at timestamptz,priority text);
  CREATE TABLE public.letters(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),org_id uuid,complaint_id uuid,kind text,language text,sent_by uuid,sent_at timestamptz DEFAULT now(),body text);
  CREATE TABLE public.qa_reviews(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),org_id uuid,complaint_id uuid,kind text,status text DEFAULT 'pending',reviewer uuid,decided_at timestamptz);
  CREATE TABLE public.org_countries(org_id uuid,country_code text,adr_name text);
  CREATE TABLE public.complaint_events(org_id uuid,complaint_id uuid,actor uuid,kind text,detail jsonb); CREATE TABLE public.notifications(org_id uuid,user_id uuid,kind text,title text,complaint_id uuid);
  CREATE TABLE public.templates(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),org_id uuid,kind text,language text,subject text,body text,updated_at timestamptz DEFAULT now(),restored_from uuid,UNIQUE(org_id,kind,language));
  CREATE TABLE public.template_versions(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),org_id uuid,template_id uuid,subject text,body text,saved_by uuid,saved_at timestamptz DEFAULT now(),restored_from uuid);
  CREATE TRIGGER templates_capture_version AFTER INSERT OR UPDATE ON public.templates FOR EACH ROW EXECUTE FUNCTION public.capture_template_version();
  CREATE FUNCTION public.audit_capture() RETURNS trigger LANGUAGE plpgsql AS $$BEGIN RETURN NEW; END$$;`.replace('CREATE TRIGGER templates_capture_version AFTER INSERT OR UPDATE ON public.templates FOR EACH ROW EXECUTE FUNCTION public.capture_template_version();', ''));
  await db.exec(readFileSync('drizzle/migrations/0015_compliance_hardening.sql', 'utf8'));
  await db.exec('CREATE TRIGGER qa_pending AFTER UPDATE ON public.complaints FOR EACH ROW EXECUTE FUNCTION public.qa_on_pending();');
  const parts = readFileSync('drizzle/migrations/0034_custom_letter_types.sql', 'utf8').split('--> statement-breakpoint');
  expect(parts[0]).toContain("ADD VALUE IF NOT EXISTS 'custom'");
  await db.exec(parts.slice(1).join('\n'));
  await db.exec(readFileSync('drizzle/migrations/0035_custom_letter_type_guard_fix.sql', 'utf8'));
  await db.exec(`CREATE TRIGGER templates_capture_version AFTER INSERT OR UPDATE ON public.templates FOR EACH ROW EXECUTE FUNCTION public.capture_template_version();
  CREATE TRIGGER letters_ai AFTER INSERT ON public.letters FOR EACH ROW EXECUTE FUNCTION public.letters_after_insert();`);
}, 30000);
beforeEach(async () => {
  await db.exec('RESET ROLE; TRUNCATE public.qa_reviews,public.letters,public.complaints,public.complaint_events,public.template_versions,public.templates,public.custom_letter_types,public.org_members,public.organisations CASCADE;');
  await db.query('INSERT INTO public.organisations VALUES($1,true),($2,false)', [org, other]);
  await db.query("INSERT INTO public.org_members(org_id,user_id,role) VALUES($1,$2,'org_admin'),($1,$3,'agent'),($4,$2,'org_admin')", [org, admin, agent, other]);
  await db.query("INSERT INTO public.complaints(id,org_id,status,assigned_to,final_due,extended_due) VALUES($1,$2,'acknowledged',$3,'2026-12-01','2026-12-20')", [id, org, admin]);
  await as(admin);
});
afterAll(async () => { await db.close(); });
const newType = async (name: string, o = org) => (await db.query<{ id: string }>('INSERT INTO public.custom_letter_types(org_id,name) VALUES($1,$2) RETURNING id', [o, name])).rows[0]!.id;
const sendCustom = (type: string | null, kind = 'custom') => db.query('INSERT INTO public.letters(org_id,complaint_id,kind,custom_type_id,language,sent_by,body) VALUES($1,$2,$3,$4,\'en\',$5,\'Hello\')', [org, id, kind, type, admin]);

it('custom letters never change status, deadlines or create QA reviews', async () => {
  const t = await newType('Account statement');
  await sendCustom(t);
  expect((await db.query('SELECT status,final_due::text,extended_due::text,holding_sent_at FROM public.complaints')).rows[0]).toEqual({ status: 'acknowledged', final_due: '2026-12-01', extended_due: '2026-12-20', holding_sent_at: null });
  expect((await db.query('SELECT status FROM public.letters')).rows[0]).toEqual({ status: 'sent' });
  expect((await db.query('SELECT count(*)::int n FROM public.qa_reviews')).rows[0]).toEqual({ n: 0 });
  await expect(db.query("UPDATE public.complaints SET status='pending_qa' WHERE id=$1", [id])).rejects.toThrow('Submit a final response');
  await expect(db.query("UPDATE public.complaints SET status='holding_response_sent',holding_reason='x' WHERE id=$1", [id])).rejects.toThrow('Holding response requires');
  expect((await db.query("SELECT kind,detail->>'custom_type_name' name FROM public.complaint_events")).rows).toEqual([{ kind: 'letter_sent', name: 'Account statement' }]);
});
it('a custom letter does not count as an acknowledgement', async () => {
  await db.exec('ALTER TABLE public.complaints DISABLE TRIGGER USER'); await db.exec("UPDATE public.complaints SET status='received'"); await db.exec('ALTER TABLE public.complaints ENABLE TRIGGER USER');
  await sendCustom(await newType('Statement'));
  await expect(db.query("UPDATE public.complaints SET status='acknowledged' WHERE id=$1", [id])).rejects.toThrow('Acknowledgement requires');
});
it('requires kind custom exactly when a custom type is set', async () => {
  const t = await newType('Statement');
  await expect(sendCustom(null)).rejects.toThrow('letters_custom_type_match');
  await expect(sendCustom(t, 'information_request')).rejects.toThrow('letters_custom_type_match');
  await expect(db.query("INSERT INTO public.templates(org_id,kind,language,subject,body) VALUES($1,'custom','en','s','b')", [org])).rejects.toThrow('templates_custom_type_match');
});
it('rejects custom types from another firm', async () => {
  const foreign = await newType('Foreign', other);
  await expect(sendCustom(foreign)).rejects.toThrow('belong to this firm');
  await expect(db.query("INSERT INTO public.templates(org_id,kind,custom_type_id,language,subject,body) VALUES($1,'custom',$2,'en','s','b')", [org, foreign])).rejects.toThrow('belong to this firm');
});
it('keeps archived types readable but blocks new templates and letters', async () => {
  const t = await newType('Statement');
  await db.query("INSERT INTO public.templates(org_id,kind,custom_type_id,language,subject,body) VALUES($1,'custom',$2,'en','s','b')", [org, t]);
  await sendCustom(t);
  await db.exec('SET ROLE authenticated'); await db.query('UPDATE public.custom_letter_types SET archived_at=now() WHERE id=$1', [t]); await db.exec('RESET ROLE');
  await expect(db.query("INSERT INTO public.templates(org_id,kind,custom_type_id,language,subject,body) VALUES($1,'custom',$2,'fr','s','b')", [org, t])).rejects.toThrow('archived');
  await expect(sendCustom(t)).rejects.toThrow('archived');
  expect((await db.query('SELECT count(*)::int n FROM public.letters WHERE custom_type_id=$1', [t])).rows[0]).toEqual({ n: 1 });
  expect((await db.query('SELECT custom_type_id FROM public.template_versions')).rows).toEqual([{ custom_type_id: t }]);
});
it('makes custom templates unique per type and language, separately from built-ins', async () => {
  const a = await newType('Alpha'), b = await newType('Beta');
  const add = (kind: string, type: string | null) => db.query('INSERT INTO public.templates(org_id,kind,custom_type_id,language,subject,body) VALUES($1,$2,$3,\'en\',\'s\',\'b\')', [org, kind, type]);
  await add('acknowledgement', null); await add('custom', a); await add('custom', b);
  await expect(add('custom', a)).rejects.toThrow('templates_custom_language_key');
  await expect(add('acknowledgement', null)).rejects.toThrow('templates_builtin_language_key');
});
it('enforces unique names, no deletes, the 50-type cap and manager-only writes', async () => {
  await db.exec('SET ROLE authenticated');
  await as(agent);
  await expect(newType('Agent type')).rejects.toThrow('row-level security');
  await as(admin);
  await newType('Statement');
  await expect(newType('  statement'.trim().toUpperCase())).rejects.toThrow('custom_letter_types_org_name_key');
  await expect(newType('x')).rejects.toThrow('name_length');
  await expect(db.exec('DELETE FROM public.custom_letter_types')).rejects.toThrow('permission');
  for (let i = 2; i <= 50; i++) await newType(`Type ${i}`);
  await expect(newType('Type 51')).rejects.toThrow('at most 50');
  await db.exec("UPDATE public.custom_letter_types SET archived_at=now() WHERE name='Type 2'");
  await newType('Type 51');
  await expect(db.exec("UPDATE public.custom_letter_types SET archived_at=NULL WHERE name='Type 2'")).rejects.toThrow('at most 50');
  await as(agent);
  expect((await db.query("UPDATE public.custom_letter_types SET name='Renamed' RETURNING id")).rows).toHaveLength(0);
  expect((await db.query('SELECT count(*)::int n FROM public.custom_letter_types')).rows[0]).toEqual({ n: 51 });
  await db.exec('RESET ROLE');
});
