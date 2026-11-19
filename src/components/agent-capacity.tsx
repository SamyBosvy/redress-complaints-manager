import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { capacityQuery, type Capacity } from '@/lib/workload';
import { LANGUAGES } from '@/lib/complaints';
import { supabase } from '@/integrations/supabase/client';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Checkbox } from './ui/checkbox';
import { Field } from './settings/controls';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
export function AgentCapacity({org,user,name,manager=false}:{org:string;user:string;name:string;manager?:boolean}) {
  const query=useQuery(capacityQuery(org,user));
  const [open,setOpen]=useState(false);
  return <><Button variant="outline" disabled={query.isPending||query.isError} onClick={()=>setOpen(true)}>{manager?'Edit capacity':'Availability'}</Button>{query.isError&&<p role="status">Could not load availability.</p>}<Dialog open={open} onOpenChange={setOpen}><DialogContent className="max-h-[90dvh] overflow-y-auto"><DialogHeader><DialogTitle>{name} — availability</DialogTitle></DialogHeader>{open&&<CapacityForm org={org} user={user} row={query.data??null} manager={manager} done={()=>setOpen(false)}/>}</DialogContent></Dialog></>;
}
function CapacityForm({org,user,row,manager,done}:{org:string;user:string;row:Capacity|null;manager:boolean;done:()=>void}) {
  const [cap,setCap]=useState(row?.max_open_cases?.toString()??'');const [accept,setAccept]=useState(row?.accepting_new??true);
  const [from,setFrom]=useState(row?.away_from??'');const [until,setUntil]=useState(row?.away_until??'');const [languages,setLanguages]=useState(row?.languages??[]);const [busy,setBusy]=useState(false);const qc=useQueryClient();
  async function save(e:React.FormEvent){e.preventDefault();if(until&&(!from||until<from)){toast.error('Away until must be on or after Away from.');return;}if(cap&&(!Number.isInteger(Number(cap))||Number(cap)<1||Number(cap)>500)){toast.error('Capacity must be 1–500, or blank for no cap.');return;}setBusy(true);try{
    const values={accepting_new:accept,away_from:from||null,away_until:until||null};
    const result=manager?await supabase.from('agent_capacity').upsert({org_id:org,user_id:user,...values,max_open_cases:cap?Number(cap):null,languages}):await supabase.from('agent_capacity').update(values).eq('org_id',org).eq('user_id',user).select('user_id');
    if(result.error)throw result.error;if(!manager&&Array.isArray(result.data)&&!result.data.length)throw new Error('Availability record unavailable. Ask a manager to set it up.');
    await Promise.all([qc.invalidateQueries({queryKey:['capacity',org,user]}),qc.invalidateQueries({queryKey:['workload',org]})]);toast.success('Availability saved.');done();
  }catch(e){toast.error(e instanceof Error?e.message:'Could not save availability.');}finally{setBusy(false);}}
  return <form onSubmit={save} className="space-y-4"><fieldset disabled={busy} className="space-y-4">{manager&&<Field label="Maximum open cases (blank = no cap)"><Input type="number" min={1} max={500} value={cap} onChange={e=>setCap(e.target.value)}/></Field>}<label className="flex items-center gap-2"><Checkbox checked={accept} onCheckedChange={v=>setAccept(v===true)}/>Accepting new cases</label><div className="grid gap-3 sm:grid-cols-2"><Field label="Away from"><Input type="date" value={from} onChange={e=>setFrom(e.target.value)}/></Field><Field label="Away until"><Input type="date" min={from||undefined} value={until} onChange={e=>setUntil(e.target.value)}/></Field></div>{manager&&<fieldset><legend className="mb-2 text-sm font-medium">Correspondence languages</legend><div className="grid grid-cols-2 gap-2">{Object.entries(LANGUAGES).map(([code,label])=><label key={code} className="flex items-center gap-2 text-sm"><Checkbox checked={languages.includes(code)} onCheckedChange={v=>setLanguages(previous=>v===true?[...previous,code]:previous.filter(x=>x!==code))}/>{label}</label>)}</div></fieldset>}</fieldset><div className="flex flex-wrap gap-2"><Button type="button" variant="outline" onClick={done} disabled={busy}>Cancel</Button><Button className="min-h-12 flex-1" disabled={busy}>{busy?'Saving…':'Save availability'}</Button></div></form>;
}