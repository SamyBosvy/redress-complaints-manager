import { useState } from 'react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';
import { detailReasonValid } from '@/lib/complaint-details';
import { previewDeadlines,type DeadlineDates } from '@/lib/deadline-recalculation';
import { CATEGORIES,PRODUCTS,LANGUAGES,CHANNELS } from '@/lib/complaints';
import { COUNTRIES } from '@/lib/countries';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import { Dialog,DialogContent,DialogHeader,DialogTitle,DialogFooter } from './ui/dialog';
import { Select,SelectContent,SelectItem,SelectTrigger,SelectValue } from './ui/select';
import { AccessibleField } from './accessible-field';
type Row=Database['public']['Tables']['complaints']['Row'];
type Case={ [K in keyof Row]?:Row[K]|null };
export function EditComplaintDetails({c,countries,onSaved}:{c:Partial<Case>&{id:string;org_id:string};countries:string[];onSaved:()=>Promise<unknown>}) {
 const [open,setOpen]=useState(false);
 return <><Button variant="outline" onClick={()=>setOpen(true)}>Edit details</Button>{open&&<Editor c={c} countries={countries} onClose={()=>setOpen(false)} onSaved={onSaved}/>}</>;
}
function Editor({c,countries,onSaved,onClose}:{c:Partial<Case>&{id:string;org_id:string};countries:string[];onSaved:()=>Promise<unknown>;onClose:()=>void}) {
 const [v,setV]=useState({complainant_name:c.complainant_name??'',complainant_email:c.complainant_email??'',complainant_phone:c.complainant_phone??'',customer_ref:c.customer_ref??'',country_code:c.country_code??'',language:c.language??'en',channel:c.channel??'email',product:c.product??'other',category:c.category??'other',summary:c.summary??'',desired_outcome:c.desired_outcome??'',received_at:c.received_at?.slice(0,16)??''});
 const [reason,setReason]=useState(''); const [busy,setBusy]=useState(false); const [next,setNext]=useState<DeadlineDates|null>(null); const [error,setError]=useState('');
 const set=(key:keyof typeof v,value:string|boolean)=>{setV(old=>({...old,[key]:value}));setNext(null);};
 const dateChanged=v.received_at!==c.received_at?.slice(0,16);
 async function save(confirm=false) {if(!detailReasonValid(reason))return;setBusy(true);setError('');try {
   if(dateChanged&&!confirm){setNext(await previewDeadlines(c.org_id,v.country_code,v.product,new Date(v.received_at+'Z').toISOString()));return;}
   const {error}=await supabase.rpc('edit_complaint_details',{_org:c.org_id,_case:c.id,_reason:reason.trim(),_patch:{...v,received_at:dateChanged?new Date(v.received_at+'Z').toISOString():c.received_at,complainant_email:v.complainant_email||null,complainant_phone:v.complainant_phone||null,customer_ref:v.customer_ref||null,desired_outcome:v.desired_outcome||null}});
   if(error)throw error;await onSaved();toast.success('Complaint details updated.');onClose();
 }catch(e){const message=e instanceof Error?e.message:typeof e==='object'&&e&&'message'in e?String(e.message):'Could not save complaint details.';setError(message);toast.error(message);}finally{setBusy(false);}}
 const picks={country_code:Object.fromEntries(countries.map(code=>[code,COUNTRIES[code]??code])),language:LANGUAGES,channel:CHANNELS,product:PRODUCTS,category:CATEGORIES};
 return <Dialog open onOpenChange={o=>{if(!o&&!busy)onClose();}}><DialogContent className="flex max-h-[90dvh] flex-col sm:max-w-2xl"><DialogHeader><DialogTitle>{next?'Confirm received date change':'Edit complaint details'}</DialogTitle></DialogHeader><form className="flex min-h-0 flex-col gap-4" onSubmit={e=>{e.preventDefault();void save(Boolean(next));}}><div className="min-h-0 overflow-y-auto space-y-4">{error&&<p role="alert" className="text-sm text-destructive">{error}</p>}{next?<><p className="text-sm">Received (UTC): {c.received_at} → {v.received_at}</p><table className="w-full text-left text-sm"><thead><tr><th>Deadline</th><th>Old</th><th>New</th></tr></thead><tbody>{(['ack_due','final_due','extended_due'] as const).map(k=><tr key={k}><th className="py-2">{{ack_due:'Acknowledgement',final_due:'Final response',extended_due:'Extended'}[k]}</th><td>{c[k]}</td><td>{next[k]}</td></tr>)}</tbody></table></>:<div className="grid gap-4 sm:grid-cols-2">{(['complainant_name','complainant_email','complainant_phone','customer_ref'] as const).map(k=><AccessibleField key={k} label={{complainant_name:'Customer name',complainant_email:'Email',complainant_phone:'Phone',customer_ref:'Customer ID'}[k]}><Input type={k==='complainant_email'?'email':'text'} required={k==='complainant_name'} maxLength={200} value={v[k]} onChange={e=>set(k,e.target.value)}/></AccessibleField>)}{Object.entries(picks).map(([k,options])=><AccessibleField key={k} label={{country_code:'Country',language:'Language',channel:'Channel',product:'Product',category:'Category'}[k as keyof typeof picks]}><Select value={String(v[k as keyof typeof v])} onValueChange={value=>set(k as keyof typeof v,value)}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent>{Object.entries(options).map(([key,label])=><SelectItem key={key} value={key}>{label}</SelectItem>)}</SelectContent></Select></AccessibleField>)}<AccessibleField label="Received date and time (UTC)"><Input type="datetime-local" required max={new Date().toISOString().slice(0,16)} value={v.received_at} onChange={e=>set('received_at',e.target.value)}/></AccessibleField>{(['summary','desired_outcome'] as const).map(k=><div key={k} className="sm:col-span-2"><AccessibleField label={k==='summary'?'Summary':'Desired outcome'}><Textarea required={k==='summary'} maxLength={5000} value={v[k]} onChange={e=>set(k,e.target.value)}/></AccessibleField></div>)}</div>}<AccessibleField label="Reason for change"><Textarea required minLength={10} maxLength={1000} value={reason} onChange={e=>setReason(e.target.value)}/></AccessibleField></div><DialogFooter><Button type="button" variant="outline" disabled={busy} onClick={next?()=>setNext(null):onClose}>{next?'Back':'Cancel'}</Button><Button className="min-h-12" disabled={busy||!detailReasonValid(reason)}>{busy?'Saving…':next?'Confirm change':'Save details'}</Button></DialogFooter></form></DialogContent></Dialog>;
}