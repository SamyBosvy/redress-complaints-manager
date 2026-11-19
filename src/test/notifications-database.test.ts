// @vitest-environment node
import {readFileSync} from 'node:fs';
import {PGlite} from '@electric-sql/pglite';
import {beforeAll,beforeEach,afterAll,it,expect} from 'vitest';
const db=new PGlite();
const org='10000000-0000-4000-8000-000000000001',c='20000000-0000-4000-8000-000000000001',a='30000000-0000-4000-8000-000000000001',b='30000000-0000-4000-8000-000000000002',manager='30000000-0000-4000-8000-000000000003';
beforeAll(async()=>{
 await db.exec(`SET TIME ZONE 'UTC';CREATE ROLE authenticated;CREATE ROLE anon;CREATE ROLE service_role;CREATE SCHEMA auth;
 CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT nullif(current_setting('test.user',true),'')::uuid $$;
 CREATE TABLE organisations(id uuid PRIMARY KEY,time_zone text);
 CREATE TABLE org_members(org_id uuid,user_id uuid,role text,active boolean);
 CREATE TABLE profiles(id uuid,full_name text);
 CREATE TABLE complaints(id uuid PRIMARY KEY,org_id uuid,reference text,assigned_to uuid,status text,final_due date,ack_due date,country_code text,anonymised_at timestamptz,privacy_processing boolean DEFAULT false);
 CREATE TABLE letters(id uuid,org_id uuid,complaint_id uuid,kind text,sent_at timestamptz,status text,approved_by uuid);
 CREATE TABLE complaint_events(org_id uuid,complaint_id uuid,actor uuid,kind text,detail jsonb,created_at timestamptz DEFAULT now());
 CREATE TABLE note_mentions(id uuid DEFAULT gen_random_uuid(),org_id uuid,complaint_id uuid,mentioned_by uuid,mentioned_user uuid);
 CREATE TABLE complaint_reopenings(id uuid DEFAULT gen_random_uuid(),org_id uuid,complaint_id uuid,reopened_by uuid);
 CREATE TABLE qa_reviews(org_id uuid,complaint_id uuid,letter_id uuid,kind text,status text,reviewer uuid,comments text);
 CREATE TABLE notifications(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),org_id uuid,user_id uuid,kind text,title text,complaint_id uuid,read_at timestamptz,created_at timestamptz DEFAULT now());
 GRANT SELECT,INSERT,UPDATE,DELETE ON notifications TO authenticated;GRANT ALL ON notifications TO anon,service_role;ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
 CREATE POLICY "notifications insert" ON notifications FOR INSERT TO authenticated WITH CHECK(true);CREATE POLICY "notifications read own" ON notifications FOR SELECT TO authenticated USING(user_id=auth.uid());CREATE POLICY "notifications update own" ON notifications FOR UPDATE TO authenticated USING(user_id=auth.uid());
 CREATE FUNCTION is_org_member(uuid) RETURNS boolean LANGUAGE sql SECURITY DEFINER AS $$ SELECT EXISTS(SELECT 1 FROM org_members WHERE org_id=$1 AND user_id=auth.uid() AND active) $$;
 CREATE FUNCTION can_read_mention_case(uuid,uuid,uuid) RETURNS boolean LANGUAGE sql SECURITY DEFINER AS $$ SELECT EXISTS(SELECT 1 FROM complaints c JOIN org_members m ON m.org_id=c.org_id WHERE c.org_id=$1 AND c.id=$2 AND m.user_id=$3 AND m.active AND (m.role<>'agent' OR c.assigned_to=$3)) $$;
 CREATE FUNCTION firm_date(uuid,timestamptz) RETURNS date LANGUAGE sql AS $$ SELECT ($2 AT TIME ZONE (SELECT time_zone FROM organisations WHERE id=$1))::date $$;
 CREATE FUNCTION add_business_days(uuid,text,date,integer) RETURNS date LANGUAGE plpgsql AS $$ DECLARE d date:=$3;n int:=0;BEGIN WHILE n<$4 LOOP d:=d+1;IF extract(isodow FROM d)<6 THEN n:=n+1;END IF;END LOOP;RETURN d;END $$;
 CREATE FUNCTION audit_capture() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF TG_OP='DELETE' THEN RETURN OLD;END IF;RETURN NEW;END $$;
 GRANT USAGE ON SCHEMA auth TO authenticated;`);
 await db.exec(readFileSync('drizzle/migrations/0031_secure_in_app_notifications.sql','utf8'));
 await db.exec(readFileSync('drizzle/migrations/0032_notification_job_query_guard.sql','utf8'));
 const pending=readFileSync('drizzle/migrations/0015_compliance_hardening.sql','utf8').split('\n').find(line=>line.startsWith('CREATE OR REPLACE FUNCTION public.qa_on_pending()'));if(!pending)throw Error('Missing pending trigger');await db.exec(pending);
 const qa=readFileSync('drizzle/migrations/0028_qa_timeline_events.sql','utf8').split('\n')[0];if(!qa)throw Error('Missing QA function');await db.exec(qa);
 await db.exec(`CREATE TRIGGER pending AFTER UPDATE ON complaints FOR EACH ROW EXECUTE FUNCTION qa_on_pending();CREATE TRIGGER assignment AFTER INSERT OR UPDATE ON complaints FOR EACH ROW EXECUTE FUNCTION notify_assignment();CREATE TRIGGER qa_decided AFTER UPDATE ON qa_reviews FOR EACH ROW EXECUTE FUNCTION qa_reviews_after_decide();`);
},30000);
beforeEach(async()=>{
 await db.exec("RESET ROLE;SELECT set_config('test.user','',false);SELECT set_config('redress.auto_case','',false);TRUNCATE notification_preferences,notifications,org_members,complaints,letters,complaint_events,note_mentions,complaint_reopenings,qa_reviews,organisations,profiles;");
 await db.query('INSERT INTO organisations VALUES($1,$2)',[org,'Europe/Paris']);
 await db.query("INSERT INTO org_members VALUES($1,$2,'agent',true),($1,$3,'agent',true),($1,$4,'complaints_manager',true)",[org,a,b,manager]);
 await db.query('INSERT INTO profiles VALUES($1,$2)',[manager,'Case Manager']);
 await db.query("INSERT INTO complaints VALUES($1,$2,'RDR-1',$3,'received','2026-01-10','2026-01-01','FR',null,false)",[c,org,a]);await db.exec('TRUNCATE notifications');
});
afterAll(()=>db.close());
const login=async(user:string)=>{await db.query("SELECT set_config('test.user',$1,false)",[user]);await db.exec('SET ROLE authenticated');};
const notes=async()=> (await db.query<{kind:string;user_id:string;title:string;actor:string;link_path:string}>('SELECT kind,user_id,title,actor,link_path FROM notifications ORDER BY kind')).rows;
it('blocks authenticated insert/delete and every change other than own read_at',async()=>{
 await db.query("INSERT INTO notifications(org_id,user_id,kind,title,complaint_id) VALUES($1,$2,'assigned','Test',$3)",[org,a,c]);await login(a);
 await expect(db.query("INSERT INTO notifications(org_id,user_id,kind,title) VALUES($1,$2,'assigned','spoof')",[org,b])).rejects.toThrow();
 await expect(db.exec('DELETE FROM notifications')).rejects.toThrow();
 for(const patch of ["title='spoof'","kind='mention'","actor=gen_random_uuid()","link_path='/auth'","user_id=gen_random_uuid()","org_id=gen_random_uuid()","created_at=now()+interval '1 day'","dedupe_key='spoof'","complaint_id=null"]){await expect(db.exec(`UPDATE notifications SET ${patch}`)).rejects.toThrow();}
 await db.exec('UPDATE notifications SET read_at=now()');expect((await db.query<{read_at:string|null}>('SELECT read_at FROM notifications')).rows[0]?.['read_at']).not.toBeNull();
});
it('hides other users and loses access immediately after case unassignment',async()=>{
 await db.query("INSERT INTO notifications(org_id,user_id,kind,title,complaint_id) VALUES($1,$2,'assigned','Own',$3),($1,$4,'assigned','Manager',$3)",[org,a,c,manager]);await login(a);expect(await notes()).toHaveLength(1);
 await db.exec('RESET ROLE');await db.query('UPDATE complaints SET assigned_to=$1 WHERE id=$2',[b,c]);await login(a);expect(await notes()).toHaveLength(0);
});
it('assignment notifies the recipient once, includes automatic label, skips self',async()=>{
 await db.query("SELECT set_config('test.user',$1,false)",[manager]);await db.query("SELECT set_config('redress.auto_case',$1,false)",[c]);await db.query('UPDATE complaints SET assigned_to=$1',[b]);
 expect(await notes()).toEqual([{kind:'assigned',user_id:b,title:'Complaint assigned to you automatically: RDR-1',actor:manager,link_path:'/app/c/'+c}]);await db.exec('TRUNCATE notifications');await db.query("SELECT set_config('test.user',$1,false)",[a]);await db.query('UPDATE complaints SET assigned_to=$1',[a]);expect(await notes()).toHaveLength(0);
});
it('mentions and reopening create one correctly attributed recipient alert',async()=>{
 await db.query('INSERT INTO note_mentions(org_id,complaint_id,mentioned_by,mentioned_user) VALUES($1,$2,$3,$4)',[org,c,manager,a]);
 await db.query('INSERT INTO complaint_reopenings(org_id,complaint_id,reopened_by) VALUES($1,$2,$3)',[org,c,manager]);
 expect((await notes()).map(n=>[n.kind,n.user_id,n.actor])).toEqual([['mention',a,manager],['reopened',a,manager]]);expect((await notes())[0]?.title).toBe('Case Manager mentioned you on RDR-1');
 await db.query('INSERT INTO note_mentions(org_id,complaint_id,mentioned_by,mentioned_user) VALUES($1,$2,$3,$3)',[org,c,a]);expect(await notes()).toHaveLength(2);
});
it('preferences suppress optional kinds while mandatory kinds cannot be disabled or others edited',async()=>{
 await login(a);await db.query("INSERT INTO notification_preferences VALUES($1,$2,'assigned',false)",[a,org]);
 for(const kind of ['mention','qa_returned'])await expect(db.query('INSERT INTO notification_preferences VALUES($1,$2,$3,false)',[a,org,kind])).rejects.toThrow();
 await expect(db.query("INSERT INTO notification_preferences VALUES($1,$2,'assigned',false)",[b,org])).rejects.toThrow();await db.exec('RESET ROLE');
 await db.query("INSERT INTO notifications(org_id,user_id,kind,title,complaint_id,actor) SELECT $1,$2,k,'Test',$3,$4 FROM unnest(ARRAY['assigned','mention','qa_returned']) k",[org,a,c,manager]);expect((await notes()).map(n=>n.kind)).toEqual(['mention','qa_returned']);
});
it('existing QA return writes one mandatory alert with reviewer and link',async()=>{
 await db.query("UPDATE complaints SET status='pending_qa'");await db.exec('TRUNCATE notifications');await db.query("INSERT INTO qa_reviews VALUES($1,$2,null,'approval','pending',$3,'fix')",[org,c,manager]);await db.query("SELECT set_config('test.user',$1,false)",[manager]);await db.exec("UPDATE qa_reviews SET status='returned'");
 expect((await notes()).map(n=>[n.kind,n.user_id,n.actor,n.link_path])).toEqual([['qa_returned',a,manager,'/app/c/'+c]]);
});
it('daily alerts dedupe within a local day, renew next day and handle unassigned managers',async()=>{
 await db.query('SELECT notification_deadline_job($1)', ['2025-12-31T23:30:00Z']);expect(await notes()).toHaveLength(0);
 await db.query('SELECT notification_deadline_job($1)', ['2026-01-01T23:30:00Z']);await db.query('SELECT notification_deadline_job($1)', ['2026-01-02T12:00:00Z']);expect(await notes()).toHaveLength(1);
 await db.query('SELECT notification_deadline_job($1)', ['2026-01-02T23:30:00Z']);expect(await notes()).toHaveLength(2);
 await db.exec('UPDATE complaints SET assigned_to=null;TRUNCATE notifications');await db.query('SELECT notification_deadline_job($1)', ['2026-01-02T12:00:00Z']);expect((await notes()).map(n=>n.user_id)).toEqual([manager]);
});
it('risk alert uses three business days, evidence prevents ack alert, optional preference suppresses job',async()=>{
 await db.exec("UPDATE complaints SET final_due='2026-01-07',ack_due=null");await db.query('SELECT notification_deadline_job($1)', ['2026-01-02T12:00:00Z']);expect((await notes()).map(n=>n.kind)).toEqual(['deadline_at_risk']);
 await db.exec("TRUNCATE notifications;UPDATE complaints SET final_due='2026-01-20',ack_due='2026-01-01'");await db.query("INSERT INTO complaint_events(org_id,complaint_id,detail) VALUES($1,$2,'{\"after\":\"acknowledged\"}')",[org,c]);await db.query('SELECT notification_deadline_job($1)', ['2026-01-02T12:00:00Z']);expect(await notes()).toHaveLength(0);
 await db.exec("TRUNCATE complaint_events;INSERT INTO notification_preferences VALUES('"+a+"','"+org+"','deadline_overdue',false)");await db.query('SELECT notification_deadline_job($1)', ['2026-01-02T12:00:00Z']);expect(await notes()).toHaveLength(0);
});
it('service-only jobs and 90-day retention leave recent rows untouched',async()=>{
 await db.query("INSERT INTO notifications(org_id,user_id,kind,title,created_at) VALUES($1,$2,'assigned','Old',now()-interval '91 days'),($1,$2,'assigned','Recent',now())",[org,a]);await login(a);await expect(db.exec('SELECT notification_deadline_job()')).rejects.toThrow();await expect(db.exec('SELECT notification_retention_job()')).rejects.toThrow();await db.exec('RESET ROLE');await db.exec('SELECT notification_retention_job()');expect((await notes()).map(n=>n.title)).toEqual(['Recent']);
});
it('QA pending keeps existing review creation and alerts eligible reviewers once, not the actor',async()=>{
 await db.query("INSERT INTO letters(id,org_id,complaint_id,kind,sent_at,status) VALUES(gen_random_uuid(),$1,$2,'final_upheld',now(),'pending_approval')",[org,c]);
 await db.query("SELECT set_config('test.user',$1,false)",[a]);await db.exec("UPDATE complaints SET status='pending_qa'");
 expect((await notes()).map(n=>[n.kind,n.user_id,n.actor,n.link_path])).toEqual([['qa_pending',manager,a,'/app/c/'+c]]);expect((await db.query('SELECT * FROM qa_reviews')).rows).toHaveLength(1);
 await db.exec("UPDATE complaints SET status='pending_qa'");expect(await notes()).toHaveLength(1);
});
