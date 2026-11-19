// @vitest-environment node
import {readFileSync} from 'node:fs';
import {PGlite} from '@electric-sql/pglite';
import {beforeAll,beforeEach,afterAll,it,expect} from 'vitest';
const db=new PGlite();
const org='10000000-0000-4000-8000-000000000001',other='10000000-0000-4000-8000-000000000002',admin='30000000-0000-4000-8000-000000000001',a='30000000-0000-4000-8000-000000000002',b='30000000-0000-4000-8000-000000000003';
beforeAll(async()=>{
 await db.exec(`SET TIME ZONE 'UTC';CREATE ROLE authenticated;CREATE ROLE anon;CREATE ROLE service_role;CREATE SCHEMA auth;
 CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT nullif(current_setting('test.user',true),'')::uuid $$;
 CREATE TYPE app_role AS ENUM('org_admin','complaints_manager','qa_reviewer','read_only','agent');
 CREATE TABLE organisations(id uuid PRIMARY KEY,time_zone text DEFAULT 'Europe/Paris');
 CREATE TABLE org_members(org_id uuid,user_id uuid,role app_role,active boolean DEFAULT true);
 CREATE TABLE profiles(id uuid,full_name text,email text);
 CREATE TABLE complaints(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),org_id uuid,assigned_to uuid,status text DEFAULT 'received',language text DEFAULT 'en',country_code text DEFAULT 'FR',channel text DEFAULT 'email',created_by uuid,anonymised_at timestamptz,privacy_processing boolean DEFAULT false,rule_set_id uuid,final_due date,ack_due date,received_at timestamptz DEFAULT now(),vulnerable boolean DEFAULT false,priority text DEFAULT 'standard');
 CREATE TABLE rule_sets(id uuid,org_id uuid);
 CREATE TABLE complaint_events(id uuid DEFAULT gen_random_uuid(),org_id uuid,complaint_id uuid,actor uuid,kind text,detail jsonb,created_at timestamptz DEFAULT now());
 CREATE TABLE audit_log(org_id uuid,table_name text,action text);
 CREATE TABLE holidays(org_id uuid,country_code text,holiday_date date);
 CREATE FUNCTION is_org_member(uuid) RETURNS boolean LANGUAGE sql SECURITY DEFINER SET search_path=public AS $$ SELECT EXISTS(SELECT 1 FROM org_members WHERE org_id=$1 AND user_id=auth.uid() AND active) $$;
 CREATE FUNCTION has_org_role(uuid,app_role[]) RETURNS boolean LANGUAGE sql SECURITY DEFINER SET search_path=public AS $$ SELECT EXISTS(SELECT 1 FROM org_members WHERE org_id=$1 AND user_id=auth.uid() AND active AND role=ANY($2)) $$;
 CREATE FUNCTION firm_date(uuid,timestamptz) RETURNS date LANGUAGE sql STABLE AS $$ SELECT ($2 AT TIME ZONE (SELECT time_zone FROM organisations WHERE id=$1))::date $$;
 CREATE FUNCTION add_business_days(uuid,text,date,integer) RETURNS date LANGUAGE plpgsql AS $$ DECLARE d date:=$3; n int:=0; BEGIN WHILE n<$4 LOOP d:=d+1;IF extract(isodow FROM d)<6 AND NOT EXISTS(SELECT 1 FROM holidays WHERE org_id=$1 AND country_code=$2 AND holiday_date=d) THEN n:=n+1;END IF;END LOOP;RETURN d;END $$;
 CREATE FUNCTION audit_capture() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$ BEGIN INSERT INTO audit_log VALUES(NEW.org_id,TG_TABLE_NAME,lower(TG_OP));RETURN NEW;END $$;
 CREATE FUNCTION log_assignment() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$ BEGIN IF TG_OP='UPDATE' AND NEW.assigned_to IS DISTINCT FROM OLD.assigned_to THEN INSERT INTO complaint_events(org_id,complaint_id,actor,kind,detail) VALUES(NEW.org_id,NEW.id,auth.uid(),'reassigned',jsonb_build_object('before',OLD.assigned_to,'after',NEW.assigned_to));END IF;RETURN NEW;END $$;
 CREATE TRIGGER complaints_log AFTER INSERT OR UPDATE ON complaints FOR EACH ROW EXECUTE FUNCTION log_assignment();
 GRANT USAGE ON SCHEMA auth,public TO authenticated;GRANT SELECT ON org_members,organisations TO authenticated;GRANT SELECT,UPDATE ON complaints TO authenticated;
 ALTER TABLE complaints ENABLE ROW LEVEL SECURITY;CREATE POLICY complaints_read ON complaints FOR SELECT TO authenticated USING(is_org_member(org_id));CREATE POLICY complaints_update ON complaints FOR UPDATE TO authenticated USING(has_org_role(org_id,ARRAY['org_admin','complaints_manager']::app_role[]));
 ALTER TABLE organisations ENABLE ROW LEVEL SECURITY;CREATE POLICY org_read ON organisations FOR SELECT TO authenticated USING(is_org_member(id));`);
 const guard=readFileSync('drizzle/migrations/0012_multi_user_settings.sql','utf8').split('\n').find(l=>l.startsWith('CREATE OR REPLACE FUNCTION public.assignment_guard()'));
 if(!guard)throw new Error('Missing assignment guard');await db.exec(guard);await db.exec('CREATE TRIGGER assignment_guard BEFORE INSERT OR UPDATE ON complaints FOR EACH ROW EXECUTE FUNCTION assignment_guard();');
 await db.exec(readFileSync('drizzle/migrations/0029_workload_auto_assignment.sql','utf8'));
},30000);
beforeEach(async()=>{
 await db.exec(`RESET ROLE;SELECT set_config('test.user','',false);DELETE FROM complaint_events;DELETE FROM complaints;DELETE FROM org_members;DELETE FROM profiles;DELETE FROM holidays;`);
 await db.query('INSERT INTO organisations(id) VALUES($1),($2) ON CONFLICT DO NOTHING',[org,other]);
 await db.exec("UPDATE organisations SET auto_assign_mode='off',auto_assign_match_language=true,auto_assign_sources=ARRAY['manual','public_form','import']");
 await db.query("INSERT INTO org_members VALUES($1,$2,'org_admin',true),($1,$3,'agent',true),($1,$4,'agent',true)",[org,admin,a,b]);
 await db.exec('UPDATE agent_capacity SET max_open_cases=NULL,accepting_new=true,away_from=NULL,away_until=NULL,languages=\'{}\',last_assigned_at=NULL,last_auto_assigned_at=NULL');
});
afterAll(()=>db.close());
async function mode(value='least_loaded'){await db.query('UPDATE organisations SET auto_assign_mode=$1 WHERE id=$2',[value,org]);}
async function insert(extra:Record<string,unknown>={}){const values={org_id:org,...extra};const keys=Object.keys(values);return (await db.query<{id:string;assigned_to:string|null}>(`INSERT INTO complaints(${keys.join(',')}) VALUES(${keys.map((_,i)=>'$'+(i+1)).join(',')}) RETURNING id,assigned_to`,Object.values(values))).rows[0];}
async function assigned(id:string|undefined){return (await db.query<{assigned_to:string|null}>('SELECT assigned_to FROM complaints WHERE id=$1',[id])).rows[0]?.assigned_to;}
async function login(user:string){await db.exec('RESET ROLE');await db.query("SELECT set_config('test.user',$1,false)",[user]);await db.exec('SET ROLE authenticated');}
it('least loaded chooses fewest open, then oldest assignment, then user ID',async()=>{
 await insert({assigned_to:a,status:'final_response_sent'});await mode();expect(await assigned((await insert())?.id)).toBe(b);
 await db.query("UPDATE agent_capacity SET last_assigned_at='2020-01-01' WHERE user_id=$1",[a]);await db.query("UPDATE agent_capacity SET last_assigned_at='2021-01-01' WHERE user_id=$1",[b]);expect(await assigned((await insert())?.id)).toBe(a);
});
it('round robin uses oldest automatic assignment rather than manual timestamp',async()=>{await mode('round_robin');expect(await assigned((await insert())?.id)).toBe(a);expect(await assigned((await insert())?.id)).toBe(b);expect(await assigned((await insert())?.id)).toBe(a);});
it('caps count every non-closed status, and leave unassigned when exhausted',async()=>{await db.exec('UPDATE agent_capacity SET max_open_cases=1');await insert({assigned_to:a,status:'escalated_to_adr'});await insert({assigned_to:b,status:'final_response_sent'});await mode();expect(await assigned((await insert())?.id)).toBeNull();});
it('skips away, nonaccepting, inactive and non-agent members',async()=>{await db.query('UPDATE agent_capacity SET away_from=firm_date($1,now()),away_until=firm_date($1,now()) WHERE user_id=$2',[org,a]);await db.query('UPDATE agent_capacity SET accepting_new=false WHERE user_id=$1',[b]);await mode();expect(await assigned((await insert())?.id)).toBeNull();await db.query('UPDATE agent_capacity SET accepting_new=true WHERE user_id=$1',[b]);await db.query('UPDATE org_members SET active=false WHERE user_id=$1',[b]);expect(await assigned((await insert())?.id)).toBeNull();});
it('language preference falls back when no eligible matching agent exists',async()=>{await db.query("UPDATE agent_capacity SET languages=ARRAY['pl'] WHERE user_id=$1",[b]);await mode();expect(await assigned((await insert({language:'pl'}))?.id)).toBe(b);expect(await assigned((await insert({language:'fr'}))?.id)).toBe(a);});
it('skips off, preassigned, excluded import and public sources, and privacy locks',async()=>{
 expect(await assigned((await insert())?.id)).toBeNull();await mode();expect(await assigned((await insert({assigned_to:b}))?.id)).toBe(b);
 await db.exec("UPDATE organisations SET auto_assign_sources=ARRAY['manual']");
 expect(await assigned((await insert({assignment_source:'import'}))?.id)).toBeNull();expect(await assigned((await insert({channel:'web_form',created_by:null}))?.id)).toBeNull();
 expect(await assigned((await insert({privacy_processing:true}))?.id)).toBeNull();expect(await assigned((await insert({anonymised_at:new Date().toISOString()}))?.id)).toBeNull();
});
it('two overlapping insert requests cannot exceed a cap of one',async()=>{await db.exec('UPDATE agent_capacity SET max_open_cases=1');await db.query('UPDATE agent_capacity SET accepting_new=false WHERE user_id=$1',[b]);await mode();const rows=await Promise.all([insert(),insert()]);expect((await db.query('SELECT count(*)::int n FROM complaints WHERE assigned_to=$1',[a])).rows).toEqual([{n:1}]);expect(await assigned(rows[1]?.id)).toBeNull();});
it('auto assignment writes one reassigned event with rule and target',async()=>{await mode();const c=await insert();expect((await db.query('SELECT kind,detail FROM complaint_events WHERE complaint_id=$1',[c?.id])).rows).toEqual([{kind:'reassigned',detail:{before:null,after:a,auto:true,rule:'least_loaded',to:a}}]);});
it('agents only update own availability, never cap, languages, timestamps or other rows',async()=>{await login(a);await db.exec("UPDATE agent_capacity SET accepting_new=false,away_from='2026-11-19' WHERE user_id=auth.uid()");await expect(db.exec('UPDATE agent_capacity SET max_open_cases=5 WHERE user_id=auth.uid()')).rejects.toThrow('availability');await expect(db.exec("UPDATE agent_capacity SET languages=ARRAY['pl'] WHERE user_id=auth.uid()")).rejects.toThrow('availability');expect((await db.query('UPDATE agent_capacity SET accepting_new=false WHERE user_id=$1 RETURNING user_id',[b])).rows).toHaveLength(0);await expect(db.exec('INSERT INTO agent_capacity(org_id,user_id) VALUES(gen_random_uuid(),gen_random_uuid())')).rejects.toThrow();await expect(db.exec('DELETE FROM agent_capacity')).rejects.toThrow();await db.exec('RESET ROLE');await expect(db.exec('DELETE FROM agent_capacity')).rejects.toThrow('cannot be deleted');});
it('active members read only their tenant; supervisors manage capacity and workload',async()=>{await login(admin);await db.query('UPDATE agent_capacity SET max_open_cases=10 WHERE user_id=$1',[a]);expect((await db.query('SELECT * FROM workload_summary($1)',[org])).rows).toHaveLength(3);await login(a);await expect(db.query('SELECT * FROM workload_summary($1)',[org])).rejects.toThrow('denied');expect((await db.query('SELECT * FROM agent_capacity WHERE org_id=$1',[other])).rows).toHaveLength(0);});
it('workload includes unassigned, final deadline, holiday-aware soon, ack and recent counts',async()=>{await db.query('INSERT INTO holidays VALUES($1,\'FR\',firm_date($1,now())+1)',[org]);await insert({assigned_to:a,final_due:'2000-01-01',ack_due:'2000-01-01',vulnerable:true,priority:'high'});await insert();await login(admin);const rows=(await db.query<{user_id:string|null;open_cases:number;overdue:number;ack_overdue:number}>('SELECT * FROM workload_summary($1)',[org])).rows;expect(rows.find(r=>r.user_id===a)).toMatchObject({open_cases:1,overdue:1,ack_overdue:1});expect(rows.find(r=>r.user_id===null)?.open_cases).toBe(1);});
it('rebalance remains permission checked and respects original assignment guard',async()=>{const c=await insert();await mode();await login(a);await expect(db.query('SELECT rebalance_complaint($1,$2)',[org,c?.id])).rejects.toThrow('managers');await login(admin);expect((await db.query<{u:string}>('SELECT rebalance_complaint($1,$2) u',[org,c?.id])).rows[0]?.u).toBe(a);await db.exec('RESET ROLE');await db.query("UPDATE org_members SET role='read_only' WHERE user_id=$1",[b]);await expect(db.query('UPDATE complaints SET assigned_to=$1 WHERE id=$2',[b,c?.id])).rejects.toThrow('active case handler');});