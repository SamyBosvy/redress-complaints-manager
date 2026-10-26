import {describe,expect,it} from 'vitest';
import {selectDailyDigest,type DigestCase,type DigestMember} from './daily-digest';
const member:DigestMember={org_id:'firm-a',user_id:'user-a',role:'org_admin',active:true};
const row=(id:string,days:number|null,status:DigestCase['status']='received',extra:Partial<DigestCase>={}):DigestCase=>({id,org_id:'firm-a',reference:id,assigned_to:'user-a',status,days_left:days,current_due:'2026-10-26',...extra});
const cases=[row('three',3),row('zero',0),row('four',4),row('late',-1),row('closed',-3,'closed'),row('unknown',null),row('qa',2,'pending_qa'),row('other-assignee',2,'received',{assigned_to:'user-b'}),row('other-firm',1,'received',{org_id:'firm-b'})];
const reviews=[{org_id:'firm-a',complaint_id:'qa',kind:'approval',status:'pending'}];
describe('Daily digest selection (no sends)',()=>{
  it('includes 0–3 business days at risk, but not 4, unknown or stopped clocks',()=>expect(selectDailyDigest(member,cases,reviews)?.atRisk.map(c=>c.id)).toEqual(['zero','other-assignee','qa','three']));
  it('includes negative business days only for running clocks',()=>expect(selectDailyDigest(member,cases,reviews)?.overdue.map(c=>c.id)).toEqual(['late']));
  it('excludes deactivated members and empty digests',()=>{expect(selectDailyDigest({...member,active:false},cases,reviews)).toBeNull();expect(selectDailyDigest(member,[row('safe',8)],[])).toBeNull();});
  it('limits agents to assigned cases and omits QA review requests',()=>{const d=selectDailyDigest({...member,role:'agent'},cases,reviews);expect(d?.atRisk.map(c=>c.id)).toEqual(['zero','qa','three']);expect(d?.awaitingQa).toEqual([]);});
  it.each(['org_admin','complaints_manager','qa_reviewer'] as const)('includes pending approvals for %s',role=>expect(selectDailyDigest({...member,role},cases,reviews)?.awaitingQa.map(c=>c.id)).toEqual(['qa']));
  it('gives read-only members firm clocks but no review requests',()=>{const d=selectDailyDigest({...member,role:'read_only'},cases,reviews);expect(d?.atRisk.some(c=>c.id==='other-assignee')).toBe(true);expect(d?.awaitingQa).toEqual([]);});
  it('requires a pending final-approval review in the same firm',()=>{expect(selectDailyDigest(member,cases,[{...reviews[0],status:'approved'}])?.awaitingQa).toEqual([]);expect(selectDailyDigest(member,cases,[{...reviews[0],kind:'sample'}])?.awaitingQa).toEqual([]);expect(selectDailyDigest(member,cases,[{...reviews[0],org_id:'firm-b'}])?.awaitingQa).toEqual([]);});
  it('never mixes firms',()=>expect(selectDailyDigest(member,cases,reviews)?.atRisk.some(c=>c.id==='other-firm')).toBe(false));
});