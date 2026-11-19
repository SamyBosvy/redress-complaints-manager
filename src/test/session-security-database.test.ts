// @vitest-environment node
import {readFileSync} from 'node:fs';
import {PGlite} from '@electric-sql/pglite';
import {beforeAll,beforeEach,afterAll,it,expect} from 'vitest';
const db=new PGlite(),org='10000000-0000-4000-8000-000000000001',other='10000000-0000-4000-8000-000000000002',a='20000000-0000-4000-8000-000000000001',b='20000000-0000-4000-8000-000000000002',admin='20000000-0000-4000-8000-000000000003',current='30000000-0000-4000-8000-000000000001',second='30000000-0000-4000-8000-000000000002',foreign='30000000-0000-4000-8000-000000000003';
beforeAll(async()=>{
 await db.exec(`SET TIME ZONE 'UTC';CREATE ROLE anon;CREATE ROLE authenticated;CREATE ROLE service_role;CREATE SCHEMA auth;
 CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT nullif(current_setting('test.user',true),'')::uuid $$;
 CREATE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql AS $$ SELECT jsonb_build_object('session_id',nullif(current_setting('test.session',true),'')) $$;
 CREATE TYPE app_role AS ENUM('org_admin','complaints_manager','agent','qa_reviewer','read_only');
 CREATE TABLE organisations(id uuid PRIMARY KEY);
 CREATE TABLE org_members(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),org_id uuid,user_id uuid,role app_role,active boolean);
 CREATE TABLE auth.sessions(id uuid PRIMARY KEY,user_id uuid,created_at timestamptz,updated_at timestamptz,refreshed_at timestamp,user_agent text,ip inet,aal text);
 CREATE TABLE audit_log(org_id uuid,actor uuid,table_name text,row_id text,action text,after jsonb,created_at timestamptz DEFAULT now());
 CREATE FUNCTION audit_capture() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$ BEGIN INSERT INTO audit_log(org_id,actor,table_name,row_id,action,after) VALUES(NEW.org_id,auth.uid(),TG_TABLE_NAME,NEW.id::text,lower(TG_OP),to_jsonb(NEW));RETURN NEW;END $$;
 CREATE FUNCTION has_org_role(uuid,app_role[]) RETURNS boolean LANGUAGE sql SECURITY DEFINER AS $$ SELECT EXISTS(SELECT 1 FROM org_members WHERE org_id=$1 AND user_id=auth.uid() AND active AND role=ANY($2)) $$;
 GRANT USAGE ON SCHEMA public,auth TO authenticated;GRANT SELECT,UPDATE ON organisations TO authenticated;
 ALTER TABLE organisations ENABLE ROW LEVEL SECURITY;CREATE POLICY org_read ON organisations TO authenticated USING(true);`);
 await db.exec(readFileSync('drizzle/migrations/0033_session_security.sql','utf8'));
},30000);
beforeEach(async()=>{
 await db.exec("RESET ROLE;SELECT set_config('test.user','',false);SELECT set_config('test.session','',false);TRUNCATE auth.sessions,session_security_events,audit_log,org_members,organisations CASCADE;");
 await db.query('INSERT INTO organisations(id) VALUES($1),($2)',[org,other]);
 await db.query("INSERT INTO org_members(org_id,user_id,role,active) VALUES($1,$2,'agent',true),($1,$3,'org_admin',true),($4,$2,'agent',true),($4,$5,'agent',true)",[org,a,admin,other,b]);
 for(const [id,user,ip] of [[current,a,'192.168.1.199'],[second,a,'2001:db8:abcd:1234:5678:9012:3456:7890'],[foreign,b,'10.0.0.42']])await db.query("INSERT INTO auth.sessions VALUES($1,$2,'2026-01-01T00:00:00Z','2026-01-01T02:00:00Z','2026-01-01 03:00:00','Chrome on Windows',$3,'aal2')",[id,user,ip]);
});
afterAll(()=>db.close());
async function login(user=a,session=current){await db.query("SELECT set_config('test.user',$1,false)",[user]);await db.query("SELECT set_config('test.session',$1,false)",[session]);await db.exec('SET ROLE authenticated');}
it('own rows only, masked IPs and current JWT session, UTC refresh timestamp',async()=>{
 await login();const rows=(await db.query<{id:string;ip:string;is_current:boolean;last_active:string}>('SELECT * FROM my_sessions() ORDER BY id')).rows;
 expect(rows.map(r=>[r.id,r.ip,r.is_current])).toEqual([[current,'192.168.1.0/24',true],[second,'2001:db8:abcd::/48',false]]);
 expect(new Date(String(rows[0]?.last_active)).toISOString()).toBe('2026-01-01T03:00:00.000Z');
 await db.exec("SET TIME ZONE 'Australia/Sydney'");expect(new Date(String((await db.query<{last_active:string}>('SELECT last_active FROM my_sessions() LIMIT 1')).rows[0]?.last_active)).toISOString()).toBe('2026-01-01T03:00:00.000Z');await db.exec("SET TIME ZONE 'UTC'");
});
it('masks IPv4 and the last 80 IPv6 bits including null and compressed forms',async()=>{
 const rows=(await db.query<{masked:string|null}>("SELECT mask_session_ip(ip::inet) masked FROM unnest(ARRAY['203.0.113.255','2001:db8::dead:beef','::1',null]) ip")).rows;
 expect(rows.map(r=>r.masked)).toEqual(['203.0.113.0/24','2001:db8::/48','::/48',null]);
});
it('refuses current and other-user sessions; own revocation audited without IP',async()=>{
 await login();await expect(db.query('SELECT revoke_my_session($1)',[current])).rejects.toThrow('Use sign out');await expect(db.query('SELECT revoke_my_session($1)',[foreign])).rejects.toThrow('access denied');
 await db.query('SELECT revoke_my_session($1)',[second]);expect((await db.query('SELECT * FROM my_sessions()')).rows).toHaveLength(1);await db.exec('RESET ROLE');
 const rows=(await db.query<{after:Record<string,unknown>}>('SELECT after FROM audit_log')).rows;expect(rows).toHaveLength(2);expect(rows[0]?.after['session_id']).toBe(second);expect(rows[0]?.after['actor']).toBe(a);expect(JSON.stringify(rows)).not.toContain('2001:db8');
});
it('admin needs a shared org and revokes across all orgs, nonadmin denied',async()=>{
 await login();await expect(db.query('SELECT revoke_member_sessions($1,$2)',[org,a])).rejects.toThrow('access denied');await db.exec('RESET ROLE');await login(admin);
 await expect(db.query('SELECT revoke_member_sessions($1,$2)',[org,b])).rejects.toThrow('access denied');await expect(db.query('SELECT revoke_member_sessions($1,$2)',[other,a])).rejects.toThrow('access denied');
 await db.query('SELECT revoke_member_sessions($1,$2)',[org,a]);await db.exec('RESET ROLE');expect((await db.query<{user_id:string}>('SELECT user_id FROM auth.sessions')).rows.map(r=>r.user_id)).toEqual([b]);
});
it('only admin edits valid session limits and strictest active org controls idle',async()=>{
 await login();await expect(db.query('UPDATE organisations SET idle_timeout_minutes=15 WHERE id=$1',[org])).rejects.toThrow('Only Org Admins');await expect(db.query('UPDATE organisations SET max_session_hours=1 WHERE id=$1',[org])).rejects.toThrow('Only Org Admins');await db.exec('RESET ROLE');await login(admin);await db.query('UPDATE organisations SET idle_timeout_minutes=15,max_session_hours=1 WHERE id=$1',[org]);
 for(const [col,value] of [['idle_timeout_minutes',14],['idle_timeout_minutes',481],['max_session_hours',0],['max_session_hours',169]])await expect(db.query(`UPDATE organisations SET ${col}=$1 WHERE id=$2`,[value,org])).rejects.toThrow();
 await db.exec('RESET ROLE');await login(a);expect((await db.query('SELECT * FROM my_session_limits()')).rows).toEqual([{idle_timeout_minutes:15,max_session_hours:1}]);
});
it('deactivation deletes all sessions in the same transaction and rollback restores them',async()=>{
 await db.query("SELECT set_config('test.user',$1,false)",[admin]);await db.exec('BEGIN');await db.query('UPDATE org_members SET active=false WHERE org_id=$1 AND user_id=$2',[org,a]);expect((await db.query('SELECT * FROM auth.sessions WHERE user_id=$1',[a])).rows).toHaveLength(0);await db.exec('ROLLBACK');expect((await db.query('SELECT * FROM auth.sessions WHERE user_id=$1',[a])).rows).toHaveLength(2);
 await db.query('UPDATE org_members SET active=false WHERE org_id=$1 AND user_id=$2',[org,a]);expect((await db.query('SELECT * FROM auth.sessions WHERE user_id=$1',[a])).rows).toHaveLength(0);
});
it('expiry removes only sessions older than strictest active limit, exact boundary retained',async()=>{
 await db.query("SELECT set_config('test.user',$1,false)",[admin]);await db.query('UPDATE organisations SET max_session_hours=1 WHERE id=$1',[org]);await db.query("UPDATE auth.sessions SET created_at='2026-01-01T01:00:00Z' WHERE id=$1",[second]);
 await db.query('SELECT session_expiry_job($1)', ['2026-01-01T02:00:00Z']);expect((await db.query<{id:string}>('SELECT id FROM auth.sessions ORDER BY id')).rows.map(r=>r.id)).toEqual([second,foreign]);
});
it('summary admin only, no IP or UA, anonymous RPCs and authenticated job denied',async()=>{
 await login();await expect(db.query('SELECT * FROM org_session_summary($1)',[org])).rejects.toThrow('Only Org Admins');await expect(db.exec('SELECT session_expiry_job()')).rejects.toThrow();await db.exec('RESET ROLE');await login(admin);const rows=(await db.query('SELECT * FROM org_session_summary($1)',[org])).rows;expect(rows.find(r=>(r as {user_id:string}).user_id===a)).toMatchObject({session_count:2});expect(Object.keys(rows[0]??{}).sort()).toEqual(['last_active','session_count','user_id']);await db.exec('RESET ROLE;SET ROLE anon');
 for(const sql of ['SELECT my_sessions()',`SELECT revoke_my_session('${second}')`,`SELECT revoke_member_sessions('${org}','${a}')`,`SELECT org_session_summary('${org}')`,'SELECT my_session_limits()','SELECT session_expiry_job()'])await expect(db.exec(sql)).rejects.toThrow();
});