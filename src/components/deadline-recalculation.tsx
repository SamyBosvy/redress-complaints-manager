import {useEffect,useState} from 'react';
import {toast} from 'sonner';
import {Button} from '@/components/ui/button';
import {Textarea} from '@/components/ui/textarea';
import {Dialog,DialogContent,DialogHeader,DialogTitle,DialogFooter} from '@/components/ui/dialog';
import {previewDeadlines,recalculateDeadlines,type DeadlineDates} from '@/lib/deadline-recalculation';
import {validRecalculationReason} from '@/lib/workspace-access';
import {formatDate} from '@/lib/letters';

const dateLabels={ack_due:'Acknowledgement',final_due:'Final response',extended_due:'Extended deadline'} as const;
export function DeadlineRecalculation({org,id,country,product,received,dates,onSaved}:{org:string;id:string;country:string;product:string;received:string;dates:DeadlineDates;onSaved:()=>Promise<unknown>}) {
  const [open,setOpen]=useState(false);
  return <><Button variant="outline" className="mt-4 w-full" onClick={()=>setOpen(true)}>Recalculate deadlines</Button>{open&&<RecalculationDialog org={org} id={id} country={country} product={product} received={received} dates={dates} onSaved={onSaved} onClose={()=>setOpen(false)}/>}</>;
}
function RecalculationDialog({org,id,country,product,received,dates,onSaved,onClose}:{org:string;id:string;country:string;product:string;received:string;dates:DeadlineDates;onSaved:()=>Promise<unknown>;onClose:()=>void}) {
  const [next,setNext]=useState<DeadlineDates|null>(null);
  const [reason,setReason]=useState('');
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const [saved,setSaved]=useState(false);
  const [old]=useState(dates);
  useEffect(()=>{let active=true;void previewDeadlines(org,country,product,received).then(d=>{if(active)setNext(d);}).catch(()=>{if(active)setError('Could not load the new deadlines. Close and try again.');});return()=>{active=false;};},[org,country,product,received]);
  async function save(e:React.FormEvent) {
    e.preventDefault();if(!next||!validRecalculationReason(reason))return;
    setBusy(true);
    try {
      await recalculateDeadlines(org,id,reason);
      // Read back the actual saved values rather than presenting the preview as authoritative.
      const {supabase}=await import('@/integrations/supabase/client');
      const result=await supabase.from('complaint_queue').select('ack_due,final_due,extended_due').eq('org_id',org).eq('id',id).single();
      setSaved(true);
      if(result.error){setNext(null);setError('Deadlines saved, but the updated dates could not be loaded. Reopen the case to check them.');}
      else setNext(result.data);
      await onSaved();toast.success('Deadlines recalculated and reason recorded.');
    } catch {setError('Could not complete recalculation. Refresh the case before trying again.');}
    finally {setBusy(false);}
  }
  return <Dialog open onOpenChange={o=>{if(!o&&!busy)onClose();}}><DialogContent className="flex max-h-[90dvh] flex-col"><DialogHeader><DialogTitle>{saved?'Deadlines updated':'Recalculate deadlines'}</DialogTitle></DialogHeader><form onSubmit={save} className="flex min-h-0 flex-col gap-4"><div className="min-h-0 overflow-y-auto space-y-4">{error&&<p role="alert" className="text-sm text-destructive">{error}</p>}{next?<div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr className="border-b"><th scope="col" className="py-2">Deadline</th><th scope="col">Old date</th><th scope="col">{saved?'Saved date':'New date'}</th></tr></thead><tbody>{(Object.keys(dateLabels) as (keyof DeadlineDates)[]).map(k=><tr key={k} className="border-b"><th scope="row" className="py-3 font-medium">{dateLabels[k]}</th><td className="px-2 tabular">{formatDate(old[k])}</td><td className="tabular">{formatDate(next[k])}</td></tr>)}</tbody></table></div>:!error&&<p role="status">Loading new dates…</p>}{!saved&&<div className="space-y-2"><label htmlFor="deadline-reason" className="text-sm font-medium">Reason for recalculation</label><Textarea id="deadline-reason" required minLength={10} maxLength={1000} value={reason} onChange={e=>setReason(e.target.value)}/></div>}</div><DialogFooter>{saved?<Button type="button" className="min-h-12 w-full" onClick={onClose}>Done</Button>:<><Button type="button" variant="outline" disabled={busy} onClick={onClose}>Cancel</Button><Button className="min-h-12" disabled={busy||!next||!validRecalculationReason(reason)}>Confirm recalculation</Button></>}</DialogFooter></form></DialogContent></Dialog>;
}