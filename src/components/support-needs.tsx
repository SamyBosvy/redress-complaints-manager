import { useState } from 'react';
import { useQuery, useQueryClient, queryOptions } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { ADJUSTMENTS, DRIVERS, SUPPORT_TEXT, supportAccess, vulnerabilitySchema, reviewDue } from '@/lib/vulnerability';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { TableSkeleton } from '@/components/table-skeleton';
import { toast } from 'sonner';
import type { Database } from '@/integrations/supabase/types';
type Row=Database['public']['Tables']['complaint_vulnerability']['Row'];
export function SupportNeeds({org,id,role,user,assigned,locked,zone,onSaved}:{org:string;id:string;role:string|null;user:string;assigned:string|null|undefined;locked:boolean;zone:string;onSaved:()=>Promise<unknown>}){
 const access=supportAccess(role,user,assigned);
 const q=useQuery(queryOptions({queryKey:['support-needs',org,id],enabled:access.read,queryFn:async()=>{const {data,error}=await supabase.from('complaint_vulnerability').select('*').eq('org_id',org).eq('complaint_id',id).maybeSingle();if(error)throw error;return data;}}));
 if(!access.read)return null;
 return <section className="border-t pt-5"><h2 className="mb-3 font-semibold">Support needs</h2>{q.isPending?<TableSkeleton columns={2}/>:q.isError?<p role="alert" className="text-sm text-destructive">Support needs could not be loaded.</p>:<SupportEditor key={`${id}:${q.data?.assessed_at??'new'}`} row={q.data??null} org={org} id={id} writable={access.write&&!locked} zone={zone} onSaved={async()=>{await q.refetch();await onSaved();}}/>}</section>;
}
function SupportEditor({row,org,id,writable,zone,onSaved}:{row:Row|null;org:string;id:string;writable:boolean;zone:string;onSaved:()=>Promise<unknown>}){
 const qc=useQueryClient();const [busy,setBusy]=useState(false);
 const [v,setV]=useState({drivers:row?.drivers??[],adjustments:row?.adjustments??[],adjustments_note:row?.adjustments_note??'',customer_consented:row?.customer_consented??false,review_by:row?.review_by??''});
 const toggle=(field:'drivers'|'adjustments',key:string,checked:boolean)=>setV(p=>({...p,[field]:checked?[...p[field],key]:p[field].filter(x=>x!==key)}));
 async function save(){const p=vulnerabilitySchema.safeParse({...v,review_by:v.review_by||null,source:'agent'});if(!p.success){toast.error('Check support needs and the 500-character note limit.');return;}setBusy(true);const {error}=await supabase.from('complaint_vulnerability').upsert({...p.data,org_id:org,complaint_id:id},{onConflict:'complaint_id'});setBusy(false);if(error){toast.error('Support needs could not be saved. The case may be locked.');return;}await onSaved();await qc.invalidateQueries({queryKey:['my-day',org]});await qc.invalidateQueries({queryKey:['regulatory-report',org]});toast.success('Support needs saved.');}
 return <div className="space-y-4">{reviewDue(v.review_by,zone)&&<span className="rounded bg-warning/15 px-2 py-1 text-xs text-warning">Review due</span>}<fieldset disabled={!writable||busy}><legend className="mb-2 text-sm font-medium">Drivers</legend><div className="flex flex-wrap gap-3">{Object.entries(DRIVERS).map(([key,label])=><label key={key} className="flex items-center gap-2 rounded border px-3 py-2 text-sm"><Checkbox checked={v.drivers.includes(key)} onCheckedChange={x=>toggle('drivers',key,x===true)}/>{label}</label>)}</div></fieldset><fieldset disabled={!writable||busy}><legend className="mb-2 text-sm font-medium">Adjustments</legend><div className="grid gap-3 sm:grid-cols-2">{Object.entries(ADJUSTMENTS).map(([key,label])=><label key={key} className="flex items-center gap-2 text-sm"><Checkbox checked={v.adjustments.includes(key)} onCheckedChange={x=>toggle('adjustments',key,x===true)}/>{label}</label>)}</div></fieldset><label className="block space-y-2 text-sm"><span>Support note</span><Textarea disabled={!writable||busy} maxLength={500} value={v.adjustments_note} onChange={e=>setV(p=>({...p,adjustments_note:e.target.value}))} aria-describedby="needs-hint"/></label><p id="needs-hint" className="text-xs text-muted-foreground">{SUPPORT_TEXT.supportHint}</p><label className="flex items-start gap-3 text-sm"><Checkbox disabled={!writable||busy} checked={v.customer_consented} onCheckedChange={x=>setV(p=>({...p,customer_consented:x===true}))}/>Customer agreed we record their support needs</label><label className="block space-y-2 text-sm"><span>Review by (optional)</span><Input disabled={!writable||busy} type="date" value={v.review_by} onChange={e=>setV(p=>({...p,review_by:e.target.value}))}/></label>{row&&<p className="text-xs text-muted-foreground">Source: {row.source} · Assessed {new Date(row.assessed_at).toLocaleString('en-GB',{timeZone:zone})}</p>}{writable&&<Button disabled={busy} onClick={()=>void save()}>Save support needs</Button>}</div>;
}
