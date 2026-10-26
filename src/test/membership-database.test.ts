// Execute the actual repository SQL routines in local PostgreSQL, never the hosted database.
// @vitest-environment node
import {readFileSync} from 'node:fs';
import {PGlite} from '@electric-sql/pglite';
import {afterAll,beforeAll,beforeEach,describe,expect,it} from 'vitest';
const db=new PGlite();
const org='10000000-0000-4000-8000-000000000001';
const otherOrg='10000000-0000-4000-8000-000000000002';
const admin='20000000-0000-4000-8000-000000000001';
const user='20000000-0000-4000-8000-000000000002';
const target='30000000-0000-4000-8000-000000000002';
const hash='a'.repeat(64),newHash='b'.repeat(64);
const migration=readFileSync('drizzle/migrations/0012_multi_user_settings.sql','utf8');
function routine(sql:string,name:string){const pattern=new RegExp(`CREATE OR REPLACE FUNCTION public\\.${name}\\([\\s\\S]*?\\$\\$;`,'i');const match=sql.match(pattern);if(!match)throw new Error(`Missing SQL routine ${name}`);return match[0];}
async function identity(id:string){await db.query("SELECT set_config('test.user',$1,false)",[id]);}
async function createInvite(h=hash){await db.query('SELECT public.create_org_invite($1,$2,$3,$4)',[org,'guest@example.test','agent',h]);}
async function accept(h=hash){return db.query('SELECT public.accept_org_invite($1) AS org',[h]);}
beforeAll(async()=>{
  await db.exec(`CREATE SCHEMA auth;
    CREATE TYPE public.app_role AS ENUM ('org_admin','complaints_manager','agent','qa_reviewer','read_only');
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$SELECT nullif(current_setting('test.user',true),'')::uuid$$;
    CREATE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql AS $$SELECT '{"aal":"aal2"}'::jsonb$$;
    CREATE TABLE auth.users(id uuid PRIMARY KEY,email text,email_confirmed_at timestamptz);
    CREATE TABLE public.organisations(id uuid PRIMARY KEY,setup_complete boolean,require_2fa boolean DEFAULT false);
    CREATE TABLE public.org_members(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),org_id uuid,user_id uuid,role public.app_role,active boolean DEFAULT true);
    CREATE TABLE public.org_invites(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),org_id uuid,email text,role public.app_role,token_hash text UNIQUE,expires_at timestamptz DEFAULT now()+interval '7 days',revoked_at timestamptz,accepted_at timestamptz,accepted_by uuid,created_by uuid,created_at timestamptz DEFAULT now());
    CREATE TABLE public.rule_sets(id uuid PRIMARY KEY,org_id uuid,is_default boolean,created_at timestamptz DEFAULT now());
    CREATE TABLE public.org_countries(org_id uuid,country_code text);
    CREATE TABLE public.rule_set_assignments(org_id uuid,rule_set_id uuid,country_code text,product text);
    CREATE TABLE public.complaints(org_id uuid,assigned_to uuid,rule_set_id uuid);
  `);
  for(const name of ['is_org_member','has_org_role','member_guard','change_org_member','transfer_org_admin','create_org_invite','revoke_org_invite','accept_org_invite','assignment_guard','rule_assignment_guard','save_rule_assignment'])await db.exec(routine(migration,name));
  await db.exec(routine(readFileSync('drizzle/migrations/0001_phase2_complaints.sql','utf8'),'resolve_rule_set'));
  await db.exec(`CREATE TRIGGER member_guard BEFORE UPDATE OR DELETE ON public.org_members FOR EACH ROW EXECUTE FUNCTION public.member_guard();
    CREATE TRIGGER assignment_guard BEFORE INSERT OR UPDATE ON public.complaints FOR EACH ROW EXECUTE FUNCTION public.assignment_guard();
    CREATE TRIGGER rule_guard BEFORE INSERT OR UPDATE ON public.rule_set_assignments FOR EACH ROW EXECUTE FUNCTION public.rule_assignment_guard();`);
},30000);
beforeEach(async()=>{
  await db.exec('TRUNCATE auth.users,public.org_members,public.org_invites,public.organisations,public.rule_sets,public.org_countries,public.rule_set_assignments,public.complaints;');
  await db.query('INSERT INTO public.organisations(id,setup_complete) VALUES($1,true),($2,true)',[org,otherOrg]);
  await db.query("INSERT INTO auth.users VALUES($1,'admin@example.test',now()),($2,'guest@example.test',now())",[admin,user]);
  await db.query("INSERT INTO public.org_members(id,org_id,user_id,role) VALUES('30000000-0000-4000-8000-000000000001',$1,$2,'org_admin'),($3,$1,$4,'agent')",[org,admin,target,user]);
  await identity(admin);
});
afterAll(async()=>{await db.close();});
describe('Real SQL invitation lifecycle',()=>{
  it('sets exactly seven days expiry and rejects an expired invitation',async()=>{await createInvite();const result=await db.query<{seconds:number}>('SELECT extract(epoch FROM expires_at-created_at)::int AS seconds FROM public.org_invites');expect(result.rows[0]?.seconds).toBe(604800);await db.exec("UPDATE public.org_invites SET expires_at=now()");await identity(user);await expect(accept()).rejects.toThrow('Invitation is unavailable');});
  it('resend revokes the old token and creates a distinct fresh invite',async()=>{await createInvite();await createInvite(newHash);const result=await db.query<{token_hash:string;revoked:boolean}>('SELECT token_hash,revoked_at IS NOT NULL AS revoked FROM public.org_invites ORDER BY token_hash');expect(result.rows).toEqual([{token_hash:hash,revoked:true},{token_hash:newHash,revoked:false}]);await identity(user);await expect(accept()).rejects.toThrow('Invitation is unavailable');});
  it('revoke prevents acceptance',async()=>{await createInvite();await db.query('SELECT public.revoke_org_invite($1,id) FROM public.org_invites',[org]);await identity(user);await expect(accept()).rejects.toThrow('Invitation is unavailable');});
  it('accepts once with the invited role, then refuses reuse',async()=>{await createInvite();await db.query('UPDATE public.org_members SET active=false WHERE id=$1',[target]);await db.exec('TRUNCATE public.org_members');await identity(user);await accept();const result=await db.query<{role:string;count:number}>('SELECT role,count(*)::int AS count FROM public.org_members GROUP BY role');expect(result.rows).toEqual([{role:'agent',count:1}]);await expect(accept()).rejects.toThrow('Invitation is unavailable');});
  it('requires the matching verified email',async()=>{await createInvite();await expect(accept()).rejects.toThrow('Invitation is unavailable');await identity(user);await db.query('UPDATE auth.users SET email_confirmed_at=NULL WHERE id=$1',[user]);await expect(accept()).rejects.toThrow('verified email');});
  it('resend replacement can be accepted and deactivated members cannot rejoin',async()=>{await createInvite();await createInvite(newHash);await db.query('UPDATE public.org_members SET active=false WHERE id=$1',[target]);await identity(user);await expect(accept(newHash)).rejects.toThrow('reactivate');await db.exec('TRUNCATE public.org_members');const result=await accept(newHash);expect(result.rows[0]).toEqual({org});});
});
describe('Real SQL membership protection',()=>{
  it('changes roles and activation without changing attribution',async()=>{await db.query("SELECT public.change_org_member($1,$2,'qa_reviewer',false)",[org,target]);let result=await db.query<{user_id:string;role:string;active:boolean}>('SELECT user_id,role,active FROM public.org_members WHERE id=$1',[target]);expect(result.rows[0]).toEqual({user_id:user,role:'qa_reviewer',active:false});await db.query("SELECT public.change_org_member($1,$2,'agent',true)",[org,target]);result=await db.query('SELECT user_id,role,active FROM public.org_members WHERE id=$1',[target]);expect(result.rows[0]?.active).toBe(true);});
  it('blocks non-admin role changes and cross-firm targets',async()=>{await expect(db.query("SELECT public.change_org_member($1,$2,'agent',true)",[otherOrg,target])).rejects.toThrow('Only Org Admins');await identity(user);await expect(db.query("SELECT public.change_org_member($1,$2,'org_admin',true)",[org,target])).rejects.toThrow('Only Org Admins');});
  it('blocks sole admin demotion, deactivation and deletion',async()=>{await expect(db.query("UPDATE public.org_members SET role='agent' WHERE user_id=$1",[admin])).rejects.toThrow('last active Org Admin');await expect(db.query('UPDATE public.org_members SET active=false WHERE user_id=$1',[admin])).rejects.toThrow('last active Org Admin');await expect(db.query('DELETE FROM public.org_members WHERE user_id=$1',[admin])).rejects.toThrow('last active Org Admin');});
  it('retains one admin when sequential demotions are attempted',async()=>{await db.query("UPDATE public.org_members SET role='org_admin' WHERE id=$1",[target]);await db.query("UPDATE public.org_members SET role='agent' WHERE user_id=$1",[admin]);await expect(db.query("UPDATE public.org_members SET role='agent' WHERE id=$1",[target])).rejects.toThrow('last active Org Admin');});
  it('transfers admin atomically and makes the caller a manager',async()=>{await db.query('SELECT public.transfer_org_admin($1,$2)',[org,target]);const result=await db.query<{user_id:string;role:string}>('SELECT user_id,role FROM public.org_members ORDER BY user_id');expect(result.rows).toEqual([{user_id:admin,role:'complaints_manager'},{user_id:user,role:'org_admin'}]);});
  it('rejects transfer to self or inactive target',async()=>{await expect(db.query('SELECT public.transfer_org_admin($1,id) FROM public.org_members WHERE user_id=$2',[org,admin])).rejects.toThrow('another active member');await db.query('UPDATE public.org_members SET active=false WHERE id=$1',[target]);await expect(db.query('SELECT public.transfer_org_admin($1,$2)',[org,target])).rejects.toThrow('another active member');});
  it('allows active handlers but rejects inactive, Read-only and other-firm assignments',async()=>{await db.query('INSERT INTO public.complaints(org_id,assigned_to) VALUES($1,$2)',[org,user]);await db.query("UPDATE public.org_members SET role='read_only' WHERE id=$1",[target]);await expect(db.query('INSERT INTO public.complaints(org_id,assigned_to) VALUES($1,$2)',[org,user])).rejects.toThrow('active case handler');await db.query("UPDATE public.org_members SET role='agent',active=false WHERE id=$1",[target]);await expect(db.query('INSERT INTO public.complaints(org_id,assigned_to) VALUES($1,$2)',[org,user])).rejects.toThrow('active case handler');await expect(db.query('INSERT INTO public.complaints(org_id,assigned_to) VALUES($1,$2)',[otherOrg,admin])).rejects.toThrow('active case handler');});
});
describe('Real SQL rule assignment precedence',()=>{
  it('uses exact > country > product > default and replaces same-scope assignments',async()=>{
    const ids=['40000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000002','40000000-0000-4000-8000-000000000003','40000000-0000-4000-8000-000000000004'];
    for(const [index,id] of ids.entries())await db.query('INSERT INTO public.rule_sets(id,org_id,is_default) VALUES($1,$2,$3)',[id,org,index===0]);
    await db.query("INSERT INTO public.org_countries VALUES($1,'IE')",[org]);
    const resolve=async()=>{const r=await db.query<{id:string}>("SELECT public.resolve_rule_set($1,'IE','card') AS id",[org]);return r.rows[0]?.id;};
    expect(await resolve()).toBe(ids[0]);
    await db.query("SELECT public.save_rule_assignment($1,$2,NULL,'card')",[org,ids[1]]);expect(await resolve()).toBe(ids[1]);
    await db.query("SELECT public.save_rule_assignment($1,$2,'IE',NULL)",[org,ids[2]]);expect(await resolve()).toBe(ids[2]);
    await db.query("SELECT public.save_rule_assignment($1,$2,'IE','card')",[org,ids[3]]);expect(await resolve()).toBe(ids[3]);
    await db.query("SELECT public.save_rule_assignment($1,$2,'IE','card')",[org,ids[2]]);expect(await resolve()).toBe(ids[2]);
    const count=await db.query<{count:number}>("SELECT count(*)::int AS count FROM public.rule_set_assignments WHERE country_code='IE' AND product='card'");expect(count.rows[0]?.count).toBe(1);
    await expect(db.query("SELECT public.save_rule_assignment($1,$2,'FR','card')",[org,ids[0]])).rejects.toThrow('Country is not served');
    await expect(db.query("SELECT public.save_rule_assignment($1,$2,'IE','card')",[org,'40000000-0000-4000-8000-000000000099'])).rejects.toThrow('another organisation');
  });
});