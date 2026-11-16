import { auditDateBoundary, auditObject, maskAuditValue } from './audit';
import { firmDate } from './reopening';
import type { ReportSearch, PeriodRange } from './reports';
import type { QaReview } from './qa';

export const QA_CRITERIA = [['accuracy','Accuracy'],['fair_outcome','Fair outcome'],['clear_communication','Clear communication'],['deadlines_met','Deadlines met'],['adr_rights','ADR rights given']] as const;
export type QaAnalyticsRow = QaReview & { assigned_to_at_review?: string | null; complaints: { reference: string; complainant_name: string; assigned_to: string | null } | null; letters?: { sent_by: string } | null };
export type QaSearch = ReportSearch & { view?: 'list'|'analytics'; agent?: string; reviewer?: string; criterion?: string; result?: 'pass'|'fail'; kind?: 'approval'|'sample'; decided?: boolean };
export const QA_METHODOLOGY = [
  'Decided reviews are approved, returned, passed or failed with a decision timestamp, grouped by the firm-local decision date. Pass means approved or passed; rates exclude pending reviews.',
  'Handler attribution: stored handler at review time, otherwise letter sent_by, otherwise current complaint assigned_to. No historical handler column currently exists; sampling attribution can change after reassignment. Agent views include only their attributed reviews.',
  'Criterion rates count only explicit pass/fail scorecard results. Missing or erased scorecards are excluded. Turnaround is elapsed hours from review creation (QA requested) to decision; invalid or negative intervals are excluded.',
  'Failure examples use up to three latest non-empty notes per criterion; personal identifiers are masked for non-admins. Comparison uses the Reports previous-period rules. Handler filters are applied after paginated reads because attribution is derived; other available columns and scorecard paths are filtered in the database.',
];
export function parseQaSearch(raw: Record<string,unknown>): QaSearch {
  const date=(v:unknown)=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v)&&Number.isFinite(Date.parse(v))&&new Date(v).toISOString().slice(0,10)===v?v:undefined;
  const uuid=(v:unknown)=>typeof v==='string'&&(/^[a-f\d]{8}-(?:[a-f\d]{4}-){3}[a-f\d]{12}$/i.test(v)||v==='unassigned')?v:undefined;
  return {period:typeof raw['period']==='string'?raw['period']:undefined,from:date(raw['from']),to:date(raw['to']),compare:raw['compare']===true||raw['compare']==='true',view:raw['view']==='analytics'?'analytics':'list',agent:uuid(raw['agent']),reviewer:uuid(raw['reviewer']),criterion:QA_CRITERIA.some(([k])=>k===raw['criterion'])?String(raw['criterion']):undefined,result:raw['result']==='pass'||raw['result']==='fail'?raw['result']:undefined,kind:raw['kind']==='approval'||raw['kind']==='sample'?raw['kind']:undefined,decided:raw['decided']===true||raw['decided']==='true'};
}
export function qaHandler(row: QaAnalyticsRow): string | null { return row.assigned_to_at_review ?? row.letters?.sent_by ?? row.complaints?.assigned_to ?? null; }
export function qaOwnRows(rows: QaAnalyticsRow[], role: string | null, userId: string) { return role==='agent'?rows.filter(r=>qaHandler(r)===userId):rows; }
export const qaPassed=(r:QaAnalyticsRow)=>r.status==='approved'||r.status==='passed';
export const qaDecided=(r:QaAnalyticsRow)=>!!r.decided_at&&['approved','returned','passed','failed'].includes(r.status);
export function qaCriterion(r:QaAnalyticsRow,key:string) { return auditObject(auditObject(r.scorecard)[key]); }
export function matchesQaFilters(row:QaAnalyticsRow,s:QaSearch,zone:string) {
  if ((s.decided||s.from||s.to||s.result) && !qaDecided(row)) return false;
  const day=row.decided_at?firmDate(new Date(row.decided_at),zone):'';
  return (!s.from||day>=s.from)&&(!s.to||day<=s.to)&&(!s.agent||(qaHandler(row)??'unassigned')===s.agent)&&(!s.reviewer||(row.reviewer??'unassigned')===s.reviewer)&&(!s.kind||row.kind===s.kind)&&(!s.result||qaPassed(row)===(s.result==='pass'))&&(!s.criterion||qaCriterion(row,s.criterion)['result']==='fail');
}
export function qaFilterOps(s:QaSearch,zone:string) {
  const ops:{op:'gte'|'lt'|'eq'|'in'|'is';column:string;value:string|string[]|null}[]=[];
  if(s.from)ops.push({op:'gte',column:'decided_at',value:auditDateBoundary(s.from,zone)});
  if(s.to)ops.push({op:'lt',column:'decided_at',value:auditDateBoundary(s.to,zone,true)});
  if(s.decided||s.from||s.to||s.result)ops.push({op:'in',column:'status',value:s.result==='pass'?['approved','passed']:s.result==='fail'?['returned','failed']:['approved','passed','returned','failed']});
  if(s.reviewer)ops.push({op:s.reviewer==='unassigned'?'is':'eq',column:'reviewer',value:s.reviewer==='unassigned'?null:s.reviewer});
  if(s.kind)ops.push({op:'eq',column:'kind',value:s.kind});
  if(s.criterion)ops.push({op:'eq',column:`scorecard->${s.criterion}->>result`,value:'fail'});
  return ops;
}
export function qaDrillDown(range:PeriodRange,filters:Partial<QaSearch>={}):QaSearch { return {view:'list',period:'custom',from:range.from,to:range.to,decided:true,...filters}; }
export async function fetchQaPages<T>(page:(offset:number,end:number)=>PromiseLike<{data:T[]|null;error:unknown}>) {
  const rows:T[]=[];
  for(let offset=0;;offset+=500){const {data,error}=await page(offset,offset+499);if(error)throw error;rows.push(...data??[]);if((data?.length??0)<500)return rows;}
}
const pct=(n:number,d:number)=>d?Math.round(n/d*1000)/10:null;
export function qaMedian(values:number[]) { const a=values.filter(Number.isFinite).sort((x,y)=>x-y),i=Math.floor(a.length/2);return a.length?(a.length%2?a[i]??null:((a[i-1]??0)+(a[i]??0))/2):null; }
export function qaTurnaround(r:QaAnalyticsRow) {const hours=(Date.parse(r.decided_at??'')-Date.parse(r.created_at))/3600000;return Number.isFinite(hours)&&hours>=0?hours:null;}
export function qaAnalytics(all:QaAnalyticsRow[],range:PeriodRange,zone:string,role:string|null='org_admin',userId='') {
  const rows=qaOwnRows(all,role,userId).filter(r=>matchesQaFilters(r,qaDrillDown(range),zone));
  const stats=(group:QaAnalyticsRow[])=>({reviews:group.length,passRate:pct(group.filter(qaPassed).length,group.length),median:qaMedian(group.flatMap(r=>{const h=qaTurnaround(r);return h===null?[]:[h];}))});
  const criteria=QA_CRITERIA.map(([key,label])=>{const reviewed=rows.filter(r=>['pass','fail'].includes(String(qaCriterion(r,key)['result']))),failed=reviewed.filter(r=>qaCriterion(r,key)['result']==='fail');return {key,label,reviewed:reviewed.length,failed:failed.length,passRate:pct(reviewed.length-failed.length,reviewed.length),notes:[...failed].sort((a,b)=>String(b.decided_at).localeCompare(String(a.decided_at))).flatMap(r=>{const note=qaCriterion(r,key)['note'];return typeof note==='string'&&note.trim()?[String(maskAuditValue(note,'note',role==='org_admin'))]:[];}).slice(0,3)};});
  const groups=(key:(r:QaAnalyticsRow)=>string|null)=>[...new Set(rows.map(r=>key(r)??'unassigned'))].map(id=>{const group=rows.filter(r=>(key(r)??'unassigned')===id);const failures=QA_CRITERIA.map(([k,label])=>({key:k,label,count:group.filter(r=>qaCriterion(r,k)['result']==='fail').length})).sort((a,b)=>b.count-a.count);return {id,...stats(group),mostFailed:failures[0]?.count?failures[0]:null};});
  return {rows,...stats(rows),approval:stats(rows.filter(r=>r.kind==='approval')),sample:stats(rows.filter(r=>r.kind==='sample')),criteria,agents:groups(qaHandler),reviewers:groups(r=>r.reviewer),failures:criteria.filter(c=>c.failed).sort((a,b)=>b.failed-a.failed)};
}
export function qaAnalyticsTables(m:ReturnType<typeof qaAnalytics>,name:(id:string)=>string=(id)=>id) {
  return [{title:'QA summary',headers:['Metric','Value'],rows:[['Reviews decided',m.reviews],['Overall pass rate %',m.passRate??'n/a'],['Letter approval rate %',m.approval.passRate??'n/a'],['Sampling pass rate %',m.sample.passRate??'n/a'],['Median turnaround hours',m.median??'n/a']]},
    {title:'QA per criterion',headers:['Criterion','Reviewed','Failed','Pass rate %'],rows:m.criteria.map(c=>[c.label,c.reviewed,c.failed,c.passRate??'n/a'])},
    {title:'QA by agent',headers:['Agent','Reviews','Pass rate %','Most-failed criterion'],rows:m.agents.map(g=>[name(g.id),g.reviews,g.passRate??'n/a',g.mostFailed?.label??'n/a'])},
    {title:'QA by reviewer',headers:['Reviewer','Reviews','Pass rate %','Median hours'],rows:m.reviewers.map(g=>[name(g.id),g.reviews,g.passRate??'n/a',g.median??'n/a'])},
    {title:'QA failure notes',headers:['Criterion','Failures','Recent examples'],rows:m.failures.map(c=>[c.label,c.failed,c.notes.join(' / ')])}] as {title:string;headers:string[];rows:(string|number)[][]}[];
}