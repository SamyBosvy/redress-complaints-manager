// @vitest-environment node
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { beforeAll,afterAll,beforeEach,it,expect } from 'vitest';
const db=new PGlite();
const org='10000000-0000-4000-8000-000000000001',id='20000000-0000-4000-8000-000000000001',author='30000000-0000-4000-8000-000000000001',reviewer='30000000-0000-4000-8000-000000000002';
beforeAll(async()=>{
 await db.exec(`CREATE SCHEMA auth; CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$SELECT nullif(current_setting('test.user',true),'')::uuid$$; CREATE FUNCTION public.has_org_role(uuid,text[]) RETURNS boolean LANGUAGE sql AS $$SELECT true$$;
 CREATE TYPE public.app_role AS ENUM('org_admin','complaints_manager','qa_reviewer','agent','read_only'); CREATE FUNCTION public.has_org_role(uuid,public.app_role[]) RETURNS boolean LANGUAGE sql AS $$SELECT true$$;
 CREATE TABLE public.organisations(id uuid PRIMARY KEY,qa_required boolean);
 CREATE TABLE public.complaints(id uuid PRIMARY KEY,org_id uuid,status text,assigned_to uuid,anonymised_at timestamptz,privacy_processing boolean DEFAULT false,outcome text,root_cause_category text,root_cause_note text,redress_amount numeric,redress_currency text,goodwill_amount numeric,goodwill_currency text,country_code text,holding_reason text,reference text,channel text,final_due date,extended_due date,holding_sent_at timestamptz,priority text);
 CREATE TABLE public.letters(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),org_id uuid,complaint_id uuid,kind text,language text,sent_by uuid,sent_at timestamptz DEFAULT now(),body text);
 CREATE TABLE public.qa_reviews(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),org_id uuid,complaint_id uuid,kind text,status text DEFAULT 'pending',reviewer uuid,decided_at timestamptz);
 CREATE TABLE public.org_countries(org_id uuid,country_code text,adr_name text); CREATE TABLE public.org_members(org_id uuid,user_id uuid,role text,active boolean);
 CREATE TABLE public.complaint_events(org_id uuid,complaint_id uuid,actor uuid,kind text,detail jsonb); CREATE TABLE public.notifications(org_id uuid,user_id uuid,kind text,title text,complaint_id uuid);
 CREATE FUNCTION public.audit_capture() RETURNS trigger LANGUAGE plpgsql AS $$BEGIN RETURN NEW; END$$;`);
 await db.exec(readFileSync('drizzle/migrations/0015_compliance_hardening.sql','utf8'));
 await db.exec('CREATE TRIGGER qa_pending AFTER UPDATE ON public.complaints FOR EACH ROW EXECUTE FUNCTION public.qa_on_pending();');
},30000);
beforeEach(async()=>{await db.exec('TRUNCATE public.qa_reviews,public.letters,public.complaints,public.organisations,public.complaint_events,public.notifications;');await db.query('INSERT INTO public.organisations VALUES($1,true)',[org]);await db.query("INSERT INTO public.complaints(id,org_id,status,assigned_to) VALUES($1,$2,'received',$3)",[id,org,author]);await db.query("SELECT set_config('test.user',$1,false)",[author]);});
afterAll(async()=>{await db.close();});
it('blocks acknowledging without a letter',async()=>{await expect(db.query("UPDATE public.complaints SET status='acknowledged' WHERE id=$1",[id])).rejects.toThrow('Acknowledgement requires');});
it('enforces four eyes and sends only after independent approval',async()=>{
 await db.query("INSERT INTO public.letters(org_id,complaint_id,kind,sent_by) VALUES($1,$2,'acknowledgement',$3)",[org,id,author]);await db.query("UPDATE public.complaints SET status='acknowledged' WHERE id=$1",[id]);
 await db.query("INSERT INTO public.letters(org_id,complaint_id,kind,sent_by) VALUES($1,$2,'final_upheld',$3)",[org,id,author]);await db.query("UPDATE public.complaints SET status='pending_qa' WHERE id=$1",[id]);
 await expect(db.exec("UPDATE public.qa_reviews SET status='approved'")).rejects.toThrow('cannot approve');
 await expect(db.query("INSERT INTO public.letters(org_id,complaint_id,kind,sent_by) VALUES($1,$2,'final_upheld',$3)",[org,id,author])).rejects.toThrow('at this stage');
 await db.query("SELECT set_config('test.user',$1,false)",[reviewer]);await db.exec("UPDATE public.qa_reviews SET status='approved'");
 expect((await db.query('SELECT status FROM public.complaints')).rows[0]).toEqual({status:'final_response_sent'});
 expect((await db.query('SELECT status,approved_by FROM public.letters WHERE kind=\'final_upheld\'')).rows[0]).toEqual({status:'sent',approved_by:reviewer});
});
it('closure requires root cause and explicit no payment even for withdrawal',async()=>{await expect(db.query("UPDATE public.complaints SET status='closed',outcome='withdrawn',withdrawal_reason='Customer withdrew' WHERE id=$1",[id])).rejects.toThrow('root cause');await db.query("UPDATE public.complaints SET status='closed',outcome='withdrawn',withdrawal_reason='Customer withdrew',root_cause_category='Service',redress_none=true,goodwill_none=true,adr_rights_given=true WHERE id=$1",[id]);expect((await db.query('SELECT status FROM public.complaints')).rows[0]).toEqual({status:'closed'});});
it('rejects invalid currency',async()=>{await expect(db.query("UPDATE public.complaints SET redress_amount=1,redress_currency='XXX' WHERE id=$1",[id])).rejects.toThrow('Invalid currency');});