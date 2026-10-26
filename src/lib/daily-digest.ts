import type {AppRole} from './org';
import {clockTone,isAtRisk,type Status} from './complaints';

export type DigestMember={org_id:string;user_id:string;role:AppRole;active:boolean};
export type DigestCase={id:string;org_id:string;reference:string;assigned_to:string|null;status:Status;days_left:number|null;current_due:string|null};
export type DigestReview={org_id:string;complaint_id:string;kind:string;status:string};
export type DailyDigest={orgId:string;userId:string;atRisk:DigestCase[];overdue:DigestCase[];awaitingQa:DigestCase[]};

/** One recipient only. No delivery, scheduling, persistence, or recipient-list broadcasting. */
export function selectDailyDigest(member:DigestMember,cases:readonly DigestCase[],reviews:readonly DigestReview[]):DailyDigest|null {
  if(!member.active)return null;
  const orgCases=cases.filter(c=>c.org_id===member.org_id);
  // Agents see their assigned work; supervisory/read-only roles see the firm's clocks.
  const visible=orgCases.filter(c=>member.role!=='agent'||c.assigned_to===member.user_id);
  const canReview=['org_admin','complaints_manager','qa_reviewer'].includes(member.role);
  const pending=new Set(reviews.filter(r=>r.org_id===member.org_id&&r.kind==='approval'&&r.status==='pending').map(r=>r.complaint_id));
  const order=(rows:DigestCase[])=>rows.sort((a,b)=>(a.days_left??Infinity)-(b.days_left??Infinity)||a.reference.localeCompare(b.reference));
  const digest:DailyDigest={orgId:member.org_id,userId:member.user_id,
    atRisk:order(visible.filter(c=>isAtRisk(c.days_left,c.status))),
    overdue:order(visible.filter(c=>clockTone(c.days_left,c.status)==='overdue')),
    awaitingQa:canReview?order(orgCases.filter(c=>c.status==='pending_qa'&&pending.has(c.id))):[]};
  return digest.atRisk.length||digest.overdue.length||digest.awaitingQa.length?digest:null;
}