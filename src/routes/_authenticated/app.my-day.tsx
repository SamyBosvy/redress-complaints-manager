import { MyMentions } from '@/components/my-mentions';
import { ReopenRequestList } from '@/components/reopen-request-list';
import { ADJUSTMENTS } from '@/lib/vulnerability';
import { useEffect, useRef, useState } from 'react';
import { SetupProgress } from '@/components/setup-progress';
import { createFileRoute, Link } from '@tanstack/react-router';
import { useSuspenseQuery } from '@tanstack/react-query';
import { membershipQuery, useMembership } from '@/lib/org';
import { canUseMyDay, DAY_LABELS, DAY_SECTIONS, dayContext, dayLink } from '@/lib/my-day';
import { myDayQuery } from '@/lib/my-day-query';
import { maskAuditValue } from '@/lib/audit';
import { shortcutsBlocked } from '@/lib/shortcuts';
import { StatusPill } from '@/components/status-pill';
import { DeadlineClock } from '@/components/deadline-clock';
import { EmptyState } from '@/components/empty-state';
import { TableSkeleton } from '@/components/table-skeleton';
import { Button } from '@/components/ui/button';
import type { Status } from '@/lib/complaints';

export const Route=createFileRoute('/_authenticated/app/my-day')({
 loader:async({context})=>{const m=await context.queryClient.ensureQueryData(membershipQuery);if(!m?.org||!canUseMyDay(m.role))return;const c=dayContext(m.org.time_zone);await context.queryClient.ensureQueryData(myDayQuery(m.org.id,m.user.id,c.today,c.zone));},
 head:()=>({meta:[{title:'My day — Redress'},{name:'description',content:'Your personal complaints, deadlines and QA reminders.'},{property:'og:title',content:'My day — Redress'},{property:'og:description',content:'Your personal complaints, deadlines and QA reminders.'},{property:'og:type',content:'website'},{name:'twitter:card',content:'summary'}]}),
 pendingComponent:()=> <TableSkeleton />,
 component:MyDay,
});
function MyDay(){const m=useMembership();if(!m?.org||!canUseMyDay(m.role))return m?.org ? <div className="mx-auto min-w-0 max-w-6xl"><h1 className="text-2xl font-semibold">My day</h1><MyMentions org={m.org.id} user={m.user.id}/></div> : null;return <DayContent org={m.org.id} user={m.user.id} zone={m.org.time_zone} admin={m.role==='org_admin'} agent={m.role==='agent'} name={String(m.user.user_metadata['full_name']??'').split(' ')[0]??''}/>;}
function DayContent({org,user,zone,admin,agent,name}:{org:string;user:string;zone:string;admin:boolean;agent:boolean;name:string}){
 const [today,setToday]=useState(()=>dayContext(zone).today);
 const {data,isRefetchError}=useSuspenseQuery(myDayQuery(org,user,today,zone));
 const container=useRef<HTMLDivElement>(null);
 useEffect(()=>{const update=()=>{if(document.visibilityState==='visible')setToday(dayContext(zone).today);};const timer=window.setInterval(update,120_000);document.addEventListener('visibilitychange',update);return()=>{clearInterval(timer);document.removeEventListener('visibilitychange',update);};},[zone]);
 useEffect(()=>{const handler=(e:KeyboardEvent)=>{if(shortcutsBlocked(e.target)||e.ctrlKey||e.metaKey||e.altKey||e.repeat||!['j','k'].includes(e.key.toLowerCase()))return;const rows=Array.from(container.current?.querySelectorAll<HTMLAnchorElement>('[data-day-row]')??[]);const i=rows.findIndex(r=>r===document.activeElement||r.contains(document.activeElement));const next=i<0?(e.key.toLowerCase()==='j'?0:rows.length-1):Math.max(0,Math.min(rows.length-1,i+(e.key.toLowerCase()==='j'?1:-1)));if(rows[next]){e.preventDefault();rows[next]?.focus();rows[next]?.scrollIntoView({block:'nearest'});}};window.addEventListener('keydown',handler);return()=>window.removeEventListener('keydown',handler);},[]);
 return <div ref={container} className="mx-auto min-w-0 max-w-6xl">
  <SetupProgress />
  <header><p className="text-sm text-muted-foreground">Hello{name?`, ${name}`:''}</p><h1 className="mt-1 text-2xl font-semibold">My day</h1><p className="mt-1 text-sm text-muted-foreground">{new Date(today+'T12:00:00Z').toLocaleDateString('en-GB',{timeZone:'UTC',weekday:'long',day:'numeric',month:'long',year:'numeric'})}</p></header>
  <MyMentions org={org} user={user}/>
  {agent&&<ReopenRequestList org={org} user={user}/>}
  <dl className="my-6 grid grid-cols-3 gap-3 border-y py-4">{(['open','overdue','week'] as const).map(s=><div key={s}><dt className="text-xs text-muted-foreground">{DAY_LABELS[s]}</dt><dd className="mt-1 text-2xl font-semibold tabular"><Link to="/app" search={dayLink(s,user,today,zone)} className="hover:text-primary">{data[s].total}</Link></dd></div>)}</dl>
  {isRefetchError&&<p role="status" className="mb-4 text-sm text-destructive">Could not refresh reminders. Your last results are still shown.</p>}
  <div className="grid min-w-0 gap-x-8 gap-y-6 lg:grid-cols-2">{DAY_SECTIONS.filter(s=>s!=='open'&&s!=='week').map(section=><section key={section} className="min-w-0 border-t pt-4" aria-label={DAY_LABELS[section]}>
   <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="text-base font-semibold">{DAY_LABELS[section]} <span className="text-muted-foreground tabular">({data[section].limited?'≥':''}{data[section].total})</span></h2><Button asChild variant="link" size="sm"><Link to="/app" search={dayLink(section,user,today,zone)}>View all</Link></Button></div>
   {section==='ack'&&<p className="mt-1 text-xs text-muted-foreground">Acknowledgement evidence checked for up to 200 open assigned cases{data.ack.limited?'; this list is incomplete':''}.</p>}
   {!data[section].rows.length?<EmptyState title="Nothing due here" description="No matching cases in your caseload."/>:<ul className="mt-2 divide-y">{data[section].rows.map(row=>row.id&&<li key={row.id}><Link data-day-row to="/app/c/$id" params={{id:row.id}} className="block min-w-0 rounded-md py-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring hover:bg-muted/50">
    <div className="flex flex-wrap items-center justify-between gap-2"><span className="font-mono text-xs">{row.reference}</span><span className="text-xs capitalize text-muted-foreground">{row.priority??'normal'} priority</span></div>
    <p className="my-1 break-words text-sm font-medium">{row.complainant_name}</p><div className="flex flex-wrap items-center justify-between gap-2"><StatusPill status={row.status as Status}/><DeadlineClock status={row.status as Status} daysLeft={row.days_left} due={row.current_due} receivedAt={row.received_at}/></div>
    {section==='vulnerable'&&row.complaint_vulnerability?.map((needs,i)=><p key={i} className="mt-2 text-xs">Review due {needs.review_by} · {needs.adjustments.map(key=>ADJUSTMENTS[key as keyof typeof ADJUSTMENTS]??key).join(', ')||'Support assessment'}</p>)}
    {section==='adr'&&row.adr_cases?.firm_response_due&&<p className="mt-2 text-xs">ADR response due {row.adr_cases.firm_response_due}</p>}
    {section==='returned'&&row.qa_reviews?.slice().sort((a,b)=>String(b.decided_at).localeCompare(String(a.decided_at)))[0]?.comments&&<p className="mt-2 break-words text-xs text-muted-foreground">{String(maskAuditValue(row.qa_reviews.slice().sort((a,b)=>String(b.decided_at).localeCompare(String(a.decided_at)))[0]?.comments,'comments',admin))}</p>}
   </Link></li>)}</ul>}
  </section>)}</div>
 </div>;
}
