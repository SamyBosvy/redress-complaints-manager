import type { AppRole } from './org';
import { firmDate } from './reopening';
import { auditDateBoundary } from './audit';
import { acknowledgedAt, type ResponseLetter, type ResponseEvent } from './response-metrics';

export const DAY_SECTIONS = ['overdue', 'soon', 'ack', 'qa', 'returned', 'adr', 'assigned', 'vulnerable', 'open', 'week'] as const;
export type DaySection = typeof DAY_SECTIONS[number];
export const DAY_LABELS: Record<DaySection, string> = { overdue:'Overdue', soon:'Due today and next 3 business days', ack:'Acknowledgements due', qa:'Waiting on QA', returned:'Sent back by QA', adr:'ADR responses due', assigned:'Recently assigned to me', vulnerable:'Vulnerable customers', open:'Open cases', week:'Due this week' };
export const DAY_OPEN = ['received','acknowledged','under_investigation','holding_response_sent','pending_qa','reopened'];
export const canUseMyDay = (role: AppRole | null | undefined) => role === 'agent' || role === 'complaints_manager' || role === 'org_admin';
export const defaultLanding = (role: AppRole | null | undefined) => role === 'agent' ? '/app/my-day' as const : '/app' as const;
export function addDay(day:string, amount:number) { const d=new Date(day+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+amount);return d.toISOString().slice(0,10); }
export function nextBusinessDate(day:string, count:number, holidays:readonly string[]=[]) { let date=day;let left=count;while(left>0){date=addDay(date,1);const dow=new Date(date+'T12:00:00Z').getUTCDay();if(dow!==0&&dow!==6&&!holidays.includes(date))left--;}return date; }
export function dayContext(zone:string, now=new Date()) { const today=firmDate(now,zone);return {today,zone,qaFrom:auditDateBoundary(addDay(today,-13),zone),assignmentFrom:auditDateBoundary(addDay(today,-6),zone),until:auditDateBoundary(today,zone,true)}; }
export function dayLink(section:DaySection, user:string, today:string, zone:string) {return {tab:'all' as const,agent:user,day_section:section,day_date:today,day_zone:zone};}
export type DayOp = {column:string;op:'eq'|'in'|'gte'|'lt'|'lte'|'is';value:string|number|boolean|null|readonly string[]};
export function dayFilterOps(section:DaySection,user:string,today:string,zone:string):DayOp[] {
  const ops:DayOp[]=[{column:'assigned_to',op:'eq',value:user}];
  const add=(column:string,op:DayOp['op'],value:DayOp['value'])=>ops.push({column,op,value});
  const c=dayContext(zone,new Date(auditDateBoundary(today,zone)));
  if(!['adr','assigned','returned'].includes(section))add('status','in',DAY_OPEN);
  if(section==='overdue')add('current_due','lt',today);
  if(section==='soon'){add('days_left','gte',0);add('days_left','lte',3);add('current_due','gte',today);}
  if(section==='week'){const dow=new Date(today+'T12:00:00Z').getUTCDay();add('current_due','gte',today);add('current_due','lte',addDay(today,(7-dow)%7));}
  if(section==='ack')add('ack_due','lte',addDay(today,1));
  if(section==='qa')add('status','eq','pending_qa');
  if(section==='vulnerable'){add('vulnerable','eq',true);add('complaint_vulnerability.review_by','lte',today);}
  if(section==='adr'){add('adr_cases.firm_response_sent_on','is',null);add('adr_cases.firm_response_due','gte',today);add('adr_cases.firm_response_due','lte',addDay(today,7));}
  if(section==='returned'){add('qa_reviews.status','eq','returned');add('qa_reviews.decided_at','gte',c.qaFrom);add('qa_reviews.decided_at','lt',c.until);}
  if(section==='assigned'){add('complaint_events.kind','eq','reassigned');add('complaint_events.detail->>after','eq',user);add('complaint_events.created_at','gte',c.assignmentFrom);add('complaint_events.created_at','lt',c.until);}
  return ops;
}
export function daySelect(base:string,section:DaySection) {return base+(section==='vulnerable'?',complaint_vulnerability!inner(adjustments,review_by)':section==='adr'?',adr_cases!inner(firm_response_due,firm_response_sent_on)':section==='returned'?',qa_reviews!inner(status,decided_at,comments)':section==='assigned'?',complaint_events!inner(kind,detail,created_at)':'');}
export function pendingAcknowledgements<T extends {id:string|null;ack_due:string|null}>(rows:T[],letters:ResponseLetter[],events:ResponseEvent[]) {return rows.filter(r=>r.id&&!acknowledgedAt(r.id,letters,events));}