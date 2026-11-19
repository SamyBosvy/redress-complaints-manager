import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { caseRequestsQuery, canDecideRequests } from '@/lib/reopen-requests';
import { REOPEN_REASONS } from '@/lib/reopening';
import { Button } from './ui/button';
import { Textarea } from './ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from './ui/dialog';
import { AccessibleField } from './accessible-field';
export function CaseReopenRequests({org,id,user,role,defaultMode,onSaved}:{org:string;id:string;user:string;role:string|null;defaultMode:string;onSaved:()=>Promise<unknown>}){
 const qc=useQueryClient();const q=useQuery(caseRequestsQuery(org,id));
 const eligible=useQuery({queryKey:['reopen-eligible',org,id,user],enabled:role==='agent',queryFn:async()=>{const {data,error}=await supabase.rpc('can_request_reopen',{_org:org,_case:id});if(error)throw error;return data;}});
 const [action,setAction]=useState<'request'|'approved'|'rejected'|null>(null),[category,setCategory]=useState('new_evidence'),[reason,setReason]=useState(''),[note,setNote]=useState(''),[mode,setMode]=useState(defaultMode),[busy,setBusy]=useState(false);
 const pending=q.data?.[0];
 const preview=useQuery({queryKey:['reopen-preview',org,id,mode],enabled:action==='approved',queryFn:async()=>{const {data,error}=await supabase.rpc('reopen_deadlines',{_org:org,_case:id,_mode:mode});if(error)throw error;return data as Record<string,string|number|null>;}});
 async function perform(withdraw=false){setBusy(true);try{
  const result=withdraw&&pending?await supabase.rpc('withdraw_reopen_request',{_request:pending.id}):action==='request'?await supabase.rpc('request_reopen',{_org:org,_case:id,_category:category,_reason:reason}):pending&&action?await supabase.rpc('decide_reopen_request',{_request:pending.id,_decision:action,...(note.trim()?{_note:note.trim()}:{}),_mode:mode}):null;
  if(!result)return;if(result.error)throw result.error;setAction(null);setReason('');setNote('');
  await Promise.all([onSaved(),...['reopen-requests','reopen-eligible','reopenings','queue','queue-counts','my-day','notifications','regulatory-report','workload'].map(key=>qc.invalidateQueries({queryKey:[key]}))]);toast.success(withdraw?'Request withdrawn.':action==='request'?'Reopening requested.':`Request ${action}.`);
 }catch(e){toast.error((e as {message?:string})?.message??'Could not save the request.');}finally{setBusy(false);}}
 return <section className="mt-4 min-w-0" aria-label="Reopening request">
 {q.isError&&<p role="alert" className="text-sm text-destructive">Could not load reopening requests.</p>}
 {eligible.isError&&<p role="alert" className="text-sm text-destructive">Could not check reopening eligibility.</p>}
 {pending?<div className="border-l-4 border-warning bg-muted p-4"><h2 className="font-semibold">Reopening requested by {pending.requester_name}</h2><p className="mt-1 text-xs text-muted-foreground">{new Date(pending.created_at).toLocaleString('en-GB')} · {REOPEN_REASONS[pending.category as keyof typeof REOPEN_REASONS]}</p><p className="my-3 whitespace-pre-wrap break-words text-sm">{pending.reason}</p><div className="flex flex-wrap gap-2">{pending.requested_by===user?<Button variant="outline" disabled={busy} onClick={()=>void perform(true)}>Withdraw request</Button>:canDecideRequests(role)&&<><Button disabled={busy} onClick={()=>setAction('approved')}>Approve</Button><Button variant="outline" disabled={busy} onClick={()=>setAction('rejected')}>Reject</Button></>}</div></div>:q.isSuccess&&eligible.data&&<Button variant="outline" onClick={()=>setAction('request')}>Request reopening</Button>}
 <Dialog open={action!==null} onOpenChange={v=>{if(!v&&!busy)setAction(null);}}><DialogContent className="flex max-h-[90dvh] flex-col overflow-hidden"><DialogHeader><DialogTitle>{action==='request'?'Request reopening':action==='approved'?'Approve reopening':'Reject reopening'}</DialogTitle><DialogDescription>{action==='approved'?'The existing reopening rules apply.':'Record the reason for this request or decision.'}</DialogDescription></DialogHeader><div className="min-h-0 space-y-4 overflow-y-auto">
 {action==='request'&&<><AccessibleField label="Reason category"><Select value={category} onValueChange={setCategory}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent>{Object.entries(REOPEN_REASONS).map(([k,v])=><SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent></Select></AccessibleField><AccessibleField label="Reason"><Textarea value={reason} minLength={10} maxLength={2000} onChange={e=>setReason(e.target.value)}/></AccessibleField><p className="text-xs text-muted-foreground">{reason.trim().length}/2000</p></>}
 {action==='rejected'&&<AccessibleField label="Rejection note"><Textarea value={note} minLength={5} maxLength={1000} onChange={e=>setNote(e.target.value)}/></AccessibleField>}
 {action==='approved'&&<><AccessibleField label="Deadline mode"><Select value={mode} onValueChange={setMode}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent><SelectItem value="restart">Restart</SelectItem><SelectItem value="continue">Continue original deadline</SelectItem></SelectContent></Select></AccessibleField>{preview.isPending?<p role="status">Loading deadlines…</p>:preview.isError?<p role="alert">Could not preview deadlines.</p>:<dl className="space-y-2 text-sm">{(['ack_due','final_due','extended_due'] as const).map(k=><div key={k} className="flex flex-wrap justify-between gap-2"><dt>{{ack_due:'Acknowledgement',final_due:'Final response',extended_due:'Extended'}[k]}</dt><dd>{preview.data?.[k]??'—'}</dd></div>)}</dl>}</>}
 </div><DialogFooter className="shrink-0"><Button variant="outline" disabled={busy} onClick={()=>setAction(null)}>Cancel</Button><Button className="min-h-12 w-full sm:w-auto" disabled={busy||(action==='request'&&reason.trim().length<10)||(action==='rejected'&&note.trim().length<5)||(action==='approved'&&!preview.data)} onClick={()=>void perform()}>{busy?'Saving…':action==='request'?'Send request':action==='approved'?'Approve reopening':'Reject request'}</Button></DialogFooter></DialogContent></Dialog>
 </section>;
}