// @vitest-environment node
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { beforeAll, beforeEach, afterAll, it, expect } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/integrations/supabase/types';
import { privacyAdmin } from '@/lib/privacy.server';
const db=new PGlite();
const a='10000000-0000-4000-8000-000000000001',b='10000000-0000-4000-8000-000000000002',u='20000000-0000-4000-8000-000000000001',v='20000000-0000-4000-8000-000000000002';
beforeAll(async()=>{await db.exec(`CREATE SCHEMA auth; CREATE ROLE authenticated; CREATE ROLE anon; CREATE TYPE app_role AS ENUM('org_admin','complaints_manager','agent','qa_reviewer','read_only');
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT nullif(current_setting('test.user',true),'')::uuid $$; GRANT USAGE ON SCHEMA auth TO authenticated;
CREATE TABLE organisations(id uuid PRIMARY KEY,legal_name text); CREATE TABLE org_members(org_id uuid,user_id uuid,role app_role,active boolean);
CREATE FUNCTION has_org_role(uuid,app_role[]) RETURNS boolean LANGUAGE sql SECURITY DEFINER AS $$ SELECT EXISTS(SELECT 1 FROM org_members WHERE org_id=$1 AND user_id=auth.uid() AND active AND role=ANY($2)) $$;
CREATE TABLE complaints(id uuid PRIMARY KEY,org_id uuid,assigned_to uuid); CREATE TABLE letters(id uuid PRIMARY KEY,org_id uuid,sent_by uuid);
CREATE TABLE qa_reviews(id int,org_id uuid,complaint_id uuid,letter_id uuid); GRANT SELECT ON complaints,letters,qa_reviews TO authenticated; ALTER TABLE qa_reviews ENABLE ROW LEVEL SECURITY; CREATE POLICY "qa read" ON qa_reviews FOR SELECT TO authenticated USING(true);
CREATE FUNCTION public_form_details(uuid) RETURNS jsonb LANGUAGE sql AS $$ SELECT '{}'::jsonb $$; CREATE FUNCTION public_form_details(uuid,text) RETURNS jsonb LANGUAGE sql AS $$ SELECT '{}'::jsonb $$;`);await db.exec(readFileSync('drizzle/migrations/0040_cross_device_qa_access.sql','utf8'));},30000);
beforeEach(async()=>{await db.exec('RESET ROLE; TRUNCATE organisations,org_members,complaints,letters,qa_reviews');await db.query("INSERT INTO organisations VALUES($1,'A'),($2,'B');",[a,b]);await db.query("INSERT INTO org_members VALUES($1,$3,'org_admin',true),($2,$3,'agent',true)",[a,b,u]);await db.query("SELECT set_config('test.user',$1,false)",[u]);await db.query('INSERT INTO complaints VALUES($1,$3,$4),($2,$3,$5)',[a,b,a,u,v]);await db.query('INSERT INTO letters VALUES($1,$3,$4),($2,$3,$5)',[a,b,a,u,v]);await db.query('INSERT INTO qa_reviews VALUES(1,$1,$1,$2),(2,$1,$2,$1),(3,$1,$2,$2),(4,$2,$2,$2)',[a,b]);});
afterAll(()=>db.close());
// Execute the real privacyAdmin query chain against local PostgreSQL memberships.
const client={from:()=>({select:()=>{const filters:Record<string,unknown>={};const query={eq:(key:string,value:unknown)=>{filters[key]=value;return query;},maybeSingle:async()=>{const r=await db.query<{org_id:string;role:string;organisations:{id:string;legal_name:string}}>(`SELECT m.org_id,m.role,jsonb_build_object('id',o.id,'legal_name',o.legal_name) organisations FROM org_members m JOIN organisations o ON o.id=m.org_id WHERE m.user_id=$1 AND m.org_id=$2 AND m.active=$3`,[filters['user_id'],filters['org_id'],filters['active']]);return {data:r.rows[0]??null,error:null};}};return query;}})} as unknown as SupabaseClient<Database>;
it('two-firm user may manage privacy in admin firm A',async()=>expect((await privacyAdmin(client,u,a)).id).toBe(a));
it('two-firm user cannot manage privacy in agent firm B',async()=>await expect(privacyAdmin(client,u,b)).rejects.toThrow('Only Org Admins'));
it('inactive admin cannot manage privacy',async()=>{await db.query('UPDATE org_members SET active=false WHERE org_id=$1',[a]);await expect(privacyAdmin(client,u,a)).rejects.toThrow('Only Org Admins');});
it('nonmember cannot manage privacy',async()=>await expect(privacyAdmin(client,v,a)).rejects.toThrow('Only Org Admins'));
it('agent reads only assigned cases or own letters',async()=>{await db.query("UPDATE org_members SET role='agent' WHERE org_id=$1",[a]);await db.exec('SET ROLE authenticated');expect((await db.query('SELECT id FROM qa_reviews ORDER BY id')).rows).toEqual([{id:1},{id:2}]);});
for(const role of ['org_admin','complaints_manager','qa_reviewer','read_only'])it(`${role} reads all reviews in firm only`,async()=>{await db.query('UPDATE org_members SET role=$1 WHERE org_id=$2',[role,a]);await db.exec('SET ROLE authenticated');expect((await db.query('SELECT id FROM qa_reviews ORDER BY id')).rows).toEqual([{id:1},{id:2},{id:3}]);});
it('inactive agent reads nothing',async()=>{await db.exec('UPDATE org_members SET active=false');await db.exec('SET ROLE authenticated');expect((await db.query('SELECT id FROM qa_reviews')).rows).toEqual([]);});
it('anonymous cannot read reviews',async()=>{await db.exec('SET ROLE anon');await expect(db.query('SELECT * FROM qa_reviews')).rejects.toThrow('permission denied');});
it('removes only old form lookup',async()=>{expect((await db.query("SELECT to_regprocedure('public_form_details(uuid)') old,to_regprocedure('public_form_details(uuid,text)') current")).rows).toEqual([{old:null,current:'public_form_details(uuid,text)'}]);});
