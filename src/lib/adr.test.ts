import { it, expect } from 'vitest';
import { adrMetrics, canManageAdr, ADR_DECISIONS } from './adr';
import { buildDrillDownSearch, reportFilterOps, evalFilterOps, regulatoryReport } from './reports';
import { parseQueueSearch } from './queue';
const range={from:'2026-03-01',to:'2026-03-31'};
const adr=[{complaint_id:'1',escalated_on:'2026-02-01',decision:'overturned',decision_on:'2026-03-02',award_amount:100,award_currency:'EUR'},{complaint_id:'2',escalated_on:'2026-03-01',decision:'partially_overturned',decision_on:'2026-03-15',award_amount:50,award_currency:'GBP'},{complaint_id:'3',escalated_on:'2026-03-02',decision:'upheld_firm',decision_on:'2026-04-01',award_amount:null,award_currency:null},{complaint_id:'4',escalated_on:'2026-03-03',decision:'settled',decision_on:'2026-03-20',award_amount:20,award_currency:'EUR'}];
it('overturn rate includes partial decisions and all decided denominator',()=>expect(adrMetrics(adr,range).overturnRate).toBe(66.7));
it('zero decisions gives n/a',()=>expect(adrMetrics([],range).overturnRate).toBeNull());
it('awards never combine currencies or count decisions outside the period',()=>expect(adrMetrics(adr,range).awards).toEqual({EUR:120,GBP:50}));
for(const role of ['org_admin','complaints_manager','agent','qa_reviewer','read_only'] as const)it(`ADR role ${role}`,()=>expect(canManageAdr(role,'u',{assigned_to:'u'})).toBe(['org_admin','complaints_manager','agent'].includes(role)));
it('agents must be assigned',()=>expect(canManageAdr('agent','u',{assigned_to:null})).toBe(false));
for(const lock of [{legal_hold:true},{privacy_processing:true},{anonymised_at:'date'}])it(`ADR lock ${JSON.stringify(lock)}`,()=>expect(canManageAdr('org_admin','u',lock)).toBe(false));
it('ADR drill-down SQL membership matches each metric and outcome count independently of receipt',()=>{
 const report=regulatoryReport([],range,[],adr);
 const asQueue=adr.map(a=>({adr_escalated_on:a.escalated_on,adr_decision:a.decision,adr_decision_on:a.decision_on,adr_award_amount:a.award_amount,adr_award_currency:a.award_currency}));
 for(const metric of ['Escalated to ADR','ADR decisions','ADR overturn rate']) {const s=buildDrillDownSearch(metric,undefined,range); const count=asQueue.filter(r=>evalFilterOps(r,reportFilterOps(s))).length;expect(count).toBe(metric==='ADR overturn rate'?2:report.summary.find(x=>x.label===metric)?.value);expect(s.report_ids).toBeUndefined();expect(s.received_from).toBeUndefined();}
 for(const r of report.tables.find(t=>t.title==='By ADR outcome')?.rows??[]) expect(asQueue.filter(a=>evalFilterOps(a,reportFilterOps(buildDrillDownSearch('By ADR outcome',r.label,range)))).length).toBe(r.count);
 expect(asQueue.filter(a=>evalFilterOps(a,reportFilterOps(buildDrillDownSearch('ADR awards — EUR',undefined,range)))).length).toBe(2);
});
it('validates ADR queue filters',()=>{expect(parseQueueSearch({tab:'adr',adr_metric:'decided',adr_from:range.from,adr_to:range.to,adr_decision:'overturned',adr_currency:'PLN'})).toMatchObject({tab:'adr',adr_metric:'decided',adr_currency:'PLN'});expect(parseQueueSearch({adr_metric:'wrong',adr_decision:'x',adr_currency:'XXX',adr_from:'2026-02-30'})).toMatchObject({adr_metric:undefined,adr_decision:undefined,adr_currency:undefined,adr_from:undefined});expect(Object.keys(ADR_DECISIONS)).toHaveLength(6);});
