import {describe,it,expect} from 'vitest';
import {buildDrillDownSearch,drillDownRows,matchesReportFilters,regulatoryReport,reportBuckets,type ReportRow} from './reports';
import {parseQueueSearch} from './queue';
const base:ReportRow={id:'a',reference:'R1',status:'closed',category:'fees_and_charges',product:'card',country_code:'FR',channel:'email',assigned_to:null,vulnerable:false,outcome:'upheld',redress_amount:10,redress_currency:'EUR',goodwill_amount:null,goodwill_currency:null,root_cause_category:'Legacy cause',received_at:'2026-01-02',closed_at:'2026-01-10',final_due:'2026-01-20',extended_due:null,holding_sent_at:null};
const rows:ReportRow[]=[base,{...base,id:'b',status:'received',closed_at:null,outcome:null,received_at:'2025-12-01'},{...base,id:'c',outcome:'withdrawn',closed_at:'2026-01-25',root_cause_category:null,redress_currency:'GBP'}];
const range={from:'2026-01-01',to:'2026-01-31'};
describe('report drilldowns',()=>{
 it('matches every summary counting cohort and outcome numerator',()=>{
 const expected:Record<string,number>={'Complaints received':2,Resolved:2,'Open at period end':1,'Resolved within deadline':1,'Median days to resolve':2,'Average days to resolve':2,Upheld:1,'Partially upheld':0,'Not upheld':0,Withdrawn:1,'Escalated to ADR':0,'Redress paid — EUR':1,'Redress paid — GBP':1};
 for(const [metric,count] of Object.entries(expected)){const selected=drillDownRows(rows,metric,undefined,range);expect(selected.length,metric).toBe(count);const s=parseQueueSearch(buildDrillDownSearch(metric,undefined,range));if(!metric.includes(' paid — '))expect(rows.filter(r=>matchesReportFilters(r,s)).length,metric).toBe(count);expect(s.tab).toBe('all');}
 });
 it('matches each regulatory table row including legacy and missing root causes',()=>{for(const table of regulatoryReport(rows,range).tables)for(const group of table.rows)expect(drillDownRows(rows,table.title,group.label,range).length).toBe(group.count);});
 it('maps agent groups',()=>expect(buildDrillDownSearch('By agent','none',range).agent).toBe('none'));
 it('validates dates outcomes and yes/no filters',()=>{expect(parseQueueSearch({received_from:'2026-02-30',received_to:'x',resolved:'maybe',within_deadline:'yes',outcome:'invalid'})).toMatchObject({received_from:undefined,received_to:undefined,resolved:undefined,within_deadline:'yes',outcome:undefined});expect(parseQueueSearch({...range,received_from:range.from,received_to:range.to,root_cause:'Legacy cause',resolved:'no'})).toMatchObject({received_from:range.from,received_to:range.to,root_cause:'Legacy cause',resolved:'no'});});
 it('uses weekly buckets below 100 days and months for longer periods',()=>{expect(reportBuckets(range).unit).toBe('week');expect(reportBuckets(range).buckets.at(-1)?.to).toBe('2026-01-31');const year=reportBuckets({from:'2024-01-01',to:'2024-12-31'});expect(year.unit).toBe('month');expect(year.buckets).toHaveLength(12);expect(year.buckets[1]?.to).toBe('2024-02-29');});
});
