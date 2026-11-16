import { describe, expect, it } from 'vitest';
import { acknowledgedAt, responseMetrics } from './response-metrics';
import { regulatoryReport, reportFilterOps, evalFilterOps, type ReportRow } from './reports';
import { parseQueueSearch } from './queue';
import { auditDateBoundary } from './audit';
const range={from:'2026-01-01',to:'2026-01-31'};
const row=(patch:Partial<ReportRow>={}):ReportRow=>({id:'1',reference:'RDR-2026-000001',status:'received',category:'fees_and_charges',product:'card',country_code:'FR',channel:'email',assigned_to:null,vulnerable:false,outcome:null,redress_amount:null,redress_currency:null,goodwill_amount:null,goodwill_currency:null,root_cause_category:null,received_at:'2025-12-31T23:30:00Z',closed_at:null,final_due:'2026-01-20',extended_due:null,holding_sent_at:null,ack_due:'2026-01-01',...patch});
describe('response evidence and clocks',()=>{
  it('prefers earliest sent acknowledgement letter even over an earlier status',()=>{
    expect(acknowledgedAt('1',[{complaint_id:'1',kind:'acknowledgement',sent_at:'2026-01-03T12:00:00Z'},{complaint_id:'1',kind:'acknowledgement',sent_at:null},{complaint_id:'1',kind:'acknowledgement',sent_at:'2026-01-02T12:00:00Z'}],[{complaint_id:'1',created_at:'2026-01-01T12:00:00Z',detail:{after:'acknowledged'}}])).toBe('2026-01-02T12:00:00Z');
  });
  it('falls back to first acknowledged status, otherwise null',()=>{
    expect(acknowledgedAt('1',[],[{complaint_id:'1',created_at:'2026-01-03',detail:{after:'acknowledged'}},{complaint_id:'1',created_at:'2026-01-02',detail:{after:'acknowledged'}}])).toBe('2026-01-02');
    expect(acknowledgedAt('1',[],[{complaint_id:'2',created_at:'2026-01-02',detail:{after:'acknowledged'}}])).toBeNull();
  });
  it('counts Paris 00:30 on 1 January in the local period and deadline',()=>{
    const m=responseMetrics([row({acknowledged_at:'2025-12-31T23:30:00Z'})],range,[],'Europe/Paris',new Date('2026-02-01T00:00:00Z'));
    expect(m.onTimePct).toBe(100);expect(m.acknowledged).toHaveLength(1);expect(m.received).toHaveLength(1);
    expect(responseMetrics([row({acknowledged_at:'2026-01-01T23:30:00Z'})],range,[],'Europe/Paris').onTimePct).toBe(0);
  });
  it('uses due OR acknowledged cohort and includes missing ack in denominator',()=>{
    const m=responseMetrics([row(),row({id:'2',ack_due:'2025-12-30',acknowledged_at:'2026-01-02'}),row({id:'3',ack_due:null,acknowledged_at:'2026-01-02'})],range,[],'Europe/Paris');
    expect(m.ackCohort).toHaveLength(2);expect(m.onTimePct).toBe(0);
  });
  it('median excludes weekends and configured country holidays',()=>{
    const m=responseMetrics([row({received_at:'2026-01-02',acknowledged_at:'2026-01-07'}),row({id:'2',received_at:'2026-01-02',acknowledged_at:'2026-01-08'})],range,[{country_code:'FR',holiday_date:'2026-01-06'}],'Europe/Paris');
    expect(m.median).toBe(2.5);
  });
  it('holding percentage and letter count use distinct definitions and zero denominators',()=>{
    const m=responseMetrics([row({holding_sent_at:'2026-01-12',holding_letters:['2026-01-12','2026-01-13']}),row({id:'2'})],range,[],'Europe/Paris');
    expect(m.holdingPct).toBe(50);expect(m.holdingLetters).toHaveLength(2);
    expect(responseMetrics([],range).holdingPct).toBeNull();expect(responseMetrics([],range).extendedPct).toBeNull();
  });
  it('extended deadline rate excludes missing deadline and resolutions before holding',()=>{
    const m=responseMetrics([row({closed_at:'2026-01-20',holding_sent_at:'2026-01-12',extended_due:'2026-01-20'}),row({id:'2',closed_at:'2026-01-21',holding_sent_at:'2026-01-12',extended_due:'2026-01-20'}),row({id:'3',closed_at:'2026-01-10',holding_sent_at:'2026-01-12',extended_due:'2026-01-20'})],range);
    expect(m.extendedPct).toBe(50);
  });
  it('groups response metrics by current agent and case country',()=>{
    const report=regulatoryReport([row({assigned_to:'agent-a',acknowledged_at:'2026-01-01'}),row({id:'2',country_code:'PL'})],range,[],[],[],'Europe/Paris');
    expect(report.responseTables?.[0]?.rows).toContainEqual(['agent-a',1,100,0,0,0,'n/a']);
    expect(report.responseTables?.[1]?.rows.find(r=>r[0]==='PL')?.[1]).toBe(1);
  });
  it('holding filter-only membership equals report numerator at local date bounds',()=>{
    const rows=[row({holding_sent_at:'2026-01-12'}),row({id:'2',holding_sent_at:'2026-01-31T23:30:00Z'}),row({id:'3',received_at:'2025-12-31T22:30:00Z',holding_sent_at:'2026-01-12'})];
    const s=parseQueueSearch({holding:'yes',receipt_start:auditDateBoundary(range.from,'Europe/Paris'),receipt_end:auditDateBoundary(range.to,'Europe/Paris',true),holding_by:auditDateBoundary(range.to,'Europe/Paris',true)});
    expect(rows.filter(r=>evalFilterOps(r as unknown as Record<string,unknown>,reportFilterOps(s))).map(r=>r.id)).toEqual(responseMetrics(rows,range,[],'Europe/Paris').holding.map(r=>r.id));
    expect(parseQueueSearch({holding:'bad',holding_by:'bad'}).holding).toBeUndefined();
  });
});