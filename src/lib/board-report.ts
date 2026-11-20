import { z } from 'zod';
import { periodRange, previousPeriod, comparison, regulatoryReport, computeMetrics, resolutionDays, projectReportRows, type fetchReportData, type PeriodRange, type ReportRow } from './reports';
import { responseMetrics } from './response-metrics';
import { firmDate } from './reopening';
import { qaAnalytics, qaCriterion, type QaAnalyticsRow } from './qa-analytics';
import { adrMetrics } from './adr';
import { reopeningMetrics } from './reopening';
export const boardWriter = (role: string | null) => role === 'org_admin' || role === 'complaints_manager';
export const boardReader = (role: string | null) => boardWriter(role) || role === 'read_only' || role === 'qa_reviewer';
export const commentarySchema = z.object({ keyThemes:z.string().max(2000), actionsTaken:z.string().max(2000), actionsPlanned:z.string().max(2000) }).strict();
export const emptyCommentary = {keyThemes:'',actionsTaken:'',actionsPlanned:''};
export const boardInputSchema = z.object({org:z.string().uuid(),id:z.string().uuid().optional(),from:z.string().regex(/^\d{4}-\d{2}-\d{2}$/),to:z.string().regex(/^\d{4}-\d{2}-\d{2}$/),quarter:z.boolean(),title:z.string().trim().min(2).max(160),commentary:commentarySchema}).refine(v=>v.from<=v.to&&[v.from,v.to].every(d=>Number.isFinite(Date.parse(d))&&new Date(d).toISOString().slice(0,10)===d),'Invalid period');
export type BoardInput=z.infer<typeof boardInputSchema>;
export type BoardCell = number | string | null;
export type BoardTable = {title:string;headers:string[];rows:BoardCell[][]};
export type BoardMetric = {label:string;unit:string;value:BoardCell;previous:BoardCell;yearAgo:BoardCell;change:BoardCell;changePct:BoardCell;yearChange:BoardCell;yearChangePct:BoardCell};
export type BoardSnapshot = {schema:1;firm:string;logo:string|null;title:string;range:PeriodRange;previousRange:PeriodRange;yearRange:PeriodRange;headlines:BoardMetric[];tables:BoardTable[];commentary:z.infer<typeof commentarySchema>;methodology:string[]};
export const smallCell=(value:number|null,count:number):BoardCell=>count<3?'<3':value;
export function lastBoardQuarter(zone:string,now=new Date()){return periodRange('last_quarter',firmDate(now,zone));}
export function yearAgoRange(range:PeriodRange):PeriodRange {
 const shift=(day:string)=>{const d=new Date(day+'T00:00:00Z');const year=d.getUTCFullYear()-1;const last=new Date(Date.UTC(year,d.getUTCMonth()+1,0)).getUTCDate();return new Date(Date.UTC(year,d.getUTCMonth(),Math.min(d.getUTCDate(),last))).toISOString().slice(0,10);};
 return {...range,from:shift(range.from),to:shift(range.to)};
}
export function boardQuarters(range:PeriodRange){let r=periodRange('this_quarter',range.to);const result:PeriodRange[]=[];for(let i=0;i<8;i++){result.unshift(r);r=previousPeriod(r);}return result;}
type Data=Awaited<ReturnType<typeof fetchReportData>>;
export function buildBoardSnapshot(data:Data,qa:QaAnalyticsRow[],range:PeriodRange,zone:string,firm:string,title:string,commentary:z.infer<typeof commentarySchema>,logo:string|null=null):BoardSnapshot{
 const prior=previousPeriod(range),year=yearAgoRange(range);
 const calculate=(r:PeriodRange)=>{
  // Keep the regulatory pack's cohort, recorded-deadline, historical-status and rounding definitions.
  const rows=projectReportRows(data,r.to,zone).map(row=>({...row,root_cause_category:data.causes.find(c=>c.id===row.root_cause_id)?.name??null}));
  const pack=regulatoryReport(rows,r,data.holidays,data.adr,data.reopenings,zone);
  const cohort=rows.filter(row=>row.received_at.slice(0,10)>=r.from&&row.received_at.slice(0,10)<=r.to);
  const resolved=cohort.filter(row=>row.closed_at&&row.closed_at.slice(0,10)<=r.to);
  const metric=(label:string)=>pack.summary.find(s=>s.label===label)?.value??null;
  const quality=qaAnalytics(qa,r,zone);
  const uphold=computeMetrics(resolved).upholdRatePct;
  return {rows,pack,cohort,resolved,quality,metric,uphold};
 };
 const current=calculate(range),previous=calculate(prior),lastYear=calculate(year);
 const metrics=(c:ReturnType<typeof calculate>)=>[
  ...c.pack.summary.filter(s=>['Complaints received','Resolved','Open at period end','Resolved within deadline','Acknowledged on time'].includes(s.label)||s.label.startsWith('Redress paid — ')||s.label.startsWith('Goodwill paid — ')),
  {label:'Uphold rate',value:c.uphold,unit:'%'},
 ];
 const sets=[metrics(current),metrics(previous),metrics(lastYear)];
 const headlines=[...new Set(sets.flatMap(s=>s.map(m=>m.label)))].map(label=>{
  const a=sets[0]?.find(m=>m.label===label),b=sets[1]?.find(m=>m.label===label),c=sets[2]?.find(m=>m.label===label),currency=label.includes(' paid — ');
  const value=a?.value??(currency?0:null),prev=b?.value??(currency?0:null),ago=c?.value??(currency?0:null);
  const p=comparison(value,prev),y=comparison(value,ago);
  return {label,unit:a?.unit??b?.unit??c?.unit??'',value,previous:prev,yearAgo:ago,change:p.absolute,changePct:p.percent,yearChange:y.absolute,yearChangePct:y.percent};
 });
 const tables:BoardTable[]=[];
 tables.push({title:'Trend — last 8 quarters',headers:['Quarter','Received','Resolved','Within deadline %','Uphold rate %'],rows:boardQuarters(range).map(r=>{const c=calculate(r);return [`${r.from.slice(0,4)} Q${Math.floor((Number(r.from.slice(5,7))-1)/3)+1}`,c.metric('Complaints received'),c.metric('Resolved'),c.metric('Resolved within deadline'),c.uphold];})});
 for(const title of ['By category','By product','By root cause']){
  const before=previous.pack.tables.find(t=>t.title===title)?.rows??[];
  tables.push({title,headers:['Group','Complaints','Share %','Previous','Change'],rows:(current.pack.tables.find(t=>t.title===title)?.rows??[]).slice(0,5).map(row=>{
   const p=before.find(b=>b.label===row.label)?.count??0;return [row.label,smallCell(row.count,row.count),smallCell(row.share,row.count),smallCell(p,p),row.count<3||p<3?'<3':row.count-p];
  })});
 }
 const outcomes=['upheld','partially_upheld','not_upheld','withdrawn'];
 tables.push({title:'Customer outcomes',headers:['Outcome','Complaints','Share %'],rows:outcomes.map(outcome=>{const n=current.resolved.filter(r=>r.outcome===outcome).length;return [outcome.replaceAll('_',' '),smallCell(n,n),smallCell(current.resolved.length?n/current.resolved.length*100:null,n)];})});
 const durations=current.resolved.flatMap(r=>{const days=resolutionDays(r,data.holidays);return days===null?[]:[days];}).sort((a,b)=>a-b);
 const open=current.rows.filter(r=>r.received_at.slice(0,10)<=range.to&&!r.closed_at);
 const ages=open.map(r=>resolutionDays({...r,closed_at:range.to},data.holidays)??0);
 tables.push({title:'Resolution and ageing',headers:['Measure','Value'],rows:[['Average business days to final response',current.metric('Average days to resolve')],['90th percentile business days',durations.length?durations[Math.ceil(durations.length*.9)-1]??null:null],['Holding responses issued',responseMetrics(current.rows,range,data.holidays,zone).holdingLetters.length],...[[0,15],[16,35],[36,Infinity]].map(([min,max])=>{const n=ages.filter(d=>d>=Number(min)&&d<=Number(max)).length;return [min===36?'>35 business days':`${min}–${max} business days`,smallCell(n,n)];})]});
 const support=current.cohort.filter(r=>r.vulnerable),supportPack=regulatoryReport(current.rows.filter(r=>r.vulnerable),range,data.holidays,[],[],zone);
 tables.push({title:'Vulnerable customers',headers:['Measure','Value'],rows:[['Complaints with support needs',smallCell(support.length,support.length)],['Share of complaints %',smallCell(current.cohort.length?support.length/current.cohort.length*100:null,support.length)],['Within deadline — support needs %',smallCell(supportPack.summary.find(s=>s.label==='Resolved within deadline')?.value??null,current.resolved.filter(r=>r.vulnerable&&r.final_due!==null).length)],['Within deadline — all %',current.metric('Resolved within deadline')]]});
 const failure=current.quality.failures[0];
 const am=adrMetrics(data.adr,range),rm=reopeningMetrics(data.reopenings,range,current.resolved.length);
 const affected=new Set(current.quality.rows.filter(r=>failure&&qaCriterion(r,failure.key)['result']==='fail').map(r=>r.complaint_id)).size;
 tables.push({title:'Escalations and quality',headers:['Measure','Value'],rows:[...['Escalated to ADR','ADR decisions','ADR overturn rate','Reopened','Reopen rate'].map(label=>{const count=label==='Escalated to ADR'?new Set(am.escalated.map(r=>r.complaint_id)).size:label.startsWith('ADR')?new Set(am.decided.map(r=>r.complaint_id)).size:rm.count;return [label,smallCell(current.metric(label),count)];}),['QA pass rate %',smallCell(current.quality.passRate,new Set(current.quality.rows.map(r=>r.complaint_id)).size)],['Most-failed scorecard item',failure?affected<3?'<3':failure.label:null]]});
 return {schema:1,firm,logo,title,range,previousRange:prior,yearRange:year,headlines,tables,commentary:commentarySchema.parse(commentary),methodology:[
  'Figures reuse the existing regulatory report, response, QA, ADR and reopening calculations. Received cohorts use UTC dates, as in the existing pack; quarter selection and acknowledgement/QA evidence use the firm time zone.',
  'Resolved includes final response, closure or ADR escalation. Historical status uses event evidence; classifications, outcomes, deadlines and payments reflect current working records. Issued versions freeze the rendered figures.',
  'Uphold rate is upheld plus partially upheld divided by decided outcomes, excluding withdrawn. Resolution time uses the recorded resolution in the current handling cycle, excluding weekends and configured country holidays.',
  'Redress and goodwill remain separate by recorded currency, including unspecified currency. They are recorded awards, not a payment ledger.',
  'Breakdown cells based on fewer than three complaints are suppressed, including percentages and comparisons; no personal case information is included. Management commentary must contain only aggregate themes and actions.',
 ]};
}
export function boardCsvRows(s:BoardSnapshot,version:number,hash:string):(string|number)[][]{
 const value=(v:BoardCell)=>v===null?'n/a':v;
 return [['Board report',s.title],['Firm',s.firm],['Period',s.range.from,s.range.to],['Version',version],['Snapshot SHA-256',hash],[],['Metric','Value','Unit','Previous','Change','Change %','Year ago','Year change','Year change %'],...s.headlines.map(m=>[m.label,value(m.value),m.unit,value(m.previous),value(m.change),value(m.changePct),value(m.yearAgo),value(m.yearChange),value(m.yearChangePct)]),...s.tables.flatMap(t=>[[],[t.title],t.headers,...t.rows.map(r=>r.map(value))]),[],['Key themes',s.commentary.keyThemes],['Actions taken',s.commentary.actionsTaken],['Actions planned',s.commentary.actionsPlanned]];
}