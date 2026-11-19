// @vitest-environment node
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { beforeAll, afterAll, it, expect } from 'vitest';
import { acknowledgedAt, acknowledgementSearch, matchesAcknowledgement } from '../lib/response-metrics';
import { evalFilterOps, reportFilterOps } from '../lib/reports';
import { parseQueueSearch } from '../lib/queue';

const db = new PGlite();
beforeAll(async () => {
  await db.exec(`SET TIME ZONE 'UTC'; CREATE ROLE anon; CREATE ROLE authenticated;
    CREATE TABLE organisations(id uuid PRIMARY KEY,time_zone text);
    INSERT INTO organisations VALUES('10000000-0000-4000-8000-000000000001','Europe/Paris');
    CREATE TABLE complaints(id uuid PRIMARY KEY,org_id uuid,ack_due date,reference text);
    CREATE TABLE letters(complaint_id uuid,org_id uuid,kind text,sent_at timestamptz);
    CREATE TABLE complaint_events(complaint_id uuid,org_id uuid,created_at timestamptz,detail jsonb);
    CREATE TABLE template_versions(id uuid); GRANT ALL ON template_versions TO anon; GRANT SELECT ON template_versions TO authenticated;
    CREATE VIEW complaint_queue WITH(security_invoker=true) AS SELECT c.*,true AS has_reopened,'pending'::text AS adr_decision FROM complaints c;
    GRANT SELECT ON complaint_queue,complaints,letters,complaint_events,organisations TO authenticated;
    ALTER TABLE complaints ENABLE ROW LEVEL SECURITY; CREATE POLICY own ON complaints FOR SELECT TO authenticated USING(org_id='10000000-0000-4000-8000-000000000001');`);
  await db.exec(readFileSync('drizzle/migrations/0030_exact_acknowledgement_filters.sql','utf8').replaceAll('--> statement-breakpoint',''));
  await db.exec(`INSERT INTO complaints SELECT ('20000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,'10000000-0000-4000-8000-000000000001','2026-01-01',n::text FROM generate_series(1,5) n;
    INSERT INTO letters SELECT id,org_id,'acknowledgement',t::timestamptz FROM complaints CROSS JOIN (VALUES('2026-01-02T12:00:00Z'),('2026-01-01T12:00:00Z')) v(t) WHERE reference='1';
    INSERT INTO letters SELECT id,org_id,'holding','2025-12-30' FROM complaints WHERE reference='2';
    INSERT INTO letters SELECT id,org_id,'acknowledgement',null FROM complaints WHERE reference='2';
    INSERT INTO complaint_events SELECT id,org_id,t::timestamptz,'{"after":"acknowledged"}' FROM complaints CROSS JOIN (VALUES('2025-12-31T23:30:00Z'),('2026-01-01T23:30:00Z')) v(t) WHERE reference IN ('1','2');
    INSERT INTO letters SELECT id,org_id,'acknowledgement','2026-01-01T23:30:00Z' FROM complaints WHERE reference='4';
    INSERT INTO letters SELECT id,org_id,'acknowledgement','2026-02-01T00:30:00Z' FROM complaints WHERE reference='5';`);
},30000);
afterAll(()=>db.close());
it('matches earliest letter, event fallback and unknown evidence exactly',async()=>{
  const rows=(await db.query<{reference:string;acknowledged_at:string|null}>('SELECT reference,acknowledged_at::text FROM complaint_queue ORDER BY reference')).rows;
  expect(rows.map(r=>r.acknowledged_at?new Date(r.acknowledged_at).toISOString():null)).toEqual(['2026-01-01T12:00:00.000Z','2025-12-31T23:30:00.000Z',null,'2026-01-01T23:30:00.000Z','2026-02-01T00:30:00.000Z']);
  expect(acknowledgedAt('1',[{complaint_id:'1',kind:'acknowledgement',sent_at:rows[0]?.acknowledged_at??null}],[])).toBe(rows[0]?.acknowledged_at);
});
it('preserves every old column in order and invoker RLS',async()=>{
  expect((await db.query<{column_name:string}>("SELECT column_name FROM information_schema.columns WHERE table_name='complaint_queue' ORDER BY ordinal_position")).rows.map(r=>r.column_name)).toEqual(['id','org_id','ack_due','reference','has_reopened','adr_decision','acknowledged_at']);
  expect((await db.query<{reloptions:string[]}>("SELECT reloptions FROM pg_class WHERE relname='complaint_queue'")).rows[0]?.reloptions).toContain('security_invoker=true');
  await db.exec("INSERT INTO complaints VALUES(gen_random_uuid(),'10000000-0000-4000-8000-000000000002','2026-01-01','hidden'); SET ROLE authenticated");
  expect((await db.query('SELECT * FROM complaint_queue')).rows).toHaveLength(5);
  await db.exec('RESET ROLE');
});
it('runs the generated filter-only drill-down predicates with exact Paris boundaries',async()=>{
  const range={from:'2026-01-01',to:'2026-01-31'}, zone='Europe/Paris';
  const rows=(await db.query<{reference:string;ack_due:string;acknowledged_at:string|null}>('SELECT reference,ack_due::text,acknowledged_at::text FROM complaint_queue WHERE reference<>\'hidden\'')).rows;
  for(const metric of ['on_time','late','overdue'] as const){
    const search=parseQueueSearch(acknowledgementSearch(metric,range,zone,'2026-02-01') as Record<string,unknown>);
    const parameters:unknown[]=[];
    const param=(v:unknown)=>{parameters.push(v);return '$'+parameters.length;};
    const predicate=reportFilterOps(search).map(op=>{
      const col=op.col==='acknowledgement_on_time'?'public.acknowledgement_on_time(q)':`q.${op.col}`;
      if(op.op==='is_null')return col+' IS NULL';
      if(op.op==='not_null')return col+' IS NOT NULL';
      if(op.op==='or'){
        const s=String(op.v);const parts=[...s.matchAll(/(ack_due|acknowledged_at)\.(gte|lte|lt)\.([^,)]+)/g)];
        expect(parts).toHaveLength(4);
        const terms=parts.map(m=>`q.${m[1]} ${m[2]==='gte'?'>=':m[2]==='lte'?'<=':'<'} ${param(m[3])}`);
        return `((${terms[0]} AND ${terms[1]}) OR (${terms[2]} AND ${terms[3]}))`;
      }
      return `${col} ${op.op==='eq'?'=':op.op==='lt'?'<':'>='} ${param(op.v)}`;
    }).join(' AND ');
    const actual=(await db.query<{reference:string}>(`SELECT reference FROM complaint_queue q WHERE reference<>'hidden' AND ${predicate} ORDER BY reference`,parameters)).rows.map(r=>r.reference);
    expect(actual).toEqual(rows.filter(r=>matchesAcknowledgement(r,search)).map(r=>r.reference).sort());
    const computed=(await db.query<Record<string,unknown>>('SELECT q.*,ack_due::text,acknowledged_at::text,public.acknowledgement_on_time(q) AS acknowledgement_on_time FROM complaint_queue q WHERE reference<>\'hidden\'')).rows;
    expect(computed.filter(r=>evalFilterOps({...r,acknowledged_at:r['acknowledged_at']?new Date(String(r['acknowledged_at'])).toISOString():null},reportFilterOps(search))).map(r=>r['reference']).sort()).toEqual(actual);
    expect(actual).toEqual(metric==='on_time'?['1','2']:metric==='late'?['4']:['3']);
    expect(JSON.stringify(search)).not.toContain('report_ids');
  }
});
it('revokes all anonymous privileges and preserves authenticated SELECT only',async()=>{
  const rows=(await db.query<{grantee:string;privilege_type:string}>("SELECT grantee,privilege_type FROM information_schema.role_table_grants WHERE table_name='template_versions' AND grantee IN ('anon','authenticated')")).rows;
  expect(rows).toEqual([{grantee:'authenticated',privilege_type:'SELECT'}]);
});